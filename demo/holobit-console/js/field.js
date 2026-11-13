'use strict';
/* The world behind the glass: a liquidity terrain that breathes with market stress. */
const Field = (() => {
  const cv = $('#field'), cx = cv.getContext('2d');
  let W = 0, H = 0, D = 1, t = 0, stress = 0, target = 0, mx = .5, my = .5, raf = 0, last = 0;
  const COL = { t1: [91, 196, 38], t2: [47, 198, 214] };
  let col = COL.t1.slice(), tcol = COL.t1;

  // cheap 2-D value noise
  const P = new Uint8Array(512); { const r = rng(7); for (let i = 0; i < 256; i++) P[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; } for (let i = 0; i < 256; i++) P[i + 256] = P[i]; }
  const fade = x => x * x * (3 - 2 * x);
  function noise(x, y) {
    const X = Math.floor(x), Y = Math.floor(y), fx = fade(x - X), fy = fade(y - Y), a = X & 255, b = Y & 255;
    const v = (i, j) => P[P[a + i] + b + j] / 255;
    return (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy;
  }
  function size() {
    D = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * D; cv.height = H * D; cx.setTransform(D, 0, 0, D, 0, 0);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || document.body.dataset.view === 'home') return;
    const dt = Math.min(50, now - last || 16); last = now;
    stress += (target - stress) * .03;
    for (let i = 0; i < 3; i++) col[i] += (tcol[i] - col[i]) * .06;
    t += dt * .00006 * (1 + stress * 5);
    cx.clearRect(0, 0, W, H);
    const rows = 26, top = H * .66, span = H * .4, step = Math.max(7, W / 220);
    const amp = H * .16 * (1 + stress * 2.6), cxu = .5 + (mx - .5) * .06, sg = .36;
    for (let r = 0; r < rows; r++) {
      const k = r / (rows - 1), y0 = top + k * span, depth = .3 + k * .7;
      cx.beginPath();
      for (let x = -step; x <= W + step; x += step) {
        const u = x / W, env = Math.exp(-((u - cxu) * (u - cxu)) / (2 * sg * sg)) * .94 + .06;
        const n = noise(u * 4.2 + r * .16 + t * 1.3, r * .3 - t * 2.2), n2 = noise(u * 13 + r * .8, t * 7 + r * .45);
        const y = y0 - (Math.pow(n, 2.3) * 1.55 + n2 * .1 * (.5 + stress * 2)) * amp * env * depth - (my - .5) * 18 * depth;
        x <= 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
      }
      cx.lineTo(W + step, H + 2); cx.lineTo(-step, H + 2); cx.closePath();
      cx.fillStyle = '#202020'; cx.fill();
      const a = .06 + k * .3;
      cx.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`;
      cx.lineWidth = .6 + k * .8; cx.stroke();
    }
  }
  addEventListener('resize', size);
  addEventListener('pointermove', e => { mx += (e.clientX / W - mx) * .08; my += (e.clientY / H - my) * .08; }, { passive: true });
  size();
  if (REDUCED) { last = 0; frame(0); cancelAnimationFrame(raf); addEventListener('resize', () => { frame(0); cancelAnimationFrame(raf); }); }
  else raf = requestAnimationFrame(frame);
  return {
    stress(x) { target = clamp(x, 0, 1); if (REDUCED) { stress = target; frame(0); cancelAnimationFrame(raf); } },
    redraw() { if (REDUCED) { frame(0); cancelAnimationFrame(raf); } },
    track(k) { tcol = COL[k] || COL.t1; if (REDUCED) { col = tcol.slice(); frame(0); cancelAnimationFrame(raf); } },
  };
})();
