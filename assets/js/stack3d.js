/* SimuWorld home · the stack, in WebGL.
   Layer 1  the economic world model: modules (markets, firms, households, institutions, policy, space, data)
            around a world-model core, wired by pipes that carry streams of data packets
   Layer 2  multi-agent simulation: little icons (people, households, markets, firms, banks, homes, coins)
            flowing with trails, flashing links when they meet,
            light beams tying them to the world below
   Layer 3  the challenge: glowing track tiles rising from the simulation, plus a "+" for worlds to come
   Driven by the pinned scene's scroll progress (--p on .scene-stack). Falls back to the CSS stack
   when WebGL is unavailable or motion is reduced. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const section = document.querySelector(".scene-stack");
const host = section && section.querySelector(".stack3d");
const canvas = host && host.querySelector(".stack-gl");
const ghostHost = document.querySelector("#foundation");
const ghostCanvas = ghostHost && ghostHost.querySelector(".found-gl");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = innerWidth < 760;

if (canvas && !reduce) {
  try { start(); } catch (e) { /* keep the CSS stack */ }
}

function start() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.018);
  // one scene, two views: the pinned stack scene, and a faint, fully assembled backdrop behind the foundation section
  const makeView = (cv, el, dpr, ghost) => {
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !ghost, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dpr));
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.4, 0.38);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // light is the only thing drawn: alpha follows brightness, so the canvas adds glow over the page and never darkens it
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0)); }",
    }));
    const v = { cv, el, renderer, camera, composer, bloom, ghost, visible: false, pS: ghost ? 1 : 0, pix: 1, hpx: 600 };
    new IntersectionObserver((e) => { v.visible = e[0].isIntersecting; }, { rootMargin: "200px" }).observe(el);
    const resize = () => {
      const r = cv.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      v.pix = renderer.getPixelRatio() * Math.min(1.4, h / 600); v.hpx = h * renderer.getPixelRatio();
    };
    new ResizeObserver(resize).observe(cv); resize();
    return v;
  };
  const views = [makeView(canvas, host, 1.5, false)];

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
        p.y += wave(p, uTime) * 0.3 * smoothstep(0.0, 1.0, uReveal) - 0.12;
        float front = uReveal * 10.5;
        vA = (1.0 - smoothstep(front - 2.5, front, d)) * (0.45 + 0.55 * aRand);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.6 + aRand * 1.6) * uPix * (24.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        gl_FragColor = vec4(vec3(0.56, 0.84, 1.0), vA * 0.26 * smoothstep(0.5, 0.0, r)); }`,
  }));
  scene.add(lattice);

  /* modules of the world model, each with its own live state, around a core */
  const MY = Y1 + 0.1, RING = 4.3;
  const makeModule = (d, x, z, r, h, i) => {
    const g = new THREE.Group(); g.position.set(x, MY, z); g.rotation.y = Math.PI / 6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), new THREE.MeshBasicMaterial({ color: d.c.clone().multiplyScalar(0.16), transparent: true, opacity: 0 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: d.c, transparent: true, opacity: 0 }));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 6), new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = h / 2 + 0.005;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.7, r * 0.425), new THREE.MeshBasicMaterial({ map: moduleLabel(d.n, d.c), transparent: true, opacity: 0, depthWrite: false }));
    label.rotation.x = -Math.PI / 2; label.rotation.z = -Math.PI / 6; label.position.y = h / 2 + 0.02;
    g.add(body, edges, glow, label); scene.add(g);
    return { g, body, edges, glow, label, x, z, r, h, c: d.c, flash: 0, i };
  };
  const MODS = [
    { n: "MARKETS", c: GREEN }, { n: "FIRMS", c: GREEN }, { n: "HOUSEHOLDS", c: new THREE.Color(0xa9cfff) }, { n: "INSTITUTIONS", c: VIOLET },
    { n: "POLICY", c: VIOLET }, { n: "SPACE", c: TEAL }, { n: "DATA", c: TEAL },
  ];
  const core = makeModule({ n: "WORLD MODEL", c: ICE }, 0, 0, 1.55, 0.55, -1);
  const mods = MODS.map((d, i) => { const a = i / MODS.length * Math.PI * 2 + 0.35; return makeModule(d, Math.cos(a) * RING, Math.sin(a) * RING, 0.98, 0.36, i); });
  const allMods = [core].concat(mods);
  const rings = [2.0, 2.32].map((rr, k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.012, 4, 120), new THREE.MeshBasicMaterial({ color: k ? TEAL : ICE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = Math.PI / 2; m.position.y = MY; scene.add(m); return m;
  });

  // live state: a ring of bars around every module, rising and falling as it computes
  const BARS = 8, barMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), allMods.length * BARS);
  allMods.forEach((m, mi) => { for (let k = 0; k < BARS; k++) barMesh.setColorAt(mi * BARS + k, m.c); });
  scene.add(barMesh);
  const bm4 = new THREE.Matrix4(), bq = new THREE.Quaternion(), bv = new THREE.Vector3(), bs = new THREE.Vector3();

  // pipes: module <-> core (state), neighbours (trade and money), a few cross links (rules, space, data)
  const pairs = [];
  mods.forEach((m, i) => { pairs.push([core, m, ICE, true]); pairs.push([m, mods[(i + 1) % mods.length], m.c, i % 2 === 0]); });
  [[0, 4, VIOLET], [1, 6, TEAL], [2, 5, TEAL], [3, 0, VIOLET]].forEach(([a, b, c]) => pairs.push([mods[a], mods[b], c, false]));
  const SEG = 40, pipes = pairs.map(([A, B, c, bidir], j) => {
    const a = new THREE.Vector3(A.x, MY + A.h / 2, A.z), b = new THREE.Vector3(B.x, MY + B.h / 2, B.z);
    const dir = b.clone().sub(a).setY(0).normalize();
    a.addScaledVector(dir, A.r * 0.8); b.addScaledVector(dir, -B.r * 0.8);
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.45 + a.distanceTo(b) * 0.14;
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(SEG);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(line);
    return { pts, line, c, A, B, bidir, j };
  });

  // data packets with short tails stream along the pipes; an arriving packet makes its module flash
  const PER = small ? 10 : 22, TAIL = 3, packets = [];
  pipes.forEach((pp) => { for (let k = 0; k < PER; k++) packets.push({ pp, u: Math.random(), sp: 0.16 + Math.random() * 0.22, dir: pp.bidir && k % 2 ? -1 : 1 }); });
  const pkPos = new Float32Array(packets.length * TAIL * 3), pkCol = new Float32Array(packets.length * TAIL * 3);
  const pkGeo = new THREE.BufferGeometry();
  pkGeo.setAttribute("position", new THREE.BufferAttribute(pkPos, 3));
  pkGeo.setAttribute("color", new THREE.BufferAttribute(pkCol, 3));
  const pkMat = new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture() });
  scene.add(new THREE.Points(pkGeo, pkMat));
  const at = (pts, u, out, o) => {
    const f = Math.min(SEG - 1e-4, Math.max(0, u * SEG)), i0 = Math.floor(f), w = f - i0, A = pts[i0], B = pts[i0 + 1];
    out[o] = A.x + (B.x - A.x) * w; out[o + 1] = A.y + (B.y - A.y) * w; out[o + 2] = A.z + (B.z - A.z) * w;
  };

  // information rising from the modules into the agent layer above
  const RISE = 5, rsPos = new Float32Array(allMods.length * RISE * 3), rsCol = new Float32Array(allMods.length * RISE * 3);
  const rsGeo = new THREE.BufferGeometry();
  rsGeo.setAttribute("position", new THREE.BufferAttribute(rsPos, 3));
  rsGeo.setAttribute("color", new THREE.BufferAttribute(rsCol, 3));
  const rsMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture() });
  scene.add(new THREE.Points(rsGeo, rsMat));
  const shaft = new Float32Array(allMods.length * 6), shaftCol = new Float32Array(allMods.length * 6);
  allMods.forEach((m, i) => { shaft.set([m.x, MY + m.h / 2, m.z, m.x, Y2, m.z], i * 6); shaftCol.set([m.c.r * 0.7, m.c.g * 0.7, m.c.b * 0.7, 0, 0, 0], i * 6); });
  const shGeo = new THREE.BufferGeometry();
  shGeo.setAttribute("position", new THREE.BufferAttribute(shaft, 3));
  shGeo.setAttribute("color", new THREE.BufferAttribute(shaftCol, 3));
  const shMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.LineSegments(shGeo, shMat));

  const frame = (y, color, dashed) => {
    const pts = [[-HALF, y, -HALF], [HALF, y, -HALF], [HALF, y, HALF], [-HALF, y, HALF], [-HALF, y, -HALF]].map((p) => new THREE.Vector3(...p));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0 })
                       : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    const l = new THREE.Line(geo, mat); if (dashed) l.computeLineDistances(); scene.add(l); return mat;
  };
  const frame1 = frame(Y1, ICE), frame2 = frame(Y2, WHITE), frame3 = frame(Y3, ICE, true);

  /* ---------- layer 2: agents ---------- */
  // who acts in the world: people, households, markets, firms, banks, homes, money
  const GOLD = new THREE.Color(0xffc857);
  const KINDS = [
    { icon: 0, c: WHITE, w: 0.30 }, { icon: 1, c: ICE, w: 0.14 }, { icon: 2, c: GREEN, w: 0.12 }, { icon: 3, c: GREEN, w: 0.08 },
    { icon: 4, c: TEAL, w: 0.11 }, { icon: 5, c: VIOLET, w: 0.08 }, { icon: 6, c: ICE, w: 0.08 }, { icon: 7, c: GOLD, w: 0.09 },
  ];
  const N = small ? 120 : 260, TR = 8;
  const ag = [];
  const agPos = new Float32Array(N * 3), agCol = new Float32Array(N * 3), agIcon = new Float32Array(N), agSize = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let roll = Math.random(), kd = KINDS[0];
    for (const k of KINDS) { if (roll < k.w) { kd = k; break; } roll -= k.w; }
    const col = kd.c;
    ag.push({ x: (Math.random() * 2 - 1) * HALF * 0.9, z: (Math.random() * 2 - 1) * HALF * 0.9, a: Math.random() * 6.28, s: 0.45 + Math.random() * 0.6, trail: [], col, ph: Math.random() * 6.28 });
    agCol.set([col.r, col.g, col.b], i * 3); agIcon[i] = kd.icon; agSize[i] = kd.icon === 0 ? 0.9 + Math.random() * 0.2 : 1.05 + Math.random() * 0.2;
  }
  const agGeo = new THREE.BufferGeometry();
  agGeo.setAttribute("position", new THREE.BufferAttribute(agPos, 3));
  agGeo.setAttribute("color", new THREE.BufferAttribute(agCol, 3));
  agGeo.setAttribute("aIcon", new THREE.BufferAttribute(agIcon, 1));
  agGeo.setAttribute("aSize", new THREE.BufferAttribute(agSize, 1));
  const agMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: iconAtlas() }, uOpacity: { value: 0 }, uSize: { value: small ? 0.62 : 0.5 }, uH: { value: 600 } },
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec3 color; attribute float aIcon, aSize; uniform float uSize, uH; varying vec3 vC; varying float vI;
      void main() { vC = color; vI = aIcon; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * aSize * projectionMatrix[1][1] * uH * 0.5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOpacity; varying vec3 vC; varying float vI;
      void main() { vec2 cell = vec2(mod(vI, 4.0), 1.0 - floor(vI / 4.0));
        vec4 tx = texture2D(uMap, (cell + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / vec2(4.0, 2.0));
        if (tx.a < 0.02) discard; gl_FragColor = vec4(vC * (0.5 + 0.35 * tx.r), tx.a * uOpacity); }`,
  });
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

  const NB = small ? 8 : 16, bmPos = new Float32Array(NB * 6), bmCol = new Float32Array(NB * 6);
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
  let t = 0, last = performance.now(), frameN = 0;
  if (ghostCanvas) { try { views.push(makeView(ghostCanvas, ghostHost, 1, true)); ghostHost.classList.add("gl-on"); } catch (e) { /* no backdrop */ } }

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (v) => 1 - Math.pow(1 - v, 3);
  const backOut = (v) => { const c = 1.6; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  const binSize = 0.9, bins = new Map();

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden || !views.some((v) => v.visible)) return;
    t += dt; frameN++;
    const main = views[0], p = parseFloat(section.style.getPropertyValue("--p")) || 0;
    main.pS += (p - main.pS) * (1 - Math.pow(0.002, dt));          // smoothed progress for the camera
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.pow(0.02, dt)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.pow(0.02, dt));
    uni.uTime.value = t;

    // agents wander on a slowly turning flow field, keep a short trail, and link up when they meet
    bins.clear();
    for (let i = 0; i < N; i++) {
      const a = ag[i];
      a.a += (Math.sin(a.x * 0.45 + t * 0.4) + Math.cos(a.z * 0.5 - t * 0.33)) * dt * 0.9;
      a.x += Math.cos(a.a) * a.s * dt; a.z += Math.sin(a.a) * a.s * dt;
      if (Math.abs(a.x) > HALF * 0.95) { a.x = Math.sign(a.x) * HALF * 0.95; a.a = Math.PI - a.a; }
      if (Math.abs(a.z) > HALF * 0.95) { a.z = Math.sign(a.z) * HALF * 0.95; a.a = -a.a; }
      agPos[i * 3] = a.x; agPos[i * 3 + 1] = Y2 + 0.24 + Math.abs(Math.sin(t * 5 * a.s + a.ph)) * 0.06; agPos[i * 3 + 2] = a.z;
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

    // the world model at work: packets travel, modules flash on arrival, information rises
    for (let n = 0; n < packets.length; n++) {
      const k = packets[n], pp = k.pp;
      k.u += k.sp * dt * k.dir;
      if (k.u > 1 || k.u < 0) { k.u -= k.dir; (k.dir > 0 ? pp.B : pp.A).flash = 1; }
      for (let q = 0; q < TAIL; q++) {
        const o = (n * TAIL + q) * 3, f = q === 0 ? 1 : q === 1 ? 0.45 : 0.18;
        at(pp.pts, k.u - q * 0.025 * k.dir, pkPos, o);
        pkCol[o] = pp.c.r * f; pkCol[o + 1] = pp.c.g * f; pkCol[o + 2] = pp.c.b * f;
      }
    }
    pkGeo.attributes.position.needsUpdate = true; pkGeo.attributes.color.needsUpdate = true;
    allMods.forEach((m, i) => {
      m.flash *= Math.pow(0.03, dt);
      for (let q = 0; q < RISE; q++) {
        const u = (t * 0.32 + q / RISE + i * 0.137) % 1, o = (i * RISE + q) * 3, f = Math.sin(u * Math.PI);
        rsPos[o] = m.x; rsPos[o + 1] = MY + m.h / 2 + (Y2 - MY - m.h / 2) * u; rsPos[o + 2] = m.z;
        rsCol[o] = m.c.r * f; rsCol[o + 1] = m.c.g * f; rsCol[o + 2] = m.c.b * f;
      }
    });
    rsGeo.attributes.position.needsUpdate = true; rsGeo.attributes.color.needsUpdate = true;
    rings[0].rotation.z = t * 0.25; rings[1].rotation.z = -t * 0.18;

    for (const v of views) if (v.visible) { pose(v); v.composer.render(); }
  }

  function pose(v) {
    const pS = v.pS, camera = v.camera;
    const s1 = 0.18 + 0.82 * ease(clamp(pS * 3.2)), s2 = ease(clamp((pS - 0.3) * 3.2)), s3 = clamp((pS - 0.6) * 3.0), s4 = clamp((pS - 0.88) * 8);
    uni.uReveal.value = s1; uni.uPix.value = v.pix;
    frame1.opacity = s1 * 0.6; frame2.opacity = s2 * 0.5; frame3.opacity = s3 * 0.6;
    agMat.uniforms.uOpacity.value = s2 * (1 - 0.35 * s3); agMat.uniforms.uH.value = v.hpx; trMat.opacity = s2 * 0.75; inMat.opacity = s2 * 0.9; bmMat.opacity = s2 * 0.7;

    // modules rise out of the floor one by one, pipes connect, then data starts to flow
    allMods.forEach((m, mi) => {
      const k = clamp((s1 - 0.22 - (m.i + 1) * 0.045) / 0.28), e = ease(k);
      const y = MY - (1 - e) * 1.1;
      m.g.position.y = y; m.g.visible = k > 0;
      m.body.material.opacity = 0.92 * k; m.edges.material.opacity = Math.min(1, 0.55 + m.flash * 0.6) * k;
      m.label.material.opacity = k; m.glow.material.opacity = (0.05 + m.flash * 0.3) * k;
      for (let q = 0; q < BARS; q++) {
        const a = q / BARS * Math.PI * 2 + 0.2, rr = m.r + 0.2;
        const hb = (0.08 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * (1.1 + q * 0.37) + mi * 2.1 + q), 2) * (1 + m.flash)) * (m.i < 0 ? 1.4 : 1) * e;
        bv.set(m.x + Math.cos(a) * rr, y - m.h / 2, m.z + Math.sin(a) * rr); bs.set(1, Math.max(0.001, hb + m.h * 0.8), 1);
        barMesh.setMatrixAt(mi * BARS + q, bm4.compose(bv, bq, bs));
      }
    });
    barMesh.instanceMatrix.needsUpdate = true; barMesh.material.opacity = clamp((s1 - 0.3) / 0.3) * 0.8;
    rings.forEach((r) => { r.material.opacity = clamp((s1 - 0.25) / 0.3) * 0.55; });
    pipes.forEach((pp) => {
      const k = clamp((s1 - 0.42 - pp.j * 0.01) / 0.26);
      pp.line.geometry.setDrawRange(0, Math.ceil(k * (SEG + 1))); pp.line.material.opacity = 0.6 * k;
    });
    pkMat.opacity = clamp((s1 - 0.6) / 0.25);
    rsMat.opacity = s2 * 0.9; shMat.opacity = s2 * 0.35;

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

    // camera: from a high, distant view of the world model down into an orbit around the challenge;
    // the backdrop keeps orbiting slowly around the finished stack
    const theta = v.ghost ? 0.4 + t * 0.06 + ptr.x * 0.08 : -0.8 + pS * 0.95 + ptr.x * 0.14 + t * 0.02;
    const phi = 0.72 - pS * 0.32 - ptr.y * 0.05;
    const rad = (14 + ease(clamp((pS - 0.26) * 2.4)) * 6 + ease(clamp((pS - 0.6) * 2.6)) * 8 - clamp((pS - 0.5) * 2) * 3 - s4 * 2) * Math.max(1, 1.3 / camera.aspect);
    const ty = 0.2 + ease(clamp((pS - 0.28) * 1.45)) * 6.8;
    camera.position.set(Math.cos(phi) * Math.sin(theta) * rad, ty + Math.sin(phi) * rad, Math.cos(phi) * Math.cos(theta) * rad);
    camera.lookAt(0, ty, 0);
    v.bloom.strength = 0.6 + s3 * 0.1 + s4 * 0.1;
  }
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

