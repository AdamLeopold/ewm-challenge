/* EWM Challenge — canvas backgrounds and page interactions. No dependencies. */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = window.innerWidth < 760;
  var lite = document.body && document.body.hasAttribute("data-lite");   // pages with several live canvases

  /* ---------- canvas helper: DPR, resize, pause when hidden/offscreen ---------- */
  function stage(canvas, draw, init) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2), big = false;
    var s = { w: 0, h: 0, t: 0, ctx: ctx, visible: true };
    function resize() {
      var r = canvas.getBoundingClientRect();
      s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
      big = s.w * s.h > 900000; var k = lite ? 1 : big ? Math.min(dpr, 1.5) : dpr;   // full-screen canvases render at most 1.5x
      canvas.width = s.w * k; canvas.height = s.h * k;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      init && init(s);
    }
    resize();
    var ro = new ResizeObserver(resize); ro.observe(canvas);
    new IntersectionObserver(function (e) { s.visible = e[0].isIntersecting; }).observe(canvas);
    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      // on the track chooser, panels that aren't hovered while another is draw every other frame
      var side = lite && canvas.closest(".side"), calm = side && !side.matches(":hover") && side.parentNode.querySelector(".side:hover");
      s.f = (s.f || 0) + 1;
      if (s.visible && !document.hidden) { s.t += dt; if (!calm || s.f % 2 === 0) draw(s, calm ? dt * 2 : dt); }
      if (!reduce) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    if (reduce) { s.t = 3; draw(s, 0); }
    return s;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* pointer, smoothed: px/py in [-1, 1] across the window; act eases to 1 while the pointer moves */
  var P = { x: 0, y: 0, tx: 0, ty: 0, cx: -9999, cy: -9999, act: 0, last: 0 };
  addEventListener("pointermove", function (e) {
    P.tx = e.clientX / innerWidth * 2 - 1; P.ty = e.clientY / innerHeight * 2 - 1;
    P.cx = e.clientX; P.cy = e.clientY; P.last = performance.now();
  }, { passive: true });
  function easePointer(dt) {
    var k = 1 - Math.pow(0.001, dt);            // frame-rate independent smoothing
    P.x += (P.tx - P.x) * k * 0.6; P.y += (P.ty - P.y) * k * 0.6;
    var want = performance.now() - P.last < 1600 ? 1 : 0;
    P.act += (want - P.act) * k * 0.35;
  }

  /* ---------- HoloBit: candles + a liquidity surface in the lower part of the frame ---------- */
  function holoFX(canvas, opts) {
    opts = opts || {};
    var quiet = !!opts.quiet, risk = opts.variant === "risk";
    var TOP = quiet ? 0.24 : 0.54, SPAN = quiet ? 0.7 : 0.46;   // where the surface lives, as a share of height
    function price(k) { return Math.sin(k * 0.11) * 0.55 + Math.sin(k * 0.037 + 1.3) * 0.9 + Math.sin(k * 0.29) * 0.18 + Math.sin(k * 0.71) * 0.07; }
    /* Track 2 variant: lending positions drift on a health-factor scale; a market shock pushes them
       down, and any that cross the liquidation line flash red and are replaced. */
    function drawRisk(s, dt) {
      var c = s.ctx, w = s.w, h = s.h, t = s.t;
      var thr = h * 0.47, topY = h * 0.33;   // above the panel text, below the page heading
      var hfY = function (hf) { return thr - (hf - 1) / 1.4 * (thr - topY); };
      var shock = Math.max(0, Math.sin(t * 0.35)) * 0.06;        // a slow wave of market stress
      c.strokeStyle = "rgba(255,92,120,.55)"; c.setLineDash([6, 6]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, thr); c.lineTo(w, thr); c.stroke(); c.setLineDash([]);
      c.font = "11px JetBrains Mono, monospace"; c.fillStyle = "rgba(255,140,160,.8)";
      c.fillText("LIQUIDATION · HEALTH FACTOR 1.00", w * 0.36, thr + 18);
      c.fillStyle = "rgba(160,255,230,.55)";
      c.fillText("HF 2.40", w * 0.36, topY - 8);
      c.globalCompositeOperation = "lighter";
      s.pos.forEach(function (p) {
        p.hf += (Math.sin(t * p.f + p.ph) * 0.004 - shock * p.beta) * dt * 60;
        p.x += p.vx * dt * 60; if (p.x > w + 10) p.x = -10;
        var y = hfY(p.hf);
        if (p.hf < 1) { s.flash.push({ x: p.x, y: thr, a: 1 }); p.hf = rnd(1.6, 2.4); p.x = rnd(0, w); return; }
        var k = Math.min(1, (p.hf - 1) / 0.8);
        var col = k > 0.5 ? "63,242,200" : k > 0.22 ? "255,200,90" : "255,92,120";
        c.fillStyle = "rgba(" + col + ",.9)"; c.beginPath(); c.arc(p.x, y, p.r, 0, 7); c.fill();
      });
      s.flash = s.flash.filter(function (f) { return (f.a -= dt * 1.2) > 0; });
      s.flash.forEach(function (f) {
        c.strokeStyle = "rgba(255,92,120," + f.a + ")"; c.lineWidth = 1.5;
        c.beginPath(); c.arc(f.x, f.y, (1 - f.a) * 26 + 3, 0, 7); c.stroke();
      });
      c.globalCompositeOperation = "source-over";
    }
    function curve(x, t, i) { return Math.sin(x * 0.0042 + t * 0.32 + i * 0.32) * 0.62 + Math.sin(x * 0.011 - t * 0.21 + i * 0.17) * 0.3 + Math.sin(x * 0.023 + t * 0.6 + i) * 0.08; }
    return stage(canvas, function (s, dt) {
      easePointer(dt);
      var c = s.ctx, w = s.w, h = s.h, t = s.t, r = canvas.getBoundingClientRect();
      c.clearRect(0, 0, w, h);
      // faint dot lattice, only where the surface is
      c.fillStyle = "rgba(120,255,200,.06)";
      for (var gx = 24; gx < w; gx += 36) for (var gy = Math.round(h * TOP / 36) * 36 + 24; gy < h; gy += 36) c.fillRect(gx, gy, 1, 1);

      if (risk) drawRisk(s, dt); else {
      // candles: thin, slow, fading at both ends, with a moving average drawn through them
      var cw = small ? 5 : 7, step = cw + (small ? 4 : 6), speed = 16;
      var mid = h * (TOP + SPAN * 0.3), amp = h * SPAN * 0.22;
      var shift = (t * speed) % step, k0 = Math.floor(t * speed / step), n = Math.ceil(w / step) + 3;
      var ma = [];
      for (var q = 0; q < n; q++) {
        var k = k0 + q, cx = q * step - shift;
        var o = mid - amp * price(k), cl = mid - amp * price(k + 1);
        var wick = amp * (0.08 + 0.1 * Math.abs(Math.sin(k * 2.7)));
        var hiY = Math.min(o, cl) - wick, loY = Math.max(o, cl) + wick * 0.8, up = cl < o;
        var edge = Math.min(1, cx / (w * 0.18), (w - cx) / (w * 0.12));
        if (edge <= 0) continue;
        var al = (quiet ? 0.28 : 0.55) * edge;
        c.strokeStyle = up ? "rgba(0,255,150," + al + ")" : "rgba(255,92,120," + al * 0.85 + ")";
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx + cw / 2 + .5, hiY); c.lineTo(cx + cw / 2 + .5, loY); c.stroke();
        c.fillStyle = up ? "rgba(0,255,150," + al * 0.5 + ")" : "rgba(255,92,120," + al * 0.35 + ")";
        c.fillRect(cx, Math.min(o, cl), cw, Math.max(1.5, Math.abs(cl - o)));
        c.strokeRect(cx + .5, Math.min(o, cl) + .5, cw - 1, Math.max(1, Math.abs(cl - o)));
        ma.push([cx + cw / 2, mid - amp * (price(k - 2) + price(k - 1) + price(k) + price(k + 1) + price(k + 2)) / 5, edge]);
      }
      c.globalCompositeOperation = "lighter";
      c.beginPath(); ma.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
      c.strokeStyle = "rgba(120,255,200," + (quiet ? 0.25 : 0.55) + ")"; c.lineWidth = 1.4;
      c.shadowColor = "rgba(0,255,150,.9)"; c.shadowBlur = quiet || lite ? 0 : 10; c.stroke(); c.shadowBlur = 0;
      if (!quiet && ma.length) {
        var last = ma[ma.length - 4] || ma[ma.length - 1];
        c.fillStyle = "#eafff4"; c.beginPath(); c.arc(last[0], last[1], 3, 0, 7); c.fill();
        c.strokeStyle = "rgba(120,255,200,.25)"; c.setLineDash([3, 5]);
        c.beginPath(); c.moveTo(0, last[1]); c.lineTo(w, last[1]); c.stroke(); c.setLineDash([]);
        c.font = "11px JetBrains Mono, monospace"; c.fillStyle = "rgba(160,255,215,.85)";
        c.fillText("ETH/USDC  " + (2400 + 60 * price(k0 + n - 4)).toFixed(2), Math.min(last[0] + 10, w - 140), last[1] - 9);
      }

      }
      c.globalCompositeOperation = "lighter";
      // the liquidity surface underneath
      var L = s.L, mx = P.cx - r.left, my = P.cy - r.top, sig = Math.max(140, w * 0.12);
      function yAt(x, i) {
        var z = i / (L - 1), base = h * (TOP + SPAN * 0.42 + SPAN * 0.58 * Math.pow(z, 1.4)), am = h * SPAN * (0.06 + 0.1 * z);
        var d = x - mx, bump = Math.exp(-(d * d) / (2 * sig * sig)) * Math.exp(-Math.pow((my - base) / (h * 0.35), 2));
        return base - am * curve(x, t, i) - bump * h * 0.07 * (0.3 + z) * P.act;
      }
      for (var i = 0; i < L; i++) {
        var z = i / (L - 1), zz = Math.pow(z, 1.5), a = (quiet ? 0.04 : 0.05) + (quiet ? 0.2 : 0.42) * zz;
        c.beginPath();
        for (var x = -10; x <= w + 10; x += 7) { var y = yAt(x, i); x === -10 ? c.moveTo(x, y) : c.lineTo(x, y); }
        var hi = i % 6 === 0;
        c.strokeStyle = "rgba(" + (hi ? "120,255,190" : "0," + Math.round(170 + 85 * z) + "," + Math.round(150 - 30 * z)) + "," + (hi ? a * 1.4 : a) + ")";
        c.lineWidth = 0.5 + 1.1 * z; c.stroke();
      }
      if (!quiet) {   // a light pulse travelling along one curve
        var kk = Math.floor(L * 0.7), head = (t * 140) % (w + 400) - 200;
        for (var j = 0; j < 46; j++) {
          var x2 = head - j * 6, al2 = 1 - j / 46;
          c.fillStyle = "rgba(190,255,225," + (al2 * al2 * 0.9) + ")";
          c.beginPath(); c.arc(x2, yAt(x2, kk), 2.2 * al2 + 0.4, 0, 7); c.fill();
        }
      }
      s.bokeh.forEach(function (b) {
        b.y -= b.v * dt * 60; b.x += Math.sin(t * 0.3 + b.ph) * 0.15;
        if (b.y < h * TOP) { b.y = h + 20; b.x = rnd(0, w); }
        var g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, "rgba(0,255,150," + b.a + ")"); g.addColorStop(1, "rgba(0,255,150,0)");
        c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
      });
      c.globalCompositeOperation = "source-over";
    }, function (s) {
      s.L = small ? 20 : (quiet ? 26 : lite ? 22 : 36);
      s.flash = []; s.pos = [];
      if (risk) for (var q = 0; q < (small ? 40 : 90); q++) s.pos.push({ x: rnd(0, s.w), hf: rnd(1.1, 2.4), vx: rnd(0.05, 0.3), f: rnd(0.4, 1.4), ph: rnd(0, 6), beta: rnd(0.6, 1.6), r: rnd(1.4, 2.8) });
      s.bokeh = [];
      for (var i = 0; i < (small ? 10 : 22); i++) s.bokeh.push({ x: rnd(0, s.w), y: rnd(s.h * TOP, s.h), r: rnd(2, 9), v: rnd(0.05, 0.25), a: rnd(0.04, 0.16), ph: rnd(0, 6) });
    });
  }

  /* ---------- HoloBit "footage": a code-drawn trading terminal for the upper part of the panel ---------- */
  function terminalFX(canvas) {
    var G = "0,255,150", R = "255,92,120";
    function px(k) { return 2400 + 42 * (Math.sin(k * 0.09) * 0.7 + Math.sin(k * 0.031 + 2) * 0.9 + Math.sin(k * 0.37) * 0.15); }
    return stage(canvas, function (s, dt) {
      var c = s.ctx, w = s.w, h = s.h, t = s.t;
      c.clearRect(0, 0, w, h);
      var W = w * parseFloat(canvas.dataset.span || "1"), H = h, pad = 18, mono = "11px JetBrains Mono, monospace";
      c.font = mono; c.lineWidth = 1;
      function box(x, y, bw, bh, title) {
        c.strokeStyle = "rgba(" + G + ",.22)"; c.strokeRect(x + .5, y + .5, bw, bh);
        c.fillStyle = "rgba(" + G + ",.55)"; c.fillText(title, x + 10, y + 16);
      }
      var narrow = W < 560;
      var top = H * 0.1, panelH = H * 0.78, colW = narrow ? (W - pad * 2) / 1.35 : (W - pad * 4) / 3;
      // 1 · price chart with area
      var x0 = pad, y0 = top;
      box(x0, y0, colW * 1.35, panelH * 0.62, "ETH/USDC · 1m · HoloBit sim");
      var cw2 = colW * 1.35 - 20, ch2 = panelH * 0.62 - 40, k0 = t * 1.6, pts = [];
      for (var i = 0; i <= 80; i++) { var v = px(k0 + i); pts.push([x0 + 10 + cw2 * i / 80, v]); }
      var lo = Math.min.apply(null, pts.map(function (p) { return p[1]; })), hi = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
      pts.forEach(function (p) { p[1] = y0 + 28 + ch2 * (1 - (p[1] - lo) / (hi - lo + 1e-6)); });
      var gr = c.createLinearGradient(0, y0 + 28, 0, y0 + 28 + ch2);
      gr.addColorStop(0, "rgba(" + G + ",.28)"); gr.addColorStop(1, "rgba(" + G + ",0)");
      c.beginPath(); pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
      c.lineTo(pts[pts.length - 1][0], y0 + 28 + ch2); c.lineTo(pts[0][0], y0 + 28 + ch2); c.closePath(); c.fillStyle = gr; c.fill();
      c.beginPath(); pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
      c.strokeStyle = "rgba(" + G + ",.9)"; c.lineWidth = 1.5; c.stroke(); c.lineWidth = 1;
      c.fillStyle = "rgba(230,255,240,.9)"; c.fillText(px(k0 + 80).toFixed(2), x0 + colW * 1.35 - 70, y0 + 16);
      if (narrow) return;      // phones: the price chart alone reads better than four cramped panels
      // 2 · depth chart
      var x1 = x0, y1 = y0 + panelH * 0.62 + pad, dw = colW * 1.35, dh = panelH * 0.38 - pad;
      box(x1, y1, dw, dh, "DEPTH · Uniswap V3 pool");
      var midX = x1 + dw / 2, baseY = y1 + dh - 8;
      [[-1, R], [1, G]].forEach(function (side) {
        c.beginPath(); c.moveTo(midX, baseY);
        var acc = 0;
        for (var j = 0; j <= 30; j++) {
          acc += 0.6 + 0.5 * Math.abs(Math.sin(j * 1.7 + t * 0.8 * side[0]));
          var xx = midX + side[0] * (dw / 2 - 10) * j / 30, yy = baseY - Math.min(dh - 30, acc * (dh - 30) / 28);
          c.lineTo(xx, yy);
        }
        c.lineTo(midX + side[0] * (dw / 2 - 10), baseY); c.closePath();
        c.fillStyle = "rgba(" + side[1] + ",.16)"; c.fill(); c.strokeStyle = "rgba(" + side[1] + ",.7)"; c.stroke();
      });
      // 3 · order book ladder
      var x2 = x0 + colW * 1.35 + pad, bw2 = colW * 0.95, bh2 = panelH;
      box(x2, y0, bw2, bh2, "ORDER BOOK");
      var rows = Math.floor((bh2 - 40) / 17), midP = px(k0 + 80);
      for (var r2 = 0; r2 < rows; r2++) {
        var ask = r2 < rows / 2, off = ask ? (rows / 2 - r2) : (r2 - rows / 2 + 1);
        var p2 = midP + (ask ? 1 : -1) * off * 0.35, size = 0.3 + Math.abs(Math.sin(r2 * 3.1 + Math.floor(t * 3) * 0.7)) * 0.7;
        var yy2 = y0 + 34 + r2 * 17, col = ask ? R : G;
        c.fillStyle = "rgba(" + col + ",.14)"; c.fillRect(x2 + bw2 - 10 - (bw2 - 20) * size, yy2 - 11, (bw2 - 20) * size, 14);
        c.fillStyle = "rgba(" + col + ",.85)"; c.fillText(p2.toFixed(2), x2 + 10, yy2);
        c.fillStyle = "rgba(220,255,235,.55)"; c.fillText((size * 12).toFixed(3), x2 + bw2 - 64, yy2);
      }
      // 4 · trade tape
      var x3 = x2 + bw2 + pad, bw3 = W - x3 - pad;
      if (bw3 > 120) {
        box(x3, y0, bw3, bh2, "TRADES · agents");
        var n3 = Math.floor((bh2 - 40) / 17), scroll = (t * 9) % 17, base3 = Math.floor(t * 9 / 17);
        c.save(); c.beginPath(); c.rect(x3, y0 + 22, bw3, bh2 - 24); c.clip();
        for (var r3 = -1; r3 < n3 + 1; r3++) {
          var id = base3 - r3, buy = Math.sin(id * 12.9898) > 0, yy3 = y0 + 34 + r3 * 17 + scroll;
          c.fillStyle = "rgba(" + (buy ? G : R) + ",.85)"; c.fillText((buy ? "BUY  " : "SELL ") + (px(id * 0.7) ).toFixed(2), x3 + 10, yy3);
          c.fillStyle = "rgba(220,255,235,.5)"; c.fillText("agent-" + String(Math.abs(Math.floor(Math.sin(id) * 900))).padStart(3, "0"), x3 + bw3 - 82, yy3);
        }
        c.restore();
      }
    });
  }

  /* ---------- Agentic City: a slowly orbiting wireframe district; agents travel its streets ---------- */
  function cityFX(canvas, opts) {
    opts = opts || {};
    var quiet = !!opts.quiet, cxr = small ? 0.5 : parseFloat(canvas.dataset.cx || "0.5"), cyr = parseFloat(canvas.dataset.cy || "0.6");
    return stage(canvas, function (s, dt) {
      easePointer(dt);
      var c = s.ctx, w = s.w, h = s.h, t = s.t, G = s.G;
      c.clearRect(0, 0, w, h);
      var th = t * 0.045 + P.x * 0.22, ph = 0.52 + P.y * 0.05;
      var ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
      var D = G * 2.2, K = Math.min(w * 0.036, h * 0.064) * (13 / G) * (parseFloat(canvas.dataset.scale || "1")), cx = w * cxr, cy = h * cyr;
      function pr(x, y, z) {
        var x1 = x * ct - z * st, z1 = x * st + z * ct;
        var y2 = y * cp + z1 * sp, z2 = z1 * cp - y * sp;   // camera above, looking down by ph
        var q = D / (D + z2);
        return [cx + x1 * K * q, cy - y2 * K * q, z2];
      }
      var H = G / 2;
      // ground grid (streets)
      c.lineWidth = 1;
      for (var i = 0; i <= G; i++) {
        var v = i - H, a1 = pr(v, 0, -H), a2 = pr(v, 0, H), b1 = pr(-H, 0, v), b2 = pr(H, 0, v);
        c.strokeStyle = "rgba(176,107,255,.13)";
        c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.moveTo(b1[0], b1[1]); c.lineTo(b2[0], b2[1]); c.stroke();
      }
      // pings: scenario runs radiating from a building
      s.pt += dt;
      if (s.pt > 1.6) { s.pt = 0; var bb = s.blds[Math.floor(Math.random() * s.blds.length)]; s.pings.push({ x: bb.x, z: bb.z, age: 0 }); }
      s.pings = s.pings.filter(function (p) { return (p.age += dt) < 3.2; });
      s.pings.forEach(function (p) {
        var rr = 0.3 + p.age * 1.1, al = 0.5 * (1 - p.age / 3.2);
        c.strokeStyle = "rgba(255,95,210," + al + ")"; c.lineWidth = 1.2;
        c.beginPath();
        for (var k = 0; k <= 36; k++) { var an = k / 36 * Math.PI * 2, q = pr(p.x + Math.cos(an) * rr, 0, p.z + Math.sin(an) * rr); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
        c.stroke();
      });
      // buildings, far to near
      s.blds.forEach(function (b) { b.d = pr(b.x, b.h / 2, b.z)[2]; });
      s.blds.sort(function (p, q) { return q.d - p.d; });
      s.blds.forEach(function (b) {
        var f = b.f / 2, hh = b.h * (0.97 + 0.03 * Math.sin(t * 0.7 + b.ph));
        var P0 = [pr(b.x - f, 0, b.z - f), pr(b.x + f, 0, b.z - f), pr(b.x + f, 0, b.z + f), pr(b.x - f, 0, b.z + f)];
        var P1 = [pr(b.x - f, hh, b.z - f), pr(b.x + f, hh, b.z - f), pr(b.x + f, hh, b.z + f), pr(b.x - f, hh, b.z + f)];
        var fog = Math.max(0.25, Math.min(1, 1 - (b.d / (G * 0.9))));
        for (var k = 0; k < 4; k++) {
          var A = P0[k], B = P0[(k + 1) % 4], C = P1[(k + 1) % 4], Dd = P1[k];
          var cross = (B[0] - A[0]) * (Dd[1] - A[1]) - (B[1] - A[1]) * (Dd[0] - A[0]);
          if (cross > 0) continue;                       // back face
          c.fillStyle = "rgba(16,6,32," + (0.92 * fog) + ")";
          c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.lineTo(Dd[0], Dd[1]); c.closePath(); c.fill();
          c.strokeStyle = "rgba(176,107,255," + (0.42 * fog) + ")"; c.lineWidth = 0.8; c.stroke();
          // floor lines
          if (!quiet) {
            c.strokeStyle = "rgba(176,107,255," + (0.12 * fog) + ")";
            c.beginPath();
            for (var fl = 0.35; fl < hh; fl += 0.35) { var u = fl / hh;
              c.moveTo(A[0] + (Dd[0] - A[0]) * u, A[1] + (Dd[1] - A[1]) * u); c.lineTo(B[0] + (C[0] - B[0]) * u, B[1] + (C[1] - B[1]) * u); }
            c.stroke();
          }
        }
        c.fillStyle = "rgba(176,107,255," + (0.16 * fog) + ")";
        c.beginPath(); P1.forEach(function (q, k) { k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill();
        c.strokeStyle = b.lit ? "rgba(255,140,230," + (0.9 * fog) + ")" : "rgba(200,150,255," + (0.6 * fog) + ")"; c.lineWidth = b.lit ? 1.3 : 0.9; c.stroke();
      });
      // agents on the streets, with short light trails
      c.globalCompositeOperation = "lighter";
      s.agents.forEach(function (a) {
        a.p += a.v * dt; if (a.p > H) a.p = -H; if (a.p < -H) a.p = H;
        var q = a.ax ? pr(a.p, 0.02, a.line) : pr(a.line, 0.02, a.p);
        a.trail.unshift(q); if (a.trail.length > 10) a.trail.pop();
        for (var k = 1; k < a.trail.length; k++) {
          var A2 = a.trail[k - 1], B2 = a.trail[k];
          if (Math.abs(A2[0] - B2[0]) > 60) continue;    // wrapped
          c.strokeStyle = "rgba(255,95,210," + (0.5 * (1 - k / a.trail.length)) + ")"; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(A2[0], A2[1]); c.lineTo(B2[0], B2[1]); c.stroke();
        }
        var g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 6);
        g.addColorStop(0, "rgba(255,200,245,.95)"); g.addColorStop(1, "rgba(255,95,210,0)");
        c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], 6, 0, 7); c.fill();
      });
      c.globalCompositeOperation = "source-over";
    }, function (s) {
      var G = s.G = small ? 9 : (quiet ? 11 : 13), H = G / 2;
      s.blds = []; s.pings = []; s.pt = 0;
      for (var i = 0; i < G; i++) for (var j = 0; j < G; j++) {
        if (Math.random() < 0.2) continue;
        var x = i - H + 0.5, z = j - H + 0.5, dc = Math.sqrt(x * x + z * z) / H;
        var hgt = (0.4 + Math.pow(Math.max(0, 1 - dc), 1.6) * rnd(2.2, 5)) * (Math.random() < 0.08 ? 1.4 : 1);
        s.blds.push({ x: x, z: z, f: rnd(0.5, 0.72), h: hgt, ph: rnd(0, 6), lit: Math.random() < 0.12 });
      }
      s.agents = [];
      for (var k = 0; k < (small ? 24 : (quiet ? 30 : 60)); k++) {
        s.agents.push({ ax: Math.random() < 0.5, line: Math.floor(rnd(0, G + 1)) - H, p: rnd(-H, H), v: rnd(0.35, 0.9) * (Math.random() < 0.5 ? -1 : 1), trail: [] });
      }
    });
  }

  /* ---------- agent glyphs: person, household, candlesticks, rising chart, factory, bank, home, coin ----------
     Drawn in white into a 128 x 128 box; the hero globe and the WebGL stack both use them. */
  function drawIcon(g, kind) {
    g.fillStyle = g.strokeStyle = "#fff"; g.lineCap = g.lineJoin = "round";
    var person = function (x, y, k) {
      g.beginPath(); g.arc(x, y - 30 * k, 14 * k, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x - 24 * k, y + 34 * k); g.quadraticCurveTo(x - 24 * k, y - 10 * k, x, y - 10 * k); g.quadraticCurveTo(x + 24 * k, y - 10 * k, x + 24 * k, y + 34 * k); g.closePath(); g.fill();
    };
    var out = function (f) { g.globalCompositeOperation = "destination-out"; f(); g.globalCompositeOperation = "source-over"; };
    if (kind === 0) person(64, 66, 1.25);
    else if (kind === 1) { person(44, 70, 1); person(86, 74, 0.82); person(66, 90, 0.55); }
    else if (kind === 2) { g.lineWidth = 5; [[30, 40, 84, 52, 72], [56, 30, 70, 38, 62], [82, 48, 96, 56, 88], [104, 20, 60, 28, 50]].forEach(function (b) {
      g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0], b[2] + 14); g.stroke(); g.fillRect(b[0] - 9, Math.min(b[3], b[4]), 18, Math.abs(b[4] - b[3]) + 10); }); }
    else if (kind === 3) { g.lineWidth = 9; g.beginPath(); g.moveTo(18, 100); g.lineTo(46, 70); g.lineTo(68, 84); g.lineTo(108, 34); g.stroke();
      g.beginPath(); g.moveTo(84, 30); g.lineTo(112, 28); g.lineTo(110, 56); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(14, 112); g.lineTo(116, 112); g.stroke(); }
    else if (kind === 4) { g.beginPath(); [[14, 112], [14, 60], [44, 78], [44, 60], [74, 78], [74, 30], [94, 30], [94, 18], [108, 18], [108, 112]].forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fill(); }
    else if (kind === 5) { g.beginPath(); g.moveTo(64, 14); g.lineTo(116, 44); g.lineTo(12, 44); g.closePath(); g.fill(); g.fillRect(14, 104, 100, 10);
      [24, 48, 72, 96].forEach(function (x) { g.fillRect(x, 52, 10, 46); }); }
    else if (kind === 6) { g.beginPath(); [[64, 16], [114, 60], [100, 60], [100, 112], [28, 112], [28, 60], [14, 60]].forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fill();
      out(function () { g.fillRect(54, 80, 20, 32); }); }
    else { g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill();
      out(function () { g.font = "700 62px 'Inter', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 64, 68); g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.stroke(); }); }
  }
  var spriteCache = {};
  function iconSprite(kind, rgb) {   // a tinted, glowing 64px sprite, built once per glyph and colour
    var key = kind + "|" + rgb;
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"); g.scale(0.5, 0.5); g.shadowColor = "rgba(" + rgb + ",.9)"; g.shadowBlur = 14; drawIcon(g, kind);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "rgb(" + rgb + ")"; g.fillRect(0, 0, 64, 64);
    return (spriteCache[key] = c);
  }

  /* ---------- EWM Challenge: a dotted globe (the world model) with agents arcing between places ---------- */
  function worldFX(canvas, opts) {
    opts = opts || {};
    var cxr = parseFloat(canvas.dataset.cx || "0.68"), cyr = parseFloat(canvas.dataset.cy || "0.52");
    var ICE = "143,214,255", WHITE = "228,243,255", GREEN = "0,255,136", VIOLET = "176,107,255";
    var ICON_KINDS = [[0, WHITE], [0, WHITE], [1, ICE], [2, GREEN], [3, GREEN], [4, "63,242,200"], [5, VIOLET], [6, ICE], [7, "255,200,87"]];
    function sph(lat, lon) { var cl = Math.cos(lat); return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)]; }
    return stage(canvas, function (s, dt) {
      easePointer(dt);
      var c = s.ctx, w = s.w, h = s.h, t = s.t;
      c.clearRect(0, 0, w, h);
      var R = Math.min(w, h) * (small ? 0.42 : 0.36), cx = w * (small ? 0.5 : cxr), cy = h * (small ? 0.42 : cyr);
      var ry = t * 0.08 + P.x * 0.35, rx = -0.32 + P.y * 0.12;
      var cy1 = Math.cos(ry), sy1 = Math.sin(ry), cx1 = Math.cos(rx), sx1 = Math.sin(rx);
      function pr(v) {   // rotate (y then x), orthographic projection; z > 0 faces the viewer
        var x = v[0] * cy1 + v[2] * sy1, z = -v[0] * sy1 + v[2] * cy1, y = v[1];
        var y2 = y * cx1 - z * sx1, z2 = y * sx1 + z * cx1;
        return [cx + x * R, cy - y2 * R, z2];
      }
      // halo and orbit rings
      var g = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.5);
      g.addColorStop(0, "rgba(" + ICE + ",.16)"); g.addColorStop(1, "rgba(" + ICE + ",0)");
      var core = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);   // a faint lit face so it reads as a sphere
      core.addColorStop(0, "rgba(" + ICE + ",.10)"); core.addColorStop(1, "rgba(" + ICE + ",.015)");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = core; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(" + ICE + ",.22)"; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      [1.18, 1.32].forEach(function (k, i) {
        c.strokeStyle = "rgba(" + ICE + "," + (0.16 - i * 0.06) + ")";
        c.beginPath(); c.ellipse(cx, cy, R * k, R * k * 0.28, -0.25 + i * 0.12, 0, Math.PI * 2); c.stroke();
      });
      // dotted sphere: back half faint, front half bright
      s.dots.forEach(function (d) {
        var q = pr(d);
        var a = q[2] > 0 ? 0.35 + 0.65 * q[2] : 0.08 + 0.08 * (1 + q[2]);
        c.fillStyle = "rgba(" + ICE + "," + a.toFixed(3) + ")";
        var sz = q[2] > 0 ? 1.4 + q[2] * 1.4 : 1.1;
        c.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
      });
      // agents travelling along lifted arcs between places; most ice-white, some green / violet
      c.globalCompositeOperation = "lighter";
      s.arcs.forEach(function (a) {
        a.k += dt * a.v;
        if (a.k > 1.35) { a.from = a.to; a.to = s.dots[Math.floor(Math.random() * s.dots.length)]; a.k = 0; }
        var trail = 14, col = a.col;
        for (var i = 0; i < trail; i++) {
          var u = Math.min(1, Math.max(0, a.k - i * 0.018));
          if (u <= 0) break;
          var A = a.from, B = a.to;
          var m = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u];
          var len = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]) || 1, lift = 1 + Math.sin(Math.PI * u) * 0.22;
          var q = pr([m[0] / len * lift, m[1] / len * lift, m[2] / len * lift]);
          if (q[2] < -0.15) continue;
          var al = (1 - i / trail) * (q[2] > 0 ? 0.9 : 0.35);
          c.fillStyle = "rgba(" + col + "," + al.toFixed(3) + ")";
          c.beginPath(); c.arc(q[0], q[1], i === 0 ? 2.4 : 1.4, 0, 7); c.fill();
        }
        if (a.k >= 1 && a.k < 1.06) {   // arrival: a small ring where two agents interact
          var e = pr(a.to);
          if (e[2] > 0) { c.strokeStyle = "rgba(" + col + ",.7)"; c.beginPath(); c.arc(e[0], e[1], 4 + (a.k - 1) * 120, 0, 7); c.stroke(); }
        }
      });
      c.globalCompositeOperation = "source-over";
      // a few agents on the surface (people, markets, firms, banks...) that breathe in and out
      s.icons.forEach(function (ic) {
        ic.k += dt / ic.dur;
        if (ic.k >= 1) { ic.k = 0; ic.at = s.dots[Math.floor(Math.random() * s.dots.length)]; ic.kind = ICON_KINDS[Math.floor(Math.random() * ICON_KINDS.length)]; ic.dur = rnd(7, 11); }
        var q = pr(ic.at);
        if (q[2] < 0.15) return;
        var br = Math.sin(Math.PI * ic.k), a = Math.pow(br, 1.6) * Math.min(1, (q[2] - 0.15) * 3);
        if (a < 0.01) return;
        var sz = (small ? 22 : 30) * (0.85 + 0.15 * br) * (0.8 + 0.2 * q[2]);
        c.globalAlpha = a; c.globalCompositeOperation = "lighter";
        c.drawImage(iconSprite(ic.kind[0], ic.kind[1]), q[0] - sz / 2, q[1] - sz, sz, sz);
        c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
      });
    }, function (s) {
      var n = small ? 520 : 1100, golden = Math.PI * (3 - Math.sqrt(5));
      s.dots = [];
      for (var i = 0; i < n; i++) { var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i; s.dots.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
      s.arcs = [];
      for (var j = 0; j < (small ? 14 : 30); j++) {
        var roll = Math.random(), col = roll < 0.15 ? GREEN : roll < 0.3 ? VIOLET : roll < 0.6 ? WHITE : ICE;
        s.arcs.push({ from: s.dots[Math.floor(Math.random() * n)], to: s.dots[Math.floor(Math.random() * n)], k: Math.random(), v: rnd(0.12, 0.3), col: col });
      }
      s.icons = [];
      for (var m = 0; m < (small ? 6 : 12); m++) {
        s.icons.push({ at: s.dots[Math.floor(Math.random() * n)], kind: ICON_KINDS[Math.floor(Math.random() * ICON_KINDS.length)], k: Math.random(), dur: rnd(7, 11) });
      }
    });
  }

  window.SW_FX = { holo: holoFX, city: cityFX, terminal: terminalFX, world: worldFX };
  window.SW_drawIcon = drawIcon;

  /* ---------- interactions ---------- */
  function countUp(el) {
    var target = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length, suf = el.dataset.suffix || "";
    if (reduce) { el.textContent = target.toLocaleString(undefined, { minimumFractionDigits: dec }) + suf; return; }
    var t0 = performance.now(), dur = 1600;
    setTimeout(function () { el.textContent = target.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; }, dur + 300);
    (function f(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* Entrance: characters and hero blocks rise out of a soft blur. Runs only while the page is
     actually rendering frames; the resting state is always fully visible, and a timer finishes
     every animation in case the browser stops advancing them (background tab, capture). */
  function intro() {
    if (reduce || !Element.prototype.animate) return;
    var ease = "cubic-bezier(.22,1,.36,1)", anims = [], longest = 0;
    function go() {
      document.querySelectorAll("[data-chars]").forEach(function (el) {
        var base = +el.dataset.base || 250;
        el.querySelectorAll(".char").forEach(function (ch, i) {
          var d = base + i * 38; longest = Math.max(longest, d + 1300);
          anims.push(ch.animate([{ opacity: 0, transform: "translateY(.45em)", filter: "blur(12px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 1300, delay: d, easing: ease, fill: "backwards" }));
        });
      });
      document.querySelectorAll(".side-content, .hero .wrap").forEach(function (box) {
        var start = box.closest(".side-city") ? 550 : 350;
        Array.prototype.forEach.call(box.children, function (el, i) {
          if (el.hasAttribute("data-chars")) return;
          var d = start + i * 120; longest = Math.max(longest, d + 1400);
          anims.push(el.animate([{ opacity: 0, transform: "translateY(18px)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 1400, delay: d, easing: ease, fill: "backwards" }));
        });
      });
      setTimeout(function () { anims.forEach(function (a) { try { a.finish(); } catch (e) {} }); }, longest + 400);
    }
    if (document.hidden) return;                                    // never start hidden: stay visible as-is
    requestAnimationFrame(function () { requestAnimationFrame(go); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // canvases
    document.querySelectorAll("canvas[data-fx]").forEach(function (cv) {
      var kind = cv.dataset.fx, quiet = cv.hasAttribute("data-quiet");
      if (window.SW_FX[kind]) window.SW_FX[kind](cv, { quiet: quiet, variant: cv.dataset.variant });
    });
    // reveal on scroll + one-shot effects
    // numbers show their final value at rest; they count up only when seen on a live page
    document.querySelectorAll("[data-count]").forEach(function (el) {
      var v = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length;
      el.textContent = v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || "");
    });
    if (!reduce && !document.hidden) document.querySelectorAll(".reveal").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top > innerHeight * 0.95) el.classList.add("pre");     // only what's below the fold waits for scroll
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add("in");
        if (el.dataset.count && !document.hidden) countUp(el);
        io.unobserve(el);
      });
    }, { threshold: 0.18 });
    document.querySelectorAll(".reveal, [data-count], .radar, .ring").forEach(function (el) { io.observe(el); });
    // split display words into characters that rise in
    document.querySelectorAll("[data-chars]").forEach(function (el) {
      var base = el.dataset.chars || ".25s", txt = el.textContent;
      el.setAttribute("aria-label", txt);
      // letters are grouped per word so a wrapped heading breaks between words, never inside one
      el.innerHTML = txt.split(/(\s+)/).map(function (word) {
        if (/^\s+$/.test(word)) return " ";
        return '<span class="char-word" aria-hidden="true">' + word.split("").map(function (ch) { return '<span class="char">' + ch + "</span>"; }).join("") + "</span>";
      }).join("");
      el.dataset.base = parseFloat(base) * 1000;
    });
    intro();
    // card spotlight + a gentle 3D tilt towards the pointer
    var tilted = null;
    var untilt = function (c) { if (c) c.style.removeProperty("--tilt"); };
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".card");
      if (card !== tilted) { untilt(tilted); tilted = card; }
      if (!card) return;
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--mx", (e.clientX - r.left) + "px"); card.style.setProperty("--my", (e.clientY - r.top) + "px");
      if (!reduce && e.pointerType === "mouse" && !card.closest("[data-scene]")) {
        var mag = Math.min(1, Math.sqrt(x * x + y * y) * 2);
        card.style.setProperty("--tilt", (-y).toFixed(3) + " " + x.toFixed(3) + " 0 " + (mag * 3.2).toFixed(2) + "deg");
      }
    });
    document.addEventListener("pointerleave", function () { untilt(tilted); tilted = null; });
    // cursor glow
    var glow = document.querySelector(".cursor-glow");
    if (glow) {
      var gx = innerWidth / 2, gy = innerHeight / 2;
      (function follow() {
        gx += (P.cx - gx) * 0.12; gy += (P.cy - gy) * 0.12;
        if (P.cx > -9000) glow.style.transform = "translate(" + gx.toFixed(1) + "px," + gy.toFixed(1) + "px)";
        requestAnimationFrame(follow);
      })();
    }
    // magnetic buttons
    if (!reduce) document.querySelectorAll("[data-magnet]").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.25 + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
    // top bar: solid once the page moves; tucks away while scrolling down, returns on the way up
    var bar = document.querySelector(".topbar[data-solid]"), lastY = scrollY;
    if (bar) {
      var onBar = function () {
        var y = scrollY;
        bar.classList.toggle("solid", y > 40);
        if (y > 240 && y > lastY + 8) bar.classList.add("tucked");
        else if (y < lastY - 8 || y < 120) bar.classList.remove("tucked");
        if (Math.abs(y - lastY) > 8) lastY = y;
      };
      onBar(); addEventListener("scroll", onBar, { passive: true });
      bar.addEventListener("focusin", function () { bar.classList.remove("tucked"); });
    }

    // smooth wheel scrolling on mouse/trackpad devices: the page eases towards where the wheel points.
    // Native scrolling is untouched for touch, keyboard, scrollbar dragging and reduced motion.
    var smooth = { to: null };
    if (!reduce && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      document.documentElement.style.scrollBehavior = "auto";
      var target = scrollY, current = scrollY, running = false, lastT = 0;
      var maxY = function () { return document.documentElement.scrollHeight - innerHeight; };
      var stepped = 0;
      var step = function (now) {
        stepped++;
        var dt = Math.min(0.05, ((now || performance.now()) - (lastT || now)) / 1000) || 0.016; lastT = now;
        current += (target - current) * (1 - Math.pow(0.0009, dt));   // frame-rate independent easing
        if (Math.abs(target - current) < 0.4) { current = target; running = false; }
        window.scrollTo(0, current);
        if (running) requestAnimationFrame(step); else lastT = 0;
      };
      var go = function (y) {
        target = Math.max(0, Math.min(maxY(), y));
        if (!running) {
          running = true; current = scrollY; requestAnimationFrame(step);
          var seen = stepped;   // if the browser isn't producing frames (power saving, background), just jump
          setTimeout(function () { if (running && stepped === seen) { running = false; current = target; window.scrollTo(0, target); } }, 120);
        }
      };
      var scrollsItself = function (el, dy) {   // leave inner scroll areas (tables, code) alone when they can scroll
        for (; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
          var cs = getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight &&
              ((dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight) || (dy < 0 && el.scrollTop > 0))) return true;
        }
        return false;
      };
      addEventListener("wheel", function (e) {
        if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (scrollsItself(e.target, e.deltaY)) return;
        e.preventDefault();
        var d = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1);
        go((running ? target : scrollY) + d);
      }, { passive: false });
      addEventListener("scroll", function () { if (!running) target = current = scrollY; }, { passive: true });
      smooth.to = go;
    }
    // in-page links glide to their section, clearing the top bar
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute("href").length < 2) return;
      var el = document.querySelector(a.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      var y = el.getBoundingClientRect().top + scrollY - 72;
      if (smooth.to) smooth.to(y); else window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
    // nav progress: a bar under the in-page links grows left to right with the reading position.
    // It reaches the end of a link as that link's section arrives, and the current link lights up.
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    var navSecs = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    if (navLinks.length && navSecs.every(Boolean)) {
      var navBox = navLinks[0].parentNode, navTrack = document.createElement("span"), navBar = document.createElement("span");
      navTrack.className = "nav-track"; navBar.className = "nav-bar";
      navBox.appendChild(navTrack); navBox.appendChild(navBar);
      var navTick = false;
      var navFrame = function () {
        navTick = false;
        var line = scrollY + innerHeight * 0.35, boxL = navBox.getBoundingClientRect().left;
        var ends = navLinks.map(function (a) { return a.getBoundingClientRect().right - boxL; });
        var tops = navSecs.map(function (el) { return el.getBoundingClientRect().top + scrollY; });
        var pts = [[innerHeight * 0.35, 0]];                       // page top -> empty bar
        tops.forEach(function (t, i) { pts.push([t, ends[i]]); });  // section i arrives -> end of link i
        pts.push([document.documentElement.scrollHeight - innerHeight * 0.65, navBox.clientWidth]);   // page end -> full
        var x = 0;
        for (var i = 0; i < pts.length - 1; i++) {
          var a = pts[i], b = pts[i + 1];
          if (line <= a[0]) { x = a[1]; break; }
          if (line <= b[0]) { x = a[1] + (b[1] - a[1]) * (line - a[0]) / Math.max(1, b[0] - a[0]); break; }
          x = b[1];
        }
        navBar.style.width = Math.max(0, x).toFixed(1) + "px";
        var cur = -1;
        tops.forEach(function (t, i) { if (line >= t) cur = i; });
        navLinks.forEach(function (a, i) { a.classList.toggle("active", i === cur); });
      };
      addEventListener("scroll", function () { if (!navTick) { navTick = true; requestAnimationFrame(navFrame); } }, { passive: true });
      addEventListener("resize", navFrame);
      document.addEventListener("sw:lang", function () { setTimeout(navFrame, 50); });   // link widths change with language
      addEventListener("load", navFrame);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(navFrame);
      navFrame();
    }

    // Scroll-driven scenes (Apple-style): a [data-scene] block is several screens tall and its
    // .scene-stick child stays pinned while the reader scrolls through it. The script writes the
    // progress (0 to 1) to --p, switches on [data-at] children once progress passes their value,
    // and calls el.onSceneProgress(p) for scenes that need custom drawing.
    var scenes = Array.prototype.slice.call(document.querySelectorAll("[data-scene]"));
    if (scenes.length) {
      if (reduce) document.documentElement.classList.add("calm");
      var sceneTick = false;
      var sceneFrame = function () {
        sceneTick = false;
        scenes.forEach(function (sc) {
          var r = sc.getBoundingClientRect(), run = r.height - innerHeight, p;
          if (reduce) p = 1;
          else if (sc.hasAttribute("data-pass")) p = Math.min(1, Math.max(0, (innerHeight * 0.92 - r.top) / (innerHeight * 0.6)));   // short blocks: progress as they slide up through the view
          else p = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 1;
          sc.style.setProperty("--p", p.toFixed(4));
          var now = null;
          sc.querySelectorAll("[data-at]").forEach(function (el) { var on = p >= parseFloat(el.dataset.at); el.classList.toggle("on", on); if (on) now = el; });
          sc.querySelectorAll("[data-at].now").forEach(function (el) { if (el !== now) el.classList.remove("now"); });
          if (now) now.classList.add("now");
          if (sc.onSceneProgress) sc.onSceneProgress(p);
        });
      };
      window.SW_sceneFrame = sceneFrame;
      addEventListener("scroll", function () { if (!sceneTick) { sceneTick = true; requestAnimationFrame(sceneFrame); } }, { passive: true });
      addEventListener("resize", sceneFrame);
      addEventListener("load", sceneFrame);
      sceneFrame();
    }

    // Rails (track cards, paper covers, abstracts): real horizontal scrollers the reader can swipe,
    // drag or trackpad through, that also drift on their own. The cards are repeated so the strip
    // wraps seamlessly at both ends from the very first frame. Drift runs about twice as fast while
    // the rail is entering the viewport and settles to cruising speed at the centre of the screen;
    // hovering brings it to a quick stop, and it eases back after the pointer leaves or a manual scroll.
    var smoothstep = function (v) { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
    document.querySelectorAll("[data-rail]").forEach(function (rail) {
      var track = rail.querySelector(".rail-track");
      if (!track) return;
      var items = Array.prototype.slice.call(track.children), sets = 1;
      var addSet = function () {
        items.forEach(function (it) {
          var c = it.cloneNode(true);
          c.setAttribute("aria-hidden", "true"); c.tabIndex = -1;
          c.querySelectorAll("a, button").forEach(function (a) { a.tabIndex = -1; });
          track.appendChild(c);
        });
        sets++;
      };
      var loop = 1, home = 0;   // loop = width of one set; home = scroll offset where the reader starts
      var measure = function () {
        if (sets < 2) addSet();
        loop = track.children[items.length].offsetLeft - track.children[0].offsetLeft || 1;
        var pad = Math.ceil(rail.clientWidth / loop) + 1, before = sets;   // sets needed on each side
        while (sets < pad * 2 + 1 && sets < 14) addSet();
        home = loop * pad;
        if (sets > before && window.SW_refresh) window.SW_refresh();
      };
      var pos = 0;
      var wrap = function () {   // keep the view inside the middle band; the sets are identical, so the jump is invisible
        if (pos < home - loop * 0.5) pos += loop; else if (pos > home + loop * 0.5) pos -= loop;
        rail.scrollLeft = pos;
      };
      measure(); pos = home; wrap();
      addEventListener("resize", function () { var off = pos - home; measure(); pos = home + off; wrap(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { var off = pos - home; measure(); pos = home + off; wrap(); });

      var auto = !reduce, base = +rail.dataset.speed || 20, dir = +rail.dataset.dir || 1;
      var v = 0, hover = false, manualUntil = 0, last = 0;
      var nudge = function () { manualUntil = performance.now() + 1200; };
      rail.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hover = true; });
      rail.addEventListener("pointerleave", function () { hover = false; });
      rail.addEventListener("focusin", function () { hover = true; });
      rail.addEventListener("focusout", function () { hover = false; });
      rail.addEventListener("wheel", function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) nudge(); }, { passive: true });
      rail.addEventListener("touchstart", nudge, { passive: true });
      rail.addEventListener("scroll", function () {   // the reader scrolled (trackpad, touch, keyboard)
        if (Math.abs(rail.scrollLeft - Math.round(pos)) > 1) { pos = rail.scrollLeft; nudge(); wrap(); }
      }, { passive: true });
      // mouse drag with a little momentum
      var drag = null;
      rail.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, start: pos, moved: 0, vx: 0, t: performance.now() };
      });
      addEventListener("pointermove", function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, now = performance.now();
        if (Math.abs(dx) > 4 && !drag.moved) { drag.moved = 1; rail.classList.add("dragging"); }
        if (!drag.moved) return;
        var np = drag.start - dx; drag.vx = (np - pos) / Math.max(8, now - drag.t) * 1000; drag.t = now;
        pos = np; nudge(); wrap(); drag.start = pos; drag.x = e.clientX;
      });
      addEventListener("pointerup", function () {
        if (!drag) return;
        if (drag.moved) { v = drag.vx * dir; nudge(); setTimeout(function () { rail.classList.remove("dragging"); }, 0); }
        drag = null;
      });
      rail.addEventListener("click", function (e) { if (rail.classList.contains("dragging")) { e.preventDefault(); e.stopPropagation(); } }, true);
      rail.addEventListener("dragstart", function (e) { e.preventDefault(); });

      (function tick(now) {
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
        var r = rail.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight && !document.hidden && !drag) {
          var d = smoothstep(Math.abs((r.top + r.height / 2) - innerHeight / 2) / (innerHeight / 2));
          var target = !auto || hover || now < manualUntil ? 0 : base * (1 + d);
          var slowing = Math.abs(target) < Math.abs(v);
          v += (target - v) * (1 - Math.pow(slowing ? (hover ? 0.0004 : 0.05) : 0.25, dt));
          if (Math.abs(v) > 0.01) { pos += v * dt * dir; wrap(); }
        }
        requestAnimationFrame(tick);
      })(0);
    });
    if (window.SW_refresh) window.SW_refresh();

    // scroll cue: fades out once the reader starts scrolling
    var cue = document.querySelector(".scroll-cue");
    if (cue) { var hideCue = function () { cue.classList.toggle("gone", scrollY > 60); }; addEventListener("scroll", hideCue, { passive: true }); hideCue(); }

    // light parallax: hero text drifts up slower than the page and fades, the hero clip and the
    // background move at their own speeds, section headings float a little around the centre line.
    // Uses the `translate` property so it never fights the transforms elements already have.
    if (!reduce) {
      var hero = document.querySelector(".hero"), heroWrap = hero && hero.querySelector(".wrap"), heroMedia = hero && hero.querySelector("video");
      var bgCanvas = document.querySelector(".page-bg canvas");
      // every numbered section gets depth: a large ghost numeral that lags behind the page, the heading
      // group and the content below it drifting at different rates, and a faint glow that wanders
      var secs = Array.prototype.slice.call(document.querySelectorAll("section")).filter(function (sec) {
        return !sec.matches("[data-scene]") && sec.querySelector(":scope .sec-num") && !sec.querySelector("[data-scene]");
      }).map(function (sec) {
        var num = sec.querySelector(".sec-num"), head = sec.querySelector(".sec-head"), ghost = document.createElement("span");
        ghost.className = "sec-ghost"; ghost.setAttribute("aria-hidden", "true");
        ghost.textContent = (num.textContent.match(/\d+/) || [""])[0];
        sec.classList.add("has-depth"); sec.insertBefore(ghost, sec.firstChild);
        var body = Array.prototype.slice.call(sec.querySelectorAll(":scope > .wrap > *:not(.sec-head), :scope > .rail, :scope > .wrap + .wrap"));
        return { sec: sec, ghost: ghost, head: head, body: body };
      });
      var ticking = false;
      var frame = function () {
        ticking = false;
        var y = scrollY, vh = innerHeight;
        if (heroWrap && y < vh * 1.3) {
          heroWrap.style.translate = "0 " + (y * 0.32).toFixed(1) + "px";
          heroWrap.style.opacity = Math.max(0, 1 - y / (vh * 0.8)).toFixed(3);
        }
        if (heroMedia && y < vh * 1.3) heroMedia.style.translate = "0 " + (y * 0.16).toFixed(1) + "px";
        if (bgCanvas) bgCanvas.style.translate = "0 " + (-Math.min(y * 0.04, 160)).toFixed(1) + "px";
        secs.forEach(function (o) {
          var r = o.sec.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          var k = Math.max(-1.5, Math.min(1.5, ((r.top + Math.min(r.height, vh) / 2) - vh / 2) / vh));   // 0 when the section's top half is centred
          o.ghost.style.translate = "0 " + (k * -140).toFixed(1) + "px";
          if (o.head) o.head.style.translate = "0 " + (k * 40).toFixed(1) + "px";
          o.body.forEach(function (el) { el.style.translate = "0 " + (k * -14).toFixed(1) + "px"; });
          o.sec.style.setProperty("--glow-y", (k * -18).toFixed(2) + "%");
        });
      };
      addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
      addEventListener("resize", frame);
      frame();
    }

    // background videos: pick the small file on phones, never block
    document.querySelectorAll("video[data-src]").forEach(function (v) {
      v.src = small && v.dataset.srcSmall ? v.dataset.srcSmall : v.dataset.src;
      v.muted = true;
      // Background loops must never stall: resume whenever the browser pauses or stalls them.
      var resume = function () { if (!document.hidden && v.paused) v.play().catch(function () {}); };
      ["pause", "stalled", "suspend", "ended"].forEach(function (ev) { v.addEventListener(ev, function () { setTimeout(resume, 50); }); });
      document.addEventListener("visibilitychange", resume);
      setInterval(resume, 1000);
      resume();
    });
  });
})();
