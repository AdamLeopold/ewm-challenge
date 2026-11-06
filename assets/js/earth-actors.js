/* EWM globe actors. Waypoints are inland [latitude, longitude] in degrees.
   Each actor follows a closed route. Every connection samples the same moving
   surface anchors used by the sprites, so the endpoints cannot drift. */
(() => {
  "use strict";

  const routes = {
    europeBank: ["bank", [[49.8, 9.0], [50.6, 13.8], [49.4, 18.1]]],
    europeWorker: [0, [[47.0, 11.5], [48.7, 15.9], [46.9, 18.2]]],
    eurasiaFirm: ["firm", [[54.8, 36.5], [56.0, 43.2], [54.2, 50.5]]],
    saharaWorker: [1, [[30.1, 4.5], [30.7, 10.5], [27.7, 14.7]]],
    saharaCourt: ["court", [[26.3, 22.0], [28.2, 25.2], [27.6, 29.0]]],
    westAfricaMarket: ["market", [[11.5, -5.5], [10.6, -1.0], [11.2, 3.4]]],
    eastAfricaWorker: [3, [[8.5, 34.0], [10.7, 37.0], [13.0, 36.0]]],
    southAfricaFirm: ["firm", [[-24.0, 20.4], [-25.0, 24.0], [-27.0, 26.7]]],
    southAfricaWorker: [4, [[-28.3, 21.5], [-29.1, 24.6], [-31.0, 26.0]]],
    northAmericaBank: ["bank", [[39.8, -112.0], [39.3, -106.5], [34.6, -106.1]]],
    northAmericaFirm: ["firm", [[44.0, -108.7], [44.5, -103.5], [41.2, -101.0]]],
    northAmericaWorker: [2, [[38.4, -90.0], [39.4, -84.8], [35.9, -83.0]]],
    northAmericaTrader: [5, [[34.8, -103.6], [35.5, -98.2], [34.3, -94.5]]],
    southAmericaMarket: ["market", [[-20.0, -55.0], [-25.5, -56.0], [-28.0, -59.0]]],
    southAmericaWorker: [1, [[-9.0, -55.0], [-13.0, -51.5], [-17.7, -47.0]]],
    southAmericaBank: ["bank", [[-24.2, -63.0], [-28.8, -64.5], [-33.0, -64.0]]],
    southAmericaTrader: [3, [[-8.5, -73.5], [-10.0, -69.8], [-13.0, -66.0]]],
    indiaBank: ["bank", [[19.0, 74.5], [19.2, 76.7], [17.6, 78.5]]],
    indiaWorker: [4, [[24.5, 74.0], [24.8, 78.0], [21.7, 79.4]]],
    chinaFirm: ["firm", [[33.7, 113.4], [35.5, 114.8], [36.8, 115.4]]],
    chinaWorker: [0, [[34.5, 108.9], [32.5, 110.8], [30.8, 108.2]]],
    southeastAsiaMarket: ["market", [[16.7, 100.4], [16.0, 101.8], [15.7, 103.5]]],
    southeastAsiaWorker: [2, [[20.4, 99.5], [19.3, 101.3], [17.8, 102.2]]],
    australiaFirm: ["firm", [[-23.6, 136.5], [-24.3, 141.0], [-27.0, 144.1]]],
    australiaWorker: [5, [[-25.0, 123.4], [-26.8, 129.4], [-28.6, 133.3]]],
  };

  const connections = [
    ["europeBank", "europeWorker"], ["europeBank", "eurasiaFirm"],
    ["europeBank", "westAfricaMarket"], ["europeWorker", "saharaWorker"],
    ["saharaWorker", "saharaCourt"], ["saharaCourt", "eastAfricaWorker"],
    ["westAfricaMarket", "southAfricaFirm"], ["eastAfricaWorker", "southAfricaFirm"],
    ["southAfricaFirm", "southAfricaWorker"],
    ["northAmericaBank", "northAmericaFirm"], ["northAmericaFirm", "northAmericaWorker"],
    ["northAmericaBank", "northAmericaTrader"], ["northAmericaTrader", "northAmericaWorker"],
    ["northAmericaWorker", "southAmericaTrader"], ["southAmericaTrader", "southAmericaWorker"],
    ["southAmericaWorker", "southAmericaMarket"], ["southAmericaMarket", "southAmericaBank"],
    ["southAmericaBank", "southAfricaFirm"],
    ["eurasiaFirm", "indiaBank"], ["indiaBank", "indiaWorker"], ["indiaWorker", "chinaFirm"],
    ["chinaFirm", "chinaWorker"], ["chinaFirm", "southeastAsiaMarket"],
    ["southeastAsiaMarket", "southeastAsiaWorker"], ["southeastAsiaWorker", "australiaFirm"],
    ["australiaFirm", "australiaWorker"],
  ];
  const linkColors = ["131,210,255", "181,237,243", "170,234,196", "211,189,253"];
  const tau = 2 * Math.PI;
  const radians = Math.PI / 180;
  const personSize = 48;
  const personFeet = 46;
  const buildingFeet = 68;

  function smoothstep(value) {
    const p = Math.min(1, Math.max(0, value));
    return p * p * (3 - 2 * p);
  }

  function wrap(value, period) {
    return ((value % period) + period) % period;
  }

  function locationAt(waypoints, time, index) {
    const cycle = 21 + (index % 5) * 1.8;
    const progress = wrap(time / cycle + index * 0.271, 1) * waypoints.length;
    const leg = Math.floor(progress);
    const from = waypoints[leg];
    const to = waypoints[(leg + 1) % waypoints.length];
    const amount = smoothstep(progress - leg);
    return [
      from[0] + (to[0] - from[0]) * amount,
      from[1] + (to[1] - from[1]) * amount,
    ];
  }

  function toVector(lat, lon) {
    const phi = lat * radians;
    const lambda = lon * radians;
    const parallel = Math.cos(phi);
    return [parallel * Math.sin(lambda), Math.sin(phi), parallel * Math.cos(lambda)];
  }

  function arcPoint(frame, from, to, fraction, lift) {
    if (fraction === 0) return from.foot;
    if (fraction === 1) return to.foot;
    const x = from.vector[0] * (1 - fraction) + to.vector[0] * fraction;
    const y = from.vector[1] * (1 - fraction) + to.vector[1] * fraction;
    const z = from.vector[2] * (1 - fraction) + to.vector[2] * fraction;
    const length = Math.hypot(x, y, z);
    const altitude = 1 + Math.sin(Math.PI * fraction) * lift;
    if (frame.projectVector) return frame.projectVector(x / length, y / length, z / length, altitude);
    const latitude = Math.asin(y / length) / radians;
    const longitude = Math.atan2(x, z) / radians;
    return frame.project(latitude, longitude, altitude);
  }

  function visible(frame, point) {
    return point.z > 0 ||
      Math.hypot(point.x - frame.cx, point.y - frame.cy) > frame.radius + 0.7;
  }

  function drawConnections(ctx, frame, nodes) {
    ctx.save();
    ctx.lineWidth = Math.max(0.65, frame.radius * 0.004);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    connections.forEach(([fromName, toName], index) => {
      const from = nodes[fromName];
      const to = nodes[toName];
      const separation = Math.hypot(...from.vector.map((value, i) => value - to.vector[i]));
      const lift = Math.min(0.15, Math.max(0.012, separation * 0.105));
      const color = linkColors[index % linkColors.length];
      const opacity = 0.25 + 0.19 * Math.max(0, from.foot.nz, to.foot.nz);
      ctx.strokeStyle = `rgba(${color},${opacity})`;
      ctx.beginPath();
      let drawing = false;
      const steps = 26;
      for (let step = 0; step <= steps; step++) {
        const point = arcPoint(frame, from, to, step / steps, lift);
        if (!visible(frame, point)) {
          drawing = false;
          continue;
        }
        if (drawing) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
        drawing = true;
      }
      ctx.stroke();

      const pulse = wrap(frame.time * (0.19 + (index % 4) * 0.014) + index * 0.137, 1);
      for (let trail = 2; trail >= 0; trail--) {
        const fraction = pulse - trail * 0.036;
        if (fraction < 0) continue;
        const point = arcPoint(frame, from, to, fraction, lift);
        if (!visible(frame, point)) continue;
        ctx.fillStyle = `rgba(${color},${0.83 - trail * 0.22})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(0.65, frame.radius * (0.007 - trail * 0.0013)), 0, tau);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  function poly(ctx, color, points) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function box(ctx, x, y, width, height, dx, dy, face, top, side) {
    poly(ctx, face, [x,y, x+width,y, x+width,y-height, x,y-height]);
    poly(ctx, top, [x,y-height, x+dx,y-height+dy, x+width+dx,y-height+dy, x+width,y-height]);
    poly(ctx, side, [x+width,y, x+width+dx,y+dy, x+width+dx,y-height+dy, x+width,y-height]);
  }

  function buildingSprite(kind) {
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 80;
    const ctx = sprite.getContext("2d");
    ctx.translate(40, buildingFeet);
    box(ctx, -27, 0, 47, 5, 9, -6, "#456080", "#7189a5", "#263d5a");
    if (kind === "bank" || kind === "court") {
      const roof = kind === "bank" ? "#aa9ce9" : "#88c7df";
      box(ctx, -21, -5, 37, 23, 9, -6, "#496682", "#bfcddd", "#4f6683");
      for (let i = 0; i < 4; i++) box(ctx, -19 + i*10, -6, 4.5, 21, 2, -1, "#e9eff2", "#ffffff", "#879fbb");
      poly(ctx, "#526788", [16,-28, 2,-42, 10,-48, 25,-34]);
      poly(ctx, roof, [-23,-28, -4,-42, 18,-28]);
      box(ctx, -24, -25, 43, 4, 8, -6, "#dfe9f5", "#edf5ff", "#8aa5c3");
      if (kind === "court") {
        ctx.fillStyle = "#76b9dc";
        ctx.beginPath();
        ctx.ellipse(2, -42, 9, 8, 0, Math.PI, tau);
        ctx.fill();
        ctx.fillStyle = "#c6e8f2";
        ctx.fillRect(-1, -53, 2, 5);
      } else {
        ctx.fillStyle = "#f2d38c";
        ctx.fillRect(-9, -27.5, 12, 2.4);
      }
    } else if (kind === "firm") {
      box(ctx, -17, -5, 28, 44, 12, -7, "#91c9d9", "#d1edf1", "#477990");
      box(ctx, -12, -49, 18, 6, 11, -6, "#c2d5dd", "#e9f8f8", "#7097a5");
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = (row + col) % 4 === 0 ? "#f6df97" : "#2c5976";
          ctx.fillRect(-13 + col*8, -44 + row*7, 5, 4);
        }
      }
      ctx.fillStyle = "#315a73";
      ctx.fillRect(-5, -10, 5, 6);
    } else {
      box(ctx, -22, -5, 40, 24, 11, -7, "#86d0b5", "#a9f0c8", "#3c7b71");
      box(ctx, -24, -29, 44, 4, 10, -7, "#d6eed4", "#e7f9dc", "#6c9e86");
      ctx.fillStyle = "#315f65";
      ctx.fillRect(-16, -23, 29, 11);
      [3,7,5,9,6].forEach((height, i) => {
        ctx.fillStyle = i === 2 ? "#f18ba7" : "#88ffbd";
        ctx.fillRect(-14 + i*5.3, -14 - height, 3, height);
        ctx.fillRect(-13 + i*5.3, -15.5 - height, 1, height + 2.5);
      });
      ctx.fillStyle = "#486578";
      ctx.fillRect(-4, -11, 7, 6);
    }
    return sprite;
  }

  function drawMarker(ctx, frame, marker, people, buildings) {
    const { foot, sprite } = marker;
    const institution = typeof sprite === "string";
    const radialLength = Math.hypot(foot.nx, foot.ny);
    const scale = Math.max(6, frame.radius * (institution ? 0.153 : 0.100));
    const factor = scale / (institution ? 80 : personSize);
    const fade = smoothstep(foot.nz / 0.18);
    const foreshorten = 0.51 + 0.49 * radialLength;

    ctx.save();
    ctx.translate(foot.x, foot.y);
    // In Canvas coordinates a clockwise rotation of (0,-1) by this angle
    // points outwards from the centre of the globe.
    ctx.rotate(foot.angle);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(4,24,41,0.33)";
    ctx.beginPath();
    ctx.ellipse(0, 0, scale * 0.22, Math.max(0.55, scale * foot.nz * 0.072), 0, 0, tau);
    ctx.fill();
    ctx.scale(factor, factor * foreshorten);
    if (institution) ctx.drawImage(buildings[sprite], -40, -buildingFeet);
    else if (people.naturalWidth) {
      ctx.drawImage(people, sprite*personSize, 0, personSize, personSize, -personSize/2, -personFeet, personSize, personSize);
    }
    ctx.restore();
  }

  function create({ invalidate = () => {}, assetsBase = "assets/models/people/" } = {}) {
    const atlas = new Image();
    const buildings = Object.fromEntries(["bank", "court", "firm", "market"].map(kind => [kind, buildingSprite(kind)]));
    const ready = new Promise(resolve => {
      atlas.onload = () => { invalidate(); resolve(); };
      atlas.onerror = () => { invalidate(); resolve(); };
    });
    atlas.src = assetsBase + "globe-people.webp";

    function draw(ctx, frame) {
      const nodes = Object.fromEntries(Object.entries(routes).map(([name, [sprite, waypoints]], index) => {
        const [lat, lon] = locationAt(waypoints, frame.time, index);
        return [name, { sprite, foot: frame.project(lat, lon, 1), vector: toVector(lat, lon) }];
      }));
      drawConnections(ctx, frame, nodes);
      Object.values(nodes)
        .filter(marker => marker.foot.nz > 0)
        .sort((first, second) => first.foot.nz - second.foot.nz)
        .forEach(marker => drawMarker(ctx, frame, marker, atlas, buildings));
    }
    return { draw, ready };
  }

  window.EWMEarthActors = { create };
})();
