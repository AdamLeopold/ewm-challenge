/* SimuWorld home · the economic world model, in WebGL.
   Four layers, bottom to top:
     L1  Intelligence foundation: an LLM network (beliefs, reasoning, language) and an RL loop (goals, adaptation)
     L2  Economic agents: little icons (people, households, markets, firms, banks, homes, money) moving and meeting
     L3  Economic environment & institutions: mechanism modules around market clearing, wired by pipes of data
     L4  Equilibrium & reality discipline: behaviour, data and the learned environment in a loop that settles
         into a fixed point, with real data flowing in from outside
   Around it all, the SimuWorld Challenge: track tiles orbiting the model; your agent flies in from outside.
   The pinned scene's scroll progress (--p on .scene-stack) drives the reveal and the camera, which visits
   each layer in turn and then pulls out; once the model is complete it can be dragged around.
   A faint copy of the finished model also turns behind the foundation section.
   Falls back to the CSS stack when WebGL is unavailable or motion is reduced. */
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
  // labels are drawn into textures, so give the web fonts a moment to arrive first
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(() => { try { start(); } catch (e) { /* keep the CSS stack */ } });
}

function start() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  // one scene, two views: the pinned scene, and the faint backdrop behind the foundation section
  const makeView = (cv, el, dpr, ghost) => {
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !ghost, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dpr));
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
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

  const ICE = new THREE.Color(0x8fd6ff), WHITE = new THREE.Color(0xe4f3ff), SKY = new THREE.Color(0xa9cfff);
  const GREEN = new THREE.Color(0x00ff88), TEAL = new THREE.Color(0x3ff2c8), VIOLET = new THREE.Color(0xb06bff);
  const PINK = new THREE.Color(0xff5fd2), GOLD = new THREE.Color(0xffc857);
  const Y1 = 0, Y2 = 3.6, Y3 = 7.2, Y4 = 10.8, HALF = 6, RING_R = 9.6, RING_Y = 5.4;
  const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const dot = dotTexture();
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (v) => 1 - Math.pow(1 - v, 3);
  const backOut = (v) => { const c = 1.6; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };

  /* ---------- shared building blocks ---------- */
  // a flat text label lying on a layer, facing up
  const flatLabel = (title, sub, color, w, x, y, z, rotZ) => {
    const tex = labelTex(title, sub, color), h = w * tex.image.height / tex.image.width;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotZ || 0; m.position.set(x, y, z); scene.add(m); return m.material;
  };
  // a square outline marking a layer
  const frame = (y, color, dashed) => {
    const pts = [[-HALF, y, -HALF], [HALF, y, -HALF], [HALF, y, HALF], [-HALF, y, HALF], [-HALF, y, -HALF]].map((p) => new THREE.Vector3(...p));
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0 })
                       : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); if (dashed) l.computeLineDistances(); scene.add(l); return mat;
  };
  // an arched pipe from a to b; returns its sampled points and its line material
  const SEG = 40;
  const pipe = (a, b, color, lift, opacity) => {
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += lift;
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(SEG);
    const mat = new THREE.LineBasicMaterial({ color, ...ADD, opacity: 0 });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); scene.add(line);
    return { pts, line, mat, c: color, base: opacity == null ? 0.6 : opacity };
  };
  const at = (pts, u, out, o) => {
    const f = Math.min(SEG - 1e-4, Math.max(0, u * SEG)), i0 = Math.floor(f), w = f - i0, A = pts[i0], B = pts[i0 + 1];
    out[o] = A.x + (B.x - A.x) * w; out[o + 1] = A.y + (B.y - A.y) * w; out[o + 2] = A.z + (B.z - A.z) * w;
  };
  // glowing packets with short tails travelling along a set of pipes
  const packets = (pipes, per, size) => {
    const TAIL = 3, list = [];
    pipes.forEach((pp) => { for (let k = 0; k < per; k++) list.push({ pp, u: Math.random(), sp: 0.14 + Math.random() * 0.2, dir: pp.bidir && k % 2 ? -1 : 1 }); });
    const pos = new Float32Array(list.length * TAIL * 3), col = new Float32Array(list.length * TAIL * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, ...ADD, opacity: 0, map: dot });
    scene.add(new THREE.Points(geo, mat));
    return {
      mat,
      update(dt) {
        for (let n = 0; n < list.length; n++) {
          const k = list[n], pp = k.pp;
          k.u += k.sp * dt * k.dir;
          if (k.u > 1 || k.u < 0) { k.u -= k.dir; const m = k.dir > 0 ? pp.B : pp.A; if (m) m.flash = 1; }
          for (let q = 0; q < TAIL; q++) {
            const o = (n * TAIL + q) * 3, f = q === 0 ? 1 : q === 1 ? 0.45 : 0.18;
            at(pp.pts, k.u - q * 0.025 * k.dir, pos, o);
            col[o] = pp.c.r * f; col[o + 1] = pp.c.g * f; col[o + 2] = pp.c.b * f;
          }
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
    };
  };
  // light travelling straight up (or down) between layers, along faint shafts
  const risers = (anchors, per, speed) => {
    const pos = new Float32Array(anchors.length * per * 3), col = new Float32Array(anchors.length * per * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.17, vertexColors: true, ...ADD, opacity: 0, map: dot });
    scene.add(new THREE.Points(geo, mat));
    const sh = new Float32Array(anchors.length * 6), shc = new Float32Array(anchors.length * 6), sgeo = new THREE.BufferGeometry();
    anchors.forEach((a, i) => { sh.set([a.x, a.y0, a.z, a.x, a.y1, a.z], i * 6); shc.set([a.c.r * 0.6, a.c.g * 0.6, a.c.b * 0.6, a.c.r * 0.1, a.c.g * 0.1, a.c.b * 0.1], i * 6); });
    sgeo.setAttribute("position", new THREE.BufferAttribute(sh, 3)); sgeo.setAttribute("color", new THREE.BufferAttribute(shc, 3));
    const smat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
    scene.add(new THREE.LineSegments(sgeo, smat));
    return {
      mat, smat,
      update(t) {
        anchors.forEach((a, i) => {
          for (let q = 0; q < per; q++) {
            const u = (t * speed + q / per + i * 0.137) % 1, o = (i * per + q) * 3, f = Math.sin(u * Math.PI);
            pos[o] = a.x; pos[o + 1] = a.y0 + (a.y1 - a.y0) * u; pos[o + 2] = a.z;
            col[o] = a.c.r * f; col[o + 1] = a.c.g * f; col[o + 2] = a.c.b * f;
          }
        });
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
    };
  };
  // a hexagonal module with a live ring of bars and a label on top
  const mods3 = [];
  const makeModule = (d, x, y, z, r, h) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.PI / 6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), new THREE.MeshBasicMaterial({ color: d.c.clone().multiplyScalar(0.16), transparent: true, opacity: 0 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: d.c, transparent: true, opacity: 0 }));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 6), new THREE.MeshBasicMaterial({ color: d.c, ...ADD, opacity: 0 }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = h / 2 + 0.005;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.7, r * 0.425), new THREE.MeshBasicMaterial({ map: moduleLabel(d.n, d.c), transparent: true, opacity: 0, depthWrite: false }));
    label.rotation.x = -Math.PI / 2; label.rotation.z = -Math.PI / 6; label.position.y = h / 2 + 0.02;
    g.add(body, edges, glow, label); scene.add(g);
    return { g, body, edges, glow, label, x, y, z, r, h, c: d.c, flash: 0 };
  };
  const BARS = 8, bm4 = new THREE.Matrix4(), bq = new THREE.Quaternion(), bv = new THREE.Vector3(), bs = new THREE.Vector3();
  const barsFor = (list) => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ ...ADD, opacity: 0 }), list.length * BARS);
    list.forEach((m, mi) => { for (let k = 0; k < BARS; k++) mesh.setColorAt(mi * BARS + k, m.c); });
    scene.add(mesh); return mesh;
  };
  // reveal a module (k: 0..1 rising out of its layer), dimmed by f
  const poseModule = (m, k, f, t, mi, bars, big) => {
    const e = ease(k), y = m.y - (1 - e) * 1.1;
    m.g.position.y = y; m.g.visible = k > 0;
    m.body.material.opacity = 0.92 * k * (0.12 + 0.88 * f); m.edges.material.opacity = Math.min(1, 0.55 + m.flash * 0.6) * k * f;
    m.label.material.opacity = k * (0.15 + 0.85 * f); m.glow.material.opacity = (0.05 + m.flash * 0.3) * k * f;
    for (let q = 0; q < BARS; q++) {
      const a = q / BARS * Math.PI * 2 + 0.2, rr = m.r + 0.2;
      const hb = (0.08 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * (1.1 + q * 0.37) + mi * 2.1 + q), 2) * (1 + m.flash)) * (big ? 1.4 : 1) * e;
      bv.set(m.x + Math.cos(a) * rr, y - m.h / 2, m.z + Math.sin(a) * rr); bs.set(1, Math.max(0.001, hb + m.h * 0.8), 1);
      bars.setMatrixAt(mi * BARS + q, bm4.compose(bv, bq, bs));
    }
  };

  /* ---------- L1 · intelligence foundation ---------- */
  const uni = { uTime: { value: 0 }, uReveal: { value: 0 }, uPix: { value: 1 }, uDim: { value: 1 } };
  const G = small ? 32 : 46, step = (HALF * 2) / (G - 1);
  const latPos = new Float32Array(G * G * 3), latRand = new Float32Array(G * G);
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * G + j; latPos[k * 3] = -HALF + i * step; latPos[k * 3 + 1] = Y1; latPos[k * 3 + 2] = -HALF + j * step; latRand[k] = Math.random();
  }
  const latGeo = new THREE.BufferGeometry();
  latGeo.setAttribute("position", new THREE.BufferAttribute(latPos, 3)); latGeo.setAttribute("aRand", new THREE.BufferAttribute(latRand, 1));
  scene.add(new THREE.Points(latGeo, new THREE.ShaderMaterial({
    uniforms: uni, ...ADD,
    vertexShader: `
      uniform float uTime, uReveal, uPix; attribute float aRand; varying float vA;
      void main() { vec3 p = position; float d = length(p.xz);
        p.y += (sin(p.x * 0.9 + uTime * 0.9) + cos(p.z * 0.7 - uTime * 0.7)) * 0.04 - 0.1;
        float front = uReveal * 10.5; vA = (1.0 - smoothstep(front - 2.5, front, d)) * (0.45 + 0.55 * aRand);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.6 + aRand * 1.6) * uPix * (24.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uDim; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vec3(0.56, 0.84, 1.0), vA * 0.24 * uDim * smoothstep(0.5, 0.0, r)); }`,
  })));
  // the LLM: a layered network; the RL loop: an agent-environment cycle around a policy node
  const nn = { nodes: [], edges: [] }, NY = Y1 + 0.35;
  const cols = [3, 5, 5, 3];
  cols.forEach((n, ci) => { for (let k = 0; k < n; k++) nn.nodes.push({ x: -4.6 + ci * 1.2, y: NY + (k % 2) * 0.12, z: (k - (n - 1) / 2) * 0.9, c: ICE, col: ci }); });
  let off = 0;
  cols.forEach((n, ci) => { if (ci < cols.length - 1) { for (let a = 0; a < n; a++) for (let b = 0; b < cols[ci + 1]; b++) nn.edges.push([off + a, off + n + b]); } off += n; });
  const rl = { nodes: [], edges: [] }, RLX = 2.9, RLR = 1.6;
  rl.nodes.push({ x: RLX, y: NY + 0.2, z: 0, c: GREEN });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; rl.nodes.push({ x: RLX + Math.cos(a) * RLR, y: NY, z: Math.sin(a) * RLR, c: GREEN }); }
  for (let k = 1; k <= 6; k++) { rl.edges.push([k, k % 6 + 1]); rl.edges.push([0, k]); }
  const l1Nodes = nn.nodes.concat(rl.nodes);
  const ndPos = new Float32Array(l1Nodes.length * 3), ndCol = new Float32Array(l1Nodes.length * 3);
  l1Nodes.forEach((n, i) => { ndPos.set([n.x, n.y, n.z], i * 3); ndCol.set([n.c.r, n.c.g, n.c.b], i * 3); });
  const ndGeo = new THREE.BufferGeometry();
  ndGeo.setAttribute("position", new THREE.BufferAttribute(ndPos, 3)); ndGeo.setAttribute("color", new THREE.BufferAttribute(ndCol, 3));
  const ndMat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(ndGeo, ndMat));
  const v3 = (n) => new THREE.Vector3(n.x, n.y, n.z);
  const l1Pipes = [];
  nn.edges.forEach(([a, b], i) => { const pp = pipe(v3(nn.nodes[a]), v3(nn.nodes[b]), ICE, 0.05, 0.22); pp.ordered = i; l1Pipes.push(pp); });
  rl.edges.forEach(([a, b], i) => { const pp = pipe(v3(rl.nodes[a]), v3(rl.nodes[b]), GREEN, a === 0 ? 0.05 : 0.35, a === 0 ? 0.25 : 0.55); pp.ordered = nn.edges.length + i; l1Pipes.push(pp); });
  const l1Flow = packets(l1Pipes.filter((pp, i) => i % 3 === 0 || pp.c === GREEN), small ? 2 : 3, 0.3);
  const l1Labels = [
    flatLabel("LLM", "BELIEFS · REASONING · LANGUAGE", ICE, 3.6, -2.9, Y1 + 0.02, 2.9),
    flatLabel("RL", "GOALS · OPTIMISATION · ADAPTATION", GREEN, 3.6, RLX - 0.2, Y1 + 0.02, 2.9),
  ];
  const l1Up = risers([0, 3, 8, 11, 14, 17, 19, 21].map((i) => { const n = l1Nodes[i % l1Nodes.length]; return { x: n.x, z: n.z, y0: n.y, y1: Y2, c: n.c }; }), 4, 0.28);

  /* ---------- L2 · economic agents ---------- */
  const KINDS = [
    { icon: 0, c: WHITE, w: 0.30 }, { icon: 1, c: ICE, w: 0.14 }, { icon: 2, c: GREEN, w: 0.12 }, { icon: 3, c: GREEN, w: 0.08 },
    { icon: 4, c: TEAL, w: 0.11 }, { icon: 5, c: VIOLET, w: 0.08 }, { icon: 6, c: ICE, w: 0.08 }, { icon: 7, c: GOLD, w: 0.09 },
  ];
  const N = small ? 70 : 140, TR = 8;
  const ag = [];
  const agPos = new Float32Array(N * 3), agCol = new Float32Array(N * 3), agIcon = new Float32Array(N), agSize = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let roll = Math.random(), kd = KINDS[0];
    for (const k of KINDS) { if (roll < k.w) { kd = k; break; } roll -= k.w; }
    ag.push({ x: (Math.random() * 2 - 1) * HALF * 0.9, z: (Math.random() * 2 - 1) * HALF * 0.9, a: Math.random() * 6.28, s: 0.45 + Math.random() * 0.6, trail: [], col: kd.c, ph: Math.random() * 6.28 });
    agCol.set([kd.c.r, kd.c.g, kd.c.b], i * 3); agIcon[i] = kd.icon; agSize[i] = kd.icon === 0 ? 0.9 + Math.random() * 0.2 : 1.05 + Math.random() * 0.2;
  }
  const agGeo = new THREE.BufferGeometry();
  agGeo.setAttribute("position", new THREE.BufferAttribute(agPos, 3)); agGeo.setAttribute("color", new THREE.BufferAttribute(agCol, 3));
  agGeo.setAttribute("aIcon", new THREE.BufferAttribute(agIcon, 1)); agGeo.setAttribute("aSize", new THREE.BufferAttribute(agSize, 1));
  const agMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: iconAtlas() }, uOpacity: { value: 0 }, uSize: { value: small ? 0.62 : 0.52 }, uH: { value: 600 } },
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
  const trPos = new Float32Array(N * (TR - 1) * 6), trCol = new Float32Array(N * (TR - 1) * 6), trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute("position", new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute("color", new THREE.BufferAttribute(trCol, 3));
  const trMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(trGeo, trMat));
  const MAXL = small ? 40 : 90, inPos = new Float32Array(MAXL * 6), inCol = new Float32Array(MAXL * 6), inGeo = new THREE.BufferGeometry();
  inGeo.setAttribute("position", new THREE.BufferAttribute(inPos, 3)); inGeo.setAttribute("color", new THREE.BufferAttribute(inCol, 3));
  const inMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(inGeo, inMat));

  /* ---------- L3 · economic environment & institutions ---------- */
  const MODS = [
    { n: "AUCTIONS", c: GREEN }, { n: "MATCHING", c: TEAL }, { n: "PRICES", c: GREEN }, { n: "ACCOUNTING", c: SKY },
    { n: "BUDGETS", c: SKY }, { n: "POLICY RULES", c: VIOLET }, { n: "INSTITUTIONS", c: VIOLET },
  ];
  const core = makeModule({ n: "MARKET CLEARING", c: ICE }, 0, Y3 + 0.1, 0, 1.55, 0.55);
  const mods = MODS.map((d, i) => { const a = i / MODS.length * Math.PI * 2 + 0.35; return makeModule(d, Math.cos(a) * 4.3, Y3 + 0.1, Math.sin(a) * 4.3, 0.98, 0.36); });
  const l3Mods = [core].concat(mods), l3Bars = barsFor(l3Mods);
  const rings = [2.0, 2.32].map((rr, k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.012, 4, 120), new THREE.MeshBasicMaterial({ color: k ? TEAL : ICE, ...ADD, opacity: 0 }));
    m.rotation.x = Math.PI / 2; m.position.y = Y3 + 0.1; scene.add(m); return m;
  });
  const top = (m) => new THREE.Vector3(m.x, m.y + m.h / 2, m.z);
  const edgePipe = (A, B, c, bidir) => {
    const a = top(A), b = top(B), dir = b.clone().sub(a).setY(0).normalize();
    a.addScaledVector(dir, A.r * 0.8); b.addScaledVector(dir, -B.r * 0.8);
    const pp = pipe(a, b, c, 0.45 + a.distanceTo(b) * 0.14); pp.A = A; pp.B = B; pp.bidir = bidir; return pp;
  };
  const l3Pipes = [];
  mods.forEach((m, i) => { l3Pipes.push(edgePipe(core, m, ICE, true)); l3Pipes.push(edgePipe(m, mods[(i + 1) % mods.length], m.c, i % 2 === 0)); });
  [[0, 5, VIOLET], [1, 3, TEAL], [2, 4, SKY], [6, 0, VIOLET]].forEach(([a, b, c]) => l3Pipes.push(edgePipe(mods[a], mods[b], c, false)));
  l3Pipes.forEach((pp, j) => { pp.ordered = j; });
  const l3Flow = packets(l3Pipes, small ? 8 : 16, 0.4);
  const l2Up = risers(l3Mods.map((m) => ({ x: m.x, z: m.z, y0: Y2 + 0.3, y1: m.y - m.h / 2, c: m.c })), 4, 0.3);

  /* ---------- L4 · equilibrium & reality discipline ---------- */
  const TRI = [{ n: "BEHAVIOUR", c: WHITE }, { n: "DATA", c: TEAL }, { n: "LEARNED ENV", c: VIOLET }];
  const l4Mods = TRI.map((d, i) => { const a = -Math.PI / 2 + i / 3 * Math.PI * 2; return makeModule(d, Math.cos(a) * 3.1, Y4, Math.sin(a) * 3.1, 0.82, 0.3); });
  const l4Bars = barsFor(l4Mods);
  const l4Pipes = l4Mods.map((m, i) => { const pp = edgePipe(m, l4Mods[(i + 1) % 3], m.c, false); pp.ordered = i; return pp; });
  const realStart = new THREE.Vector3(11.5, Y4 + 2.6, -6.5);
  const realPipe = pipe(realStart, top(l4Mods[1]), GOLD, 1.2, 0.5); realPipe.B = l4Mods[1]; realPipe.ordered = 3;
  const l4Flow = packets(l4Pipes.concat([realPipe]), small ? 8 : 14, 0.42);
  const realLabel = flatLabel("REAL DATA", "EXTERNAL CALIBRATION", GOLD, 3.6, 10.2, Y4 + 2.4, -4.6, 0.5);
  const fixLabel = flatLabel("DDGE", "FIXED POINT", WHITE, 2.4, 0, Y4 + 0.02, 1.25);
  // the fixed point: particles spiralling in to a bright, breathing centre
  const VN = small ? 90 : 180, vx = [];
  for (let i = 0; i < VN; i++) vx.push({ a0: Math.random() * 6.28, k: Math.random(), sp: 0.12 + Math.random() * 0.1 });
  const vxPos = new Float32Array(VN * 3), vxCol = new Float32Array(VN * 3), vxGeo = new THREE.BufferGeometry();
  vxGeo.setAttribute("position", new THREE.BufferAttribute(vxPos, 3)); vxGeo.setAttribute("color", new THREE.BufferAttribute(vxCol, 3));
  const vxMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(vxGeo, vxMat));
  const fpGeo = new THREE.BufferGeometry(); fpGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, Y4 + 0.35, 0]), 3));
  const fpMat = new THREE.PointsMaterial({ size: 1.4, color: WHITE, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(fpGeo, fpMat));
  const l3Up = risers([{ x: 0, z: 0, y0: Y3 + 0.4, y1: Y4 + 0.3, c: ICE }].concat(l4Mods.map((m) => ({ x: m.x, z: m.z, y0: Y3 + 0.2, y1: m.y - m.h / 2, c: m.c }))), 5, 0.26);
  // feedback: the settled behaviour flows back down into the agents
  const fbStart = l4Mods[0], fbGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(fbStart.x, Y4 - 0.2, fbStart.z), new THREE.Vector3(fbStart.x * 1.5, Y2 + 0.3, fbStart.z * 1.5)]);
  const fbMat = new THREE.LineDashedMaterial({ color: WHITE, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0 });
  const fbLine = new THREE.Line(fbGeo, fbMat); fbLine.computeLineDistances(); scene.add(fbLine);
  const l4Down = risers([{ x: fbStart.x, z: fbStart.z, y0: Y4 - 0.2, y1: Y2 + 0.3, c: WHITE }], 6, 0.2);

  const frames = [frame(Y1, ICE), frame(Y2, WHITE), frame(Y3, ICE), frame(Y4, ICE, true)];
  const tags = [
    flatLabel("L1", "INTELLIGENCE FOUNDATION", ICE, 3.8, -HALF + 1.9, Y1 + 0.02, HALF + 0.75),
    flatLabel("L2", "ECONOMIC AGENTS", WHITE, 3.8, -HALF + 1.9, Y2 + 0.02, HALF + 0.75),
    flatLabel("L3", "ENVIRONMENT & INSTITUTIONS", ICE, 3.8, -HALF + 1.9, Y3 + 0.02, HALF + 0.75),
    flatLabel("L4", "EQUILIBRIUM & REALITY", ICE, 3.8, -HALF + 1.9, Y4 + 0.02, HALF + 0.75),
  ];

  /* ---------- outer layer · SimuWorld Challenge ---------- */
  const ringPts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * RING_R, RING_Y, Math.sin(a) * RING_R)); }
  const ringMat = new THREE.LineDashedMaterial({ color: ICE, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0 });
  const ringLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), ringMat); ringLine.computeLineDistances(); scene.add(ringLine);
  const ringLabel = flatLabel("SIMUWORLD CHALLENGE", "YOUR AGENT ENTERS FROM OUTSIDE", ICE, 6.4, 0, RING_Y - 0.02, RING_R + 1.4);
  const tiles = [];
  [{ c: GREEN, t1: "TRACK 1", t2: "STRATEGY AGENT" }, { c: TEAL, t1: "TRACK 2", t2: "PROTOCOL RISK" },
   { c: VIOLET, t1: "TRACK 3", t2: "AGENTIC CITY" }, { c: ICE, t1: "+", t2: "MORE WORLDS", ghost: true }].forEach((d, i) => {
    const g = new THREE.Group(), w = 2.3, h = 0.28, dpt = 1.6;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), new THREE.MeshBasicMaterial({ color: d.c.clone().multiplyScalar(d.ghost ? 1 : 0.42), transparent: true, opacity: 0 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), d.ghost
      ? new THREE.LineDashedMaterial({ color: d.c, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0 })
      : new THREE.LineBasicMaterial({ color: d.c, transparent: true, opacity: 0 }));
    if (d.ghost) edges.computeLineDistances();
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, dpt * 0.9), new THREE.MeshBasicMaterial({ map: tileTexture(d), transparent: true, opacity: 0, depthWrite: false }));
    label.rotation.x = -Math.PI / 2; label.position.y = h / 2 + 0.01;
    g.add(box, edges, label); scene.add(g);
    // a faint door line from each tile into the agent layer
    const door = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: d.c, dashSize: 0.2, gapSize: 0.2, ...ADD, opacity: 0 }));
    scene.add(door);
    tiles.push({ g, box, edges, label, door, ghost: d.ghost, i, c: d.c });
  });
  // your agent: a bright comet that leaves a track tile and lands among the agents
  const CT = 12, cmPos = new Float32Array(CT * 3), cmCol = new Float32Array(CT * 3), cmGeo = new THREE.BufferGeometry();
  cmGeo.setAttribute("position", new THREE.BufferAttribute(cmPos, 3)); cmGeo.setAttribute("color", new THREE.BufferAttribute(cmCol, 3));
  const cmMat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(cmGeo, cmMat));
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: GOLD, ...ADD, opacity: 0, side: THREE.DoubleSide }));
  splash.rotation.x = -Math.PI / 2; scene.add(splash);
  const comet = { k: 1, curve: null, tile: 0, splash: 0, wait: 1.5 };

  /* ---------- camera path: visit each layer, then pull out ---------- */
  // [progress, target x, target y, target z, radius, azimuth, elevation]
  const KEYS = [
    [0.00, 0, 0.4, 0.9, 12.5, -0.95, 0.7],
    [0.13, 0, 0.4, 0.9, 11.0, -0.25, 0.62],
    [0.22, 0, Y2, 0, 15, 0.05, 0.68],
    [0.32, 0.8, Y2, 0.4, 12.5, 0.4, 0.56],
    [0.40, 0, Y3, 0, 14, 0.7, 0.76],
    [0.50, 0, Y3 + 0.2, 0, 10.5, 1.05, 0.64],
    [0.58, 0, Y4, 0, 13, 0.6, 0.66],
    [0.68, 0, Y4 + 0.3, 0.3, 10, 0.05, 0.56],
    [0.80, 0, 5.6, 0, 29, 0.35, 0.36],
    [0.92, 0, 5.4, 0, 26, 0.7, 0.32],
    [1.00, 0, 5.4, 0, 26, 0.85, 0.32],
  ];
  const cr = (p0, p1, p2, p3, s) => 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
  const camAt = (p) => {
    p = clamp(p); let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(KEYS.length - 1, i + 2)];
    const s = (p - b[0]) / (c[0] - b[0]), e = s * s * (3 - 2 * s) * 0.35 + s * 0.65;   // a gentle settle at each stop
    const out = []; for (let k = 1; k < 7; k++) out.push(cr(a[k], b[k], c[k], d[k], e)); return out;
  };

  /* ---------- drag to turn the finished model ---------- */
  const user = { th: 0, ph: 0, vth: 0, vph: 0, drag: null, idle: 0 };
  const dragOn = () => views[0].pS > 0.86;
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (e) => {
    if (!dragOn()) return;
    user.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; user.vth = user.vph = 0; canvas.setPointerCapture(e.pointerId); host.classList.add("grabbing");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!user.drag) return;
    const dx = e.clientX - user.drag.x, dy = e.clientY - user.drag.y; user.drag.x = e.clientX; user.drag.y = e.clientY;
    user.vth = -dx * 0.006; user.vph = dy * 0.004; user.th += user.vth; user.ph = Math.max(-0.3, Math.min(0.75, user.ph + user.vph)); user.idle = 0;
  });
  const endDrag = () => { if (user.drag) { user.drag = null; host.classList.remove("grabbing"); } };
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

  /* ---------- loop ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let t = 0, last = performance.now(), frameN = 0;
  if (ghostCanvas) { try { views.push(makeView(ghostCanvas, ghostHost, 1, true)); ghostHost.classList.add("gl-on"); } catch (e) { /* no backdrop */ } }
  const binSize = 0.9, bins = new Map();

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden || !views.some((v) => v.visible)) return;
    t += dt; frameN++;
    const main = views[0], p = parseFloat(section.style.getPropertyValue("--p")) || 0;
    main.pS += (p - main.pS) * (1 - Math.pow(0.004, dt));          // smoothed progress for the camera
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.pow(0.02, dt)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.pow(0.02, dt));
    uni.uTime.value = t;
    const on = dragOn();
    canvas.style.pointerEvents = on ? "auto" : "none"; host.classList.toggle("can-drag", on);
    if (!user.drag) {   // inertia, then the tilt eases back while the auto-orbit carries on
      user.th += user.vth; user.ph = Math.max(-0.3, Math.min(0.75, user.ph + user.vph));
      user.vth *= Math.pow(0.04, dt); user.vph *= Math.pow(0.04, dt); user.idle += dt;
      if (user.idle > 3) user.ph *= Math.pow(0.5, dt);
    }

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
        if (d2 > 0.6) continue;
        const f = 1 - d2 / 0.6, c = (list[u] + list[w]) % 3 === 0 ? PINK : ICE, o = nl * 6;
        inPos.set([A.x, Y2 + 0.2, A.z, B.x, Y2 + 0.2, B.z], o); inCol.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], o);
        nl++;
      }
    }
    inGeo.setDrawRange(0, nl * 2); inGeo.attributes.position.needsUpdate = true; inGeo.attributes.color.needsUpdate = true;

    // flows through every layer
    l1Flow.update(dt); l3Flow.update(dt); l4Flow.update(dt);
    l1Up.update(t); l2Up.update(t); l3Up.update(t); l4Down.update(t);
    l3Mods.concat(l4Mods).forEach((m) => { m.flash *= Math.pow(0.03, dt); });
    rings[0].rotation.z = t * 0.25; rings[1].rotation.z = -t * 0.18;
    for (let i = 0; i < VN; i++) {   // the fixed point
      const q = vx[i]; q.k += q.sp * dt; if (q.k > 1) { q.k -= 1; q.a0 = Math.random() * 6.28; }
      const r = 2.4 * Math.pow(1 - q.k, 0.85), ang = q.a0 + q.k * 7, o = i * 3, f = 0.25 + 0.75 * q.k;
      vxPos[o] = Math.cos(ang) * r; vxPos[o + 1] = Y4 + 0.3 + (1 - q.k) * 0.25; vxPos[o + 2] = Math.sin(ang) * r;
      vxCol[o] = (ICE.r + (WHITE.r - ICE.r) * q.k) * f; vxCol[o + 1] = (ICE.g + (WHITE.g - ICE.g) * q.k) * f; vxCol[o + 2] = (ICE.b + (WHITE.b - ICE.b) * q.k) * f;
    }
    vxGeo.attributes.position.needsUpdate = true; vxGeo.attributes.color.needsUpdate = true;
    // the tiles orbit; doors point from each tile into the agents
    tiles.forEach((tl) => {
      const a = tl.i / tiles.length * Math.PI * 2 + t * 0.09;
      tl.ang = a; tl.g.position.set(Math.cos(a) * RING_R, RING_Y + Math.sin(t * 1.1 + tl.i) * 0.12, Math.sin(a) * RING_R);
      tl.g.rotation.y = -a + Math.PI / 2;
      const dp = tl.door.geometry.attributes.position;
      dp.setXYZ(0, tl.g.position.x * 0.9, RING_Y - 0.1, tl.g.position.z * 0.9); dp.setXYZ(1, Math.cos(a) * HALF * 0.7, Y2 + 0.3, Math.sin(a) * HALF * 0.7); dp.needsUpdate = true;
      tl.door.computeLineDistances();
    });
    // your agent
    if (comet.k >= 1) {
      comet.wait -= dt;
      if (comet.wait <= 0) {
        const tl = tiles[comet.tile % 3]; comet.tile++;
        const a = tl.g.position.clone(), b = new THREE.Vector3((Math.random() - 0.5) * 5, Y2 + 0.3, (Math.random() - 0.5) * 5);
        const m = a.clone().add(b).multiplyScalar(0.5); m.y += 4.5;
        comet.curve = new THREE.QuadraticBezierCurve3(a, m, b); comet.k = 0; comet.wait = 3.5; comet.col = tl.c;
      }
    } else {
      comet.k += dt / 2.2;
      if (comet.k >= 1) { comet.splash = 1; splash.position.copy(comet.curve.v2); }
    }
    const cv = new THREE.Vector3();
    for (let q = 0; q < CT; q++) {
      const u = comet.k - q * 0.022, o = q * 3, f = comet.k < 1 && u > 0 ? Math.pow(1 - q / CT, 1.5) : 0;
      if (comet.curve) comet.curve.getPoint(Math.min(1, Math.max(0, u)), cv);
      cmPos[o] = cv.x; cmPos[o + 1] = cv.y; cmPos[o + 2] = cv.z;
      const c = q === 0 ? WHITE : comet.col || GOLD; cmCol[o] = c.r * f; cmCol[o + 1] = c.g * f; cmCol[o + 2] = c.b * f;
    }
    cmGeo.attributes.position.needsUpdate = true; cmGeo.attributes.color.needsUpdate = true;
    comet.splash = Math.max(0, comet.splash - dt * 0.9);

    for (const v of views) if (v.visible) { pose(v); v.composer.render(); }
  }

  function pose(v) {
    const pS = v.pS, camera = v.camera;
    // reveal of each layer, and focus: once the next layer arrives the previous ones step back until the full view
    const r1 = ease(clamp((pS + 0.04) / 0.12)), r2 = ease(clamp((pS - 0.17) / 0.09)), r3 = clamp((pS - 0.35) / 0.13), r4 = ease(clamp((pS - 0.53) / 0.1)), r5 = clamp((pS - 0.71) / 0.12);
    const all = clamp((pS - 0.76) / 0.1);
    const dimAfter = (next) => 1 - 0.86 * clamp((pS - next) / 0.06) * (1 - all);
    const f1 = dimAfter(0.19), f2 = dimAfter(0.37), f3 = dimAfter(0.55), f4 = dimAfter(0.73);

    // L1
    uni.uReveal.value = r1; uni.uPix.value = v.pix; uni.uDim.value = f1;
    ndMat.opacity = r1 * f1; frames[0].opacity = r1 * 0.5 * f1;
    l1Pipes.forEach((pp) => { const k = clamp((r1 - 0.25 - pp.ordered * 0.004) / 0.35); pp.line.geometry.setDrawRange(0, Math.ceil(k * (SEG + 1))); pp.mat.opacity = pp.base * k * f1; });
    l1Flow.mat.opacity = clamp((r1 - 0.6) / 0.3) * f1;
    l1Labels.forEach((m) => { m.opacity = clamp((r1 - 0.4) / 0.4) * (0.4 + 0.6 * f1); }); tags[0].opacity = r1 * (0.4 + 0.6 * f1);
    l1Up.mat.opacity = r2 * 0.9 * f2; l1Up.smat.opacity = r2 * 0.3 * f2;
    // L2
    agMat.uniforms.uOpacity.value = r2 * (0.2 + 0.8 * f2); agMat.uniforms.uH.value = v.hpx;
    trMat.opacity = r2 * 0.7 * f2; inMat.opacity = r2 * 0.9 * f2; frames[1].opacity = r2 * 0.45 * f2; tags[1].opacity = r2 * (0.4 + 0.6 * f2);
    // L3
    l3Mods.forEach((m, mi) => poseModule(m, clamp((r3 - mi * 0.045) / 0.4), f3, t, mi, l3Bars, mi === 0));
    l3Bars.instanceMatrix.needsUpdate = true; l3Bars.material.opacity = clamp((r3 - 0.1) / 0.3) * 0.8 * f3;
    rings.forEach((r) => { r.material.opacity = clamp(r3 / 0.3) * 0.55 * f3; });
    l3Pipes.forEach((pp) => { const k = clamp((r3 - 0.35 - pp.ordered * 0.01) / 0.3); pp.line.geometry.setDrawRange(0, Math.ceil(k * (SEG + 1))); pp.mat.opacity = 0.6 * k * f3; });
    l3Flow.mat.opacity = clamp((r3 - 0.65) / 0.25) * f3; frames[2].opacity = r3 * 0.45 * f3; tags[2].opacity = r3 * (0.4 + 0.6 * f3);
    l2Up.mat.opacity = r3 * 0.9 * f3; l2Up.smat.opacity = r3 * 0.3 * f3;
    // L4
    l4Mods.forEach((m, mi) => poseModule(m, clamp((r4 - mi * 0.1) / 0.5), f4, t, mi, l4Bars, false));
    l4Bars.instanceMatrix.needsUpdate = true; l4Bars.material.opacity = r4 * 0.8 * f4;
    l4Pipes.concat([realPipe]).forEach((pp) => { const k = clamp((r4 - 0.3 - pp.ordered * 0.08) / 0.4); pp.line.geometry.setDrawRange(0, Math.ceil(k * (SEG + 1))); pp.mat.opacity = pp.base * k * f4; });
    l4Flow.mat.opacity = clamp((r4 - 0.6) / 0.3) * f4;
    vxMat.opacity = r4 * f4; fpMat.opacity = r4 * f4 * (0.7 + 0.3 * Math.sin(t * 2.2)); fpMat.size = 1.2 + 0.4 * Math.sin(t * 2.2);
    fixLabel.opacity = clamp((r4 - 0.5) / 0.5) * (0.4 + 0.6 * f4); realLabel.opacity = clamp((r4 - 0.5) / 0.5) * (0.4 + 0.6 * f4);
    frames[3].opacity = r4 * 0.5 * f4; tags[3].opacity = r4 * (0.4 + 0.6 * f4);
    l3Up.mat.opacity = r4 * 0.9 * f4; l3Up.smat.opacity = r4 * 0.3 * f4;
    fbMat.opacity = r4 * 0.4 * f4; l4Down.mat.opacity = r4 * 0.8 * f4; l4Down.smat.opacity = 0;
    // outer ring
    ringMat.opacity = r5 * 0.5; ringLabel.opacity = clamp((r5 - 0.3) / 0.5);
    tiles.forEach((tl) => {
      const k = clamp((r5 - tl.i * 0.12) / 0.5), e = k <= 0 ? 0 : backOut(k);
      tl.g.visible = k > 0; tl.g.scale.setScalar(0.4 + 0.6 * e);
      tl.box.material.opacity = (tl.ghost ? 0.08 : 0.92) * Math.min(1, k * 1.5);
      tl.edges.material.opacity = Math.min(1, k * 1.5); tl.label.material.opacity = Math.min(1, k * 1.5);
      tl.door.material.opacity = k * (tl.ghost ? 0.15 : 0.35);
    });
    cmMat.opacity = clamp((r5 - 0.5) / 0.4); splash.material.opacity = comet.splash * 0.8 * cmMat.opacity; splash.scale.setScalar(0.2 + (1 - comet.splash) * 1.6);

    // camera
    let tx, ty, tz, rad, th, ph;
    if (v.ghost) { tx = 0; ty = 5.4; tz = 0; rad = 31; th = 0.4 + t * 0.06 + ptr.x * 0.08; ph = 0.4; }
    else {
      [tx, ty, tz, rad, th, ph] = camAt(pS);
      th += t * 0.02 + ptr.x * 0.1 + user.th * all; ph = Math.max(0.12, Math.min(1.25, ph - ptr.y * 0.04 + user.ph * all));
    }
    rad *= Math.max(1, 1.3 / camera.aspect);
    camera.position.set(tx + Math.cos(ph) * Math.sin(th) * rad, ty + Math.sin(ph) * rad, tz + Math.cos(ph) * Math.cos(th) * rad);
    camera.lookAt(tx, ty, tz);
    v.bloom.strength = 0.6 + all * 0.1;
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

// the eight agent glyphs (shared with the hero globe in fx.js) on a 4 x 2 atlas
function iconAtlas() {
  const S = 128, c = document.createElement("canvas"); c.width = S * 4; c.height = S * 2;
  const g = c.getContext("2d");
  for (let i = 0; i < 8; i++) { g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S); g.shadowColor = "rgba(255,255,255,.9)"; g.shadowBlur = 6; window.SW_drawIcon(g, i); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const rgbOf = (color) => "rgb(" + [color.r, color.g, color.b].map((v) => Math.round(v * 255)).join(",") + ")";
const fit = (g, text, weight, size, family, maxW) => {   // shrink the font until the text fits
  let s = size; do { g.font = weight + " " + s + "px " + family; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
};

function moduleLabel(text, color) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.shadowColor = rgbOf(color); g.shadowBlur = 18; g.fillStyle = "#f2fbff"; g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = "4px";
  fit(g, text, "700", 62, "'JetBrains Mono', monospace", 470);
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// a two-line flat label: a bold title and a small mono subtitle, left aligned
function labelTex(title, sub, color) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 260;
  const g = c.getContext("2d");
  g.shadowColor = rgbOf(color); g.shadowBlur = 16; g.textBaseline = "alphabetic"; g.textAlign = "left";
  g.fillStyle = "#f2fbff"; fit(g, title, "700", 112, "'Space Grotesk', sans-serif", 1000); g.fillText(title, 12, 120);
  g.fillStyle = rgbOf(color); if ("letterSpacing" in g) g.letterSpacing = "6px";
  fit(g, sub, "600", 46, "'JetBrains Mono', monospace", 1000); g.fillText(sub, 14, 210);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function tileTexture(d) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 356;
  const g = c.getContext("2d");
  g.fillStyle = d.ghost ? "rgba(143,214,255,.9)" : "rgba(236,250,255,.96)";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = (d.ghost ? "600 150px" : "600 92px") + " 'Space Grotesk', 'JetBrains Mono', sans-serif";
  g.fillText(d.t1, 256, 150);
  g.font = "500 40px 'JetBrains Mono', monospace";
  g.fillText(d.t2, 256, d.ghost ? 270 : 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