// eight white glyphs on a 4 x 2 atlas: person, household, candlesticks, rising chart, factory, bank, home, coin
function iconAtlas() {
  const S = 128, c = document.createElement("canvas"); c.width = S * 4; c.height = S * 2;
  const g = c.getContext("2d");
  g.fillStyle = g.strokeStyle = "#fff"; g.lineCap = g.lineJoin = "round";
  const cell = (i, draw) => { g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S); g.shadowColor = "rgba(255,255,255,.9)"; g.shadowBlur = 6; draw(); g.restore(); };
  const person = (x, y, k) => { g.beginPath(); g.arc(x, y - 30 * k, 14 * k, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - 24 * k, y + 34 * k); g.quadraticCurveTo(x - 24 * k, y - 10 * k, x, y - 10 * k); g.quadraticCurveTo(x + 24 * k, y - 10 * k, x + 24 * k, y + 34 * k); g.closePath(); g.fill(); };
  cell(0, () => person(64, 66, 1.25));
  cell(1, () => { person(44, 70, 1); person(86, 74, 0.82); person(66, 90, 0.55); });
  cell(2, () => { g.lineWidth = 5; [[30, 40, 84, 52, 72], [56, 30, 70, 38, 62], [82, 48, 96, 56, 88], [104, 20, 60, 28, 50]].forEach(([x, top, bot, o, cl]) => {
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot + 14); g.stroke(); g.fillRect(x - 9, Math.min(o, cl), 18, Math.abs(cl - o) + 10); }); });
  cell(3, () => { g.lineWidth = 9; g.beginPath(); g.moveTo(18, 100); g.lineTo(46, 70); g.lineTo(68, 84); g.lineTo(108, 34); g.stroke();
    g.beginPath(); g.moveTo(84, 30); g.lineTo(112, 28); g.lineTo(110, 56); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(14, 112); g.lineTo(116, 112); g.stroke(); });
  cell(4, () => { g.beginPath(); g.moveTo(14, 112); g.lineTo(14, 60); g.lineTo(44, 78); g.lineTo(44, 60); g.lineTo(74, 78); g.lineTo(74, 30); g.lineTo(94, 30); g.lineTo(94, 18); g.lineTo(108, 18); g.lineTo(108, 112); g.closePath(); g.fill(); });
  cell(5, () => { g.beginPath(); g.moveTo(64, 14); g.lineTo(116, 44); g.lineTo(12, 44); g.closePath(); g.fill(); g.fillRect(14, 104, 100, 10);
    [24, 48, 72, 96].forEach((x) => g.fillRect(x, 52, 10, 46)); });
  cell(6, () => { g.beginPath(); g.moveTo(64, 16); g.lineTo(114, 60); g.lineTo(100, 60); g.lineTo(100, 112); g.lineTo(28, 112); g.lineTo(28, 60); g.lineTo(14, 60); g.closePath(); g.fill();
    g.globalCompositeOperation = "destination-out"; g.fillRect(54, 80, 20, 32); g.globalCompositeOperation = "source-over"; });
  cell(7, () => { g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill(); g.globalCompositeOperation = "destination-out";
    g.font = "700 62px 'Inter', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 64, 68); g.globalCompositeOperation = "source-over";
    g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.globalCompositeOperation = "destination-out"; g.stroke(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function moduleLabel(text, color) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.shadowColor = "rgb(" + [color.r, color.g, color.b].map((v) => Math.round(v * 255)).join(",") + ")"; g.shadowBlur = 18;
  g.fillStyle = "#f2fbff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "700 " + (text.length > 10 ? 50 : 62) + "px 'JetBrains Mono', monospace";
  if ("letterSpacing" in g) g.letterSpacing = "4px";
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
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
