/* SimuWorld home · the stack, in WebGL.
   Layer 1  the economic world model: a breathing lattice of markets, institutions and space
   Layer 2  multi-agent simulation: agents flowing with trails, flashing links when they meet,
            light beams tying them to the world below
   Layer 3  the challenge: glowing track tiles rising from the simulation, plus a "+" for worlds to come
   Driven by the pinned scene's scroll progress (--p on .scene-stack). Falls back to the CSS stack
   when WebGL is unavailable or motion is reduced. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const section = document.querySelector(".scene-stack");
const host = section && section.querySelector(".stack3d");
const canvas = host && host.querySelector(".stack-gl");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = innerWidth < 760;

if (canvas && !reduce) {
  try { start(); } catch (e) { /* keep the CSS stack */ }
}

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.018);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.42, 0.22);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const ICE = new THREE.Color(0x8fd6ff), WHITE = new THREE.Color(0xe4f3ff);
  const GREEN = new THREE.Color(0x00ff88), TEAL = new THREE.Color(0x3ff2c8), VIOLET = new THREE.Color(0xb06bff), PINK = new THREE.Color(0xff5fd2);
  const Y1 = 0, Y2 = 4.2, Y3 = 8.4, HALF = 6;

  /* ---------- layer 1: the world model lattice ---------- */
  const waveGLSL = `
    float wave(vec3 p, float t) {
      float d = length(p.xz);
      return sin(p.x * 0.9 + t * 0.9) * 0.16 + cos(p.z * 0.7 - t * 0.7) * 0.16 + sin(d * 1.4 - t * 1.6) * 0.12;
    }`;
  const uni = { uTime: { value: 0 }, uReveal: { value: 0 }, uPix: { value: 1 } };
  const G = small ? 36 : 54, step = (HALF * 2) / (G - 1);
  const latPos = new Float32Array(G * G * 3), latRand = new Float32Array(G * G);
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * G + j;
    latPos[k * 3] = -HALF + i * step; latPos[k * 3 + 1] = Y1; latPos[k * 3 + 2] = -HALF + j * step;
    latRand[k] = Math.random();
  }
  const latGeo = new THREE.BufferGeometry();
  latGeo.setAttribute("position", new THREE.BufferAttribute(latPos, 3));
  latGeo.setAttribute("aRand", new THREE.BufferAttribute(latRand, 1));
  const lattice = new THREE.Points(latGeo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `${waveGLSL}
      uniform float uTime, uReveal, uPix; attribute float aRand; varying float vA;
      void main() {
        vec3 p = position; float d = length(p.xz);
        p.y += wave(p, uTime) * smoothstep(0.0, 1.0, uReveal);
        float front = uReveal * 10.5;
        vA = (1.0 - smoothstep(front - 2.5, front, d)) * (0.45 + 0.55 * aRand);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.6 + aRand * 1.6) * uPix * (24.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        gl_FragColor = vec4(vec3(0.56, 0.84, 1.0), vA * 0.55 * smoothstep(0.5, 0.0, r)); }`,
  }));
  scene.add(lattice);

  // links between nearby lattice nodes (markets, institutions, space)
  const linkCount = small ? 160 : 320, linkPos = new Float32Array(linkCount * 6), linkPhase = new Float32Array(linkCount * 2);
  for (let n = 0; n < linkCount; n++) {
    const i = Math.floor(Math.random() * (G - 4)) + 2, j = Math.floor(Math.random() * (G - 4)) + 2;
    const di = Math.floor(Math.random() * 7) - 3, dj = Math.floor(Math.random() * 7) - 3;
    const a = i * G + j, b = Math.min(G - 1, Math.max(0, i + di)) * G + Math.min(G - 1, Math.max(0, j + dj));
    for (let c = 0; c < 3; c++) { linkPos[n * 6 + c] = latPos[a * 3 + c]; linkPos[n * 6 + 3 + c] = latPos[b * 3 + c]; }
    linkPhase[n * 2] = linkPhase[n * 2 + 1] = Math.random() * 6.28;
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
  linkGeo.setAttribute("aPhase", new THREE.BufferAttribute(linkPhase, 1));
  scene.add(new THREE.LineSegments(linkGeo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `${waveGLSL}
      uniform float uTime, uReveal; attribute float aPhase; varying float vA;
      void main() { vec3 p = position; p.y += wave(p, uTime) * smoothstep(0.0, 1.0, uReveal);
        float front = uReveal * 10.5; float d = length(p.xz);
        vA = (1.0 - smoothstep(front - 3.0, front, d)) * (0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 1.8 + aPhase), 3.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(0.56, 0.84, 1.0, vA * 0.55); }`,
  })));

  const frame = (y, color, dashed) => {
    const pts = [[-HALF, y, -HALF], [HALF, y, -HALF], [HALF, y, HALF], [-HALF, y, HALF], [-HALF, y, -HALF]].map((p) => new THREE.Vector3(...p));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0 })
                       : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    const l = new THREE.Line(geo, mat); if (dashed) l.computeLineDistances(); scene.add(l); return mat;
  };
  const frame1 = frame(Y1, ICE), frame2 = frame(Y2, WHITE), frame3 = frame(Y3, ICE, true);

  /* ---------- layer 2: agents ---------- */
  const N = small ? 180 : 420, TR = 8;
  const ag = [];
  const agPos = new Float32Array(N * 3), agCol = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const roll = Math.random(), col = roll < 0.12 ? GREEN : roll < 0.24 ? VIOLET : roll < 0.34 ? TEAL : roll < 0.7 ? WHITE : ICE;
    ag.push({ x: (Math.random() * 2 - 1) * HALF * 0.9, z: (Math.random() * 2 - 1) * HALF * 0.9, a: Math.random() * 6.28, s: 0.6 + Math.random() * 0.8, trail: [], col });
    agCol.set([col.r, col.g, col.b], i * 3);
  }
  const agGeo = new THREE.BufferGeometry();
  agGeo.setAttribute("position", new THREE.BufferAttribute(agPos, 3));
  agGeo.setAttribute("color", new THREE.BufferAttribute(agCol, 3));
  const agMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture() });
  scene.add(new THREE.Points(agGeo, agMat));

  const trPos = new Float32Array(N * (TR - 1) * 6), trCol = new Float32Array(N * (TR - 1) * 6);
  const trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute("position", new THREE.BufferAttribute(trPos, 3));
  trGeo.setAttribute("color", new THREE.BufferAttribute(trCol, 3));
  const trMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.LineSegments(trGeo, trMat));

  const MAXL = small ? 80 : 180, inPos = new Float32Array(MAXL * 6), inCol = new Float32Array(MAXL * 6);
  const inGeo = new THREE.BufferGeometry();
  inGeo.setAttribute("position", new THREE.BufferAttribute(inPos, 3));
  inGeo.setAttribute("color", new THREE.BufferAttribute(inCol, 3));
  const inMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const inLines = new THREE.LineSegments(inGeo, inMat); scene.add(inLines);

  const NB = small ? 18 : 40, bmPos = new Float32Array(NB * 6), bmCol = new Float32Array(NB * 6);
  const bmGeo = new THREE.BufferGeometry();
  bmGeo.setAttribute("position", new THREE.BufferAttribute(bmPos, 3));
  bmGeo.setAttribute("color", new THREE.BufferAttribute(bmCol, 3));
  const bmMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.LineSegments(bmGeo, bmMat));

  /* ---------- layer 3: track tiles ---------- */
  const tiles = [];
  const tileDefs = [
    { c: GREEN, t1: "TRACK 1", t2: "STRATEGY AGENT" },
    { c: TEAL, t1: "TRACK 2", t2: "PROTOCOL RISK" },
    { c: VIOLET, t1: "TRACK 3", t2: "AGENTIC CITY" },
    { c: ICE, t1: "+", t2: "MORE WORLDS", ghost: true },
  ];
  tileDefs.forEach((d, i) => {
    const g = new THREE.Group();
    const w = 2.3, h = 0.28, dpt = 1.6;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), new THREE.MeshBasicMaterial({ color: d.c.clone().multiplyScalar(d.ghost ? 1 : 0.42), transparent: true, opacity: d.ghost ? 0.06 : 0.92 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), d.ghost
      ? new THREE.LineDashedMaterial({ color: d.c, dashSize: 0.12, gapSize: 0.08, transparent: true })
      : new THREE.LineBasicMaterial({ color: d.c, transparent: true }));
    if (d.ghost) edges.computeLineDistances();
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, dpt * 0.9), new THREE.MeshBasicMaterial({ map: labelTexture(d), transparent: true, depthWrite: false }));
    label.rotation.x = -Math.PI / 2; label.position.y = h / 2 + 0.01;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 1, 24, 1, true), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: d.c }, uA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying float vY; void main() { vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uA; varying float vY; void main() { gl_FragColor = vec4(uColor, uA * pow(1.0 - vY, 2.2) * 0.2); }`,
    }));
    g.add(box, edges, label); scene.add(g); scene.add(pillar);
    g.position.set(-3.75 + i * 2.5, Y2, 0);
    tiles.push({ g, box, edges, label, pillar, ghost: d.ghost, i });
  });

  /* ---------- loop ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let visible = false, p = 0, pS = 0, t = 0, last = performance.now(), frameN = 0;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { rootMargin: "200px" }).observe(host);

  const resize = () => {
    const r = canvas.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    uni.uPix.value = renderer.getPixelRatio() * Math.min(1.4, h / 600);
  };
  new ResizeObserver(resize).observe(canvas);

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (v) => 1 - Math.pow(1 - v, 3);
  const backOut = (v) => { const c = 1.6; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  const binSize = 0.9, bins = new Map();

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    t += dt; frameN++;
    p = parseFloat(section.style.getPropertyValue("--p")) || 0;
    pS += (p - pS) * (1 - Math.pow(0.002, dt));          // smoothed progress for the camera
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.pow(0.02, dt)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.pow(0.02, dt));
    const s1 = 0.18 + 0.82 * ease(clamp(pS * 3.2)), s2 = ease(clamp((pS - 0.3) * 3.2)), s3 = clamp((pS - 0.6) * 3.0), s4 = clamp((pS - 0.88) * 8);

    uni.uTime.value = t; uni.uReveal.value = s1;
    frame1.opacity = s1 * 0.6; frame2.opacity = s2 * 0.5; frame3.opacity = s3 * 0.6;

    // agents wander on a slowly turning flow field, keep a short trail, and link up when they meet
    bins.clear();
    for (let i = 0; i < N; i++) {
      const a = ag[i];
      a.a += (Math.sin(a.x * 0.45 + t * 0.4) + Math.cos(a.z * 0.5 - t * 0.33)) * dt * 0.9;
      a.x += Math.cos(a.a) * a.s * dt; a.z += Math.sin(a.a) * a.s * dt;
      if (Math.abs(a.x) > HALF * 0.95) { a.x = Math.sign(a.x) * HALF * 0.95; a.a = Math.PI - a.a; }
      if (Math.abs(a.z) > HALF * 0.95) { a.z = Math.sign(a.z) * HALF * 0.95; a.a = -a.a; }
      agPos[i * 3] = a.x; agPos[i * 3 + 1] = Y2; agPos[i * 3 + 2] = a.z;
      if (frameN % 2 === 0) { a.trail.unshift(a.x, a.z); if (a.trail.length > TR * 2) a.trail.length = TR * 2; }
      const key = Math.floor(a.x / binSize) + ":" + Math.floor(a.z / binSize);
      (bins.get(key) || bins.set(key, []).get(key)).push(i);
    }
    agGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < N; i++) {
      const a = ag[i], tr = a.trail;
      for (let k = 0; k < TR - 1; k++) {
        const o = (i * (TR - 1) + k) * 6, has = tr.length >= (k + 2) * 2;
        const x0 = has ? tr[k * 2] : a.x, z0 = has ? tr[k * 2 + 1] : a.z, x1 = has ? tr[k * 2 + 2] : a.x, z1 = has ? tr[k * 2 + 3] : a.z;
        trPos[o] = x0; trPos[o + 1] = Y2; trPos[o + 2] = z0; trPos[o + 3] = x1; trPos[o + 4] = Y2; trPos[o + 5] = z1;
        const f0 = 1 - k / (TR - 1), f1 = 1 - (k + 1) / (TR - 1);
        trCol[o] = a.col.r * f0; trCol[o + 1] = a.col.g * f0; trCol[o + 2] = a.col.b * f0;
        trCol[o + 3] = a.col.r * f1; trCol[o + 4] = a.col.g * f1; trCol[o + 5] = a.col.b * f1;
      }
    }
    trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
    let nl = 0;
    for (const list of bins.values()) {
      for (let u = 0; u < list.length && nl < MAXL; u++) for (let w = u + 1; w < list.length && nl < MAXL; w++) {
        const A = ag[list[u]], B = ag[list[w]], dx = A.x - B.x, dz = A.z - B.z, d2 = dx * dx + dz * dz;
        if (d2 > 0.5) continue;
        const f = 1 - d2 / 0.5, c = (list[u] + list[w]) % 3 === 0 ? PINK : ICE, o = nl * 6;
        inPos.set([A.x, Y2, A.z, B.x, Y2, B.z], o);
        inCol.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], o);
        nl++;
      }
    }
    inGeo.setDrawRange(0, nl * 2); inGeo.attributes.position.needsUpdate = true; inGeo.attributes.color.needsUpdate = true;
    for (let b = 0; b < NB; b++) {   // beams from a handful of agents down into the world model
      const a = ag[(b * 37) % N], fl = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.3 + b * 1.7), 2), o = b * 6;
      bmPos.set([a.x, Y2, a.z, a.x, Y1 + 0.15, a.z], o);
      bmCol.set([a.col.r * fl, a.col.g * fl, a.col.b * fl, 0, 0, 0], o);
    }
    bmGeo.attributes.position.needsUpdate = true; bmGeo.attributes.color.needsUpdate = true;
    agMat.opacity = s2; trMat.opacity = s2 * 0.75; inMat.opacity = s2 * 0.9; bmMat.opacity = s2 * 0.7;

    // tiles rise in turn from the simulation layer to the challenge layer
    tiles.forEach((tl) => {
      const k = clamp((s3 - tl.i * 0.14) / 0.55), e = k <= 0 ? 0 : backOut(k);
      const y = Y2 + (Y3 - Y2) * e + Math.sin(t * 1.2 + tl.i) * 0.06 * k;
      tl.g.position.y = y; tl.g.visible = k > 0;
      tl.g.rotation.y = (1 - k) * 0.6;
      tl.box.material.opacity = (tl.ghost ? 0.08 : 0.92) * Math.min(1, k * 1.5);
      tl.edges.material.opacity = Math.min(1, k * 1.5);
      tl.label.material.opacity = Math.min(1, k * 1.5);
      const hgt = Math.max(0.01, y - Y2);
      tl.pillar.scale.set(1, hgt, 1); tl.pillar.position.set(tl.g.position.x, Y2 + hgt / 2, 0);
      tl.pillar.material.uniforms.uA.value = tl.ghost ? k * 0.35 : k;
    });

    // camera: from a high, distant view of the world model down into an orbit around the challenge
    const theta = -0.8 + pS * 0.95 + ptr.x * 0.14 + t * 0.02;
    const phi = 0.72 - pS * 0.32 - ptr.y * 0.05;
    const rad = (31 - pS * 5 - s4 * 2) * Math.max(1, 1.3 / camera.aspect);
    const ty = 2.6 + pS * 4.6;
    camera.position.set(Math.cos(phi) * Math.sin(theta) * rad, ty + Math.sin(phi) * rad, Math.cos(phi) * Math.cos(theta) * rad);
    camera.lookAt(0, ty, 0);
    bloom.strength = 0.65 + s3 * 0.2 + s4 * 0.25;

    composer.render();
  }
  resize();
  host.classList.add("gl-on");
  requestAnimationFrame(tick);
}

function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,.6)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function labelTexture(d) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 356;
  const g = c.getContext("2d");
  g.fillStyle = d.ghost ? "rgba(143,214,255,.9)" : "rgba(236,250,255,.96)";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = (d.ghost ? "600 150px" : "600 92px") + " 'Space Grotesk', 'JetBrains Mono', sans-serif";
  g.fillText(d.t1, 256, d.ghost ? 150 : 150);
  g.font = "500 40px 'JetBrains Mono', monospace";
  g.fillText(d.t2, 256, d.ghost ? 270 : 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
