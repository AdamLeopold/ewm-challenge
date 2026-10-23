/* SimuWorld home · the economic world model, in WebGL.
   The story the camera tells, scrolled by the pinned scene's progress (--p on .scene-stack):
     L1  Intelligence foundation lives inside every agent. We start inside one agent's chest -- an LLM as stacked
         transformer sheets with word tokens rising and attention arcs, an RL objective landscape with a ball
         climbing it inside an action -> environment -> reward loop -- and pull out to find a waving figure.
     L2  Economic agents: low-poly people on a platform, walking, talking to each other, docking at a bank,
         a stock market, a firm or a home for a moment (borrow, trade, work, spend), then letting go. The
         buildings themselves slide to new cells now and then and snap into place.
     L3  Economic environment & institutions: mechanism modules around market clearing, wired by pipes of data.
         Neural-network-like lines grow from the agents' heads up into these modules.
     L4  Equilibrium & reality discipline: an armillary of three rings (behaviour, data, learned environment)
         converging on the data-driven generative equilibrium, beside real data the simulated curve learns to fit.
   A light spine runs through the model and "ECONOMIC WORLD MODEL" turns around its top and bottom. Around it,
   SIMUWORLD CHALLENGE circles as big lettering with depth; now and then your agent flies in from it.
   Once the model is complete it can be dragged around. A faint copy turns behind the foundation section.
   Falls back to the CSS stack when WebGL is unavailable or motion is reduced. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

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
  // people and buildings: low-poly models by Quaternius (CC0), see assets/models/LICENSE.txt
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = (n) => new Promise((res, rej) => loader.load("assets/models/" + n + ".glb", res, undefined, rej));
  const assets = Promise.all([
    Promise.all(["male-suit", "female-casual", "male-worker", "female-suit"].map(load)),
    Promise.all(["bank", "market", "firm", "home"].map(load)),
  ]);
  Promise.all([fontsReady, assets]).then(([, a]) => start(a)).catch(() => { /* keep the CSS stack */ });
}

