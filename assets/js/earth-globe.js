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
  const OBLIQUITY = -23.44 * RAD;
  const CP = Math.cos(PITCH), SP = Math.sin(PITCH);
  const CO = Math.cos(OBLIQUITY), SO = Math.sin(OBLIQUITY);
  const AXIS = Object.freeze({ x: -CP * SO, y: CP * CO, z: SP });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const wrap = (v, mod) => v - Math.floor(v / mod) * mod;
  const smooth = (a, b, v) => { const f = clamp((v - a) / (b - a), 0, 1); return f * f * (3 - 2 * f); };
  const cloudWidth = 512;
  const cloudHeight = 256;

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

  function noiseAt(x, y) {
    let h = Math.imul(x + 71, 0x45d9f3b) ^ Math.imul(y + 211, 0x119de1f3);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function cloudNoise(u, v, columns, rows) {
    const x = u * columns, y = v * rows;
    const i = Math.floor(x), j = Math.floor(y);
    const xf = smooth(0, 1, x - i), yf = smooth(0, 1, y - j);
    const a = wrap(i, columns), b = wrap(i + 1, columns);
    return lerp(lerp(noiseAt(a, j), noiseAt(b, j), xf), lerp(noiseAt(a, j + 1), noiseAt(b, j + 1), xf), yf);
  }

  function makeClouds() {
    // Analytic lobe shapes give the clouds soft, readable silhouettes at the
    // small hero scale. Fine noise and shallow relief keep the edges organic.
    const systems = [
      [15, -35, 26, 6.5, -0.21], [55, -44, 37, 8, 0.27], [57, 24, 27, 6, -0.27],
      [-24, 60, 25, 5.5, 0.34], [-51, 23, 32, 8, 0.16], [24, 71, 20, 5.8, -0.35],
      [29, 121, 27, 7, 0.18], [-9, 154, 38, 6, 0.34], [-37, 114, 27, 8, -0.16],
      [26, -160, 38, 6.5, -0.28], [46, -122, 26, 7, 0.32], [-23, -111, 27, 5.5, 0.18],
      [5, -79, 23, 5.5, -0.15], [-31, -51, 26, 7, 0.33]
    ].map(([lat, lon, width, height, shear], idx) => ({
      lat, lon, width, height, shear,
      puffs: Array.from({ length: 7 }, (_, i) => ({
        x: (i - 3) * 0.24 + (noiseAt(idx, i) - 0.5) * 0.15,
        y: (noiseAt(i + 14, idx + 18) - 0.5) * 0.79,
        r: 0.25 + noiseAt(idx + 51, i + 91) * 0.16,
        h: 0.59 + noiseAt(i + 32, idx + 13) * 0.22
      }))
    }));
    const mask = new Uint8Array(cloudWidth * cloudHeight);
    const height = new Uint8Array(mask.length);
    for (let j = 0; j < cloudHeight; j++) {
      const v = j / cloudHeight, lat = 90 - v * 180;
      const nearby = systems.filter(system => Math.abs(lat - system.lat) < system.height * 2);
      for (let i = 0; i < cloudWidth; i++) {
        const u = i / cloudWidth, lon = u * 360 - 180;
        let cover = 0, altitude = 0;
        for (const system of nearby) {
          const x = (wrap(lon - system.lon + 180, 360) - 180) / system.width;
          if (Math.abs(x) > 1.3) continue;
          const y = (lat - system.lat) / system.height - x * system.shear;
          for (const puff of system.puffs) {
            const dx = (x - puff.x) / puff.r, dy = (y - puff.y) / puff.h;
            const dist = dx * dx + dy * dy;
            if (dist > 1.2) continue;
            const shape = 1 - smooth(0.24, 1.19, dist);
            cover = Math.max(cover, shape);
            altitude = Math.max(altitude, Math.sqrt(Math.max(0, 1 - dist)));
          }
        }
        const large = cloudNoise(u + 0.027 * Math.sin(v * 21), v, 13, 27);
        const detail = cloudNoise(u, v, 61, 98);
        const wisps = smooth(0.59, 0.84, large * 0.68 + detail * 0.32) * 0.35;
        const texture = lerp(0.68, 1, smooth(0.1, 0.83, large * 0.5 + detail * 0.5));
        const at = j * cloudWidth + i;
        mask[at] = Math.round(224 * Math.max(cover * texture, wisps));
        height[at] = Math.round(255 * altitude);
      }
    }
    return { mask, height };
  }

  function prepareProjection(ctx, size, width, height) {
    const count = size * size;
    const longitude = new Float32Array(count), rowOffset = new Uint32Array(count), rowFrac = new Float32Array(count);
    const sun = new Float32Array(count), rim = new Float32Array(count), alpha = new Uint8Array(count);
    const cloudRow = new Uint16Array(count);
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
        cloudRow[p] = Math.floor(v * (cloudHeight - 1));
        const directional = Math.max(0, -0.48 * x + 0.56 * y + 0.68 * z);
        sun[p] = 0.64 + 0.48 * directional;
        rim[p] = (1 - z) ** 3.35 * (0.49 + 0.28 * Math.max(0, (-x + y) * 0.7));
        alpha[p] = Math.round(255 * clamp((1 - rho) * size * 0.57, 0, 1));
      }
    }
    return { size, image: ctx.createImageData(size, size), longitude, rowOffset, rowFrac, sun, rim, alpha, cloudRow };
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
    let clouds, projection, texture, instance, fixedFrame;
    let actorsReady = false, textureReady = false;
    let frame;

    function paintGlobe(ctx, current) {
      if (!texture) { paintFallback(ctx, current); return; }
      const { cx, cy, radius: r, rotation, time } = current;
      const size = Math.max(16, Math.min(540, Math.round(r * 2)));
      const width = texture.width;
      if (projection?.size !== size) {
        surface.width = surface.height = size;
        projection = prepareProjection(offscreen, size, width, texture.height);
      }
      const { image, longitude, rowOffset, rowFrac, sun, rim, alpha, cloudRow } = projection;
      const data = image.data, source = texture.data;
      const shift = rotation / TAU;
      const cloudShift = shift + time / 3100;
      const rowStep = width * 4;
      for (let p = 0; p < alpha.length; p++) {
        if (!alpha[p]) continue;
        const u = wrap(longitude[p] - shift, 1) * width;
        const x = u | 0, frac = u - x;
        const src = rowOffset[p] + x * 4, next = x === width - 1 ? rowOffset[p] : src + 4;
        const rf = rowFrac[p];
        const cu = wrap(longitude[p] - cloudShift, 1) * cloudWidth;
        const ci = cu | 0, cloudFrac = cu - ci;
        const cloudBase = cloudRow[p] * cloudWidth;
        const cloudIdx = cloudBase + ci, cloudNext = cloudBase + ((ci + 1) % cloudWidth);
        const cover = lerp(clouds.mask[cloudIdx], clouds.mask[cloudNext], cloudFrac) / 255;
        const puff = lerp(clouds.height[cloudIdx], clouds.height[cloudNext], cloudFrac) / 255;
        const cloudColor = 214 + 41 * puff;
        const light = sun[p], air = rim[p], keep = 1 - air;
        const i = p * 4;
        const red = lerp(lerp(source[src], source[next], frac), lerp(source[src + rowStep], source[next + rowStep], frac), rf);
        const green = lerp(lerp(source[src + 1], source[next + 1], frac), lerp(source[src + rowStep + 1], source[next + rowStep + 1], frac), rf);
        const blue = lerp(lerp(source[src + 2], source[next + 2], frac), lerp(source[src + rowStep + 2], source[next + rowStep + 2], frac), rf);
        data[i] = lerp(red, cloudColor, cover) * light * keep + 65 * air;
        data[i + 1] = lerp(green, cloudColor + 6, cover) * light * keep + 177 * air;
        data[i + 2] = lerp(blue, cloudColor + 13, cover) * light * keep + 253 * air;
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
      frame = current;
      if (capture) window.__EWM_EARTH_FRAME__ = current;
      ctx.clearRect(0, 0, s.w, s.h);
      paintAtmosphere(ctx, current);
      paintGlobe(ctx, current);
      paintRim(ctx, current);
      actors?.draw(ctx, current);
    }

    function invalidate() {
      fixedFrame = undefined;
      if (instance?.visible && !document.hidden) draw(instance, true);
    }
    function updateReady() {
      if (capture) window.__EWM_EARTH_READY__ = textureReady && actorsReady;
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
    image.onload = () => {
      try {
        texture = readSurface(image);
        clouds = makeClouds();
        textureReady = true;
      } catch (error) {
        if (capture) window.__EWM_EARTH_ERROR__ = String(error);
      }
      updateReady();
    };
    image.onerror = () => {
      if (capture) window.__EWM_EARTH_ERROR__ = "Earth texture failed to load";
      invalidate();
    };
    image.src = assetsBase + "earth-blue-marble.jpg";

    if (capture) window.__EWM_EARTH_RENDER__ = seconds => {
      if (!Number.isFinite(seconds)) throw new TypeError("Earth capture time must be a number of seconds");
      window.__EWM_EARTH_TIME__ = seconds;
      draw(instance, true);
      const { cx, cy, radius, rotation, axis } = frame;
      return { time: seconds, cx, cy, radius, rotation, axis };
    };
    return instance;
  }

  window.EWMEarthGlobe = { mount };
})();
