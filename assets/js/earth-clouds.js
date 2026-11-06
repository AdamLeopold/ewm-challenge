/* Elevated cloud groups, composed of lit ellipsoids on the homepage globe. */
(function () {
  "use strict";
  const radians = Math.PI / 180;
  const cloudShell = 1.071;
  const sun = [-0.48, 0.56, 0.68];
  const sunLength = Math.hypot(...sun);
  const [lightX, lightY, lightZ] = sun.map(v => v / sunLength);
  const mix = (a, b, weight) => a + (b - a) * weight;
  function ease(v) {
    const p = Math.max(0, Math.min(1, v));
    return p * p * (3 - 2 * p);
  }

  // Cloud bands occupy separate latitudes so the continents and network still read.
  // Each entry is latitude, longitude, scale, and heading in degrees.
  const systems = [
    [12, -40, 1.06, -18], [48, -46, 1.05, 23], [56, 27, 0.79, -22],
    [-25, 66, 0.96, 18], [-47, 6, 0.85, -12], [23, 111, 0.83, 20],
    [32, 145, 0.94, -13], [-11, 158, 1.12, 14], [-39, 116, 0.71, -25],
    [17, -162, 1.12, 18], [47, -127, 0.86, -16], [-27, -109, 1.02, -24],
    [13, -81, 0.79, 14], [-38, -47, 0.93, 16]
  ].map(([latitude, longitude, scale, heading], index) => ({
    latitude, longitude, scale,
    c: Math.cos(heading * radians), s: Math.sin(heading * radians),
    wind: 0.19 + (index % 4) * 0.034,
    phase: index * 1.81,
    shape: index % 3
  }));

  // In the tangent plane, x is east, y is north, and r is the lobe radius.
  // The lift differences give the lobes actual depth before projection.
  const puffs = [
    [-0.120, -0.011, 0.025, -0.004], [-0.087, 0.006, 0.035, 0.000],
    [-0.051, -0.013, 0.036, 0.006], [-0.031, 0.018, 0.040, 0.017],
    [ 0.010, 0.032, 0.042, 0.027], [ 0.041, -0.005, 0.039, 0.013],
    [ 0.080, 0.008, 0.033, 0.007], [ 0.116, -0.008, 0.024, 0.001]
  ];

  function projectCloud(frame, cloud) {
    const { time, radius } = frame;
    const lat = (cloud.latitude + Math.sin(time * 0.044 + cloud.phase) * 0.8) * radians;
    const lon = (cloud.longitude + time * cloud.wind) * radians;
    const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
    const center = [cl * so, sl, cl * co];
    const east = [co, 0, -so];
    const north = [-sl * so, cl, -sl * co];
    const lobes = [];
    let depth = 0;
    for (const [index, [x, y, r, height]] of puffs.entries()) {
      const variant = Math.sin(index * 2.19 + cloud.phase) * 0.011;
      const wide = x * (cloud.shape === 1 ? 1.17 : 1);
      const tall = y * (cloud.shape === 2 ? 1.18 : 1) + variant;
      const u = (wide * cloud.c - tall * cloud.s) * cloud.scale;
      const v = (wide * cloud.s + tall * cloud.c) * cloud.scale;
      const vx = center[0] + east[0] * u + north[0] * v;
      const vy = center[1] + north[1] * v;
      const vz = center[2] + east[2] * u + north[2] * v;
      const norm = Math.hypot(vx, vy, vz);
      const lift = cloudShell + height * cloud.scale;
      const p = frame.projectVector(vx / norm, vy / norm, vz / norm, lift);
      const size = r * cloud.scale;
      const rx = size * radius * 1.18;
      const ry = size * radius * 0.87;
      const rz = size * 0.92;
      lobes.push({ x: p.x, y: p.y, z: p.z, rx, ry, rz, size });
      depth += p.z;
    }
    return { lobes, depth: depth / lobes.length };
  }

  function paintShadows(ctx, frame, clouds) {
    const { cx, cy, radius } = frame;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI); ctx.clip();
    for (const { lobes } of clouds) {
      for (let i = 0; i < lobes.length; i += 2) {
        const p = lobes[i];
        const x = (p.x - cx) / radius, y = (cy - p.y) / radius, z = p.z;
        const towardSun = x * lightX + y * lightY + z * lightZ;
        const discriminant = towardSun ** 2 - (x * x + y * y + z * z - 1);
        if (towardSun <= 0 || discriminant <= 0) continue;
        const travel = towardSun - Math.sqrt(discriminant);
        const groundZ = z - travel * lightZ;
        if (groundZ <= 0) continue;
        const shadowX = cx + (x - travel * lightX) * radius;
        const shadowY = cy - (y - travel * lightY) * radius;
        const width = p.rx * 1.67;
        const height = p.ry * 1.65;
        const opacity = 0.29 * ease(groundZ * 4) * ease(towardSun * 1.55);
        ctx.save(); ctx.translate(shadowX, shadowY); ctx.scale(width, height);
        const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        fade.addColorStop(0, `rgba(22,48,103,${opacity})`);
        fade.addColorStop(0.53, `rgba(22,48,103,${opacity * 0.59})`);
        fade.addColorStop(1, "rgba(22,48,103,0)");
        ctx.fillStyle = fade; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
      }
    }
    ctx.restore();
  }

  function create() {
    const raster = document.createElement("canvas");
    const context = raster.getContext("2d");
    let buffer, depth, shade, opacity, ground;
    let lastFrame, projectedClouds;

    function reserve(size) {
      if (buffer && buffer.width >= size) return;
      raster.width = raster.height = size;
      buffer = context.createImageData(size, size);
      const length = size * size;
      depth = new Float32Array(length);
      shade = new Float32Array(length);
      opacity = new Float32Array(length);
      ground = new Float32Array(length);
    }

    function groundDepth(frame, x, y) {
      if (frame.surfaceDepth) return frame.surfaceDepth(x, y);
      const nx = (x - frame.cx) / frame.radius, ny = (frame.cy - y) / frame.radius;
      const rho = nx * nx + ny * ny;
      return rho < 1 ? Math.sqrt(1 - rho) : -Infinity;
    }

    function paintCloud(ctx, frame, { lobes }) {
      const minX = Math.floor(Math.min(...lobes.map(p => p.x - p.rx)));
      const minY = Math.floor(Math.min(...lobes.map(p => p.y - p.ry)));
      const width = Math.ceil(Math.max(...lobes.map(p => p.x + p.rx))) - minX;
      const height = Math.ceil(Math.max(...lobes.map(p => p.y + p.ry))) - minY;
      if (width < 1 || height < 1) return;
      reserve(Math.max(width, height));
      const stride = buffer.width;
      depth.fill(-Infinity, 0, stride * height);
      opacity.fill(0, 0, stride * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) ground[y * stride + x] = groundDepth(frame, minX + x + 0.5, minY + y + 0.5);
      }
      for (const p of lobes) {
        const x0 = Math.max(0, Math.floor(p.x - p.rx) - minX);
        const x1 = Math.min(width, Math.ceil(p.x + p.rx) - minX);
        const y0 = Math.max(0, Math.floor(p.y - p.ry) - minY);
        const y1 = Math.min(height, Math.ceil(p.y + p.ry) - minY);
        const edge = Math.max(0.035, 1.0 / Math.min(p.rx, p.ry));
        for (let y = y0; y < y1; y++) {
          const dy = (p.y - minY - y - 0.5) / p.ry;
          for (let x = x0; x < x1; x++) {
            const dx = (minX + x + 0.5 - p.x) / p.rx;
            const distance = dx * dx + dy * dy;
            if (distance >= 1) continue;
            const front = Math.sqrt(1 - distance);
            const z = p.z + front * p.rz;
            const index = y * stride + x;
            const reveal = (z - ground[index]) * frame.radius * 0.58;
            if (reveal <= 0) continue;
            const cover = ease((1 - distance) / edge) * ease(reveal);
            opacity[index] = 1 - (1 - opacity[index]) * (1 - cover);
            const nx = dx / 1.18, ny = dy / 0.87, nz = front / 0.92;
            const lit = Math.max(0, (nx * lightX + ny * lightY + nz * lightZ) / Math.hypot(nx, ny, nz));
            // Neighboring lobes blend near their common boundary, keeping the
            // rounded outline and reducing hard seams where volumes overlap.
            const blendDistance = 0.011 * Math.max(0.7, p.size / 0.034);
            if (depth[index] === -Infinity) {
              depth[index] = z; shade[index] = lit;
            } else if (z >= depth[index]) {
              const weight = 0.5 + 0.5 * ease((z - depth[index]) / blendDistance);
              shade[index] = mix(shade[index], lit, weight); depth[index] = z;
            } else if (depth[index] - z < blendDistance) {
              shade[index] = mix(shade[index], lit, 0.5 * (1 - ease((depth[index] - z) / blendDistance)));
            }
          }
        }
      }
      const pixels = buffer.data;
      let visible = false;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * stride + x, pos = i * 4;
          pixels[pos + 3] = opacity[i] * 244;
          if (pixels[pos + 3] === 0) continue;
          const light = ease(shade[i] * 1.24);
          pixels[pos] = mix(135, 251, light);
          pixels[pos + 1] = mix(167, 253, light);
          pixels[pos + 2] = mix(212, 255, light);
          visible = true;
        }
      }
      if (!visible) return;
      context.putImageData(buffer, 0, 0, 0, 0, width, height);
      ctx.drawImage(raster, 0, 0, width, height, minX, minY, width, height);
    }

    function project(frame) {
      if (frame === lastFrame) return projectedClouds;
      lastFrame = frame;
      projectedClouds = systems.map(cloud => projectCloud(frame, cloud)).filter(cloud => cloud.depth > -0.50);
      projectedClouds.sort((a, b) => a.depth - b.depth);
      return projectedClouds;
    }
    function drawShadows(ctx, frame) { paintShadows(ctx, frame, project(frame)); }
    function draw(ctx, frame) {
      for (const cloud of project(frame)) paintCloud(ctx, frame, cloud);
    }
    return { drawShadows, draw };
  }

  window.EWMEarthClouds = { create };
})();