function start([charGltf, bldGltf]) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.008);

  // one scene, two views: the pinned scene, and the faint backdrop behind the foundation section
  const makeView = (cv, el, dpr, ghost) => {
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !ghost, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dpr));
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 300);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.4, 0.38);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // light is the only thing drawn: alpha follows brightness, so the canvas adds glow over the page and never darkens it
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; vec4 s = texture2D(tDiffuse, vUv); gl_FragColor = vec4(c, clamp(max(max(c.r, max(c.g, c.b)), smoothstep(0.82, 1.0, s.a)), 0.0, 1.0)); }",
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
  const PINK = new THREE.Color(0xff5fd2), GOLD = new THREE.Color(0xffc857), LILAC = new THREE.Color(0xc9b6ff);
  const PY = 0, Y3 = 3.8, Y4 = 7.6, HALF = 6, RING_Y = 3.6;
  const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const dot = dotTexture();
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (v) => 1 - Math.pow(1 - v, 3);
  const sstep = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const backOut = (v) => { const c = 1.7; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };

  /* ---------- shared building blocks ---------- */
  const flatLabel = (title, sub, color, w, x, y, z, rotZ, parent) => {
    const tex = labelTex(title, sub, color), h = w * tex.image.height / tex.image.width;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotZ || 0; m.position.set(x, y, z); (parent || scene).add(m); return m.material;
  };
  const texCache = {};
  const tag = (text, color, h, parent) => {
    const key = text + "|" + color.getHex(), tex = texCache[key] || (texCache[key] = tagTex(text, color));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    s.scale.set(h * tex.image.width / tex.image.height, h, 1); (parent || scene).add(s); return s;
  };
  const frame = (y, color, dashed) => {
    const pts = [[-HALF, y, -HALF], [HALF, y, -HALF], [HALF, y, HALF], [-HALF, y, HALF], [-HALF, y, -HALF]].map((p) => new THREE.Vector3(...p));
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0 })
                       : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); if (dashed) l.computeLineDistances(); scene.add(l); return mat;
  };
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
  const packets = (paths, per, size, wrapAround, parent) => {
    const TAIL = 3, list = [];
    paths.forEach((pp) => { for (let k = 0; k < per; k++) list.push({ pp, u: Math.random(), sp: 0.14 + Math.random() * 0.2, dir: pp.bidir && k % 2 ? -1 : 1 }); });
    const pos = new Float32Array(list.length * TAIL * 3), col = new Float32Array(list.length * TAIL * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, ...ADD, opacity: 0, map: dot });
    (parent || scene).add(new THREE.Points(geo, mat));
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

  /* ---------- L2 · the agent platform: low-poly people and buildings ---------- */
  scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x202a3a, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(6, 12, 9); scene.add(sun);
  const CHAR_H = 1.45, CHEST = 0.9, bldMats = new Set();
  const fit = (obj, size, byHeight) => {   // scale a model to a height (people) or a footprint (buildings), standing on y = 0
    obj.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(obj), d = box.getSize(new THREE.Vector3());
    const s = size / (byHeight ? d.y : Math.max(d.x, d.z)); obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true); box.setFromObject(obj); obj.position.y -= box.min.y; obj.position.x -= (box.min.x + box.max.x) / 2; obj.position.z -= (box.min.z + box.max.z) / 2;
    return box.max.y - box.min.y;
  };
  const makeFigure = (i) => {
    const src = charGltf[i % charGltf.length], model = cloneSkinned(src.scene), g = new THREE.Group(), mats = [];
    model.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.frustumCulled = false; mats.push(o.material); } });
    g.add(model); fit(model, CHAR_H, true); scene.add(g);
    const mixer = new THREE.AnimationMixer(model), acts = {};
    src.animations.forEach((a) => { acts[a.name] = mixer.clipAction(a); });
    const f = { g, mats, mixer, acts, cur: null };
    f.play = (name, speed) => {
      const a = acts[name] || acts.Idle; a.timeScale = speed || 1; if (f.cur === a) return;
      a.reset().setEffectiveWeight(1).play(); if (f.cur) f.cur.crossFadeTo(a, 0.35, false); f.cur = a;
    };
    f.play("Idle"); mixer.update(Math.random() * 2);
    return f;
  };
  const BLD = { bank: [VIOLET, "BANK", 1.55, 0], market: [GREEN, "STOCK MARKET", 1.35, 1], firm: [TEAL, "FIRM", 1.4, 2], home: [SKY, "HOME", 1.2, 3] };
  const makeBuilding = (kind) => {
    const [c, name, size, gi] = BLD[kind], g = new THREE.Group(), model = bldGltf[gi].scene.clone(true);
    model.traverse((o) => { if (o.isMesh) { o.material.transparent = true; bldMats.add(o.material); } });
    g.add(model); const top = fit(model, size, false);
    if (kind === "market") {   // a live ticker on the roof
      const cg = new THREE.Group(); cg.position.y = top + 0.02; g.add(cg);
      g.userData.candles = [0, 1, 2, 3, 4].map((i) => {
        const m = new THREE.MeshStandardMaterial({ color: i % 3 === 1 ? 0xff4d8d : 0x18d67a, emissive: i % 3 === 1 ? 0x5a0a28 : 0x064d2a, roughness: 0.5, transparent: true }); bldMats.add(m);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1, 0.14).translate(0, 0.5, 0), m), wick = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1, 0.025).translate(0, 0.5, 0), m);
        b.position.x = wick.position.x = -0.44 + i * 0.22; cg.add(b, wick); return { b, wick, ph: i * 1.3 };
      });
    }
    const label = tag(name, c, 0.26);
    scene.add(g); return { g, kind, c, label, top: top + (kind === "market" ? 0.55 : 0), cell: null, from: null, to: null, k: 1, docks: 0 };
  };
  const CELLS = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i || j) CELLS.push([i * 2.3, j * 2.3]);
  const KINDS_B = ["bank", "market", "firm", "home", "bank", "market", "home", "firm"].slice(0, small ? 5 : 8);
  const shuffled = CELLS.filter((c) => !(Math.abs(c[0]) < 1 && c[1] > 1)).sort(() => Math.random() - 0.5);   // keep the hero's spot clear
  const buildings = KINDS_B.map((k, i) => { const b = makeBuilding(k); b.cell = shuffled[i]; b.g.position.set(b.cell[0], PY, b.cell[1]); b.g.rotation.y = (Math.random() - 0.5) * 0.6; return b; });
  const FCOL = [WHITE, ICE, WHITE, LILAC, ICE, WHITE, SKY];
  const NF = small ? 8 : 14, figs = [];
  for (let i = 0; i < NF; i++) {
    const f = makeFigure(i); f.c = i === 0 ? WHITE : FCOL[i % FCOL.length];
    Object.assign(f, { x: i === 0 ? 0 : (Math.random() - 0.5) * 9, z: i === 0 ? 2.6 : (Math.random() - 0.5) * 9, yaw: 0, state: "wander", tx: 0, tz: 0, timer: Math.random() * 2, walk: Math.random() * 6, partner: null, target: null });
    f.tag = tag("TALK", WHITE, 0.24); f.tag.userData.word = "TALK|" + WHITE.getHex();
    f.tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: f.c, ...ADD, opacity: 0 }));
    scene.add(f.tether); f.tetherA = 0;
    figs.push(f);
  }
  const hero = figs[0];
  const coins = [0, 1, 2, 3].map(() => { const mat = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0x5a3a00, metalness: 0.6, roughness: 0.3, transparent: true }); bldMats.add(mat); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.035, 18), mat); m.visible = false; scene.add(m); return { m, k: 1, a: new THREE.Vector3(), b: new THREE.Vector3() }; });
  const ACT = { bank: "BORROW", market: "TRADE", firm: "WORK", home: "SPEND · SAVE" };
  const setTag = (f, word, color) => {
    const key = word + "|" + color.getHex(); if (f.tag.userData.word === key) return;
    const tex = texCache[key] || (texCache[key] = tagTex(word, color));
    f.tag.material.map = tex; f.tag.material.needsUpdate = true; f.tag.scale.set(0.24 * tex.image.width / tex.image.height, 0.24, 1); f.tag.userData.word = key;
  };
  const grid = new THREE.GridHelper(HALF * 2, 12, ICE, ICE); grid.position.y = PY; grid.material.transparent = true; grid.material.opacity = 0; grid.material.depthWrite = false; scene.add(grid);

  /* ---------- L1 · intelligence foundation, built at its own scale and carried in the hero's chest ---------- */
  const S1 = 0.021, l1G = new THREE.Group(); l1G.scale.setScalar(S1); scene.add(l1G);
  const LX = -3.0, SHEETS = [0.35, 1.05, 1.75], L1TOP = 3.3;
  const sheetMats = SHEETS.map((y) => {
    const g = new THREE.PlaneGeometry(4.6, 3.6); g.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ICE, ...ADD, opacity: 0, side: THREE.DoubleSide }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0 }));
    fill.position.set(LX, y, 0); edge.position.set(LX, y, 0); l1G.add(fill, edge);
    return [fill.material, edge.material];
  });
  const WORDS = ["BELIEF", "PRICE", "PLAN", "RISK", "WHY", "IF", "WAGE", "RATE", "TRUST", "DEBT", "SAVE", "BUY", "EXPECT", "SIGNAL"];
  const NT = small ? 8 : 12, tokens = [];
  for (let i = 0; i < NT; i++) {
    const s = tag(WORDS[i % WORDS.length], i % 4 === 0 ? WHITE : ICE, 0.3, l1G);
    const tk = { s, k: i / NT, sp: 1 / (7 + Math.random() * 3), path: [], fade: 0 };
    tk.pick = () => { tk.path = [new THREE.Vector3(LX - 3.0, SHEETS[0] + 0.12, (Math.random() - 0.5) * 2.8)];
      SHEETS.forEach((y) => tk.path.push(new THREE.Vector3(LX + (Math.random() - 0.5) * 3.6, y + 0.14, (Math.random() - 0.5) * 2.8)));
      tk.path.push(new THREE.Vector3(LX + (Math.random() - 0.5) * 2, L1TOP, (Math.random() - 0.5) * 2)); };
    tk.pick(); tokens.push(tk);
  }
  const AR = small ? 5 : 8, ARS = 14, arPos = new Float32Array(AR * ARS * 6), arCol = new Float32Array(AR * ARS * 6), arGeo = new THREE.BufferGeometry();
  arGeo.setAttribute("position", new THREE.BufferAttribute(arPos, 3)); arGeo.setAttribute("color", new THREE.BufferAttribute(arCol, 3));
  const arMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  l1G.add(new THREE.LineSegments(arGeo, arMat));
  const arcs = []; for (let i = 0; i < AR; i++) arcs.push({ a: 0, b: 1, life: Math.random(), dur: 1.4 + Math.random() });
  const RX = 3.0, GN = small ? 24 : 34, GS = 4.6;
  const hgt = (x, z) => { x -= RX;
    return 1.25 * Math.exp(-((x - 0.9) ** 2 + (z + 0.6) ** 2) / 0.9) + 0.75 * Math.exp(-((x + 1.0) ** 2 + (z - 0.9) ** 2) / 0.7)
      + 0.35 * Math.exp(-((x + 0.2) ** 2 + (z + 1.4) ** 2) / 0.5) + 0.06 * Math.sin(x * 3) * Math.cos(z * 3); };
  const tPos = [], tCol = [];
  const tv = (i, j) => { const x = RX - GS / 2 + i / (GN - 1) * GS, z = -GS / 2 + j / (GN - 1) * GS, h = hgt(x, z); return [x, 0.05 + h, z, h]; };
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
  l1G.add(new THREE.LineSegments(terGeo, terMat));
  const ball = { x: RX - 1.6, z: 1.6, trail: [], pause: 0 };
  const BT = 40, btPos = new Float32Array(BT * 3), btCol = new Float32Array(BT * 3), btGeo = new THREE.BufferGeometry();
  btGeo.setAttribute("position", new THREE.BufferAttribute(btPos, 3)); btGeo.setAttribute("color", new THREE.BufferAttribute(btCol, 3));
  const btMat = new THREE.PointsMaterial({ size: 0.22 * S1, vertexColors: true, ...ADD, opacity: 0, map: dot });
  l1G.add(new THREE.Points(btGeo, btMat));
  const ballGeo = new THREE.BufferGeometry(); ballGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
  const ballMat = new THREE.PointsMaterial({ size: 0.7 * S1, color: WHITE, ...ADD, opacity: 0, map: dot });
  l1G.add(new THREE.Points(ballGeo, ballMat));
  const loopPts = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2; loopPts.push(new THREE.Vector3(RX + Math.cos(a) * 2.9, 0.08, Math.sin(a) * 2.9)); }
  const loopMat = new THREE.LineBasicMaterial({ color: GREEN, ...ADD, opacity: 0 });
  l1G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loopPts), loopMat));
  const loopFlow = packets([{ pts: loopPts, c: GREEN, speed: 0.5 }], small ? 5 : 8, 0.34 * S1, true, l1G);
  const loopTags = [["ACTION", 0.6], ["ENVIRONMENT", 2.7], ["REWARD", 4.8]].map(([w, a]) => { const s = tag(w, GREEN, 0.3, l1G); s.position.set(RX + Math.cos(a) * 3.35, 0.35, Math.sin(a) * 3.35); return s; });
  const l1Labels = [
    flatLabel("LLM", "BELIEFS · REASONING · LANGUAGE", ICE, 3.4, LX, 0.02, 2.65, 0, l1G),
    flatLabel("RL", "GOALS · OPTIMISATION · ADAPTATION", GREEN, 3.4, RX, 0.02, 3.7, 0, l1G),
  ];
  const l1Tag = tag("L1 · INTELLIGENCE FOUNDATION · INSIDE EVERY AGENT", ICE, 0.42, l1G); l1Tag.position.set(0, 4.4, 0);
  const chest = new THREE.Vector3();

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

  // neural lines: from each agent's head, a trunk to a node, then branches into a few L3 modules
  const BR = 3, NSEG = 1 + BR * 2;
  const nlPos = new Float32Array(NF * NSEG * 6), nlCol = new Float32Array(NF * NSEG * 6), nlGeo = new THREE.BufferGeometry();
  nlGeo.setAttribute("position", new THREE.BufferAttribute(nlPos, 3)); nlGeo.setAttribute("color", new THREE.BufferAttribute(nlCol, 3));
  const nlMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(nlGeo, nlMat));
  const NN = NF * (1 + BR), nnPos = new Float32Array(NN * 3), nnCol = new Float32Array(NN * 3), nnGeo = new THREE.BufferGeometry();
  nnGeo.setAttribute("position", new THREE.BufferAttribute(nnPos, 3)); nnGeo.setAttribute("color", new THREE.BufferAttribute(nnCol, 3));
  const nnMat = new THREE.PointsMaterial({ size: 0.34, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(nnGeo, nnMat));
  const NP = NF * 2, npPos = new Float32Array(NP * 3), npCol = new Float32Array(NP * 3), npGeo = new THREE.BufferGeometry();
  npGeo.setAttribute("position", new THREE.BufferAttribute(npPos, 3)); npGeo.setAttribute("color", new THREE.BufferAttribute(npCol, 3));
  const npMat = new THREE.PointsMaterial({ size: 0.3, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(npGeo, npMat));
  figs.forEach((f, i) => { f.links = [0, 1, 2].map((k) => (i * 3 + k * 2 + 1) % l3Mods.length); f.nph = Math.random(); });

  /* ---------- L4 · equilibrium & reality discipline ---------- */
  const AC = new THREE.Vector3(-0.6, Y4 + 1.7, 0), AR_R = 1.9;
  const ARM = [
    { n: "BEHAVIOUR", c: WHITE, tilt: [1.05, 0.0, 0.45], spin: 0.55 },
    { n: "DATA", c: TEAL, tilt: [-0.7, 0.0, 1.0], spin: -0.4 },
    { n: "LEARNED ENV", c: VIOLET, tilt: [0.25, 0.0, -1.15], spin: 0.32 },
  ].map((d) => {
    const g = new THREE.Group(); g.position.copy(AC);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(AR_R, 0.028, 6, 160), new THREE.MeshBasicMaterial({ color: d.c, ...ADD, opacity: 0 }));
    g.add(ringM); scene.add(g);
    return { ...d, g, ringM, label: tag(d.n, d.c, 0.27), ang: Math.random() * 6.28 };
  });
  const BEADS = 3, bdPos = new Float32Array(ARM.length * BEADS * 3), bdCol = new Float32Array(ARM.length * BEADS * 3), bdGeo = new THREE.BufferGeometry();
  bdGeo.setAttribute("position", new THREE.BufferAttribute(bdPos, 3)); bdGeo.setAttribute("color", new THREE.BufferAttribute(bdCol, 3));
  const bdMat = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(bdGeo, bdMat));
  const fpGeo = new THREE.BufferGeometry(); fpGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([AC.x, AC.y, AC.z]), 3));
  const fpMat = new THREE.PointsMaterial({ size: 1.2, color: WHITE, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(fpGeo, fpMat));
  const fpTag = tag("DATA-DRIVEN GENERATIVE EQUILIBRIUM", WHITE, 0.27), fpTag2 = tag("FIXED POINT", ICE, 0.22);
  fpTag.position.set(AC.x, AC.y - AR_R - 0.45, AC.z); fpTag2.position.set(AC.x, AC.y - AR_R - 0.78, AC.z);
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
  const SH = 7.0, SB = PY - 0.7;
  const nameRings = [0, 1].map((k) => {
    const tex = nameTexture(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(SH * 1.32, SH * 1.32, 0.62, 128, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide }));
    scene.add(m); return { m, tex, k };
  });
  const spine = risers([{ x: 0, z: 0, y0: PY + 1.4, y1: Y4 + 2.4, c: ICE }, { x: 0.06, z: 0.06, y0: Y4 + 2.4, y1: PY + 1.4, c: VIOLET }], 9, 0.12, 0.22);
  const frames = [frame(PY, WHITE), frame(Y3, ICE), frame(Y4, ICE, true)];
  const tags = [
    flatLabel("L2", "ECONOMIC AGENTS", WHITE, 3.8, -HALF + 1.9, PY + 0.02, HALF + 0.75),
    flatLabel("L3", "ENVIRONMENT & INSTITUTIONS", ICE, 3.8, -HALF + 1.9, Y3 + 0.02, HALF + 0.75),
    flatLabel("L4", "EQUILIBRIUM & REALITY", ICE, 3.8, -HALF + 1.9, Y4 + 0.02, HALF + 0.75),
  ];

  /* ---------- outer layer · SimuWorld Challenge: the name itself circles the model ---------- */
  // big upright letters on a gently tilted circle well clear of the model; stacked copies set slightly inward and
  // darker give the letters real depth, like a sign around a globe. No band, no rails: just the lettering.
  const RR = 15.5, RH = 3.4, DEPTH = 8;
  const ringG = new THREE.Group(); ringG.position.y = RING_Y; ringG.rotation.set(0.1, 0, -0.05, "ZXY"); scene.add(ringG);
  const spinG = new THREE.Group(); ringG.add(spinG);
  const nameTex = ringNameTexture(); nameTex.wrapS = THREE.RepeatWrapping; nameTex.repeat.set(2, 1);
  const letterLayers = [];
  for (let k = DEPTH - 1; k >= 0; k--) {
    const shade = k === 0 ? 1 : 0.34 - k * 0.03, geo = new THREE.CylinderGeometry(RR - k * 0.06, RR - k * 0.06, RH, 256, 1, true);
    const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: nameTex, color: new THREE.Color(shade, shade, shade), transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide }));
    front.renderOrder = 10 + (DEPTH - k); spinG.add(front); letterLayers.push({ m: front.material, k });
    if (k === 0) { const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide })); back.renderOrder = 1; spinG.add(back); letterLayers.push({ m: back.material, k: -1 }); }
  }
  const CT = 12, cmPos = new Float32Array(CT * 3), cmCol = new Float32Array(CT * 3), cmGeo = new THREE.BufferGeometry();
  cmGeo.setAttribute("position", new THREE.BufferAttribute(cmPos, 3)); cmGeo.setAttribute("color", new THREE.BufferAttribute(cmCol, 3));
  const cmMat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(cmGeo, cmMat));
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: GOLD, ...ADD, opacity: 0, side: THREE.DoubleSide }));
  splash.rotation.x = -Math.PI / 2; scene.add(splash);
  const comet = { k: 1, curve: null, splash: 0, wait: 1.5 };
  const COMET_C = [GREEN, TEAL, VIOLET, ICE, GOLD];

  /* ---------- camera path ---------- */
  // [progress, target x, target y, target z, radius, azimuth, elevation]; the radius is interpolated in log space
  const HC = [0, CHEST, 2.6];   // the hero's chest
  const KEYS = [
    [0.00, HC[0], HC[1], HC[2], 0.13, 0.35, 0.12],
    [0.07, HC[0], HC[1], HC[2], 0.3, 0.05, 0.22],
    [0.13, HC[0], HC[1] - 0.1, HC[2], 1.3, -0.15, 0.2],
    [0.19, HC[0], 0.75, HC[2], 3.6, -0.3, 0.2],
    [0.27, 0, 0.6, 1.2, 11, 0.05, 0.42],
    [0.35, 0, 0.5, 0, 18, 0.4, 0.6],
    [0.43, 0, Y3 - 1.6, 0, 21, 0.7, 0.42],
    [0.50, 0, Y3, 0, 18, 1.0, 0.62],
    [0.58, 0.8, Y4 + 1.2, 0, 20, 0.55, 0.42],
    [0.68, 0.4, Y4 + 1.4, 0, 16.5, 0.1, 0.34],
    [0.80, 0, 3.6, 0, 70, 0.35, 0.2],
    [0.92, 0, 3.4, 0, 64, 0.7, 0.17],
    [1.00, 0, 3.4, 0, 64, 0.85, 0.17],
  ].map((k) => { const c = k.slice(); c[4] = Math.log(c[4]); return c; });
  const cr = (p0, p1, p2, p3, s) => 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
  const camAt = (p) => {
    p = clamp(p); let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(KEYS.length - 1, i + 2)];
    const s = (p - b[0]) / (c[0] - b[0]), e = s * s * (3 - 2 * s) * 0.35 + s * 0.65;
    const out = []; for (let k = 1; k < 7; k++) out.push(cr(a[k], b[k], c[k], d[k], e)); out[3] = Math.exp(out[3]); return out;
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

  /* ---------- agent behaviour: wander, pick an errand, dock for a moment, let go ---------- */
  const freeCell = () => { const used = new Set(buildings.map((b) => b.cell.join())); const c = shuffled.filter((c) => !used.has(c.join())); return c[Math.floor(Math.random() * c.length)]; };
  const turnTo = (f, want, rate, dt) => { let dy = want - f.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; f.yaw += dy * (1 - Math.pow(rate, dt)); };
  const choose = (f) => {
    if (Math.random() < 0.3) {
      const free = figs.filter((g) => g !== f && g !== hero && g.state === "wander"), o = free[Math.floor(Math.random() * free.length)];
      if (o) { f.state = "go"; f.target = null; f.partner = o; o.state = "wait"; o.partner = f; return; }
    }
    if (Math.random() < 0.8) { const b = buildings[Math.floor(Math.random() * buildings.length)]; if (b.k >= 1) { f.state = "go"; f.target = b; f.partner = null; return; } }
    f.state = "wander"; f.tx = (Math.random() - 0.5) * 10; f.tz = (Math.random() - 0.5) * 10; f.timer = 2 + Math.random() * 3;
  };
  const release = (f) => {
    if (f.target) f.target.docks--;
    if (f.partner && f.partner.partner === f) { const o = f.partner; o.state = "wander"; o.timer = 0.5; o.partner = null; o.tx = o.x; o.tz = o.z; }
    f.target = null; f.partner = null; f.state = "wander"; f.tx = f.x + (Math.random() - 0.5) * 4; f.tz = f.z + (Math.random() - 0.5) * 4; f.timer = 1.5 + Math.random() * 2;
  };
  const stepFigure = (f, dt, t, heroHold) => {
    let moving = false, gx = f.tx, gz = f.tz;
    if (f === hero && heroHold) { if (f.state !== "hold") { if (f.state === "dock" || f.state === "go") release(f); f.state = "hold"; } }
    else if (f.state === "hold") { f.state = "wander"; f.timer = 0; }
    if (f.state === "wander") { f.timer -= dt; if (f.timer <= 0) choose(f); }
    if (f.state === "go") {
      if (f.target) {
        const b = f.target.g.position, dx = f.x - b.x, dz = f.z - b.z, d = Math.hypot(dx, dz) || 1; gx = b.x + dx / d * 0.95; gz = b.z + dz / d * 0.95;
        if (Math.hypot(f.x - gx, f.z - gz) < 0.08) {
          f.state = "dock"; f.timer = 2 + Math.random() * 2; f.target.docks++;
          if (f.target.kind === "bank") { const c = coins.find((c) => c.k >= 1); if (c) { c.k = 0; c.a.set(b.x, 0.7, b.z); c.b.set(f.x, 0.95, f.z); } }
        }
      } else if (f.partner) {
        const o = f.partner; if (o.partner !== f) { release(f); return; }
        const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz) || 1; gx = o.x + dx / d * 0.7; gz = o.z + dz / d * 0.7;
        if (Math.hypot(f.x - gx, f.z - gz) < 0.08) { f.state = "dock"; f.timer = 2.5 + Math.random() * 1.5; o.state = "dock"; o.timer = f.timer + 0.2; }
      } else f.state = "wander";
    }
    if (f.state === "dock") { f.timer -= dt; if (f.timer <= 0) release(f); }
    if (f.state === "wander" || f.state === "go") {
      const dx = gx - f.x, dz = gz - f.z, d = Math.hypot(dx, dz);
      if (d > 0.05) { const sp = Math.min(d, 0.9 * dt); f.x += dx / d * sp; f.z += dz / d * sp; moving = true; turnTo(f, Math.atan2(dx, dz), 0.002, dt); }
      f.x = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, f.x)); f.z = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, f.z));
    }
    if (f.state === "dock") { const o = f.target ? f.target.g.position : f.partner; if (o) turnTo(f, Math.atan2(o.x - f.x, o.z - f.z), 0.01, dt); }
    if (f.state === "hold") turnTo(f, 0, 0.01, dt);
    // animation: walk while moving, wave hello, reach out at a building, idle otherwise
    if (moving) f.play("Walk", 1.15);
    else if (f.state === "hold") f.play("Wave");
    else if (f.state === "dock") f.play(f.target ? "Interact" : "Wave", f.target ? 1 : 0.8);
    else f.play("Idle");
    f.mixer.update(dt);
    f.g.position.set(f.x, PY, f.z); f.g.rotation.y = f.yaw;
    const docked = f.state === "dock";
    f.tetherA += ((docked ? 1 : 0) - f.tetherA) * (1 - Math.pow(0.02, dt));
    if (docked) {
      const o = f.target ? f.target.g.position : f.partner, tp = f.tether.geometry.attributes.position;
      tp.setXYZ(0, f.x, 1.0, f.z); tp.setXYZ(1, o.x, f.target ? 0.7 : 1.0, o.z); tp.needsUpdate = true;
      setTag(f, f.target ? ACT[f.target.kind] : "TALK", f.target ? f.target.c : WHITE);
    }
    f.tag.position.set(f.x, PY + CHAR_H + 0.3, f.z);
  };

  /* ---------- loop ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let t = 0, last = performance.now(), frameN = 0, conv = 0, moveT = 4;
  if (ghostCanvas) { try { views.push(makeView(ghostCanvas, ghostHost, 1, true)); ghostHost.classList.add("gl-on"); } catch (e) { /* no backdrop */ } }
  const tmp = new THREE.Vector3(), cv = new THREE.Vector3(), headV = new THREE.Vector3(), nodeV = new THREE.Vector3(), midV = new THREE.Vector3(), endV = new THREE.Vector3(), pV = new THREE.Vector3();

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

    // L2 · agents and buildings
    const heroHold = main.visible && main.pS < 0.24;
    if (heroHold) { hero.x += (0 - hero.x) * (1 - Math.pow(0.05, dt)); hero.z += (2.6 - hero.z) * (1 - Math.pow(0.05, dt)); }
    figs.forEach((f) => stepFigure(f, dt, t, heroHold));
    moveT -= dt;
    if (moveT <= 0) {   // now and then a building slides to a free cell and snaps into place
      moveT = 5 + Math.random() * 4;
      const idle = buildings.filter((b) => b.docks <= 0 && b.k >= 1 && !figs.some((f) => f.target === b)), b = idle[Math.floor(Math.random() * idle.length)];
      if (b) { b.from = b.g.position.clone(); b.cell = freeCell(); b.to = new THREE.Vector3(b.cell[0], PY, b.cell[1]); b.k = 0; }
    }
    buildings.forEach((b) => {
      if (b.k < 1) { b.k = Math.min(1, b.k + dt / 1.3); b.g.position.lerpVectors(b.from, b.to, backOut(b.k)); }
      b.label.position.set(b.g.position.x, PY + b.top + 0.35, b.g.position.z);
      if (b.g.userData.candles) b.g.userData.candles.forEach((c, i) => {
        const h = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * (1.4 + i * 0.3) * (b.docks > 0 ? 2.5 : 1) + c.ph));
        c.b.scale.y = h; c.b.position.y = 0.12; c.wick.scale.y = h + 0.24; c.wick.position.y = 0;
      });
    });
    coins.forEach((c) => {
      if (c.k >= 1) { c.m.visible = false; return; }
      c.k = Math.min(1, c.k + dt / 1.1); c.m.visible = true;
      c.m.position.lerpVectors(c.a, c.b, c.k); c.m.position.y += Math.sin(Math.PI * c.k) * 0.8; c.m.rotation.set(Math.PI / 2, 0, t * 6);
    });

    // L1 · carried in the hero's chest
    hero.g.updateMatrixWorld(); chest.set(0, CHEST, 0.0); hero.g.localToWorld(chest);
    l1G.position.copy(chest); l1G.position.y -= 1.0 * S1; l1G.rotation.y = hero.yaw;
    tokens.forEach((tk) => {
      tk.k += tk.sp * dt; if (tk.k >= 1) { tk.k -= 1; tk.pick(); }
      const seg = tk.k * (tk.path.length - 1), i0 = Math.min(tk.path.length - 2, Math.floor(seg)), w = sstep(seg - i0);
      tk.s.position.copy(tk.path[i0]).lerp(tk.path[i0 + 1], w);
      tk.fade = Math.min(1, tk.k * 8, (1 - tk.k) * 6);
    });
    for (let i = 0; i < AR; i++) {
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
    if (ball.pause > 0) { ball.pause -= dt; if (ball.pause <= 0) { const a = Math.random() * 6.28; ball.x = RX + Math.cos(a) * 2.0; ball.z = Math.sin(a) * 2.0; ball.trail.length = 0; } }
    else {
      const e = 0.02, gx = (hgt(ball.x + e, ball.z) - hgt(ball.x - e, ball.z)) / (2 * e), gz = (hgt(ball.x, ball.z + e) - hgt(ball.x, ball.z - e)) / (2 * e), g = Math.hypot(gx, gz);
      const stepLen = Math.min(0.9, 0.35 + g) * dt;
      if (g < 0.05) ball.pause = 1.4; else { ball.x += gx / g * stepLen; ball.z += gz / g * stepLen; }
    }
    if (frameN % 3 === 0) { ball.trail.unshift(ball.x, ball.z); if (ball.trail.length > BT * 2) ball.trail.length = BT * 2; }
    ballGeo.attributes.position.setXYZ(0, ball.x, 0.12 + hgt(ball.x, ball.z), ball.z); ballGeo.attributes.position.needsUpdate = true;
    for (let q = 0; q < BT; q++) {
      const has = ball.trail.length > q * 2, x = has ? ball.trail[q * 2] : ball.x, z = has ? ball.trail[q * 2 + 1] : ball.z, f = has ? 1 - q / BT : 0;
      btPos.set([x, 0.1 + hgt(x, z), z], q * 3); btCol.set([GREEN.r * f + 0.4 * f, GREEN.g * f, GREEN.b * f + 0.3 * f], q * 3);
    }
    btGeo.attributes.position.needsUpdate = true; btGeo.attributes.color.needsUpdate = true;
    loopFlow.update(dt);

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
    const sp = simLine.geometry.attributes.position;
    const sim = curve((h, u) => h + (1 - conv) * (0.45 * Math.sin(u * 1.3 + t * 0.6) - 0.15));
    for (let i = 0; i < CP; i++) sp.setXYZ(i, sim[i * 3], sim[i * 3 + 1], sim[i * 3 + 2]);
    sp.needsUpdate = true;
    calFlow.update(dt);
    l3Up.update(t); spine.update(t);
    nameRings.forEach((r) => { r.tex.offset.x = (t * 0.012 * (r.k ? -1 : 1)) % 1; });

    // outer lettering turns; your agent flies in from a point on it
    spinG.rotation.y = -t * 0.05;
    if (comet.k >= 1) {
      comet.wait -= dt;
      if (comet.wait <= 0) {
        ringG.updateMatrixWorld(true);
        const ang = Math.random() * Math.PI * 2, a = new THREE.Vector3(Math.cos(ang) * RR, (Math.random() - 0.5) * RH * 0.6, Math.sin(ang) * RR).applyMatrix4(spinG.matrixWorld);
        const b = new THREE.Vector3((Math.random() - 0.5) * 5, PY + 0.4, (Math.random() - 0.5) * 5), m = a.clone().add(b).multiplyScalar(0.5); m.y += 4.5;
        comet.curve = new THREE.QuadraticBezierCurve3(a, m, b); comet.k = 0; comet.wait = 3.5; comet.col = COMET_C[Math.floor(Math.random() * COMET_C.length)];
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

  // neural lines for a given growth g (0..1): head -> node, then node -> mid -> module for each branch
  const growNeural = (g) => {
    figs.forEach((f, i) => {
      headV.set(f.x, PY + CHAR_H + 0.08, f.z);
      nodeV.set(f.x * 0.85, PY + CHAR_H + (Y3 - PY - CHAR_H) * 0.4, f.z * 0.85);
      const g1 = clamp(g * 2), g2 = clamp(g * 2 - 1), base = i * NSEG * 6, bright = 0.5 + 0.5 * Math.sin(t * 2 + i);
      const seg = (k, A, B, gg, c, f0) => {
        const o = base + k * 6; nlPos.set([A.x, A.y, A.z, A.x + (B.x - A.x) * gg, A.y + (B.y - A.y) * gg, A.z + (B.z - A.z) * gg], o);
        nlCol.set([c.r * f0, c.g * f0, c.b * f0, c.r * f0 * 0.6, c.g * f0 * 0.6, c.b * f0 * 0.6], o);
      };
      seg(0, headV, nodeV, g1, f.c, 1.4);
      const no = i * (1 + BR) * 3; nnPos.set([nodeV.x, nodeV.y, nodeV.z], no); nnCol.set([f.c.r * g1, f.c.g * g1, f.c.b * g1], no);
      f.links.forEach((mi, k) => {
        const m = l3Mods[mi];
        endV.set(m.x, m.y - m.h / 2, m.z);
        midV.set((nodeV.x + endV.x) / 2 + (k - 1) * 0.5, nodeV.y + (endV.y - nodeV.y) * 0.55, (nodeV.z + endV.z) / 2);
        const ga = clamp(g2 * 2), gb = clamp(g2 * 2 - 1);
        seg(1 + k * 2, nodeV, midV, ga, m.c, 1.2); seg(2 + k * 2, midV, endV, gb, m.c, 1.0);
        const o2 = no + (k + 1) * 3; nnPos.set([midV.x, midV.y, midV.z], o2); nnCol.set([m.c.r * ga, m.c.g * ga, m.c.b * ga], o2);
        if (k < 2) {   // a pulse travelling up this branch
          const u = (t * 0.45 + f.nph + k * 0.5) % 1, po = (i * 2 + k) * 3, vis = g >= 1 ? bright : 0;
          if (u < 0.4) pV.lerpVectors(headV, nodeV, u / 0.4); else if (u < 0.7) pV.lerpVectors(nodeV, midV, (u - 0.4) / 0.3); else pV.lerpVectors(midV, endV, (u - 0.7) / 0.3);
          npPos.set([pV.x, pV.y, pV.z], po); npCol.set([m.c.r * vis, m.c.g * vis, m.c.b * vis], po);
        }
      });
    });
    nlGeo.attributes.position.needsUpdate = true; nlGeo.attributes.color.needsUpdate = true;
    nnGeo.attributes.position.needsUpdate = true; nnGeo.attributes.color.needsUpdate = true;
    npGeo.attributes.position.needsUpdate = true; npGeo.attributes.color.needsUpdate = true;
  };

  function pose(v) {
    const pS = v.pS, camera = v.camera;
    const L = v.ghost ? 0.25 : 1 - clamp((pS - 0.2) / 0.1) * 0.75;      // L1 is the star at first, then a glow inside the agent
    const r2 = v.ghost ? 1 : ease(clamp((pS - 0.1) / 0.12)), r3 = clamp((pS - 0.38) / 0.13), g3 = clamp((pS - 0.36) / 0.12);
    const r4 = ease(clamp((pS - 0.53) / 0.1)), r5 = clamp((pS - 0.71) / 0.12);
    const all = clamp((pS - 0.76) / 0.1);
    const dimAfter = (next) => 1 - 0.8 * clamp((pS - next) / 0.06) * (1 - all);
    const f2 = dimAfter(0.45), f3 = dimAfter(0.55), f4 = dimAfter(0.73);
    const lab = (r, f) => r * (0.15 + 0.85 * f);

    // L1 inside the hero
    sheetMats.forEach(([fill, edge]) => { fill.opacity = 0.06 * L; edge.opacity = 0.6 * L; });
    tokens.forEach((tk) => { tk.s.material.opacity = L * tk.fade; });
    arMat.opacity = L; terMat.opacity = 0.8 * L; ballMat.opacity = L; btMat.opacity = 0.9 * L;
    loopMat.opacity = 0.45 * L; loopFlow.mat.opacity = L; loopTags.forEach((s) => { s.material.opacity = L; });
    l1Labels.forEach((m) => { m.opacity = L; });
    l1Tag.material.opacity = v.ghost ? 0 : clamp((0.17 - pS) / 0.06) * clamp(pS / 0.02 + 0.3);
    // L2
    const figA = (0.25 + 0.75 * f2);
    // seen from inside, the hero's own body is only a faint shell; the others arrive as we pull out
    const heroA = v.ghost ? figA : (0.12 + 0.88 * clamp((pS - 0.12) / 0.1)) * figA, othersA = v.ghost ? figA : clamp((pS - 0.12) / 0.1) * figA;
    figs.forEach((f) => {
      const a = f === hero ? heroA : othersA; f.mats.forEach((m) => { m.opacity = a; m.depthWrite = a > 0.97; });
      f.g.visible = a > 0.01;
      f.tether.material.opacity = f.tetherA * 0.7 * r2 * f2; f.tag.material.opacity = f.tetherA * r2 * (0.15 + 0.85 * f2);
    });
    const bA = r2 * (0.3 + 0.7 * f2); bldMats.forEach((m) => { m.opacity = bA; m.depthWrite = bA > 0.97; });
    buildings.forEach((b) => { b.g.visible = r2 > 0.01; b.label.material.opacity = lab(r2, f2) * 0.8; });
    grid.material.opacity = r2 * 0.12 * f2; frames[0].opacity = r2 * 0.4 * f2; tags[0].opacity = lab(r2, f2);
    // neural lines
    growNeural(v.ghost ? 1 : g3);
    const nA = v.ghost ? 1 : g3 > 0 ? 1 : 0;
    nlMat.opacity = nA * (0.35 + 0.65 * f3); nnMat.opacity = nA * (0.35 + 0.65 * f3); npMat.opacity = nnMat.opacity;
    // L3
    l3Mods.forEach((m, mi) => poseModule(m, clamp((r3 - mi * 0.045) / 0.4), f3, t, mi, l3Bars, mi === 0));
    inst.g.scale.setScalar(1 + (inst.bump || 0) * 0.28);
    l3Bars.instanceMatrix.needsUpdate = true; l3Bars.material.opacity = clamp((r3 - 0.1) / 0.3) * 0.8 * f3;
    rings.forEach((r) => { r.material.opacity = clamp(r3 / 0.3) * 0.55 * f3; });
    l3Pipes.forEach((pp) => { const k = clamp((r3 - 0.35 - pp.ordered * 0.01) / 0.3); pp.line.geometry.setDrawRange(0, Math.ceil(k * (SEG + 1))); pp.mat.opacity = 0.6 * k * f3; });
    l3Flow.mat.opacity = clamp((r3 - 0.65) / 0.25) * f3; frames[1].opacity = r3 * 0.4 * f3; tags[1].opacity = lab(r3, f3);
    // L4
    ARM.forEach((r, i) => { const k = clamp((r4 - i * 0.12) / 0.5); r.ringM.material.opacity = k * (0.55 + 0.45 * conv) * f4; r.label.material.opacity = lab(k, f4); r.g.scale.setScalar(0.6 + 0.4 * ease(k)); });
    bdMat.opacity = r4 * f4; fpMat.opacity = r4 * f4 * (0.25 + 0.75 * conv) * (0.85 + 0.15 * Math.sin(t * 3)); fpMat.size = 0.6 + 1.1 * conv;
    fpTag.material.opacity = lab(clamp((r4 - 0.4) / 0.5), f4) * (0.5 + 0.5 * conv); fpTag2.material.opacity = fpTag.material.opacity * 0.85;
    rdBars.material.opacity = clamp((r4 - 0.3) / 0.5) * 0.35 * f4; realLine.material.opacity = clamp((r4 - 0.4) / 0.5) * 0.9 * f4; simLine.material.opacity = realLine.material.opacity;
    rdTag.material.opacity = lab(clamp((r4 - 0.4) / 0.5), f4);
    calPipe.mat.opacity = r4 * 0.35 * f4; calFlow.mat.opacity = clamp((r4 - 0.5) / 0.4) * f4;
    frames[2].opacity = r4 * 0.45 * f4; tags[2].opacity = lab(r4, f4);
    l3Up.mat.opacity = r4 * 0.9 * f4; l3Up.smat.opacity = r4 * 0.3 * f4;
    // the name rings appear with the full view
    const topY = PY + 2.6 + (Y3 - PY) * r3 + (Y4 - Y3) * r4;
    nameRings.forEach((r) => { r.m.position.y = r.k ? topY + 0.6 * r4 + 0.4 : SB - 0.2; r.m.material.opacity = all * 0.8; });
    spine.mat.opacity = clamp(r3 * 0.6 + r4 * 0.4); spine.smat.opacity = spine.mat.opacity * 0.4;
    // outer lettering
    const nA5 = clamp((r5 - 0.1) / 0.5);
    letterLayers.forEach((l) => { l.m.opacity = nA5 * (l.k === 0 ? 1 : l.k < 0 ? 0 : 0.9); });
    ringG.scale.setScalar(0.85 + 0.15 * ease(r5));
    cmMat.opacity = clamp((r5 - 0.5) / 0.4); splash.material.opacity = comet.splash * 0.8 * cmMat.opacity; splash.scale.setScalar(0.2 + (1 - comet.splash) * 1.6);

    // camera
    let tx, ty, tz, rad, th, ph;
    if (v.ghost) { tx = 0; ty = 3.4; tz = 0; rad = 54; th = 0.4 + t * 0.06 + ptr.x * 0.08; ph = 0.2; }
    else {
      [tx, ty, tz, rad, th, ph] = camAt(pS);
      const far = clamp((pS - 0.2) / 0.1);   // no pointer sway while we are inside the agent
      th += (t * 0.02 + ptr.x * 0.1) * far + user.th * all; ph = Math.max(0.05, Math.min(1.25, ph - ptr.y * 0.04 * far + user.ph * all));
      if (pS < 0.3) { const k = 1 - clamp((pS - 0.22) / 0.08); tx += (hero.x - HC[0]) * k; tz += (hero.z - HC[2]) * k; }
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

// "SIMUWORLD · CHALLENGE ·", the lettering that circles the model
function ringNameTexture() {
  const c = document.createElement("canvas"); c.width = 4096; c.height = 288;
  const g = c.getContext("2d");
  g.textBaseline = "middle"; g.textAlign = "center"; g.font = "700 236px 'Space Grotesk', sans-serif";
  if ("letterSpacing" in g) g.letterSpacing = "30px";
  const grd = g.createLinearGradient(0, 30, 0, 260); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.5, "#cfeeff"); grd.addColorStop(1, "#73bcff");
  g.shadowColor = "rgba(143,214,255,.9)"; g.shadowBlur = 20; g.fillStyle = grd;
  g.fillText("SIMUWORLD", 1024, 150); g.fillText("CHALLENGE", 3072, 150);
  g.shadowBlur = 0; g.fillStyle = "rgba(143,214,255,.85)"; g.beginPath(); g.arc(2048, 144, 18, 0, 7); g.arc(4078, 144, 18, 0, 7); g.fill();
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
