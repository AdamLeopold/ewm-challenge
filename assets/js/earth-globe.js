/* EWM homepage globe. Natural geography, soft atmospheric rendering and a fixed rotation axis.
   Earth imagery: NASA Earth Observatory Blue Marble: Next Generation with Topography.
   https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/ */
(function () {
  "use strict";
  const TAU = 2 * Math.PI;
  const RAD = Math.PI / 180;
  const ROTATION_PERIOD = 145;
  const START_YAW = -18 * RAD;
  const PITCH = 11 * RAD;
  const OBLIQUITY = 23.44 * RAD;
  const CP = Math.cos(PITCH), SP = Math.sin(PITCH);
  const CO = Math.cos(OBLIQUITY), SO = Math.sin(OBLIQUITY);
  const AXIS = Object.freeze({ x: -CP * SO, y: CP * CO, z: SP });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const wrap = (v, mod) => v - Math.floor(v / mod) * mod;
  const smooth = (a, b, v) => { const f = clamp((v - a) / (b - a), 0, 1); return f * f * (3 - 2 * f); };

  function pixelCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function readSurface(image) {
    const width = Math.min(image.naturalWidth, 1536);
    const height = width / 2;
    const canvas = pixelCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Blue Marble has a deep blue ocean, warm terrain and natural ice. Lift the
      // luminance of the original colors and keep the coastline exactly registered.
      const sea = smooth(4, 15, b - Math.max(r, g));
      const shelf = smooth(20, 90, b);
      const forest = smooth(-6, 12, g - r) * smooth(2, 15, g - b) * (1 - smooth(146, 205, r));
      const snow = smooth(135, 230, Math.min(r, g, b));
      const landR = lerp(lerp(88 + 0.63 * r, 58 + 0.63 * r, forest), 226 + r * 0.11, snow);
      const landG = lerp(lerp(98 + 0.55 * g, 123 + 0.66 * g, forest), 235 + g * 0.075, snow);
      const landB = lerp(lerp(61 + 0.66 * b, 42 + 0.60 * b, forest), 243 + b * 0.048, snow);
      data[i] = lerp(landR, 28 + 11 * shelf, sea);
      data[i + 1] = lerp(landG, 113 + 41 * shelf, sea);
      data[i + 2] = lerp(landB, 215 + 24 * shelf, sea);
    }
    return { data, width, height };
  }

  function prepareProjection(ctx, size, width, height) {
    const count = size * size;
    const longitude = new Float32Array(count), rowOffset = new Uint32Array(count), rowFrac = new Float32Array(count);
    const sun = new Float32Array(count), rim = new Float32Array(count), alpha = new Uint8Array(count);
    for (let j = 0; j < size; j++) {
      const y = 1 - (j + 0.5) * 2 / size;
      for (let i = 0; i < size; i++) {
        const x = (i + 0.5) * 2 / size - 1;
        const rho = Math.hypot(x, y);
        if (rho >= 1) continue;
        const z = Math.sqrt(1 - rho * rho);
        // Undo screen obliquity and the camera pitch. Spin is then only a shift
        // in longitude, which is shared with the link endpoints.
        const px = x * CO + y * SO, py = -x * SO + y * CO;
        const worldY = py * CP + z * SP, unpitchedZ = -py * SP + z * CP;
        const u = 0.5 + Math.atan2(px, unpitchedZ) / TAU;
        const v = 0.5 - Math.asin(clamp(worldY, -1, 1)) / Math.PI;
        const p = j * size + i;
        longitude[p] = u;
        const row = v * (height - 2);
        rowOffset[p] = Math.floor(row) * width * 4;
        rowFrac[p] = row - Math.floor(row);
        const directional = Math.max(0, -0.48 * x + 0.56 * y + 0.68 * z);
        sun[p] = 0.64 + 0.48 * directional;
        rim[p] = (1 - z) ** 3.35 * (0.49 + 0.28 * Math.max(0, (-x + y) * 0.7));
        alpha[p] = Math.round(255 * clamp((1 - rho) * size * 0.57, 0, 1));
      }
    }
    return { size, image: ctx.createImageData(size, size), longitude, rowOffset, rowFrac, sun, rim, alpha };
  }

  function planetFrame(s, canvas, time, small) {
    const height = small ? s.h : Math.min(s.h, innerHeight || s.h);
    const center = (value, fallback) => { const n = Number(value); return Number.isFinite(n) ? clamp(n, 0, 1) : fallback; };
    const x = center(canvas.dataset.cx, small ? 0.5 : 0.75);
    const y = center(canvas.dataset.cy, small ? 0.51 : 0.53);
    const cx = s.w * x, cy = height * y;
    const radius = Math.min(height * (small ? 0.416 : 0.335), s.w * (small ? 0.42 : 0.205));
    const rotation = START_YAW + wrap(time, ROTATION_PERIOD) / ROTATION_PERIOD * TAU;
    const c = Math.cos(rotation), sin = Math.sin(rotation);
    function projectVector(x, y, z, lift = 1) {
      const sx = x * c + z * sin, sz = -x * sin + z * c;
      const sy = y * CP - sz * SP, nz = y * SP + sz * CP;
      const nx = sx * CO - sy * SO, ny = sx * SO + sy * CO;
      return { x: cx + nx * radius * lift, y: cy - ny * radius * lift, z: nz * lift, nx, ny, nz, angle: Math.atan2(nx, ny) };
    }
    function project(lat, lon, lift = 1) {
      const latitude = lat * RAD, longitude = lon * RAD, cos = Math.cos(latitude);
      return projectVector(cos * Math.sin(longitude), Math.sin(latitude), cos * Math.cos(longitude), lift);
    }
    return { time, cx, cy, radius, rotation, axis: AXIS, projectVector, project };
  }

  function paintAtmosphere(ctx, { cx, cy, radius: r }) {
    const halo = ctx.createRadialGradient(cx, cy, r * 0.93, cx, cy, r * 1.29);
    halo.addColorStop(0, "rgba(93,173,255,.33)");
    halo.addColorStop(0.23, "rgba(93,173,255,.15)");
    halo.addColorStop(0.63, "rgba(86,156,244,.04)");
    halo.addColorStop(1, "rgba(80,146,244,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 1.29, cy - r * 1.29, r * 2.58, r * 2.58);
  }

  function paintFallback(ctx, frame) {
    const { cx, cy, radius: r, project } = frame;
    const fill = ctx.createRadialGradient(cx - r * 0.27, cy - r * 0.34, r * 0.06, cx, cy, r);
    fill.addColorStop(0, "#447bc3"); fill.addColorStop(1, "#142f55");
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(176,216,251,0.24)";
    function line(samples) {
      ctx.beginPath(); let visible = false;
      for (const pt of samples) {
        if (pt.z > 0) { visible ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y); visible = true; }
        else visible = false;
      }
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => project(lat, -180 + i * 5)));
    for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 37 }, (_, i) => project(-90 + i * 5, lon)));
  }

  function paintRim(ctx, { cx, cy, radius: r }) {
    const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rim.addColorStop(0, "rgba(204,238,255,.84)");
    rim.addColorStop(0.55, "rgba(129,207,255,.53)");
    rim.addColorStop(1, "rgba(74,137,219,.27)");
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, r * 0.005);
    ctx.beginPath(); ctx.arc(cx, cy, r - 0.22, 0, TAU); ctx.stroke();
  }

  function mount(canvas, options) {
    const assetsBase = options.assetsBase || "assets/models/people/";
    const capture = options.capture || new URLSearchParams(location.search).has("capture");
    const surface = pixelCanvas(1, 1), offscreen = surface.getContext("2d");
    const clouds = window.EWMEarthClouds?.create();
    let projection, texture, terrain, instance, fixedFrame;
    let actorsReady = false, textureReady = false, terrainSettled = false;
    let frame;

    function paintGlobe(ctx, current) {
      if (!texture) { paintFallback(ctx, current); return; }
      const { cx, cy, radius: r, rotation } = current;
      const size = Math.max(16, Math.min(540, Math.round(r * 2)));
      const width = texture.width;
      if (projection?.size !== size) {
        surface.width = surface.height = size;
        projection = prepareProjection(offscreen, size, width, texture.height);
      }
      const { image, longitude, rowOffset, rowFrac, sun, rim, alpha } = projection;
      const data = image.data, source = texture.data;
      const shift = rotation / TAU;
      const rowStep = width * 4;
      for (let p = 0; p < alpha.length; p++) {
        if (!alpha[p]) continue;
        const u = wrap(longitude[p] - shift, 1) * width;
        const x = u | 0, frac = u - x;
        const src = rowOffset[p] + x * 4, next = x === width - 1 ? rowOffset[p] : src + 4;
        const rf = rowFrac[p];
        const light = sun[p], air = rim[p], keep = 1 - air;
        const i = p * 4;
        const red = lerp(lerp(source[src], source[next], frac), lerp(source[src + rowStep], source[next + rowStep], frac), rf);
        const green = lerp(lerp(source[src + 1], source[next + 1], frac), lerp(source[src + rowStep + 1], source[next + rowStep + 1], frac), rf);
        const blue = lerp(lerp(source[src + 2], source[next + 2], frac), lerp(source[src + rowStep + 2], source[next + rowStep + 2], frac), rf);
        data[i] = red * light * keep + 65 * air;
        data[i + 1] = green * light * keep + 177 * air;
        data[i + 2] = blue * light * keep + 253 * air;
        data[i + 3] = alpha[p];
      }
      offscreen.putImageData(image, 0, 0);
      ctx.drawImage(surface, cx - r, cy - r, 2 * r, 2 * r);
    }

    function draw(s, force = false) {
      const fixed = capture && Number.isFinite(window.__EWM_EARTH_TIME__);
      const time = fixed ? window.__EWM_EARTH_TIME__ : s.t;
      if (!force && fixed && fixedFrame === time) return;
      fixedFrame = fixed ? time : undefined;
      const ctx = s.ctx;
      const current = planetFrame(s, canvas, time, innerWidth <= 760);
      const activeTerrain = terrain?.isAvailable() ? terrain : null;
      current.terrain = Boolean(activeTerrain);
      current.surfaceLift = (lat, lon) => activeTerrain?.lift(lat, lon) ?? 1;
      current.projectSurface = (lat, lon) => current.project(lat, lon, current.surfaceLift(lat, lon));
      frame = current;
      if (capture) window.__EWM_EARTH_FRAME__ = current;
      ctx.clearRect(0, 0, s.w, s.h);
      paintAtmosphere(ctx, current);
      if (activeTerrain) activeTerrain.draw(ctx, current, PITCH, OBLIQUITY);
      else {
        paintGlobe(ctx, current);
        paintRim(ctx, current);
      }
      clouds?.drawShadows(ctx, current);
      actors?.draw(ctx, current);
      clouds?.draw(ctx, current);
    }

    function invalidate() {
      fixedFrame = undefined;
      if (instance?.visible && !document.hidden) draw(instance, true);
    }
    function updateReady() {
      if (capture) window.__EWM_EARTH_READY__ = textureReady && actorsReady && terrainSettled;
      invalidate();
    }

    if (capture) window.__EWM_EARTH_READY__ = false;
    const actors = window.EWMEarthActors?.create({ invalidate, assetsBase });
    Promise.resolve(actors?.ready).then(() => { actorsReady = true; updateReady(); }, error => {
      if (capture) window.__EWM_EARTH_ERROR__ = String(error);
      invalidate();
    });
    instance = options.stage(canvas, s => draw(s), () => { fixedFrame = undefined; });
    const image = new Image();
    const elevation = new Image();
    function prepareTerrain() {
      if (!textureReady || !elevation.complete || !elevation.naturalWidth) return;
      try {
        terrain = window.EWMEarthTerrain?.create(image, elevation);
      } catch (error) {
        if (capture) window.__EWM_EARTH_ERROR__ = String(error);
      }
      terrainSettled = true;
      updateReady();
    }
    image.onload = () => {
      try {
        texture = readSurface(image);
        textureReady = true;
      } catch (error) {
        if (capture) window.__EWM_EARTH_ERROR__ = String(error);
      }
      prepareTerrain();
      updateReady();
    };
    image.onerror = () => {
      if (capture) window.__EWM_EARTH_ERROR__ = "Earth texture failed to load";
      invalidate();
    };
    elevation.onload = prepareTerrain;
    elevation.onerror = () => {
      terrainSettled = true;
      if (capture) window.__EWM_EARTH_ERROR__ = "Earth elevation failed to load";
      updateReady();
    };
    elevation.src = assetsBase + "earth-elevation.png";
    image.src = assetsBase + "earth-blue-marble.jpg";

    if (capture) window.__EWM_EARTH_RENDER__ = seconds => {
      if (!Number.isFinite(seconds)) throw new TypeError("Earth capture time must be a number of seconds");
      window.__EWM_EARTH_TIME__ = seconds;
      draw(instance, true);
      const { cx, cy, radius, rotation, axis } = frame;
      return { time: seconds, cx, cy, radius, rotation, axis, terrain: frame.terrain, clouds: Boolean(clouds) };
    };
    return instance;
  }

  window.EWMEarthGlobe = { mount };
})();
