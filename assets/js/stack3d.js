/* EWM Challenge home · the economic world model, in WebGL.
   The story the camera tells, scrolled by the pinned scene's progress (--p on .scene-stack):
     L1  Intelligence foundation lives inside every agent. We start inside one agent's chest -- a machined
         transformer stack with attention heads and tokens riding its residual stream, and beside it, wired to it,
         a cluster of branching RL neuron circuits -- which fold into a small orb as we pull out to find a waving figure.
     L2  Economic agents: low-poly people on a platform, walking, talking to each other, docking at a bank,
         a stock market, a firm or a home for a moment (borrow, trade, work, spend), then letting go. The
         buildings themselves slide to new cells now and then and snap into place.
     L3  Economic environment & institutions: mechanism modules around market clearing, wired by pipes of data.
         Neural-network-like lines grow from the agents' heads up into these modules. While the camera visits
         the upper layers they float further apart; in the finished view they settle back close together.
     L4  Equilibrium & reality discipline: an armillary of three rings (behaviour, data, learned environment)
         converging on the data-driven generative equilibrium, beside real data the simulated curve learns to fit.
   A light spine runs through the model and "ECONOMIC WORLD MODEL" turns around its top and bottom. Around it,
   ECONOMIC WORLD MODEL CHALLENGE circles as big lettering with depth; now and then your agent flies in from it.
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
  // people and buildings: cartoon models by Kenney (CC0), see assets/models/LICENSE.txt
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = (n) => new Promise((res, rej) => loader.load("assets/models/" + n + ".glb", res, undefined, rej));
  const people = ["male-a", "female-a", "male-c", "female-d", "male-e", "female-b"].map((n) => "people/character-" + n);
  const assets = Promise.all([
    Promise.all(people.map(load)),
    Promise.all(["commercial/market", "commercial/firm", "suburban/home-a", "suburban/home-b"].map(load)),
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
    // a single NaN or infinite pixel would be smeared by the bloom blur into flickering black squares: scrub first
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); bvec4 bad = bvec4(c.r != c.r || c.r > 6e4, c.g != c.g || c.g > 6e4, c.b != c.b || c.b > 6e4, c.a != c.a); if (any(bad)) c = vec4(0.0); gl_FragColor = clamp(c, 0.0, 64.0); }",
    }));
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.4, 0.38);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // light is the only thing drawn: alpha follows brightness, so the canvas adds glow over the page and never darkens it
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; vec4 s = texture2D(tDiffuse, vUv); gl_FragColor = vec4(c, clamp(max(max(c.r, max(c.g, c.b)), smoothstep(0.975, 1.0, s.a)), 0.0, 1.0)); }",
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
  const frame = (y, color, dashed, parent, half) => {
    const H = half || HALF, pts = [[-H, y, -H], [H, y, -H], [H, y, H], [-H, y, H], [-H, y, -H]].map((p) => new THREE.Vector3(...p));
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0 })
                       : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); if (dashed) l.computeLineDistances(); (parent || scene).add(l); return mat;
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
    // the name floats above the module and always faces the camera, so it reads upright from any angle
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: moduleLabel(d.n, d.c), transparent: true, opacity: 0, depthWrite: false }));
    label.scale.set(r * 1.9, r * 0.475, 1); label.position.y = h / 2 + 0.55;
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

  /* ---------- L2 · the agent platform: cartoon people walking a small town ---------- */
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0x26303f, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(6, 12, 9); scene.add(sun);
  const HALF2 = 8.5, CHAR_H = 0.78, CHEST = 0.26, bldMats = new Set();
  // a soft glowing rim on solid models, so they keep the scene's luminous edges
  const rim = (mat, color, k) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: color.clone().multiplyScalar(k) };
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uRim;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n{ float rimF = pow(clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.4); totalEmissiveRadiance += uRim * rimF; }");
    };
    mat.customProgramCacheKey = () => "rim" + color.getHexString() + k;
    return mat;
  };
  const fit = (obj, size, byHeight) => {   // scale a model to a height (people) or a footprint (buildings), standing on y = 0
    obj.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(obj), d = box.getSize(new THREE.Vector3());
    const s = size / (byHeight ? d.y : Math.max(d.x, d.z)); obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true); box.setFromObject(obj); obj.position.y -= box.min.y; obj.position.x -= (box.min.x + box.max.x) / 2; obj.position.z -= (box.min.z + box.max.z) / 2;
    return box.max.y - box.min.y;
  };
  const makeFigure = (i) => {
    const src = charGltf[i % charGltf.length], model = cloneSkinned(src.scene), g = new THREE.Group(), mats = [];
    model.traverse((o) => { if (o.isMesh) { o.material = rim(o.material.clone(), ICE, 0.45); o.material.transparent = true; o.frustumCulled = false; mats.push(o.material); } });
    g.add(model); fit(model, CHAR_H, true); scene.add(g);
    const mixer = new THREE.AnimationMixer(model), acts = {};
    src.animations.forEach((a) => { acts[a.name] = mixer.clipAction(a); });
    const f = { g, mats, mixer, acts, cur: null, armR: model.getObjectByName("arm-right") };
    f.play = (name, speed) => {
      const a = acts[name] || acts.idle; a.timeScale = speed || 1; if (f.cur === a) return;
      a.reset().setEffectiveWeight(1).play(); if (f.cur) f.cur.crossFadeTo(a, 0.3, false); f.cur = a;
    };
    f.play("idle"); mixer.update(Math.random() * 2);
    return f;
  };
  // civic buildings drawn in the same cartoon style: a bank and a court with columns and a pediment
  const civic = (kind) => {
    const g = new THREE.Group(), white = rim(new THREE.MeshStandardMaterial({ color: 0xd9dee8, roughness: 0.8, transparent: true }), ICE, 0.18);
    const roofC = kind === "court" ? 0x5b6476 : 0x6b5aa8, roof = rim(new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.7, transparent: true }), ICE, 0.18);
    [white, roof].forEach((m) => bldMats.add(m));
    const W = kind === "court" ? 3.0 : 2.6, D = 1.9, add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(W + 0.4, 0.14, D + 0.5), white, 0, 0.07, 0.05); add(new THREE.BoxGeometry(W + 0.2, 0.12, D + 0.3), white, 0, 0.2, 0.05);
    add(new THREE.BoxGeometry(W - 0.3, 1.25, D - 0.5), white, 0, 0.88, -0.2);
    const n = kind === "court" ? 6 : 5;
    for (let k = 0; k < n; k++) add(new THREE.CylinderGeometry(0.09, 0.1, 1.25, 12), white, -W / 2 + 0.25 + k * (W - 0.5) / (n - 1), 0.88, D / 2 - 0.05);
    add(new THREE.BoxGeometry(W + 0.1, 0.18, D + 0.1), white, 0, 1.6, 0);
    const ped = new THREE.CylinderGeometry(0.5, 0.5, D + 0.1, 3); ped.rotateX(Math.PI / 2); ped.rotateZ(Math.PI / 2); ped.scale(W / 1.4, 0.8, 1); add(ped, roof, 0, 1.87, 0);
    if (kind === "court") { add(new THREE.CylinderGeometry(0.42, 0.5, 0.35, 16), white, 0, 2.3, -0.2); add(new THREE.SphereGeometry(0.44, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), roof, 0, 2.47, -0.2); }
    else { const sign = add(new THREE.BoxGeometry(0.9, 0.22, 0.04), rim(new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0x6a4a00, transparent: true }), GOLD, 0.6), 0, 1.6, D / 2 + 0.07); bldMats.add(sign.material); }
    return g;
  };
  const BLD = {
    bank: { c: VIOLET, name: "BANK", act: "BORROW", r: 1.6 }, court: { c: SKY, name: "COURT", act: "RULES · DISPUTES", r: 1.8 },
    market: { c: GREEN, name: "STOCK MARKET", act: "TRADE", size: 2.5, gi: 0, r: 1.45 }, firm: { c: TEAL, name: "FIRM", act: "WORK", size: 2.1, gi: 1, r: 1.25 },
    home: { c: SKY, name: "HOME", act: "SPEND · SAVE", size: 2.4, gi: 2, r: 1.35 }, home2: { c: SKY, name: "HOME", act: "SPEND · SAVE", size: 2.4, gi: 3, r: 1.35 },
  };
  const makeBuilding = (kind, x, z) => {
    const d = BLD[kind], g = new THREE.Group(); let top;
    if (d.gi == null) { const m = civic(kind); g.add(m); top = kind === "court" ? 2.9 : 2.3; }
    else {
      const model = bldGltf[d.gi].scene.clone(true);
      model.traverse((o) => { if (o.isMesh) { o.material = rim(o.material.clone(), ICE, 0.18); o.material.transparent = true; bldMats.add(o.material); } });
      g.add(model); top = fit(model, d.size, false);
    }
    if (kind === "market") {   // a live ticker on the roof
      const cg = new THREE.Group(); cg.position.y = top + 0.02; g.add(cg);
      g.userData.candles = [0, 1, 2, 3, 4].map((i) => {
        const m = new THREE.MeshStandardMaterial({ color: i % 3 === 1 ? 0xff4d8d : 0x18d67a, emissive: i % 3 === 1 ? 0x5a0a28 : 0x064d2a, roughness: 0.5, transparent: true }); bldMats.add(m);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0), m), wick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03).translate(0, 0.5, 0), m);
        b.position.x = wick.position.x = -0.5 + i * 0.25; cg.add(b, wick); return { b, wick, ph: i * 1.3 };
      });
    }
    g.position.set(x, PY, z); g.rotation.y = Math.atan2(-x, -z);   // every building faces the square
    const label = tag(d.name, d.c, 0.3);
    scene.add(g); return { g, kind: kind === "home2" ? "home" : kind, c: d.c, act: d.act, r: d.r, label, top: top + (kind === "market" ? 0.6 : 0), docks: 0 };
  };
  // a fixed town around a central square; only the people move
  const TOWN = [["court", 0, -6.2], ["bank", -5.3, -4.3], ["market", 5.3, -4.3], ["firm", 6.3, 1.6], ["home", -6.3, 1.6], ["home2", -3.9, 6.1], ["home", 3.9, 6.1]];
  const buildings = TOWN.slice(0, small ? 6 : 7).map(([k, x, z]) => makeBuilding(k, x, z));
  const FCOL = [WHITE, ICE, WHITE, LILAC, ICE, WHITE, SKY];
  const NF = small ? 8 : 14, figs = [];
  for (let i = 0; i < NF; i++) {
    const f = makeFigure(i); f.c = i === 0 ? WHITE : FCOL[i % FCOL.length];
    Object.assign(f, { x: i === 0 ? 0 : (Math.random() - 0.5) * 7, z: i === 0 ? 2.6 : (Math.random() - 0.5) * 7, yaw: 0, state: "wander", tx: 0, tz: 0, timer: Math.random() * 2, partner: null, target: null });
    f.tag = tag("TALK", WHITE, 0.24); f.tag.userData.word = "TALK|" + WHITE.getHex();
    f.tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: f.c, ...ADD, opacity: 0 }));
    scene.add(f.tether); f.tetherA = 0;
    figs.push(f);
  }
  const hero = figs[0];
  // solid models fade by dithering (alpha hash) rather than blending: no sorting flicker, and every drawn pixel is
  // fully opaque, so dark parts never flash as half-transparent squares over the page
  const dither = (m) => { m.transparent = false; m.alphaHash = true; m.depthWrite = true; m.needsUpdate = true; };
  const coins = [0, 1, 2, 3].map(() => { const mat = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0x5a3a00, metalness: 0.6, roughness: 0.3, transparent: true }); bldMats.add(mat); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.035, 18), mat); m.visible = false; scene.add(m); return { m, k: 1, a: new THREE.Vector3(), b: new THREE.Vector3() }; });
  figs.forEach((f) => f.mats.forEach(dither)); bldMats.forEach(dither);
  const setTag = (f, word, color) => {
    const key = word + "|" + color.getHex(); if (f.tag.userData.word === key) return;
    const tex = texCache[key] || (texCache[key] = tagTex(word, color));
    f.tag.material.map = tex; f.tag.material.needsUpdate = true; f.tag.scale.set(0.24 * tex.image.width / tex.image.height, 0.24, 1); f.tag.userData.word = key;
  };
  const grid = new THREE.GridHelper(HALF2 * 2, 16, ICE, ICE); grid.position.y = PY; grid.material.transparent = true; grid.material.opacity = 0; grid.material.depthWrite = false; scene.add(grid);

  /* ---------- L1 · intelligence foundation, built at its own scale and carried in the hero's chest ----------
     A machined transformer stack (blocks, attention heads, a residual stream that tokens ride up) and, beside it,
     a cluster of reinforcement-learning neuron circuits wired to it. As the camera pulls out, both fold into one orb. */
  const S1 = 0.05, l1G = new THREE.Group(); l1G.scale.setScalar(S1); scene.add(l1G);
  const L1C = 1.8, l1In = new THREE.Group(); l1In.position.y = L1C; l1G.add(l1In);
  const l1C = new THREE.Group(); l1C.position.set(-2.2, -L1C, 0); l1In.add(l1C);
  const metal = new THREE.MeshStandardMaterial({ color: 0x223044, metalness: 0.85, roughness: 0.32, emissive: 0x06121e, alphaHash: true });   // dithered fade: a dark half-transparent block would read as a black square
  const l1Line = []; const lineMat = (c, o) => { const m = new THREE.LineBasicMaterial({ color: c, ...ADD, opacity: 0 }); m.userData.base = o; l1Line.push(m); return m; };
  const BLK = [0.3, 1.2, 2.1, 3.0], heads = [], headMats = [];
  BLK.forEach((y, bi) => {
    const geo = new THREE.BoxGeometry(2.6, 0.3, 1.8), blk = new THREE.Mesh(geo, metal); blk.position.y = y; l1C.add(blk);
    blk.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(ICE, 0.85)));
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.06), new THREE.MeshBasicMaterial({ color: bi % 2 ? VIOLET : ICE, ...ADD, opacity: 0 }));
    strip.position.set(0, 0, 0.905); blk.add(strip); headMats.push(strip.material);
    for (let h = 0; h < 6; h++) {   // attention heads: small spinning rings on top of each block
      const m = new THREE.MeshBasicMaterial({ color: h % 3 === 0 ? WHITE : bi % 2 ? VIOLET : ICE, ...ADD, opacity: 0 }); headMats.push(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 32), m);
      ring.position.set(-0.8 + (h % 3) * 0.8, y + 0.32, -0.4 + Math.floor(h / 3) * 0.8); l1C.add(ring);
      heads.push({ ring, sp: 0.8 + Math.random() * 1.6, ax: Math.random() < 0.5 });
    }
  });
  [[-1.2, -0.82], [1.2, -0.82], [-1.2, 0.82], [1.2, 0.82]].forEach(([x, z]) => {   // frame pillars
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), metal); pl.position.set(x, 1.65, z); l1C.add(pl);
  });
  const resid = { pts: [new THREE.Vector3(0, -0.8, 0), new THREE.Vector3(0, 4.3, 0)], c: ICE, speed: 0.9 };
  l1C.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(resid.pts), lineMat(ICE, 0.55)));
  const residFlow = packets([resid], 10, 0.3 * S1, true, l1C);
  const WORDS = ["BELIEF", "PRICE", "PLAN", "RISK", "WHY", "IF", "WAGE", "RATE", "TRUST", "DEBT", "SAVE", "BUY", "EXPECT", "SIGNAL"];
  const NT = small ? 7 : 10, tokens = [];
  for (let i = 0; i < NT; i++) {
    const s = tag(WORDS[i % WORDS.length], i % 4 === 0 ? WHITE : ICE, 0.26, l1C);
    const tk = { s, k: i / NT, sp: 1 / (7 + Math.random() * 3), path: [], fade: 0 };
    tk.pick = () => { tk.path = [new THREE.Vector3((Math.random() - 0.5) * 2, -0.9, 1.4)];
      BLK.forEach((y) => tk.path.push(new THREE.Vector3((Math.random() - 0.5) * 1.8, y + 0.55, 1.15)));
      tk.path.push(new THREE.Vector3((Math.random() - 0.5) * 1.2, 4.4, 0.6)); };
    tk.pick(); tokens.push(tk);
  }
  const AR = small ? 5 : 8, ARS = 14, arPos = new Float32Array(AR * ARS * 6), arCol = new Float32Array(AR * ARS * 6), arGeo = new THREE.BufferGeometry();
  arGeo.setAttribute("position", new THREE.BufferAttribute(arPos, 3)); arGeo.setAttribute("color", new THREE.BufferAttribute(arCol, 3));
  const arMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  l1C.add(new THREE.LineSegments(arGeo, arMat));
  const arcs = []; for (let i = 0; i < AR; i++) arcs.push({ a: 0, b: 1, life: Math.random(), dur: 1.2 + Math.random() });
  // RL, beside the transformer: a cluster of branching neuron circuits around a reward core, wired to the stack
  const nPos = [], nCol = [], nodes = [], rlPaths = [];
  const grow = (from, dir, len, depth, path, col) => {
    const to = from.clone().addScaledVector(dir, len); const c = col.clone().multiplyScalar(0.55 + 0.45 * depth / 4);
    nPos.push(from.x, from.y, from.z, to.x, to.y, to.z); nCol.push(c.r, c.g, c.b, c.r * 0.7, c.g * 0.7, c.b * 0.7);
    nodes.push(to); const p = path.concat([to]);
    if (depth <= 1) { rlPaths.push({ pts: p, c: col, speed: 0.55 }); return; }
    const n = depth > 2 ? 2 : 2 + (Math.random() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.3, (Math.random() - 0.35) * 1.0, (Math.random() - 0.5) * 1.3)).normalize();
      grow(to, d, len * (0.62 + Math.random() * 0.15), depth - 1, p, col);
    }
  };
  const RX = 4.4, soma = new THREE.Vector3(RX, 1.8, 0), NR = small ? 6 : 9;
  for (let k = 0; k < NR; k++) {   // dendrites spread out from the core in all directions
    const yy = 1 - 2 * (k + 0.5) / NR, rr = Math.sqrt(1 - yy * yy), a = k * 2.4;
    const dir = new THREE.Vector3(Math.cos(a) * rr, yy * 0.8, Math.sin(a) * rr).normalize();
    const root = soma.clone().addScaledVector(dir, 0.35);
    grow(root, dir, 0.85, 4, [soma.clone(), root], k % 3 === 0 ? TEAL : GREEN);
  }
  const bridges = [0.3, 1.2, 2.1, 3.0].map((y, k) => { const pp = { pts: new THREE.QuadraticBezierCurve3(new THREE.Vector3(1.3, y, 0), new THREE.Vector3(2.6, (y + 1.8) / 2 + 0.3, 0.5), soma.clone()).getPoints(20), c: k % 2 ? TEAL : ICE, speed: 0.8, bidir: true };
    l1C.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pp.pts), lineMat(pp.c, 0.45))); return pp; });
  const bridgeFlow = packets(bridges, 2, 0.26 * S1 * 1.3, false, l1C);
  const somaS = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0x9dffd0, ...ADD, opacity: 0 })); somaS.position.copy(soma); somaS.scale.setScalar(1.1); l1C.add(somaS);
  const rlGeo = new THREE.BufferGeometry();
  rlGeo.setAttribute("position", new THREE.Float32BufferAttribute(nPos, 3)); rlGeo.setAttribute("color", new THREE.Float32BufferAttribute(nCol, 3));
  const rlMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  l1C.add(new THREE.LineSegments(rlGeo, rlMat));
  const ndGeo = new THREE.BufferGeometry(); ndGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodes.flatMap((v) => [v.x, v.y, v.z]), 3));
  const ndMat = new THREE.PointsMaterial({ size: 0.16 * S1 * 1.6, color: GREEN, ...ADD, opacity: 0, map: dot });
  l1C.add(new THREE.Points(ndGeo, ndMat));
  const rlFlow = packets(rlPaths, 1, 0.26 * S1 * 1.3, false, l1C);
  const l1Tags = [["LLM · TRANSFORMER", ICE, [0, 4.6, 0]], ["RL · REWARD CIRCUITS", GREEN, [RX, 4.6, 0]], ["ACTION", GREEN, [RX + 2.5, 2.9, 0.6]], ["REWARD", GREEN, [RX + 2.2, 0.4, -0.6]]]
    .map(([w, c, p]) => { const s = tag(w, c, 0.3, l1C); s.position.set(...p); return s; });
  const l1Tag = tag("L1 · INTELLIGENCE FOUNDATION · INSIDE EVERY AGENT", ICE, 0.36, l1C); l1Tag.position.set(RX / 2, 5.5, 0);
  // the orb everything folds into; it keeps glowing faintly in the agent's chest
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xcfeeff, ...ADD, opacity: 0, depthTest: false })); orb.position.y = L1C; l1G.add(orb);
  const orbRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 48), new THREE.MeshBasicMaterial({ color: GREEN, ...ADD, opacity: 0, depthTest: false })); orbRing.position.y = L1C; l1G.add(orbRing);
  const chest = new THREE.Vector3();

  /* ---------- L3 · economic environment & institutions ---------- */
  const MODS = [
    { n: "AUCTIONS", c: GREEN }, { n: "MATCHING", c: TEAL }, { n: "PRICES", c: GREEN }, { n: "ACCOUNTING", c: SKY },
    { n: "BUDGETS", c: SKY }, { n: "POLICY RULES", c: VIOLET }, { n: "INSTITUTIONS", c: VIOLET },
  ];
  // L3 and L4 live in their own groups so the gaps between layers can open up while the camera visits them
  const l3G = new THREE.Group(), l4G = new THREE.Group(); scene.add(l3G, l4G);
  const adopt = (from, into) => { scene.children.slice(from).filter((o) => o !== l3G && o !== l4G).forEach((o) => into.attach(o)); };
  let mark = scene.children.length;
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
  adopt(mark, l3G);

  // neural lines: from every entity on the agent platform -- each person's head, each building's roof -- a trunk
  // rises to a node, then branches into a few L3 modules
  const ents = figs.map((f) => ({ c: f.c, head: (v) => v.set(f.x, PY + CHAR_H + 0.08, f.z) }))
    .concat(buildings.map((b) => ({ c: b.c, head: (v) => v.set(b.g.position.x, PY + b.top + 0.1, b.g.position.z) })));
  const NF2 = ents.length, BR = 2, NSEG = 1 + BR * 2;
  const nlPos = new Float32Array(NF2 * NSEG * 6), nlCol = new Float32Array(NF2 * NSEG * 6), nlGeo = new THREE.BufferGeometry();
  nlGeo.setAttribute("position", new THREE.BufferAttribute(nlPos, 3)); nlGeo.setAttribute("color", new THREE.BufferAttribute(nlCol, 3));
  const nlMat = new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, opacity: 0 });
  scene.add(new THREE.LineSegments(nlGeo, nlMat));
  const NN = NF2 * (1 + BR), nnPos = new Float32Array(NN * 3), nnCol = new Float32Array(NN * 3), nnGeo = new THREE.BufferGeometry();
  nnGeo.setAttribute("position", new THREE.BufferAttribute(nnPos, 3)); nnGeo.setAttribute("color", new THREE.BufferAttribute(nnCol, 3));
  const nnMat = new THREE.PointsMaterial({ size: 0.24, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(nnGeo, nnMat));
  const NP = NF2 * 2, npPos = new Float32Array(NP * 3), npCol = new Float32Array(NP * 3), npGeo = new THREE.BufferGeometry();
  npGeo.setAttribute("position", new THREE.BufferAttribute(npPos, 3)); npGeo.setAttribute("color", new THREE.BufferAttribute(npCol, 3));
  const npMat = new THREE.PointsMaterial({ size: 0.3, vertexColors: true, ...ADD, opacity: 0, map: dot });
  scene.add(new THREE.Points(npGeo, npMat));
  ents.forEach((f, i) => { f.links = [0, 1].map((k) => (i * 3 + k * 4 + 1) % l3Mods.length); f.nph = Math.random(); });

  /* ---------- L4 · equilibrium & reality discipline ---------- */
  mark = scene.children.length;
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
  const bdGeoObj = new THREE.Points(bdGeo, bdMat); scene.add(bdGeoObj);
  const fpGeo = new THREE.BufferGeometry(); fpGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([AC.x, AC.y, AC.z]), 3));
  const fpMat = new THREE.PointsMaterial({ size: 1.2, color: WHITE, ...ADD, opacity: 0, map: dot });
  const fpObj = new THREE.Points(fpGeo, fpMat); scene.add(fpObj);
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
  // the armillary and the real-data chart turn to face the camera, so both always read head-on
  const pivotAround = (centre, objs) => {
    const pivot = new THREE.Group(), inner = new THREE.Group(); pivot.position.copy(centre); inner.position.copy(centre).negate();
    pivot.add(inner); objs.forEach((o) => inner.add(o)); scene.add(pivot); return pivot;
  };
  const armPivot = pivotAround(AC, ARM.map((r) => r.g).concat(ARM.map((r) => r.label), [bdGeoObj, fpObj, fpTag, fpTag2]));
  const chartPivot = pivotAround(new THREE.Vector3(RDX + RDW / 2, Y4, -0.4), [rdBars, realLine, simLine, rdTag]);
  const billboards = [armPivot, chartPivot], bbW = new THREE.Vector3();
  adopt(mark, l4G);
  const l3Up = risers([{ x: 0, z: 0, y0: Y3 + 0.4, y1: Y4, c: ICE }, { x: inst.x, z: inst.z, y0: Y3 + 0.3, y1: Y4, c: VIOLET }], 5, 0.26);

  /* ---------- the model as one thing: a light spine, and its name turning around the top and bottom ---------- */
  const SH = 7.0, SB = PY - 0.7;
  const nameRings = [0, 1].map((k) => {
    const tex = nameTexture(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(SH * 1.32, SH * 1.32, 0.62, 128, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide }));
    scene.add(m); return { m, tex, k };
  });
  const spine = risers([{ x: 0, z: 0, y0: PY + 1.4, y1: Y4 + 2.4, c: ICE }, { x: 0.06, z: 0.06, y0: Y4 + 2.4, y1: PY + 1.4, c: VIOLET }], 9, 0.12, 0.22);
  const frames = [frame(PY, WHITE, false, null, HALF2), frame(Y3, ICE, false, l3G), frame(Y4, ICE, true, l4G)];
  const tags = [
    flatLabel("L2", "ECONOMIC AGENTS", WHITE, 3.8, -HALF2 + 1.9, PY + 0.02, HALF2 + 0.75),
    flatLabel("L3", "ENVIRONMENT & INSTITUTIONS", ICE, 3.8, -HALF + 1.9, Y3 + 0.02, HALF + 0.75, 0, l3G),
    flatLabel("L4", "EQUILIBRIUM & REALITY", ICE, 3.8, -HALF + 1.9, Y4 + 0.02, HALF + 0.75, 0, l4G),
  ];

  /* ---------- outer layer · Economic World Model Challenge: the name itself circles the model ---------- */
  // big upright letters on a gently tilted circle well clear of the model; stacked copies set slightly inward and
  // darker give the letters real depth, like a sign around a globe. No band, no rails: just the lettering.
  const RR = 18.5, RH = 4.8, DEPTH = 8;
  const ringG = new THREE.Group(); ringG.position.y = RING_Y; ringG.rotation.set(0.1, 0, -0.05, "ZXY"); scene.add(ringG);
  const spinG = new THREE.Group(); ringG.add(spinG);
  const nameTex = ringNameTexture(); nameTex.wrapS = THREE.RepeatWrapping; nameTex.repeat.set(1, 1);
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
  // [progress, target x, target y, target z, radius, azimuth, elevation, layer]; the radius is interpolated in log
  // space, and the target height follows the layer (3 or 4) as it floats up
  const KEYS = [
    [0.00, HC[0], HC[1] + 0.12, HC[2], 1.25, 0.25, 0.12, 0],
    [0.07, HC[0], HC[1] + 0.12, HC[2], 1.35, 0.05, 0.16, 0],
    [0.13, HC[0], HC[1] + 0.12, HC[2], 1.9, -0.15, 0.2, 0],
    [0.19, HC[0], 0.42, HC[2], 3.2, -0.3, 0.22, 0],
    [0.27, 0, 0.6, 1.2, 13, 0.05, 0.42, 0],
    [0.35, 0, 0.5, 0, 22, 0.4, 0.6, 0],
    [0.39, 0, 5.0, 0, 15, -0.35, -0.27, 0],
    [0.45, 0, 6.2, 0, 16, 0.1, -0.17, 0],
    [0.50, 0, Y3, 0, 18, 1.0, 0.62, 3],
    [0.58, 0.8, Y4 + 1.2, 0, 20, 0.55, 0.42, 4],
    [0.68, 0.4, Y4 + 1.4, 0, 16.5, 0.1, 0.34, 4],
    [0.80, 0, 3.8, 0, 80, 0.35, 0.2, 0],
    [0.92, 0, 3.6, 0, 74, 0.7, 0.17, 0],
    [1.00, 0, 3.6, 0, 74, 0.85, 0.17, 0],
  ].map((k) => { const c = k.slice(); c[4] = Math.log(c[4]); return c; });
  const cr = (p0, p1, p2, p3, s) => 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
  const camAt = (p, E3, E4) => {
    p = clamp(p); let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(KEYS.length - 1, i + 2)];
    const s = (p - b[0]) / (c[0] - b[0]), e = s * s * (3 - 2 * s) * 0.35 + s * 0.65;
    const val = (key, k) => k === 2 ? key[2] + (key[7] === 3 ? E3 : key[7] === 4 ? E4 : 0) : key[k];
    const out = []; for (let k = 1; k < 7; k++) out.push(cr(val(a, k), val(b, k), val(c, k), val(d, k), e)); out[3] = Math.exp(out[3]); return out;
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
  const waveE = new THREE.Euler(), waveQ = new THREE.Quaternion();
  const turnTo = (f, want, rate, dt) => { let dy = want - f.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; f.yaw += dy * (1 - Math.pow(rate, dt)); };
  const choose = (f) => {
    if (Math.random() < 0.3) {
      const free = figs.filter((g) => g !== f && g !== hero && g.state === "wander"), o = free[Math.floor(Math.random() * free.length)];
      if (o) { f.state = "go"; f.target = null; f.partner = o; o.state = "wait"; o.partner = f; return; }
    }
    if (Math.random() < 0.8) { f.state = "go"; f.target = buildings[Math.floor(Math.random() * buildings.length)]; f.partner = null; return; }
    f.state = "wander"; f.tx = (Math.random() - 0.5) * 9; f.tz = (Math.random() - 0.5) * 9; f.timer = 2 + Math.random() * 3;
  };
  const release = (f) => {
    if (f.target) f.target.docks--;
    if (f.partner && f.partner.partner === f) { const o = f.partner; o.state = "wander"; o.timer = 0.5; o.partner = null; o.tx = o.x; o.tz = o.z; }
    f.target = null; f.partner = null; f.side = null; f.state = "wander"; f.tx = f.x + (Math.random() - 0.5) * 4; f.tz = f.z + (Math.random() - 0.5) * 4; f.timer = 1.5 + Math.random() * 2;
  };
  const stepFigure = (f, dt, t, heroHold) => {
    let moving = false, gx = f.tx, gz = f.tz;
    if (f === hero && heroHold) { if (f.state !== "hold") { if (f.state === "dock" || f.state === "go") release(f); f.state = "hold"; } }
    else if (f.state === "hold") { f.state = "wander"; f.timer = 0; }
    if (f.state === "wander") { f.timer -= dt; if (f.timer <= 0) choose(f); }
    if (f.state === "go") {
      if (f.target) {
        // go to the front of the building (it faces the square)
        const b = f.target.g.position, fx = -b.x, fz = -b.z, fd = Math.hypot(fx, fz) || 1, rr = f.target.r + 0.35, side = (f.side = f.side == null ? (Math.random() - 0.5) * 1.2 : f.side);
        gx = b.x + fx / fd * rr + fz / fd * side; gz = b.z + fz / fd * rr - fx / fd * side;
        if (Math.hypot(f.x - gx, f.z - gz) < 0.08) {
          f.state = "dock"; f.timer = 2 + Math.random() * 2; f.target.docks++;
          if (f.target.kind === "bank") { const c = coins.find((c) => c.k >= 1); if (c) { c.k = 0; c.a.set(b.x, 1.0, b.z); c.b.set(f.x, 0.5, f.z); } }
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
      if (d > 0.05) { const sp = Math.min(d, 0.75 * dt); f.x += dx / d * sp; f.z += dz / d * sp; moving = true; turnTo(f, Math.atan2(dx, dz), 0.002, dt); }
      f.x = Math.max(-HALF2 + 0.6, Math.min(HALF2 - 0.6, f.x)); f.z = Math.max(-HALF2 + 0.6, Math.min(HALF2 - 0.6, f.z));
    }
    if (f.state === "dock") { const o = f.target ? f.target.g.position : f.partner; if (o) turnTo(f, Math.atan2(o.x - f.x, o.z - f.z), 0.01, dt); }
    if (f.state === "hold") turnTo(f, 0, 0.01, dt);
    // animation: walk while moving, reach out at a building, nod while talking, idle otherwise; the hero waves
    if (moving) f.play("walk", 1.1);
    else if (f.state === "dock") f.play(f.target ? "interact-right" : "emote-yes", f.target ? 0.8 : 0.7);
    else f.play("idle");
    f.mixer.update(dt);
    if (f.state === "hold" && f.armR) {   // wave: lift the animated right arm out to the side and swing it, below the big head
      waveE.set(-0.3, 0, -(1.35 + Math.sin(t * 7) * 0.25), "ZXY"); f.armR.quaternion.premultiply(waveQ.setFromEuler(waveE));
    }
    f.g.position.set(f.x, PY, f.z); f.g.rotation.y = f.yaw;
    const docked = f.state === "dock";
    f.tetherA += ((docked ? 1 : 0) - f.tetherA) * (1 - Math.pow(0.02, dt));
    if (docked) {
      const o = f.target ? f.target.g.position : f.partner, tp = f.tether.geometry.attributes.position;
      tp.setXYZ(0, f.x, 0.4, f.z); tp.setXYZ(1, o.x, f.target ? 0.8 : 0.4, o.z); tp.needsUpdate = true;
      setTag(f, f.target ? f.target.act : "TALK", f.target ? f.target.c : WHITE);
    }
    f.tag.position.set(f.x, PY + CHAR_H + 0.3, f.z);
  };

  /* ---------- loop ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let t = 0, last = performance.now(), frameN = 0, conv = 0;
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
    // keep the dragged turn within one revolution, so leaving the full view only turns back to the nearest front
    user.th = Math.atan2(Math.sin(user.th), Math.cos(user.th));
    if (!user.drag) {
      user.th += user.vth; user.ph = Math.max(-0.25, Math.min(0.75, user.ph + user.vph));
      user.vth *= Math.pow(0.04, dt); user.vph *= Math.pow(0.04, dt); user.idle += dt;
      if (user.idle > 3) user.ph *= Math.pow(0.5, dt);
    }

    // L2 · agents and buildings
    const heroHold = main.visible && main.pS < 0.24;
    if (heroHold) { hero.x += (0 - hero.x) * (1 - Math.pow(0.05, dt)); hero.z += (2.6 - hero.z) * (1 - Math.pow(0.05, dt)); }
    figs.forEach((f) => stepFigure(f, dt, t, heroHold));
    if (main.pS < 0.3) figs.forEach((f) => {   // while the camera pulls out of the hero, others keep their distance
      if (f === hero) return; const dx = f.x - hero.x, dz = f.z - hero.z, d = Math.hypot(dx, dz) || 1, R = 3.2;
      if (d < R) { f.x = hero.x + dx / d * R; f.z = hero.z + dz / d * R; if (f.state === "go" && f.partner === hero) f.state = "wander"; }
    });
    // the agent is not shown around its intelligence at first; as the camera pulls out it appears very large and
    // shrinks to its real size, its chest staying where the orb is
    const hk = 1 + 7 * Math.pow(1 - sstep((main.pS - 0.09) / 0.14), 2);
    hero.g.scale.setScalar(hk); hero.g.position.y += CHEST * (1 - hk); hero.hk = hk;
    buildings.forEach((b) => {
      b.label.position.set(b.g.position.x, PY + b.top + 0.35, b.g.position.z);
      if (b.g.userData.candles) b.g.userData.candles.forEach((c, i) => {
        const h = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * (1.4 + i * 0.3) * (b.docks > 0 ? 2.5 : 1) + c.ph));
        c.b.scale.y = h * 1.3; c.b.position.y = 0.14; c.wick.scale.y = h * 1.3 + 0.28; c.wick.position.y = 0;
      });
    });
    coins.forEach((c) => {
      if (c.k >= 1) { c.m.visible = false; return; }
      c.k = Math.min(1, c.k + dt / 1.1); c.m.visible = true;
      c.m.position.lerpVectors(c.a, c.b, c.k); c.m.position.y += Math.sin(Math.PI * c.k) * 0.8; c.m.rotation.set(Math.PI / 2, 0, t * 6);
    });

    // L1 · carried in the hero's chest
    hero.g.updateMatrixWorld(); chest.set(0, CHEST, 0.0); hero.g.localToWorld(chest);
    l1G.position.copy(chest); l1G.position.y -= L1C * S1; l1G.rotation.y = hero.yaw;
    heads.forEach((h, i) => { h.ring.rotation[h.ax ? "x" : "y"] = t * h.sp; h.ring.rotation.z = Math.sin(t * 0.7 + i) * 0.4; });
    l1C.rotation.y = Math.sin(t * 0.25) * 0.08;
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
      const lift = 0.35 + A.distanceTo(B) * 0.2;
      for (let q = 0; q < ARS; q++) {
        const u0 = q / ARS, u1 = (q + 1) / ARS, o = (i * ARS + q) * 6;
        const P = (u) => [A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, A.z + (B.z - A.z) * u + Math.sin(Math.PI * u) * lift];
        arPos.set(P(u0).concat(P(u1)), o);
        const c = i % 3 === 0 ? WHITE : ICE; arCol.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], o);
      }
    }
    arGeo.attributes.position.needsUpdate = true; arGeo.attributes.color.needsUpdate = true;
    residFlow.update(dt); rlFlow.update(dt); bridgeFlow.update(dt);

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
      r.g.updateMatrix();
      for (let b = 0; b < BEADS; b++) {
        const a = r.ang + b / BEADS * Math.PI * 2, o = (ri * BEADS + b) * 3;
        tmp.set(Math.cos(a) * AR_R, Math.sin(a) * AR_R, 0).applyMatrix4(r.g.matrix);
        bdPos.set([tmp.x, tmp.y, tmp.z], o); bdCol.set([r.c.r, r.c.g, r.c.b], o);
      }
      tmp.set(Math.cos(0.8 + ri * 2.1) * (AR_R + 0.35), Math.sin(0.8 + ri * 2.1) * (AR_R + 0.35), 0).applyMatrix4(r.g.matrix);
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
    ents.forEach((f, i) => {
      f.head(headV);
      nodeV.set(headV.x * 0.85, headV.y + (Y3 + l3G.position.y - headV.y) * 0.4, headV.z * 0.85);
      const g1 = clamp(g * 2), g2 = clamp(g * 2 - 1), base = i * NSEG * 6, bright = 0.5 + 0.5 * Math.sin(t * 2 + i);
      const seg = (k, A, B, gg, c, f0) => {
        const o = base + k * 6; nlPos.set([A.x, A.y, A.z, A.x + (B.x - A.x) * gg, A.y + (B.y - A.y) * gg, A.z + (B.z - A.z) * gg], o);
        nlCol.set([c.r * f0, c.g * f0, c.b * f0, c.r * f0 * 0.6, c.g * f0 * 0.6, c.b * f0 * 0.6], o);
      };
      seg(0, headV, nodeV, g1, f.c, 0.8);
      const no = i * (1 + BR) * 3; nnPos.set([nodeV.x, nodeV.y, nodeV.z], no); nnCol.set([f.c.r * g1, f.c.g * g1, f.c.b * g1], no);
      f.links.forEach((mi, k) => {
        const m = l3Mods[mi];
        endV.set(m.x, m.y - m.h / 2 + l3G.position.y, m.z);
        midV.set((nodeV.x + endV.x) / 2 + (k - 0.5) * 0.6, nodeV.y + (endV.y - nodeV.y) * 0.55, (nodeV.z + endV.z) / 2);
        const ga = clamp(g2 * 2), gb = clamp(g2 * 2 - 1);
        seg(1 + k * 2, nodeV, midV, ga, m.c, 0.65); seg(2 + k * 2, midV, endV, gb, m.c, 0.5);
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

  // how far the upper layers float above their resting height: wide while the camera visits, tight at the end
  const gaps = (pS) => {
    const out = 1 - sstep((pS - 0.72) / 0.1), e3 = 5 * sstep((pS - 0.3) / 0.08) * out, e4 = e3 + 5 * sstep((pS - 0.5) / 0.08) * out;
    return [e3, e4];
  };
  function pose(v) {
    const pS = v.pS, camera = v.camera, [E3, E4] = v.ghost ? [0, 0] : gaps(pS);
    l3G.position.y = E3; l4G.position.y = E4;
    const L = v.ghost ? 0.25 : 1 - clamp((pS - 0.2) / 0.1) * 0.75;      // L1 is the star at first, then a glow inside the agent
    const r2 = v.ghost ? 1 : ease(clamp((pS - 0.1) / 0.12)), r3 = clamp((pS - 0.38) / 0.13), g3 = clamp((pS - 0.33) / 0.07);
    const r4 = ease(clamp((pS - 0.53) / 0.1)), r5 = clamp((pS - 0.71) / 0.12);
    const all = clamp((pS - 0.76) / 0.1);
    const dimAfter = (next) => 1 - 0.8 * clamp((pS - next) / 0.06) * (1 - all);
    const f2 = dimAfter(0.45), f3 = dimAfter(0.55), f4 = dimAfter(0.73);
    const lab = (r, f) => r * (0.15 + 0.85 * f);

    // L1 inside the hero: shown in full, then folded into an orb as the camera pulls out
    const mg = v.ghost ? 1 : sstep((pS - 0.08) / 0.09), Lc = L * (1 - mg);
    l1In.scale.setScalar(1 - 0.97 * mg); l1C.visible = Lc > 0.005;
    metal.opacity = Lc;
    l1Line.forEach((m) => { m.opacity = m.userData.base * Lc; }); headMats.forEach((m) => { m.opacity = 0.9 * Lc; });
    tokens.forEach((tk) => { tk.s.material.opacity = Lc * tk.fade; });
    arMat.opacity = Lc; rlMat.opacity = 0.95 * Lc; ndMat.opacity = Lc; rlFlow.mat.opacity = Lc; residFlow.mat.opacity = Lc;
    bridgeFlow.mat.opacity = Lc; somaS.material.opacity = Lc * (0.75 + 0.25 * Math.sin(t * 3));
    l1Tags.forEach((s) => { s.material.opacity = Lc; });
    l1Tag.material.opacity = v.ghost ? 0 : clamp((0.12 - pS) / 0.05) * clamp(pS / 0.02 + 0.3);
    const orbA = v.ghost ? 0 : mg * (1 - 0.55 * clamp((pS - 0.2) / 0.08));
    orb.material.opacity = orbA; orb.scale.setScalar(1.2 + 1.6 * Math.sin(Math.PI * clamp(mg)) + 0.15 * Math.sin(t * 4));
    orbRing.material.opacity = orbA * 0.8; orbRing.rotation.set(t * 1.3, t * 0.9, 0); orbRing.scale.setScalar(0.9 + 0.25 * Math.sin(t * 2));
    // L2
    const figA = 1;   // solid models are dithered, so they are not dimmed with the other layers (that would show as grain)
    // seen from inside, the hero's own body is only a faint shell; the others arrive as we pull out
    const heroA = v.ghost ? figA : clamp((pS - 0.115) / 0.025) * figA, othersA = v.ghost ? figA : clamp((pS - 0.115) / 0.035) * figA;
    v.heroA = heroA;
    figs.forEach((f) => {
      const a = f === hero ? heroA : othersA; f.mats.forEach((m) => { m.opacity = a; });
      f.g.visible = a > 0.01;
      f.tether.material.opacity = f.tetherA * 0.7 * r2 * f2; f.tag.material.opacity = f.tetherA * r2 * (0.15 + 0.85 * f2);
    });
    const bA = v.ghost ? 1 : clamp((pS - 0.11) / 0.035); bldMats.forEach((m) => { m.opacity = bA; });
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
    const tight = 1 - clamp(Math.max(E3, E4 - E3) / 1.2);   // links that span the layers only show once the gaps close
    l3Up.mat.opacity = r4 * 0.9 * f4 * tight; l3Up.smat.opacity = r4 * 0.3 * f4 * tight;
    // the name rings appear with the full view
    const topY = PY + 2.6 + (Y3 - PY) * r3 + (Y4 - Y3) * r4 + E4;
    nameRings.forEach((r) => { r.m.position.y = r.k ? topY + 0.6 * r4 + 0.4 : SB - 0.2; r.m.material.opacity = all * 0.8; });
    spine.mat.opacity = clamp(r3 * 0.6 + r4 * 0.4) * tight; spine.smat.opacity = spine.mat.opacity * 0.4;
    // outer lettering
    const nA5 = clamp((r5 - 0.1) / 0.5);
    letterLayers.forEach((l) => { l.m.opacity = nA5 * (l.k === 0 ? 1 : l.k < 0 ? 0 : 0.9); });
    ringG.scale.setScalar(0.85 + 0.15 * ease(r5));
    cmMat.opacity = clamp((r5 - 0.5) / 0.4); splash.material.opacity = comet.splash * 0.8 * cmMat.opacity; splash.scale.setScalar(0.2 + (1 - comet.splash) * 1.6);

    // camera
    let tx, ty, tz, rad, th, ph;
    if (v.ghost) { tx = 0; ty = 3.6; tz = 0; rad = 62; th = 0.4 + t * 0.06 + ptr.x * 0.08; ph = 0.2; }
    else {
      [tx, ty, tz, rad, th, ph] = camAt(pS, E3, E4);
      const far = clamp((pS - 0.2) / 0.1);   // no pointer sway while we are inside the agent
      th += (t * 0.02 + ptr.x * 0.1) * far + user.th * all; ph = Math.max(-0.9, Math.min(1.25, ph - ptr.y * 0.04 * far + user.ph * all));
      if (pS < 0.3) { const k = 1 - clamp((pS - 0.22) / 0.08); tx += (hero.x - HC[0]) * k; tz += (hero.z - HC[2]) * k; }
    }
    rad *= Math.max(1, (small ? 1.0 : 1.3) / camera.aspect);
    camera.position.set(tx + Math.cos(ph) * Math.sin(th) * rad, ty + Math.sin(ph) * rad, tz + Math.cos(ph) * Math.cos(th) * rad);
    camera.lookAt(tx, ty, tz);
    billboards.forEach((b) => { b.getWorldPosition(bbW); b.rotation.y = Math.atan2(camera.position.x - bbW.x, camera.position.z - bbW.z); });
    // the giant agent only shows once the camera is clear of its body: no faces sliding through the near plane
    if (!v.ghost) {
      const size = (hero.hk || 1) * CHAR_H, d = camera.position.distanceTo(chest), a = v.heroA * clamp((d - 0.6 * size) / (0.12 * size));
      hero.mats.forEach((m) => { m.opacity = a; }); hero.g.visible = a > 0.01;
    }
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
  g.fillStyle = "rgba(4,14,22,.42)"; g.strokeStyle = rgbOf(color); g.lineWidth = 2;
  g.beginPath(); g.roundRect ? g.roundRect(2, 6, w - 4, H - 12, 26) : g.rect(2, 6, w - 4, H - 12); g.fill(); g.stroke();
  g.fillStyle = "#f2fbff"; g.textBaseline = "middle"; g.fillText(text, 22, H / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// "ECONOMIC WORLD MODEL CHALLENGE ·", the lettering that circles the model
function ringNameTexture() {
  // the full name runs once around the ring, in tall narrow letters
  const c = document.createElement("canvas"); c.width = 8192; c.height = 400;
  const g = c.getContext("2d"), text = "ECONOMIC WORLD MODEL CHALLENGE";
  g.textBaseline = "middle"; g.textAlign = "center"; g.font = "600 380px 'Space Grotesk', sans-serif";
  if ("letterSpacing" in g) g.letterSpacing = "60px";
  const grd = g.createLinearGradient(0, 20, 0, 380); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.5, "#cfeeff"); grd.addColorStop(1, "#73bcff");
  g.shadowColor = "rgba(143,214,255,.9)"; g.shadowBlur = 18; g.fillStyle = grd;
  const k = Math.min(0.62, 7600 / g.measureText(text).width);
  g.save(); g.translate(3996, 214); g.scale(k, 1); g.fillText(text, 0, 0); g.restore();
  g.shadowBlur = 0; g.fillStyle = "rgba(143,214,255,.85)"; g.beginPath(); g.arc(8092, 200, 18, 0, 7); g.fill();
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
