/* SimuWorld — canvas backgrounds and page interactions. No dependencies. */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = window.innerWidth < 760;

  /* ---------- canvas helper: DPR, resize, pause when hidden/offscreen ---------- */
  function stage(canvas, draw, init) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var s = { w: 0, h: 0, t: 0, ctx: ctx, visible: true };
    function resize() {
      var r = canvas.getBoundingClientRect();
      s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
      canvas.width = s.w * dpr; canvas.height = s.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init && init(s);
    }
    resize();
    var ro = new ResizeObserver(resize); ro.observe(canvas);
    new IntersectionObserver(function (e) { s.visible = e[0].isIntersecting; }).observe(canvas);
    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (s.visible && !document.hidden) { s.t += dt; draw(s, dt); }
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
    var quiet = !!opts.quiet;
    var TOP = quiet ? 0.24 : 0.54, SPAN = quiet ? 0.7 : 0.46;   // where the surface lives, as a share of height
    function price(k) { return Math.sin(k * 0.11) * 0.55 + Math.sin(k * 0.037 + 1.3) * 0.9 + Math.sin(k * 0.29) * 0.18 + Math.sin(k * 0.71) * 0.07; }
    function curve(x, t, i) { return Math.sin(x * 0.0042 + t * 0.32 + i * 0.32) * 0.62 + Math.sin(x * 0.011 - t * 0.21 + i * 0.17) * 0.3 + Math.sin(x * 0.023 + t * 0.6 + i) * 0.08; }
    return stage(canvas, function (s, dt) {
      easePointer(dt);
      var c = s.ctx, w = s.w, h = s.h, t = s.t, r = canvas.getBoundingClientRect();
      c.clearRect(0, 0, w, h);
      // faint dot lattice, only where the surface is
      c.fillStyle = "rgba(120,255,200,.06)";
      for (var gx = 24; gx < w; gx += 36) for (var gy = Math.round(h * TOP / 36) * 36 + 24; gy < h; gy += 36) c.fillRect(gx, gy, 1, 1);

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
      c.shadowColor = "rgba(0,255,150,.9)"; c.shadowBlur = quiet ? 0 : 10; c.stroke(); c.shadowBlur = 0;
      if (!quiet && ma.length) {
        var last = ma[ma.length - 4] || ma[ma.length - 1];
        c.fillStyle = "#eafff4"; c.beginPath(); c.arc(last[0], last[1], 3, 0, 7); c.fill();
        c.strokeStyle = "rgba(120,255,200,.25)"; c.setLineDash([3, 5]);
        c.beginPath(); c.moveTo(0, last[1]); c.lineTo(w, last[1]); c.stroke(); c.setLineDash([]);
        c.font = "11px JetBrains Mono, monospace"; c.fillStyle = "rgba(160,255,215,.85)";
        c.fillText("ETH/USDC  " + (2400 + 60 * price(k0 + n - 4)).toFixed(2), Math.min(last[0] + 10, w - 140), last[1] - 9);
      }

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
      s.L = small ? 20 : (quiet ? 26 : 36);
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

  window.SW_FX = { holo: holoFX, city: cityFX, terminal: terminalFX };

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
      if (window.SW_FX[kind]) window.SW_FX[kind](cv, { quiet: quiet });
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
    // card spotlight
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".card");
      if (card) { var r = card.getBoundingClientRect(); card.style.setProperty("--mx", (e.clientX - r.left) + "px"); card.style.setProperty("--my", (e.clientY - r.top) + "px"); }
    });
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
    // sticky top bar background
    var bar = document.querySelector(".topbar[data-solid]");
    if (bar) { var on = function () { bar.classList.toggle("solid", scrollY > 40); }; on(); addEventListener("scroll", on, { passive: true }); }
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

    // scroll cue: fades out once the reader starts scrolling
    var cue = document.querySelector(".scroll-cue");
    if (cue) { var hideCue = function () { cue.classList.toggle("gone", scrollY > 60); }; addEventListener("scroll", hideCue, { passive: true }); hideCue(); }

    // light parallax: hero text drifts up slower than the page and fades, the hero clip and the
    // background move at their own speeds, section headings float a little around the centre line.
    // Uses the `translate` property so it never fights the transforms elements already have.
    if (!reduce) {
      var hero = document.querySelector(".hero"), heroWrap = hero && hero.querySelector(".wrap"), heroMedia = hero && hero.querySelector("video");
      var bgCanvas = document.querySelector(".page-bg canvas");
      var heads = Array.prototype.slice.call(document.querySelectorAll(".sec-head h2"));
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
        heads.forEach(function (h) {
          var r = h.getBoundingClientRect();
          if (r.bottom < -120 || r.top > vh + 120) return;
          h.style.translate = "0 " + (((r.top + r.height / 2) - vh / 2) / vh * 30).toFixed(1) + "px";
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
