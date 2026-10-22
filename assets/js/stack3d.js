/* SimuWorld home · the economic world model, in WebGL.
   One model, four layers, bottom to top, each with its own look:
     L1  Intelligence foundation: LLM as stacked transformer sheets with word tokens rising through them and
         attention arcs between them; RL as a glowing objective landscape that a ball climbs, inside an
         action -> environment -> reward loop
     L2  Economic agents: a few dozen icons (people, households, markets, firms, banks, homes, money) on a
         grid, each with a breathing halo for its private state; four carry tags that name what agents hold
     L3  Economic environment & institutions: mechanism modules around market clearing, wired by pipes of
         data; the institutions module evolves now and then
     L4  Equilibrium & reality discipline: an armillary of three rings (behaviour, data, learned environment)
         that converge on a fixed point, beside real data that the simulated curve learns to fit
   A light spine runs through all four, and "ECONOMIC WORLD MODEL" turns around the top and bottom.
   Around it, the SimuWorld Challenge as a planetary ring of worlds with its name turning in it; now and then
   your agent flies in from it.
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
  scene.fog = new THREE.FogExp2(0x000000, 0.011);

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
      renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
      // on wide screens the copy sits on the left, so the model's centre moves to the right
      if (!ghost && innerWidth > 860) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      v.pix = renderer.getPixelRatio() * Math.min(1.4, h / 600); v.hpx = h * renderer.getPixelRatio();
    };
    new ResizeObserver(resize).observe(cv); resize();
    return v;
  };
  const views = [makeView(canvas, host, 1.25, false)];

  const ICE = new THREE.Color(0x8fd6ff), WHITE = new THREE.Color(0xe4f3ff), SKY = new THREE.Color(0xa9cfff);
  const GREEN = new THREE.Color(0x00ff88), TEAL = new THREE.Color(0x3ff2c8), VIOLET = new THREE.Color(0xb06bff);
  const PINK = new THREE.Color(0xff5fd2), GOLD = new THREE.Color(0xffc857);
  const Y1 = 0, Y2 = 3.6, Y3 = 7.2, Y4 = 10.8, HALF = 6, RING_Y = 5.4;
  const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const dot = dotTexture();
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (v) => 1 - Math.pow(1 - v, 3);
  const sstep = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };

  /* ---------- shared building blocks ---------- */
  // a flat text label lying on a layer, facing up
  const flatLabel = (title, sub, color, w, x, y, z, rotZ) => {
    const tex = labelTex(title, sub, color), h = w * tex.image.height / tex.image.width;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotZ || 0; m.position.set(x, y, z); scene.add(m); return m.material;
  };
  // a small upright text tag that always faces the camera
  const tag = (text, color, h) => {
    const tex = tagTex(text, color), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    s.scale.set(h * tex.image.width / tex.image.height, h, 1); scene.add(s); return s;
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
    const n = pts.length - 1, f = Math.min(n - 1e-4, Math.max(0, u * n)), i0 = Math.floor(f), w = f - i0, A = pts[i0], B = pts[i0 + 1];
    out[o] = A.x + (B.x - A.x) * w; out[o + 1] = A.y + (B.y - A.y) * w; out[o + 2] = A.z + (B.z - A.z) * w;
  };
  // glowing packets with short tails travelling along a set of paths
  const packets = (paths, per, size, wrapAround) => {
    const TAIL = 3, list = [];
    paths.forEach((pp) => { for (let k = 0; k < per; k++) list.push({ pp, u: Math.random(), sp: 0.14 + Math.random() * 0.2, dir: pp.bidir && k % 2 ? -1 : 1 }); });
    const pos = new Float32Array(list.length * TAIL * 3), col = new Float32Array(list.length * TAIL * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, ...ADD, opacity: 0, map: dot });
    scene.add(new THREE.Points(geo, mat));
    return {
      mat,
      update(dt) {
        for (let n = 0; n < list.length; n++) {
          const k = list[n], pp = k.pp;
          k.u += k.sp * dt * k.dir * (pp.speed || 1);
          if (k.u > 1 || k.u < 0) { k.u -= k.dir; const m = k.dir > 0 ? pp.B : pp.A; if (m) m.flash = 1; }
          for (let q = 0; q < TAIL; q++) {
            const o = (n * TAIL + q) * 3, f = q === 0 ? 1 : q === 1 ? 0.45 : 0.18;
            let u = k.u - q * 0.025 * k.dir; if (wrapAround) u = (u + 1) % 1;
            at(pp.pts, u, pos, o);
            col[o] = pp.c.r * f; col[o + 1] = pp.c.g * f; col[o + 2] = pp.c.b * f;
          }
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
    };
  };
  // light travelling straight up (or down) between layers, along faint shafts
  const risers = (anchors, per, speed, size) => {
    const pos = new Float32Array(anchors.length * per * 3), col = new Float32Array(anchors.length * per * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: size || 0.17, vertexColors: true, ...ADD, opacity: 0, map: dot });
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
  const makeModule = (d, x, y, z, r, h) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.PI / 6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), new THREE.MeshBasicMaterial({ color: d.c.clone().multiplyScalar(0.16), transparent: true, opacity: 0 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: d.c.clone(), transparent: true, opacity: 0 }));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 6), new THREE.MeshBasicMaterial({ color: d.c.clone(), ...ADD, opacity: 0 }));
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
  // LLM: three translucent transformer sheets; word tokens rise through them, attention arcs link them
  const LX = -3.0, SHEETS = [0.35, 1.05, 1.75];
  const sheetMats = SHEETS.map((y) => {
    const g = new THREE.PlaneGeometry(4.6, 3.6); g.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ICE, ...ADD, opacity: 0, side: THREE.DoubleSide }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0 }));
    fill.position.set(LX, y, 0); edge.position.set(LX, y, 0); scene.add(fill, edge);
    return [fill.material, edge.material];
  });
  const WORDS = ["BELIEF", "PRICE", "PLAN", "RISK", "WHY", "IF", "WAGE", "RATE", "TRUST", "DEBT", "SAVE", "BUY", "EXPECT", "SIGNAL"];
  const NT = small ? 8 : 13, tokens = [];
  for (let i = 0; i < NT; i++) {
    const s = tag(WORDS[i % WORDS.length], i % 4 === 0 ? WHITE : ICE, 0.24);
    const tk = { s, k: i / NT, sp: 1 / (7 + Math.random() * 3), path: [] };
    const pick = () => { tk.path = [new THREE.Vector3(LX - 3.0, SHEETS[0] + 0.12, (Math.random() - 0.5) * 2.8)];
      SHEETS.forEach((y) => tk.path.push(new THREE.Vector3(LX + (Math.random() - 0.5) * 3.6, y + 0.14, (Math.random() - 0.5) * 2.8)));
      tk.path.push(new THREE.Vector3(LX + (Math.random() - 0.5) * 2, Y2 - 0.3, (Math.random() - 0.5) * 2)); };
    pick(); tk.pick = pick; tokens.push(tk);
  }
  const AR = small ? 5 : 9, ARS = 14, arPos = new Float32Array(AR * ARS * 6), arCol = new Float32Array(AR * ARS * 6), arGeo = new THREE.BufferGeometry();
  arGeo.setAttribute("position", new THREE.BufferAttribute(arPos, 3)); arGeo.setAttribute("color", new THREE.BufferAttribute(arCol, 3));
  const arMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(arGeo, arMat));
  const arcs = []; for (let i = 0; i < AR; i++) arcs.push({ a: 0, b: 1, life: Math.random(), dur: 1.4 + Math.random() });
  // RL: an objective landscape (wireframe), a ball that climbs it, and the action/environment/reward loop around it
  const RX = 3.0, GN = small ? 26 : 38, GS = 4.6;
  const hgt = (x, z) => { x -= RX;
    return 1.25 * Math.exp(-((x - 0.9) ** 2 + (z + 0.6) ** 2) / 0.9) + 0.75 * Math.exp(-((x + 1.0) ** 2 + (z - 0.9) ** 2) / 0.7)
      + 0.35 * Math.exp(-((x + 0.2) ** 2 + (z + 1.4) ** 2) / 0.5) + 0.06 * Math.sin(x * 3) * Math.cos(z * 3); };
  const tPos = [], tCol = [];
  const tv = (i, j) => { const x = RX - GS / 2 + i / (GN - 1) * GS, z = -GS / 2 + j / (GN - 1) * GS, h = hgt(x, z); return [x, Y1 + 0.05 + h, z, h]; };
  for (let i = 0; i < GN; i++) for (let j = 0; j < GN; j++) {
    const a = tv(i, j);
    [[i + 1, j], [i, j + 1]].forEach(([i2, j2]) => {
      if (i2 >= GN || j2 >= GN) return; const b = tv(i2, j2);
      tPos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      [a[3], b[3]].forEach((h) => { const f = 0.25 + 0.75 * Math.min(1, h / 1.2); tCol.push(GREEN.r * f, GREEN.g * f + 0.05, GREEN.b * f + 0.1 * (1 - f)); });
    });
  }
  const terGeo = new THREE.BufferGeometry();
  terGeo.setAttribute("position", new THREE.Float32BufferAttribute(tPos, 3)); terGeo.setAttribute("color", new THREE.Float32BufferAttribute(tCol, 3));
  const terMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(terGeo, terMat));
  const ball = { x: RX - 1.6, z: 1.6, trail: [], pause: 0 };
  const BT = 40, btPos = new Float32Array(BT * 3), btCol = new Float32Array(BT * 3), btGeo = new THREE.BufferGeometry();
  btGeo.setAttribute("position", new THREE.BufferAttribute(btPos, 3)); btGeo.setAttribute("color", new THREE.BufferAttribute(btCol, 3));
  const btMat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(btGeo, btMat));
  const ballGeo = new THREE.BufferGeometry(); ballGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
  const ballMat = new THREE.PointsMaterial({ size: 0.7, color: WHITE, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(ballGeo, ballMat));
  const loopPts = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2; loopPts.push(new THREE.Vector3(RX + Math.cos(a) * 2.9, Y1 + 0.08, Math.sin(a) * 2.9)); }
  const loopMat = new THREE.LineBasicMaterial({ color: GREEN, ...ADD, opacity: 0 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loopPts), loopMat));
  const loopFlow = packets([{ pts: loopPts, c: GREEN, speed: 0.5 }], small ? 5 : 8, 0.34, true);
  const loopTags = [["ACTION", 0.6], ["ENVIRONMENT", 2.7], ["REWARD", 4.8]].map(([w, a]) => { const s = tag(w, GREEN, 0.26); s.position.set(RX + Math.cos(a) * 3.35, Y1 + 0.35, Math.sin(a) * 3.35); return s; });
  const l1Labels = [
    flatLabel("LLM", "BELIEFS · REASONING · LANGUAGE", ICE, 3.4, LX, Y1 + 0.02, 2.65),
    flatLabel("RL", "GOALS · OPTIMISATION · ADAPTATION", GREEN, 3.4, RX, Y1 + 0.02, 3.7),
  ];
  const l1Up = risers([{ x: LX, z: 0, y0: 2.0, y1: Y2, c: ICE }, { x: LX + 1.2, z: -0.8, y0: 2.0, y1: Y2, c: ICE },
    { x: RX + 0.9, z: -0.6, y0: 1.4, y1: Y2, c: GREEN }, { x: RX - 1.0, z: 0.9, y0: 0.9, y1: Y2, c: GREEN }], 4, 0.28);

  /* ---------- L2 · economic agents ---------- */
  const KINDS = [
    { icon: 0, c: WHITE, w: 0.30 }, { icon: 1, c: ICE, w: 0.14 }, { icon: 2, c: GREEN, w: 0.12 }, { icon: 3, c: GREEN, w: 0.08 },
    { icon: 4, c: TEAL, w: 0.11 }, { icon: 5, c: VIOLET, w: 0.08 }, { icon: 6, c: ICE, w: 0.08 }, { icon: 7, c: GOLD, w: 0.09 },
  ];
  const TAGGED = [{ icon: 1, c: ICE, t: "HOUSEHOLD · BUDGET" }, { icon: 4, c: TEAL, t: "FIRM · GOAL" }, { icon: 3, c: GREEN, t: "INVESTOR · BELIEF" }, { icon: 5, c: VIOLET, t: "BANK · CONSTRAINT" }];
  const N = small ? 26 : 45, TR = 10;
  const ag = [];
  const agPos = new Float32Array(N * 3), agCol = new Float32Array(N * 3), agIcon = new Float32Array(N), agSize = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let kd = KINDS[0];
    if (i < TAGGED.length) kd = TAGGED[i];
    else { let roll = Math.random(); for (const k of KINDS) { if (roll < k.w) { kd = k; break; } roll -= k.w; } }
    const a = { x: (Math.random() * 2 - 1) * HALF * 0.85, z: (Math.random() * 2 - 1) * HALF * 0.85, a: Math.random() * 6.28, s: 0.25 + Math.random() * 0.35, trail: [], col: kd.c, ph: Math.random() * 6.28 };
    if (kd.t) a.tag = tag(kd.t, kd.c, 0.27);
    ag.push(a);
    agCol.set([kd.c.r, kd.c.g, kd.c.b], i * 3); agIcon[i] = kd.icon; agSize[i] = kd.icon === 0 ? 0.95 + Math.random() * 0.15 : 1.1 + Math.random() * 0.15;
  }
  const agGeo = new THREE.BufferGeometry();
  agGeo.setAttribute("position", new THREE.BufferAttribute(agPos, 3)); agGeo.setAttribute("color", new THREE.BufferAttribute(agCol, 3));
  agGeo.setAttribute("aIcon", new THREE.BufferAttribute(agIcon, 1)); agGeo.setAttribute("aSize", new THREE.BufferAttribute(agSize, 1));
  const agMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: iconAtlas() }, uOpacity: { value: 0 }, uSize: { value: small ? 0.85 : 0.74 }, uH: { value: 600 } },
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
  // halos: each agent's private state, breathing at its own pace
  const haloPos = new Float32Array(N * 3), haloCol = new Float32Array(N * 3), haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3)); haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  const haloMat = new THREE.PointsMaterial({ size: 1.3, vertexColors: true, ...ADD, opacity: 0, map: ringTexture() });
  scene.add(new THREE.Points(haloGeo, haloMat));
  const trPos = new Float32Array(N * (TR - 1) * 6), trCol = new Float32Array(N * (TR - 1) * 6), trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute("position", new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute("color", new THREE.BufferAttribute(trCol, 3));
  const trMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(trGeo, trMat));
  const MAXL = small ? 12 : 24, inPos = new Float32Array(MAXL * 6), inCol = new Float32Array(MAXL * 6), inGeo = new THREE.BufferGeometry();
  inGeo.setAttribute("position", new THREE.BufferAttribute(inPos, 3)); inGeo.setAttribute("color", new THREE.BufferAttribute(inCol, 3));
  const inMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(inGeo, inMat));
  const grid = new THREE.GridHelper(HALF * 2, 12, ICE, ICE); grid.position.y = Y2; grid.material.transparent = true; grid.material.opacity = 0; grid.material.depthWrite = false; scene.add(grid);

  /* ---------- L3 · economic environment & institutions ---------- */
  const MODS = [
    { n: "AUCTIONS", c: GREEN }, { n: "MATCHING", c: TEAL }, { n: "PRICES", c: GREEN }, { n: "ACCOUNTING", c: SKY },
    { n: "BUDGETS", c: SKY }, { n: "POLICY RULES", c: VIOLET }, { n: "INSTITUTIONS", c: VIOLET },
  ];
  const core = makeModule({ n: "MARKET CLEARING", c: ICE }, 0, Y3 + 0.1, 0, 1.55, 0.55);
  const mods = MODS.map((d, i) => { const a = i / MODS.length * Math.PI * 2 + 0.35; return makeModule(d, Math.cos(a) * 4.3, Y3 + 0.1, Math.sin(a) * 4.3, 0.98, 0.36); });
  const inst = mods[6];
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
  const l3Flow = packets(l3Pipes, small ? 8 : 14, 0.4);
  const l2Up = risers(l3Mods.map((m) => ({ x: m.x, z: m.z, y0: Y2 + 0.3, y1: m.y - m.h / 2, c: m.c })), 4, 0.3);

  /* ---------- L4 · equilibrium & reality discipline ---------- */
  // an armillary: three rings that converge on one plane and one rhythm -- the fixed point -- then drift apart again
  const AC = new THREE.Vector3(-0.6, Y4 + 1.7, 0), AR_R = 1.9;
  const ARM = [
    { n: "BEHAVIOUR", c: WHITE, tilt: [1.05, 0.0, 0.45], spin: 0.55 },
    { n: "DATA", c: TEAL, tilt: [-0.7, 0.0, 1.0], spin: -0.4 },
    { n: "LEARNED ENV", c: VIOLET, tilt: [0.25, 0.0, -1.15], spin: 0.32 },
  ].map((d) => {
    const g = new THREE.Group(); g.position.copy(AC);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(AR_R, 0.028, 6, 160), new THREE.MeshBasicMaterial({ color: d.c, ...ADD, opacity: 0 }));
    g.add(ringM); scene.add(g);
    const s = tag(d.n, d.c, 0.27);
    return { ...d, g, ringM, label: s, ang: Math.random() * 6.28 };
  });
  const BEADS = 3, bdPos = new Float32Array(ARM.length * BEADS * 3), bdCol = new Float32Array(ARM.length * BEADS * 3), bdGeo = new THREE.BufferGeometry();
  bdGeo.setAttribute("position", new THREE.BufferAttribute(bdPos, 3)); bdGeo.setAttribute("color", new THREE.BufferAttribute(bdCol, 3));
  const bdMat = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(bdGeo, bdMat));
  const fpGeo = new THREE.BufferGeometry(); fpGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([AC.x, AC.y, AC.z]), 3));
  const fpMat = new THREE.PointsMaterial({ size: 1.2, color: WHITE, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(fpGeo, fpMat));
  const fpTag = tag("DDGE FIXED POINT", WHITE, 0.28);
  fpTag.position.set(AC.x, AC.y - AR_R - 0.45, AC.z);
  // real data: historic bars, a real curve over them, and the simulated curve learning to fit it
  const RDX = 2.6, RDN = 12, RDW = 3.4, series = [];
  for (let i = 0; i < RDN; i++) series.push(0.7 + 0.35 * Math.sin(i * 0.7) + i * 0.09 + (i % 3 === 0 ? 0.18 : 0));
  const rdBars = new THREE.InstancedMesh(new THREE.BoxGeometry(RDW / RDN * 0.62, 1, 0.22).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: GOLD, ...ADD, opacity: 0 }), RDN);
  series.forEach((h, i) => { bv.set(RDX + i / (RDN - 1) * RDW, Y4, -0.4); bs.set(1, h, 1); rdBars.setMatrixAt(i, bm4.compose(bv, bq, bs)); });
  scene.add(rdBars);
  const CP = 48, curve = (fn) => { const pts = []; for (let i = 0; i < CP; i++) { const u = i / (CP - 1) * (RDN - 1), i0 = Math.min(RDN - 2, Math.floor(u)), w = u - i0;
    pts.push(RDX + u / (RDN - 1) * RDW, Y4 + 0.12 + fn(series[i0] + (series[i0 + 1] - series[i0]) * w, u), -0.4); } return pts; };
  const realLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: GOLD, ...ADD, opacity: 0 }));
  realLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(curve((h) => h), 3)); scene.add(realLine);
  const simLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: ICE, ...ADD, opacity: 0 }));
  simLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(CP * 3), 3)); scene.add(simLine);
  const rdTag = tag("REAL DATA · CALIBRATION", GOLD, 0.28);
  rdTag.position.set(RDX + RDW / 2, Y4 + 2.7, -0.4);
  const calPipe = pipe(new THREE.Vector3(RDX + 0.2, Y4 + 1.5, -0.4), AC.clone().add(new THREE.Vector3(AR_R * 0.7, 0, 0)), GOLD, 0.6, 0.45);
  const calFlow = packets([calPipe], small ? 4 : 7, 0.34);
  const l3Up = risers([{ x: 0, z: 0, y0: Y3 + 0.4, y1: Y4, c: ICE }, { x: inst.x, z: inst.z, y0: Y3 + 0.3, y1: Y4, c: VIOLET }], 5, 0.26);

  /* ---------- the model as one thing: a light spine, and its name turning around the top and bottom ---------- */
  const SH = 7.0, SB = -0.7;
  const nameRings = [0, 1].map((k) => {
    const tex = nameTexture(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(SH * 1.32, SH * 1.32, 0.62, 128, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide }));
    scene.add(m); return { m, tex, k };
  });
  const spine = risers([{ x: 0, z: 0, y0: 0.2, y1: Y4 + 2.4, c: ICE }, { x: 0.06, z: 0.06, y0: Y4 + 2.4, y1: 0.2, c: VIOLET }], 9, 0.12, 0.22);

  const frames = [frame(Y1, ICE), frame(Y2, WHITE), frame(Y3, ICE), frame(Y4, ICE, true)];
  const tags = [
    flatLabel("L1", "INTELLIGENCE FOUNDATION", ICE, 3.8, -HALF + 1.9, Y1 + 0.02, HALF + 0.75),
    flatLabel("L2", "ECONOMIC AGENTS", WHITE, 3.8, -HALF + 1.9, Y2 + 0.02, HALF + 0.75),
    flatLabel("L3", "ENVIRONMENT & INSTITUTIONS", ICE, 3.8, -HALF + 1.9, Y3 + 0.02, HALF + 0.75),
    flatLabel("L4", "EQUILIBRIUM & REALITY", ICE, 3.8, -HALF + 1.9, Y4 + 0.02, HALF + 0.75),
  ];

  /* ---------- outer layer · SimuWorld Challenge ---------- */
  // a planetary ring: a band of particles with a few brighter worlds in it, slowly turning around the model
  const ringG = new THREE.Group(); ringG.position.y = RING_Y; ringG.rotation.set(0.12, 0, 0.07); scene.add(ringG);
  const RN = small ? 900 : 2200, rnPos = new Float32Array(RN * 3), rnCol = new Float32Array(RN * 3);
  const RCOL = [ICE, WHITE, ICE, SKY, VIOLET, TEAL];
  for (let i = 0; i < RN; i++) {
    const band = Math.random(), r = band < 0.5 ? 8.8 + Math.random() * 1.9 : band < 0.58 ? 10.75 + Math.random() * 0.1 : 12.3 + Math.random() * 1.6;
    const a = Math.random() * Math.PI * 2, c = RCOL[i % RCOL.length], f = 0.4 + Math.random() * 0.6;
    rnPos.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.12, Math.sin(a) * r], i * 3); rnCol.set([c.r * f, c.g * f, c.b * f], i * 3);
  }
  const rnGeo = new THREE.BufferGeometry();
  rnGeo.setAttribute("position", new THREE.BufferAttribute(rnPos, 3)); rnGeo.setAttribute("color", new THREE.BufferAttribute(rnCol, 3));
  const rnMat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, ...ADD, opacity: 0, map: dot });
  ringG.add(new THREE.Points(rnGeo, rnMat));
  const bandMats = [8.7, 10.85, 12.2, 14.0].map((r) => {
    const pts = []; for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const m = new THREE.LineBasicMaterial({ color: ICE, ...ADD, opacity: 0 }); ringG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); return m;
  });
  const WN = 9, worlds = [], wPos = new Float32Array(WN * 3), wCol = new Float32Array(WN * 3);
  for (let i = 0; i < WN; i++) { const c = [GREEN, TEAL, VIOLET, ICE, GOLD][i % 5]; worlds.push({ a: i / WN * Math.PI * 2 + Math.random() * 0.5, r: i % 2 ? 9.2 + Math.random() * 1.3 : 12.5 + Math.random() * 1.2, c, ph: Math.random() * 6.28 }); }
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3)); wGeo.setAttribute("color", new THREE.BufferAttribute(wCol, 3));
  const wMat = new THREE.PointsMaterial({ size: 1.1, vertexColors: true, ...ADD, opacity: 0, map: dot });
  ringG.add(new THREE.Points(wGeo, wMat));
  // the ring's name, written along the ring itself so it turns with it
  const ringText = (() => {
    const r0 = 10.95, r1 = 12.1, segs = 240, pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = -i / segs * Math.PI * 2, u = i / segs * 2;   // two repeats around the ring, reading clockwise from above
      pos.push(Math.cos(a) * r1, 0.02, Math.sin(a) * r1, Math.cos(a) * r0, 0.02, Math.sin(a) * r0); uv.push(u, 1, u, 0);
      if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const tex = ringNameTexture(); tex.wrapS = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ringG.add(m); return m.material;
  })();
  const CT = 12, cmPos = new Float32Array(CT * 3), cmCol = new Float32Array(CT * 3), cmGeo = new THREE.BufferGeometry();
  cmGeo.setAttribute("position", new THREE.BufferAttribute(cmPos, 3)); cmGeo.setAttribute("color", new THREE.BufferAttribute(cmCol, 3));
  const cmMat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(cmGeo, cmMat));
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: GOLD, ...ADD, opacity: 0, side: THREE.DoubleSide }));
  splash.rotation.x = -Math.PI / 2; scene.add(splash);
  const comet = { k: 1, curve: null, splash: 0, wait: 1.5 };

  /* ---------- camera path: visit each layer, then pull out ---------- */
  // [progress, target x, target y, target z, radius, azimuth, elevation]
  const KEYS = [
    [0.00, 0, 0.6, 0.6, 21, -0.85, 0.62],
    [0.13, 0, 0.6, 0.6, 19, -0.2, 0.56],
    [0.22, 0, Y2, 0, 23, 0.05, 0.64],
    [0.32, 0.4, Y2, 0.3, 20, 0.4, 0.54],
    [0.40, 0, Y3, 0, 22, 0.7, 0.72],
    [0.50, 0, Y3 + 0.2, 0, 18, 1.05, 0.6],
    [0.58, 0.8, Y4 + 1.2, 0, 20, 0.55, 0.42],
    [0.68, 0.4, Y4 + 1.4, 0, 16.5, 0.1, 0.34],
    [0.80, 0, 6.2, 0, 56, 0.35, 0.3],
    [0.92, 0, 6.0, 0, 52, 0.7, 0.27],
    [1.00, 0, 6.0, 0, 52, 0.85, 0.27],
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
    user.drag = { x: e.clientX, y: e.clientY }; user.vth = user.vph = 0; canvas.setPointerCapture(e.pointerId); host.classList.add("grabbing");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!user.drag) return;
    const dx = e.clientX - user.drag.x, dy = e.clientY - user.drag.y; user.drag.x = e.clientX; user.drag.y = e.clientY;
    user.vth = -dx * 0.006; user.vph = dy * 0.004; user.th += user.vth; user.ph = Math.max(-0.25, Math.min(0.75, user.ph + user.vph)); user.idle = 0;
  });
  const endDrag = () => { if (user.drag) { user.drag = null; host.classList.remove("grabbing"); } };
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

  /* ---------- loop ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let t = 0, last = performance.now(), frameN = 0, conv = 0;
  if (ghostCanvas) { try { views.push(makeView(ghostCanvas, ghostHost, 1, true)); ghostHost.classList.add("gl-on"); } catch (e) { /* no backdrop */ } }
  const binSize = 1.3, bins = new Map(), tmp = new THREE.Vector3(), cv = new THREE.Vector3();

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden || !views.some((v) => v.visible)) return;
    t += dt; frameN++;
    const main = views[0], p = parseFloat(section.style.getPropertyValue("--p")) || 0;
    main.pS += (p - main.pS) * (1 - Math.pow(0.004, dt));
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.pow(0.02, dt)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.pow(0.02, dt));
    const on = dragOn();
    canvas.style.pointerEvents = on ? "auto" : "none"; host.classList.toggle("can-drag", on);
    if (!user.drag) {
      user.th += user.vth; user.ph = Math.max(-0.25, Math.min(0.75, user.ph + user.vph));
      user.vth *= Math.pow(0.04, dt); user.vph *= Math.pow(0.04, dt); user.idle += dt;
      if (user.idle > 3) user.ph *= Math.pow(0.5, dt);
    }

    // L1 · tokens climb the transformer sheets
    tokens.forEach((tk) => {
      tk.k += tk.sp * dt; if (tk.k >= 1) { tk.k -= 1; tk.pick(); }
      const seg = tk.k * (tk.path.length - 1), i0 = Math.min(tk.path.length - 2, Math.floor(seg)), w = sstep(seg - i0);
      tk.s.position.copy(tk.path[i0]).lerp(tk.path[i0 + 1], w);
      tk.fade = Math.min(1, tk.k * 8, (1 - tk.k) * 6);
    });
    for (let i = 0; i < AR; i++) {   // attention: arcs flicker between tokens on neighbouring sheets
      const a = arcs[i]; a.life += dt / a.dur;
      if (a.life >= 1) { a.life = 0; a.a = Math.floor(Math.random() * NT); a.b = Math.floor(Math.random() * NT); if (a.b === a.a) a.b = (a.a + 1) % NT; }
      const A = tokens[a.a].s.position, B = tokens[a.b].s.position, f = Math.sin(Math.PI * a.life) * Math.min(tokens[a.a].fade, tokens[a.b].fade);
      const lift = 0.5 + A.distanceTo(B) * 0.25;
      for (let q = 0; q < ARS; q++) {
        const u0 = q / ARS, u1 = (q + 1) / ARS, o = (i * ARS + q) * 6;
        const P = (u) => [A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u + Math.sin(Math.PI * u) * lift, A.z + (B.z - A.z) * u];
        arPos.set(P(u0).concat(P(u1)), o);
        const c = i % 3 === 0 ? WHITE : ICE; arCol.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], o);
      }
    }
    arGeo.attributes.position.needsUpdate = true; arGeo.attributes.color.needsUpdate = true;
    // L1 · the ball climbs the objective by gradient ascent, then starts again somewhere else
    if (ball.pause > 0) { ball.pause -= dt; if (ball.pause <= 0) { const a = Math.random() * 6.28; ball.x = RX + Math.cos(a) * 2.0; ball.z = Math.sin(a) * 2.0; ball.trail.length = 0; } }
    else {
      const e = 0.02, gx = (hgt(ball.x + e, ball.z) - hgt(ball.x - e, ball.z)) / (2 * e), gz = (hgt(ball.x, ball.z + e) - hgt(ball.x, ball.z - e)) / (2 * e), g = Math.hypot(gx, gz);
      const stepLen = Math.min(0.9, 0.35 + g) * dt;
      if (g < 0.05) ball.pause = 1.4; else { ball.x += gx / g * stepLen; ball.z += gz / g * stepLen; }
    }
    if (frameN % 3 === 0) { ball.trail.unshift(ball.x, ball.z); if (ball.trail.length > BT * 2) ball.trail.length = BT * 2; }
    const by = Y1 + 0.12 + hgt(ball.x, ball.z);
    ballGeo.attributes.position.setXYZ(0, ball.x, by, ball.z); ballGeo.attributes.position.needsUpdate = true;
    for (let q = 0; q < BT; q++) {
      const has = ball.trail.length > q * 2, x = has ? ball.trail[q * 2] : ball.x, z = has ? ball.trail[q * 2 + 1] : ball.z, f = has ? 1 - q / BT : 0;
      btPos.set([x, Y1 + 0.1 + hgt(x, z), z], q * 3); btCol.set([GREEN.r * f + 0.4 * f, GREEN.g * f, GREEN.b * f + 0.3 * f], q * 3);
    }
    btGeo.attributes.position.needsUpdate = true; btGeo.attributes.color.needsUpdate = true;
    loopFlow.update(dt);

    // L2 · agents wander slowly, keep a short trail, and link up when they meet
    bins.clear();
    for (let i = 0; i < N; i++) {
      const a = ag[i];
      a.a += (Math.sin(a.x * 0.45 + t * 0.3) + Math.cos(a.z * 0.5 - t * 0.25)) * dt * 0.6;
      a.x += Math.cos(a.a) * a.s * dt; a.z += Math.sin(a.a) * a.s * dt;
      if (Math.abs(a.x) > HALF * 0.9) { a.x = Math.sign(a.x) * HALF * 0.9; a.a = Math.PI - a.a; }
      if (Math.abs(a.z) > HALF * 0.9) { a.z = Math.sign(a.z) * HALF * 0.9; a.a = -a.a; }
      const y = Y2 + 0.32 + Math.abs(Math.sin(t * 3.5 * a.s + a.ph)) * 0.07;
      agPos[i * 3] = a.x; agPos[i * 3 + 1] = y; agPos[i * 3 + 2] = a.z;
      const br = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.8 + a.s) + a.ph));
      haloPos.set([a.x, Y2 + 0.04, a.z], i * 3); haloCol.set([a.col.r * br, a.col.g * br, a.col.b * br], i * 3);
      if (a.tag) a.tag.position.set(a.x, y + 0.75, a.z);
      if (frameN % 2 === 0) { a.trail.unshift(a.x, a.z); if (a.trail.length > TR * 2) a.trail.length = TR * 2; }
      const key = Math.floor(a.x / binSize) + ":" + Math.floor(a.z / binSize);
      (bins.get(key) || bins.set(key, []).get(key)).push(i);
    }
    agGeo.attributes.position.needsUpdate = true; haloGeo.attributes.position.needsUpdate = true; haloGeo.attributes.color.needsUpdate = true;
    for (let i = 0; i < N; i++) {
      const a = ag[i], tr = a.trail;
      for (let k = 0; k < TR - 1; k++) {
        const o = (i * (TR - 1) + k) * 6, has = tr.length >= (k + 2) * 2;
        const x0 = has ? tr[k * 2] : a.x, z0 = has ? tr[k * 2 + 1] : a.z, x1 = has ? tr[k * 2 + 2] : a.x, z1 = has ? tr[k * 2 + 3] : a.z;
        trPos[o] = x0; trPos[o + 1] = Y2 + 0.03; trPos[o + 2] = z0; trPos[o + 3] = x1; trPos[o + 4] = Y2 + 0.03; trPos[o + 5] = z1;
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
        if (d2 > 1.4) continue;
        const f = 1 - d2 / 1.4, c = (list[u] + list[w]) % 3 === 0 ? PINK : ICE, o = nl * 6;
        inPos.set([A.x, Y2 + 0.3, A.z, B.x, Y2 + 0.3, B.z], o); inCol.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], o);
        nl++;
      }
    }
    inGeo.setDrawRange(0, nl * 2); inGeo.attributes.position.needsUpdate = true; inGeo.attributes.color.needsUpdate = true;

    // L3 · the machine runs; the institutions module evolves every few seconds
    l3Flow.update(dt);
    l3Mods.forEach((m) => { m.flash *= Math.pow(0.03, dt); });
    rings[0].rotation.z = t * 0.25; rings[1].rotation.z = -t * 0.18;
    const evo = (t % 7) / 7, bump = evo < 0.16 ? Math.sin(Math.PI * evo / 0.16) : 0;
    inst.bump = bump; if (bump > 0.9) inst.flash = 1;
    inst.edges.material.color.copy(VIOLET).lerp(PINK, bump); inst.glow.material.color.copy(VIOLET).lerp(PINK, bump);

    // L4 · the armillary converges, holds at the fixed point, and drifts apart again (a 12 s cycle)
    const cyc = (t % 12) / 12;
    conv = cyc < 0.42 ? sstep(cyc / 0.42) : cyc < 0.7 ? 1 : 1 - sstep((cyc - 0.7) / 0.3);
    ARM.forEach((r, ri) => {
      const k = 1 - conv;
      r.g.rotation.set(Math.PI / 2 + r.tilt[0] * k, t * r.spin * k + t * 0.5 * conv, r.tilt[2] * k, "YXZ");
      r.ang += dt * (0.9 + ri * 0.35 * k);
      r.g.updateMatrixWorld();
      for (let b = 0; b < BEADS; b++) {
        const a = r.ang + b / BEADS * Math.PI * 2, o = (ri * BEADS + b) * 3;
        tmp.set(Math.cos(a) * AR_R, Math.sin(a) * AR_R, 0).applyMatrix4(r.g.matrixWorld);
        bdPos.set([tmp.x, tmp.y, tmp.z], o); bdCol.set([r.c.r, r.c.g, r.c.b], o);
      }
      tmp.set(Math.cos(0.8 + ri * 2.1) * (AR_R + 0.35), Math.sin(0.8 + ri * 2.1) * (AR_R + 0.35), 0).applyMatrix4(r.g.matrixWorld);
      r.label.position.copy(tmp);
    });
    bdGeo.attributes.position.needsUpdate = true; bdGeo.attributes.color.needsUpdate = true;
    const sp = simLine.geometry.attributes.position, fit = conv;
    const sim = curve((h, u) => h + (1 - fit) * (0.45 * Math.sin(u * 1.3 + t * 0.6) - 0.15));
    for (let i = 0; i < CP; i++) sp.setXYZ(i, sim[i * 3], sim[i * 3 + 1], sim[i * 3 + 2]);
    sp.needsUpdate = true;
    calFlow.update(dt);

    // flows between layers, and along the spine
    l1Up.update(t); l2Up.update(t); l3Up.update(t); spine.update(t);
    nameRings.forEach((r) => { r.tex.offset.x = (t * 0.012 * (r.k ? -1 : 1)) % 1; });

    // outer ring · the planetary ring turns, its worlds pulse; your agent flies in from one of them
    ringG.rotation.y = t * 0.035;
    worlds.forEach((w, i) => {
      const br = 0.55 + 0.45 * Math.sin(t * 1.3 + w.ph);
      wPos.set([Math.cos(w.a) * w.r, 0.05, Math.sin(w.a) * w.r], i * 3); wCol.set([w.c.r * br, w.c.g * br, w.c.b * br], i * 3);
    });
    wGeo.attributes.position.needsUpdate = true; wGeo.attributes.color.needsUpdate = true;
    if (comet.k >= 1) {
      comet.wait -= dt;
      if (comet.wait <= 0) {
        const w = worlds[Math.floor(Math.random() * WN)]; ringG.updateMatrixWorld();
        const a = new THREE.Vector3(Math.cos(w.a) * w.r, 0.05, Math.sin(w.a) * w.r).applyMatrix4(ringG.matrixWorld), b = new THREE.Vector3((Math.random() - 0.5) * 5, Y2 + 0.3, (Math.random() - 0.5) * 5);
        const m = a.clone().add(b).multiplyScalar(0.5); m.y += 4.5;
        comet.curve = new THREE.QuadraticBezierCurve3(a, m, b); comet.k = 0; comet.wait = 3.5; comet.col = w.c;
      }
    } else {
      comet.k += dt / 2.2;
      if (comet.k >= 1) { comet.splash = 1; splash.position.copy(comet.curve.v2); }
    }
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
    const r1 = ease(clamp((pS + 0.04) / 0.12)), r2 = ease(clamp((pS - 0.17) / 0.09)), r3 = clamp((pS - 0.35) / 0.13), r4 = ease(clamp((pS - 0.53) / 0.1)), r5 = clamp((pS - 0.71) / 0.12);
    const all = clamp((pS - 0.76) / 0.1);
    const dimAfter = (next) => 1 - 0.86 * clamp((pS - next) / 0.06) * (1 - all);
    const f1 = dimAfter(0.19), f2 = dimAfter(0.37), f3 = dimAfter(0.55), f4 = dimAfter(0.73);
    const lab = (r, f) => r * (0.15 + 0.85 * f);

    // L1
    sheetMats.forEach(([fill, edge], i) => { const k = clamp((r1 - i * 0.15) / 0.5); fill.opacity = 0.05 * k * f1; edge.opacity = 0.55 * k * f1; });
    tokens.forEach((tk) => { tk.s.material.opacity = clamp((r1 - 0.4) / 0.4) * tk.fade * (0.15 + 0.85 * f1); });
    arMat.opacity = clamp((r1 - 0.5) / 0.4) * f1;
    terMat.opacity = r1 * 0.75 * f1; ballMat.opacity = clamp((r1 - 0.4) / 0.4) * f1; btMat.opacity = ballMat.opacity * 0.9;
    loopMat.opacity = r1 * 0.45 * f1; loopFlow.mat.opacity = clamp((r1 - 0.5) / 0.4) * f1;
    loopTags.forEach((s) => { s.material.opacity = lab(clamp((r1 - 0.5) / 0.4), f1); });
    l1Labels.forEach((m) => { m.opacity = lab(clamp((r1 - 0.4) / 0.4), f1); }); frames[0].opacity = r1 * 0.35 * f1; tags[0].opacity = lab(r1, f1);
    l1Up.mat.opacity = r2 * 0.9 * f2; l1Up.smat.opacity = r2 * 0.3 * f2;
    // L2
    agMat.uniforms.uOpacity.value = lab(r2, f2); agMat.uniforms.uH.value = v.hpx;
    haloMat.opacity = r2 * 0.55 * f2; haloMat.size = 1.3 * (v.pix > 1.4 ? 1 : 1);
    trMat.opacity = r2 * 0.6 * f2; inMat.opacity = r2 * 0.8 * f2; grid.material.opacity = r2 * 0.12 * f2;
    ag.forEach((a) => { if (a.tag) a.tag.material.opacity = clamp((r2 - 0.5) / 0.5) * (0.1 + 0.9 * f2); });
    frames[1].opacity = r2 * 0.4 * f2; tags[1].opacity = lab(r2, f2);
    // L3
    l3Mods.forEach((m, mi) => poseModule(m, clamp((r3 - mi * 0.045) / 0.4), f3, t, mi, l3Bars, mi === 0));
    inst.g.scale.setScalar(1 + (inst.bump || 0) * 0.28);
    l3Bars.instanceMatrix.needsUpdate = true; l3Bars.material.opacity = clamp((r3 - 0.1) / 0.3) * 0.8 * f3;
    rings.forEach((r) => { r.material.opacity = clamp(r3 / 0.3) * 0.55 * f3; });
    l3Pipes.forEach((pp) => { const k = clamp((r3 - 0.35 - pp.ordered * 0.01) / 0.3); pp.line.geometry.setDrawRange(0, Math.ceil(k * (SEG + 1))); pp.mat.opacity = 0.6 * k * f3; });
    l3Flow.mat.opacity = clamp((r3 - 0.65) / 0.25) * f3; frames[2].opacity = r3 * 0.4 * f3; tags[2].opacity = lab(r3, f3);
    l2Up.mat.opacity = r3 * 0.9 * f3; l2Up.smat.opacity = r3 * 0.3 * f3;
    // L4
    ARM.forEach((r, i) => { const k = clamp((r4 - i * 0.12) / 0.5); r.ringM.material.opacity = k * (0.55 + 0.45 * conv) * f4; r.label.material.opacity = lab(k, f4); r.g.scale.setScalar(0.6 + 0.4 * ease(k)); });
    bdMat.opacity = r4 * f4; fpMat.opacity = r4 * f4 * (0.25 + 0.75 * conv) * (0.85 + 0.15 * Math.sin(t * 3)); fpMat.size = 0.6 + 1.1 * conv;
    fpTag.material.opacity = lab(clamp((r4 - 0.4) / 0.5), f4) * (0.4 + 0.6 * conv);
    rdBars.material.opacity = clamp((r4 - 0.3) / 0.5) * 0.35 * f4; realLine.material.opacity = clamp((r4 - 0.4) / 0.5) * 0.9 * f4; simLine.material.opacity = realLine.material.opacity;
    rdTag.material.opacity = lab(clamp((r4 - 0.4) / 0.5), f4);
    calPipe.mat.opacity = r4 * 0.35 * f4; calFlow.mat.opacity = clamp((r4 - 0.5) / 0.4) * f4;
    frames[3].opacity = r4 * 0.45 * f4; tags[3].opacity = lab(r4, f4);
    l3Up.mat.opacity = r4 * 0.9 * f4; l3Up.smat.opacity = r4 * 0.3 * f4;
    // the name rings: the top one rises with the stack
    const topY = 2.6 + (Y2 * r2 + (Y3 - Y2) * r3 + (Y4 - Y3) * r4);
    nameRings.forEach((r) => { r.m.position.y = r.k ? topY + 0.6 * r4 + 0.4 : SB - 0.2; r.m.material.opacity = all * 0.8; });
    spine.mat.opacity = clamp(r2 * 0.6 + r4 * 0.4); spine.smat.opacity = spine.mat.opacity * 0.4;
    // outer ring
    rnMat.opacity = r5; wMat.opacity = clamp((r5 - 0.3) / 0.5); bandMats.forEach((m, i) => { m.opacity = r5 * (i === 1 || i === 2 ? 0.32 : 0.14); });
    ringText.opacity = clamp((r5 - 0.4) / 0.5);
    ringG.scale.setScalar(0.75 + 0.25 * ease(r5));
    cmMat.opacity = clamp((r5 - 0.5) / 0.4); splash.material.opacity = comet.splash * 0.8 * cmMat.opacity; splash.scale.setScalar(0.2 + (1 - comet.splash) * 1.6);

    // camera
    let tx, ty, tz, rad, th, ph;
    if (v.ghost) { tx = 0; ty = 6.0; tz = 0; rad = 42; th = 0.4 + t * 0.06 + ptr.x * 0.08; ph = 0.36; }
    else {
      [tx, ty, tz, rad, th, ph] = camAt(pS);
      th += t * 0.02 + ptr.x * 0.1 + user.th * all; ph = Math.max(0.12, Math.min(1.25, ph - ptr.y * 0.04 + user.ph * all));
    }
    rad *= Math.max(1, (small ? 1.0 : 1.3) / camera.aspect);
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

function ringTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), grd = g.createRadialGradient(64, 64, 30, 64, 64, 62);
  grd.addColorStop(0, "rgba(255,255,255,0)"); grd.addColorStop(0.55, "rgba(255,255,255,.08)"); grd.addColorStop(0.82, "rgba(255,255,255,.9)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
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

// a pill-shaped upright tag (for sprites)
function tagTex(text, color) {
  const c = document.createElement("canvas"), g = c.getContext("2d"), H = 64;
  g.font = "600 34px 'JetBrains Mono', monospace"; if ("letterSpacing" in g) g.letterSpacing = "3px";
  const w = Math.ceil(g.measureText(text).width) + 44; c.width = w; c.height = H;
  g.font = "600 34px 'JetBrains Mono', monospace"; if ("letterSpacing" in g) g.letterSpacing = "3px";
  g.fillStyle = "rgba(4,14,22,.72)"; g.strokeStyle = rgbOf(color); g.lineWidth = 2;
  g.beginPath(); g.roundRect ? g.roundRect(2, 6, w - 4, H - 12, 26) : g.rect(2, 6, w - 4, H - 12); g.fill(); g.stroke();
  g.fillStyle = "#f2fbff"; g.textBaseline = "middle"; g.fillText(text, 22, H / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// "SIMUWORLD CHALLENGE · MANY WORLDS ·", written along the planetary ring
function ringNameTexture() {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 96;
  const g = c.getContext("2d");
  g.textBaseline = "middle"; g.font = "700 50px 'Space Grotesk', sans-serif";
  if ("letterSpacing" in g) g.letterSpacing = "16px";
  g.shadowColor = "rgba(143,214,255,.9)"; g.shadowBlur = 14;
  g.fillStyle = "rgba(236,250,255,.95)"; g.fillText("SIMUWORLD CHALLENGE", 30, 50);
  g.fillStyle = "rgba(143,214,255,.8)"; g.font = "600 40px 'JetBrains Mono', monospace"; g.fillText("·  MANY WORLDS  ·  YOUR AGENT ENTERS HERE  ·", 860, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// "ECONOMIC WORLD MODEL ·" repeated, for the turning name rings
function nameTexture() {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(190,230,255,.95)"; g.textBaseline = "middle"; g.font = "700 54px 'Space Grotesk', sans-serif";
  if ("letterSpacing" in g) g.letterSpacing = "14px";
  g.shadowColor = "rgba(143,214,255,.9)"; g.shadowBlur = 12;
  g.fillText("ECONOMIC WORLD MODEL  ·  ECONOMIC WORLD MODEL  ·  ", 10, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
