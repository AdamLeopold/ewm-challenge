'use strict';
/* Toy digital twin. Enough mechanism to make every branch of the decision loop reachable;
   nothing here is the competition simulator. */

const FAM = [
  { id: 'F0', n: ['Calm & false alarms', '平静与假警报'], sig: ['rumour', '传闻'], vol: .004 },
  { id: 'F1', n: ['USDC depeg', 'USDC 脱锚'], sig: ['depeg', '脱锚'], vol: .006, depeg: .11 },
  { id: 'F2', n: ['Price & volatility shock', '价格与波动冲击'], sig: ['price', '价格'], vol: .011, shock: -.28 },
  { id: 'F3', n: ['Liquidity collapse', '流动性崩塌'], sig: ['liquidity', '流动性'], vol: .007, shock: -.07, slip: 5, fee: .4 },
  { id: 'F4', n: ['Utilisation shock', '借款利用率冲击'], sig: ['utilisation', '利用率'], vol: .005, util: .34 },
  { id: 'F5', n: ['Liquidation cascade', '清算连锁'], sig: ['liquidations', '清算'], vol: .009, shock: -.21, second: -.1, slip: 2.5, weak: 1 },
  { id: 'F6', n: ['Oracle failure', '价格源失效'], sig: ['oracle', '价格源'], vol: .008, shock: -.12, stale: 1 },
  { id: 'F7', n: ['Yield & incentive shock', '收益与激励冲击'], sig: ['incentive', '激励'], vol: .005, fee: .3, util: .16 },
  { id: 'F8', n: ['Gas & infrastructure', 'gas 与基础设施故障'], sig: ['infrastructure', '基础设施'], vol: .008, shock: -.13, gas: 30, drop: .45 },
  { id: 'F9', n: ['Backed-asset failure', '外部背书资产失效'], sig: ['asset', '资产'], vol: .007, shock: -.09, util: .2, mint: 1 },
  { id: 'F10', n: ['Cross-protocol contagion', '两协议间的传染'], sig: ['contagion', '传染'], vol: .009, shock: -.17, slip: 3.5, weak: .6 },
];
const FAMS = Object.fromEntries(FAM.map(f => [f.id, f]));
const HOURS = 48, STEP = 6;

function genWorld(fam, seed) {
  const f = FAMS[fam], r = rng(seed), dud = fam === 'F0' || r() < .32, t0 = r.int(9, 20), dur = r.int(4, 8);
  const px = [3000], us = [1], gas = [1];
  for (let h = 1; h <= HOURS; h++) {
    let ret = f.vol * r.g();
    if (!dud && f.shock && h >= t0 && h < t0 + dur) ret += Math.log(1 + f.shock) / dur;
    if (!dud && f.second && h >= t0 + dur + 3 && h < t0 + dur + 7) ret += Math.log(1 + f.second) / 4;
    px.push(px[h - 1] * Math.exp(ret));
    const k = (h - t0) / (dur * 2.4);
    us.push(!dud && f.depeg && k > 0 && k < 1 ? 1 - f.depeg * Math.sin(Math.PI * k) * (.8 + .2 * r()) : 1 + (r() - .5) * .0008);
    gas.push(!dud && f.gas && h >= t0 && h < t0 + dur * 2 ? f.gas * (.5 + r()) : 1 + r() * .4);
  }
  const sig = { h: Math.max(1, t0 - r.int(3, 6)), type: f.sig, sev: fam === 'F0' ? r.int(1, 3) : r.int(3, 5), cred: Math.round((.3 + r() * .65) * 100) / 100 };
  return { f, seed, px, us, gas, t0, dur, dud, sig, active: h => !dud && h >= t0 && h < t0 + dur * 2 };
}
const hrand = (seed, h, i) => rng((seed ^ (h * 7919) ^ (i * 104729)) >>> 0)();

/* ───────── Track 1 · a portfolio on Uniswap V3 + Aave v3 ───────── */
const LT = { e: .83, u: .78 }, LTV = { e: .805, u: .75 };
class Fail extends Error { constructor(en, zh) { super(en); this.pair = [en, zh]; } }

class Sim1 {
  constructor(fam, seed) {
    this.fam = fam; this.w = genWorld(fam, seed); this.h = 0; this.V0 = 100000;
    this.bal = { u: 50000, e: 50000 / 3000 }; this.hold0 = { ...this.bal };
    this.lp = null; this.av = { su: 0, se: 0, du: 0, de: 0 };
    this.gasPaid = 0; this.peak = this.V0; this.mdd = 0; this.dead = null; this.exited = false;
    this.hist = [{ h: 0, p: 3000, nav: this.V0, hold: this.V0 }];
    this.n = 0; this.miss = 0; this.lastP = 3000;
  }
  get p() { return this.w.px[this.h]; }
  get up() { return this.w.us[this.h]; }
  get done() { return this.h >= HOURS || !!this.dead || this.exited; }
  lpAmt() {
    if (!this.lp) return { e: 0, u: 0 };
    const { L, a, b } = this.lp, s = Math.sqrt(clamp(this.p, a, b));
    return { e: L * (1 / s - 1 / Math.sqrt(b)), u: L * (s - Math.sqrt(a)) + this.lp.fee };
  }
  debt() { return this.av.du * this.up + this.av.de * this.p; }
  assets() { const l = this.lpAmt(); return (this.bal.u + l.u + this.av.su) * this.up + (this.bal.e + l.e + this.av.se) * this.p; }
  nav() { return this.assets() - this.debt(); }
  holdNav() { return this.hold0.u * this.up + this.hold0.e * this.p; }
  hf() { const d = this.debt(); return d < 1e-6 ? Infinity : (this.av.se * this.p * LT.e + this.av.su * this.up * LT.u) / d; }
  room() { return this.av.se * this.p * LTV.e + this.av.su * this.up * LTV.u - this.debt(); }
  px(a) { return a === 'e' ? this.p : this.up; }

  obs() {
    const w = this.w, act = w.active(this.h), l = this.lpAmt();
    const move = Math.abs(this.p / this.lastP - 1), hf = this.hf();
    const trig = hf < 1.2 ? ['health below 1.2', '健康度低于 1.2'] : this.lp && (this.p < this.lp.a || this.p > this.lp.b) ? ['position out of range', '仓位出界']
      : move >= .02 ? ['reference price moved ≥ 2%', '参考价变动 ≥ 2%'] : this.h >= w.sig.h && this.h < w.sig.h + STEP ? ['new message', '新消息'] : ['hourly', '每小时'];
    return {
      h: this.h, n: this.n + 1, trig, price: this.p, usdc: this.up, stale: !!(w.f.stale && act), gas: w.gas[this.h],
      bal: { ...this.bal }, lp: this.lp && { a: this.lp.a, b: this.lp.b, inr: this.p >= this.lp.a && this.p <= this.lp.b, val: l.e * this.p + l.u * this.up }, av: { ...this.av },
      hf, nav: this.nav(), debt: this.debt(), sig: this.h >= w.sig.h ? w.sig : null,
    };
  }
  /* pre-trade validation against the state at the end of the previous block → 'rejected', no gas */
  validate(plan) {
    if (!plan.length) return ['P-01 · empty plan', 'P-01 · 计划为空'];
    if (plan.length > 6) return ['P-02 · more than 6 actions in one plan', 'P-02 · 一份计划超过 6 个动作'];
    const nav = this.nav(); let sw = 0, nd = 0;
    for (const a of plan) {
      if (a.k === 'swap') sw += this.bal[a.from] * a.x * this.px(a.from);
      if (a.k === 'borrow') nd += a.x * nav;
    }
    if (sw > .5 * nav + 1) return ['H-02 · swaps in one plan exceed 50% of NAV', 'H-02 · 一份计划的换币合计超过净值的 50%'];
    if (nd && this.debt() + nd > nav + 1) return ['H-01 · debt would exceed 100% of NAV', 'H-01 · 债将超过净值的 100%'];
    return null;
  }
  apply(a) {
    const act = this.w.active(this.h), f = this.w.f, b = this.bal, av = this.av;
    if (a.k === 'swap') {
      const amt = b[a.from] * a.x, v = amt * this.px(a.from); if (v < 1) throw new Fail('nothing to swap', '没有可换的余额');
      const slip = (.0005 + .0012 * v / 1e5) * (act && f.slip || 1) + .0005, to = a.from === 'u' ? 'e' : 'u';
      b[a.from] -= amt; b[to] += v * (1 - slip) / this.px(to);
    } else if (a.k === 'lp') {
      if (this.lp) this.apply({ k: 'unlp' });
      const v = (b.u * this.up + b.e * this.p) * a.x; if (v < 100) throw new Fail('insufficient balance for the range', '余额不足以建仓');
      b.u *= 1 - a.x; b.e *= 1 - a.x;
      const lo = this.p * (1 - a.w), hi = this.p * (1 + a.w), s = Math.sqrt(this.p);
      const unit = (1 / s - 1 / Math.sqrt(hi)) * this.p + (s - Math.sqrt(lo)) * this.up;
      this.lp = { L: v * .9995 / unit, a: lo, b: hi, w: a.w, fee: 0 };
    } else if (a.k === 'unlp') {
      if (!this.lp) throw new Fail('no position to remove', '没有可撤的仓位');
      const l = this.lpAmt(); b.e += l.e; b.u += l.u; this.lp = null;
    } else if (a.k === 'supply') {
      const amt = b[a.a] * a.x; if (amt * this.px(a.a) < 1) throw new Fail('nothing to supply', '没有可存的余额');
      b[a.a] -= amt; av['s' + a.a] += amt;
    } else if (a.k === 'withdraw') {
      const amt = av['s' + a.a] * a.x; if (amt * this.px(a.a) < 1) throw new Fail('nothing supplied', '没有存款');
      av['s' + a.a] -= amt; b[a.a] += amt;
      if (this.hf() < 1.01) throw new Fail('withdrawal would break the health factor', '取款会让健康度过低');
    } else if (a.k === 'borrow') {
      const v = a.x * this.nav(); if (v > this.room() + 1) throw new Fail('borrow exceeds collateral LTV', '借款超过抵押的 LTV');
      const amt = v / this.px(a.a); av['d' + a.a] += amt; b[a.a] += amt;
    } else if (a.k === 'repay') {
      const amt = av['d' + a.a] * a.x; if (amt * this.px(a.a) < 1) throw new Fail('no debt to repay', '没有要还的债');
      if (b[a.a] < amt * .999) throw new Fail('insufficient balance to repay', '余额不足以还款');
      b[a.a] -= Math.min(amt, b[a.a]); av['d' + a.a] -= amt;
    } else if (a.k === 'flash') { b.u += a.amt; this._flash = (this._flash || 0) + a.amt * 1.0005; }
  }
  gasOf(plan) { return plan.reduce((s, a) => s + ({ swap: 3, lp: 9, unlp: 6, flash: 5 }[a.k] || 4), 0) * this.w.gas[this.h]; }
  run(plan, commit = true) {
    const keep = clone({ bal: this.bal, lp: this.lp, av: this.av }), gas = this.gasOf(plan);
    let res = { status: 'completed', gas };
    this._flash = 0;
    try {
      for (const a of plan) this.apply(a);
      if (this._flash) { if (this.bal.u < this._flash) throw new Fail('flash loan not repaid inside the plan', '闪电贷没有在计划内还清'); this.bal.u -= this._flash; }
    } catch (e) { if (!(e instanceof Fail)) throw e; Object.assign(this, clone(keep)); res = { status: 'failed', gas, why: e.pair }; }
    const after = { nav: this.nav() - gas, hf: this.hf() };
    if (!commit) { Object.assign(this, clone(keep)); return { ...res, after }; }
    this.bal.u -= gas / this.up; if (this.bal.u < 0) { this.bal.e += this.bal.u * this.up / this.p; this.bal.u = 0; }
    this.gasPaid += gas; return { ...res, after };
  }
  /* one decision: {type:'hold'|'abstain'|'plan'|'error'|'timeout', plan} → outcome */
  decide(d) {
    let out = { type: d.type, h: this.h };
    if (d.type === 'plan') {
      const rej = this.validate(d.plan);
      if (rej) out = { ...out, status: 'rejected', why: rej, gas: 0 };
      else if (this.w.f.drop && this.w.active(this.h) && hrand(this.w.seed, this.h, 3) < this.w.f.drop) out = { ...out, status: 'failed', why: ['not executed · dropped before inclusion', '未执行 · 打包前被丢弃'], gas: 0, dropped: true };
      else out = { ...out, ...this.run(d.plan) };
    }
    if (d.type === 'error' || d.type === 'timeout') this.miss++;
    this.n++; this.lastP = this.p;
    this.advance(STEP);
    out.post = { nav: this.nav(), hf: this.hf(), h: this.h, dead: this.dead, exited: this.exited };
    return out;
  }
  advance(hours) {
    for (let i = 0; i < hours && this.h < HOURS; i++) {
      const p0 = this.p; this.h++;
      if (!this.dead && !this.exited) {
        const act = this.w.active(this.h), f = this.w.f;
        if (this.lp && this.p >= this.lp.a && this.p <= this.lp.b) {
          const l = this.lpAmt(), v = l.e * this.p + l.u * this.up;
          this.lp.fee += v * .00003 * (.1 / this.lp.w) * (act && f.fee || 1) * (1 + Math.abs(this.p / p0 - 1) * 40);
        }
        const apr = act && f.util ? .6 : .045;
        this.av.du *= 1 + apr / 8760; this.av.de *= 1 + apr * .6 / 8760; this.av.su *= 1 + .02 / 8760; this.av.se *= 1 + .012 / 8760;
        const nav = this.nav(), d = this.debt();
        if (d > 1 && this.hf() < 1) {                       // liquidated: half the debt, 5% bonus
          const rep = d * .5, seize = rep * 1.05;
          let fromE = Math.min(this.av.se * this.p, seize); this.av.se -= fromE / this.p; this.av.su -= Math.min(this.av.su, (seize - fromE) / this.up);
          const k = 1 - rep / d; this.av.du *= k; this.av.de *= k; this.dead = 'liquidated';
        } else if (d > this.assets()) this.dead = 'baddebt';
        else if (nav < .05 * this.V0) this.dead = 'insolvent';
        else if ((nav - this.holdNav()) / this.holdNav() < -.05) this.forceExit();
      }
      const nav = this.nav(); this.peak = Math.max(this.peak, nav); this.mdd = Math.max(this.mdd, (this.peak - nav) / this.peak);
      this.hist.push({ h: this.h, p: this.p, nav, hold: this.holdNav() });
    }
  }
  forceExit() {                                             // platform unwinds to the 7-day reference mix
    if (this.lp) this.apply({ k: 'unlp' });
    const b = this.bal, av = this.av; b.u += av.su - av.du; b.e += av.se - av.de; this.av = { su: 0, se: 0, du: 0, de: 0 };
    if (b.u < 0) { b.e += b.u * this.up / this.p; b.u = 0; } if (b.e < 0) { b.u += b.e * this.p / this.up; b.e = 0; }
    const v = (b.u * this.up + b.e * this.p) * .997, hv = this.holdNav(), k = v / hv;
    b.u = this.hold0.u * k; b.e = this.hold0.e * k; this.exited = true;
  }
  score() {
    const nav = this.nav(), r = (nav - this.V0) / this.V0 * 1e4, mdd = this.mdd * 1e4;
    return { r, mdd, S: r - .5 * mdd, dH: (nav - this.holdNav()) / this.V0 * 1e4, gas: this.gasPaid, nav,
      gate: this.dead ? this.dead : this.n && this.miss / this.n > .05 && this.miss > 1 ? 'missed' : null, exited: this.exited };
  }
}

/* ───────── Track 2 · the Aave USDC reserve with WETH collateral, paired with an unchanged baseline ───────── */
const P2 = {
  ltv: { n: ['LTV', 'LTV'], v: 80.5, max: .5, step: .25, u: '%', cd: 72, d: 2 },
  lt: { n: ['Liquidation threshold', '清算阈值'], v: 83, max: .5, step: .25, u: '%', cd: 72, d: 2 },
  bonus: { n: ['Liquidation bonus', '清算奖励'], v: 5, max: .5, step: .25, u: '%', cd: 72, d: 2 },
  bcap: { n: ['Borrow cap', '借款上限'], v: 620, max: 1, rel: true, step: .25, u: 'm', cd: 36, d: 0 },
  base: { n: ['Base rate', '基础利率'], v: 0, max: 1, step: .5, u: '%', cd: 36, d: 1 },
  s1: { n: ['Slope 1', '斜率一'], v: 5.5, max: 1, step: .5, u: '%', cd: 36, d: 1 },
  s2: { n: ['Slope 2', '斜率二'], v: 60, max: 20, step: 10, u: '%', cd: 36, d: 0 },
  uopt: { n: ['Optimal utilisation', '最优利用率'], v: 90, max: 3, step: 1.5, u: '%', cd: 36, d: 1 },
  rf: { n: ['Reserve factor', '储备系数'], v: 10, max: 5, step: 2.5, u: '%', cd: 72, d: 1 },
};
class World2 {
  constructor(fam, seed) {
    this.w = genWorld(fam, seed); this.h = 0; this.P = Object.fromEntries(Object.entries(P2).map(([k, v]) => [k, v.v])); this.frozen = false;
    const f = this.w.f, hfs = [1.03, 1.06, 1.1, 1.15, 1.22, 1.3, 1.4, 1.55, 1.7, 1.9, 2.2, 2.6];
    let wt = [.02, .03, .05, .07, .1, .13, .15, .14, .12, .09, .06, .04].map((x, i) => i < 4 ? x * (1 + 1.6 * (f.weak || 0)) : x);
    const sw = wt.reduce((a, b) => a + b); wt = wt.map(x => x / sw);
    this.bk = hfs.map((hf, i) => ({ debt: 480 * wt[i], coll: 480 * wt[i] * hf / (.83 * 3000) }));
    this.supply = 620; this.BD = 0; this.LP = 0; this.RV = 0; this.W = 0; this.direct = 0; this.liq = 0;
    this.D0 = this.supply + this.bk.reduce((s, b) => s + b.coll * 3000, 0);
    this.hist = [{ h: 0, U: this.U(), BD: 0 }];
  }
  get p() { return this.w.px[this.h]; }
  debt() { return this.bk.reduce((s, b) => s + b.debt, 0); }
  U() { return clamp(this.debt() / this.supply, 0, 1); }
  rate() { const P = this.P, U = this.U() * 100; return U <= P.uopt ? P.base + P.s1 * U / P.uopt : P.base + P.s1 + P.s2 * (U - P.uopt) / (100 - P.uopt); }
  hfDist() { const e = [1, 1.1, 1.25, 1.5, 2, 9], out = [0, 0, 0, 0, 0, 0]; this.bk.forEach(b => { const hf = b.coll * this.p * this.P.lt / 100 / b.debt; let i = e.findIndex(x => hf < x); if (i < 0) i = 5; out[i] += b.debt; }); return out; }
  setLT(v) { this.bk.forEach(b => { const a = b.coll * this.p / b.debt; if (a * this.P.lt / 100 >= 1 && a * v / 100 < 1) this.direct += b.debt; }); this.P.lt = v; }
  hour() {
    this.h++; const p = this.p, P = this.P, f = this.w.f, act = this.w.active(this.h), b0 = P2.bonus.v; let liqH = 0;
    this.bk = this.bk.filter((b, i) => {
      const cv = b.coll * p, hf = cv * P.lt / 100 / b.debt; if (hf >= 1) return true;
      const slip = .012 * (1 + liqH / 30) * (act && f.slip || 1), late = act && f.gas && hrand(this.w.seed, this.h, i) < .6;
      if (!late && P.bonus / 100 > slip) {
        const rep = hf < .95 ? b.debt : b.debt * .5, seize = rep * (1 + P.bonus / 100);
        if (seize >= cv) { const got = cv / (1 + P.bonus / 100); this.BD += b.debt - got; this.LP += got * b0 / 100; this.RV += got * P.bonus / 1000; liqH += got; this.liq += got; return false; }
        b.coll -= seize / p; b.debt -= rep; this.LP += rep * b0 / 100; this.RV += rep * P.bonus / 1000; liqH += rep; this.liq += rep; return b.debt > .01;
      }
      if (cv < b.debt) { this.BD += b.debt - cv * .92; return false; }
      return true;
    });
    const rate = this.rate(), debt = this.debt();
    if (act && f.mint && !this.frozen && debt < P.bcap) this.BD += Math.min(1.1, P.bcap - debt);     // unbacked X borrows good assets
    if (!this.frozen) {
      const dem = Math.min(debt * .0012 * Math.max(0, 1 - (rate - 6) / 20), Math.max(0, P.bcap - debt));
      if (dem > 0) this.bk.push({ debt: dem, coll: dem / (P.ltv / 100 * p) });
    }
    const rep = clamp((rate - 9) * .0006, 0, .02); this.bk.forEach(b => { b.debt *= 1 - rep; b.coll *= 1 - rep; });
    this.RV += this.debt() * rate / 100 * P.rf / 100 / 8760;
    if (act && f.util) { const wd = this.supply * f.util / (this.w.dur * 2), av = Math.max(0, this.supply - this.debt()); if (wd > av) this.W += (wd - av) / 24; this.supply -= Math.min(wd, av); }
    this.supply *= 1 + clamp((rate - 6) * .0004, 0, .01);
    this.hist.push({ h: this.h, U: this.U(), BD: this.BD });
  }
}
class Sim2 {
  constructor(fam, seed) { this.fam = fam; this.a = new World2(fam, seed); this.b = new World2(fam, seed); this.cool = {}; this.queue = []; this.n = 0; this.miss = 0; this.lastP = 3000; }
  get h() { return this.a.h; } get w() { return this.a.w; } get done() { return this.h >= HOURS; }
  obs() {
    const a = this.a, w = a.w, act = w.active(a.h), U = a.U(), move = Math.abs(a.p / this.lastP - 1);
    const trig = a.BD > (this._bd || 0) + .01 ? ['bad debt appeared', '出现坏账'] : U > .9 ? ['utilisation above 90%', '利用率超过 90%'] : move >= .05 ? ['oracle price moved ≥ 5%', '预言机价变动 ≥ 5%']
      : a.h >= w.sig.h && a.h < w.sig.h + STEP ? ['new message', '新消息'] : ['every 6 hours', '每 6 小时'];
    return { h: a.h, n: this.n + 1, trig, price: a.p, stale: !!(w.f.stale && act), U, rate: a.rate(), supply: a.supply, debt: a.debt(), dist: a.hfDist(), P: { ...a.P }, frozen: a.frozen, BD: a.BD, liq: a.liq, sig: a.h >= w.sig.h ? w.sig : null, cool: { ...this.cool }, queue: this.queue.slice() };
  }
  /* changes: [{k, v}] in order, freeze: bool|undefined, gov: bool */
  propose(ch, freeze, gov) {
    const a = this.a, lines = []; let status = 'completed', why = null;
    const P = { ...a.P };
    for (const c of ch) {
      const d = P2[c.k], cur = P[c.k], lim = (d.rel ? cur * d.max : d.max) * (gov ? 10 : 1);
      if (Math.abs(c.v - cur) > lim + 1e-9) { status = 'rejected'; why = [`B-01 · ${d.n[0]}: change exceeds ±${d.rel ? d.max * 100 + '%' : d.max + ' pp'} per decision`, `B-01 · ${d.n[1]}：单次改动超过 ±${d.rel ? d.max * 100 + '%' : d.max + ' 个百分点'}`]; break; }
      if (!gov && (this.cool[c.k] || 0) > a.h) { status = 'rejected'; why = [`B-02 · ${d.n[0]}: cooling down until t+${this.cool[c.k]}h`, `B-02 · ${d.n[1]}：冷却期到 t+${this.cool[c.k]}h`]; break; }
      if (c.v <= 0 && c.k !== 'base') { status = 'rejected'; why = [`B-03 · ${d.n[0]} cannot be set to zero`, `B-03 · ${d.n[1]}不能设为 0`]; break; }
      P[c.k] = c.v;
    }
    if (status === 'completed' && (P.lt <= P.ltv || P.lt / 100 * (1 + P.bonus / 100) > 1)) { status = 'failed'; why = P.lt <= P.ltv ? ['contract reverted · threshold must stay above LTV', '合约回滚 · 清算阈值必须高于 LTV'] : ['contract reverted · threshold × (1 + bonus) must stay ≤ 100%', '合约回滚 · 阈值 ×（1 + 奖励）必须 ≤ 100%']; }
    if (status === 'completed') {
      if (gov) { const eff = a.h + 120; this.queue.push({ eff, ch, freeze }); lines.push(['queued on the governance channel · effective t+' + eff + 'h', '进入治理通道 · t+' + eff + 'h 生效']); }
      else {
        ch.forEach(c => { c.k === 'lt' ? a.setLT(c.v) : (a.P[c.k] = c.v); this.cool[c.k] = a.h + P2[c.k].cd; });
        if (freeze != null) a.frozen = freeze;
        lines.push(['effective next block', '下一个区块生效']);
      }
    }
    return { status, why, lines };
  }
  decide(d) {
    let out = { type: d.type, h: this.h };
    if (d.type === 'plan') out = { ...out, ...this.propose(d.ch, d.freeze, d.gov) };
    if (d.type === 'error' || d.type === 'timeout') this.miss++;
    this.n++; this.lastP = this.a.p; this._bd = this.a.BD;
    for (let i = 0; i < STEP && !this.done; i++) { this.a.hour(); this.b.hour(); }
    out.post = { U: this.a.U(), BD: this.a.BD, BD0: this.b.BD, h: this.h };
    return out;
  }
  score() {
    const a = this.a, b = this.b, cW = .2 / 365;
    const t = { bd: b.BD - a.BD, lp: b.LP - a.LP, rv: a.RV - b.RV, w: -cW * (a.W - b.W) };
    const S = (t.bd + t.lp + t.rv + t.w) / a.D0 * 1e4;
    const gate = a.BD - b.BD > .0005 * a.D0 ? 'baddebt' : a.direct > 2 ? 'direct' : this.n && this.miss / this.n > .05 && this.miss > 1 ? 'missed' : null;
    return { S, t, gate, a, b, D0: a.D0 };
  }
}

/* ───────── drawing ───────── */
/* series: [{d:[…], c, w, dash, fill, lab}] share one y-scale; x spans 0…xmax so a run draws left to right */
function chart({ W = 360, H = 132, series, xmax, band, fmt = x => nf(x), pad = [12, 56, 16, 2], zero }) {
  const all = series.flatMap(s => s.d).concat(band ? [band.a, band.b] : [], zero != null ? [zero] : []);
  let lo = Math.min(...all), hi = Math.max(...all); const pos = lo >= 0, m = (hi - lo || Math.abs(hi) * .02 || 1) * .14; lo -= m; hi += m; if (pos && lo < 0) lo = 0;
  const iw = W - pad[1] - pad[3], ih = H - pad[0] - pad[2], X = i => pad[3] + i / xmax * iw, Y = v => pad[0] + (1 - (v - lo) / (hi - lo)) * ih;
  let o = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">`;
  for (let g = 0; g <= 3; g++) { const y = pad[0] + ih * g / 3; o += `<line x1="${pad[3]}" x2="${pad[3] + iw}" y1="${y}" y2="${y}" class="grid"/><text x="${W - 4}" y="${y + 3.5}" class="ax" text-anchor="end">${fmt(hi - (hi - lo) * g / 3)}</text>`; }
  if (band) o += `<rect x="${X(band.from || 0)}" y="${Y(band.b)}" width="${Math.max(0, pad[3] + iw - X(band.from || 0))}" height="${Math.max(1, Y(band.a) - Y(band.b))}" class="band"/>`;
  if (zero != null) o += `<line x1="${pad[3]}" x2="${pad[3] + iw}" y1="${Y(zero)}" y2="${Y(zero)}" class="zero"/>`;
  series.forEach(s => {
    const pts = s.d.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    if (s.fill) o += `<polygon points="${pad[3]},${pad[0] + ih} ${pts.join(' ')} ${X(s.d.length - 1).toFixed(1)},${pad[0] + ih}" fill="${s.c}" opacity=".09"/>`;
    o += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w || 1.5}" ${s.dash ? 'stroke-dasharray="3 3"' : ''} vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    if (!s.dash) o += `<circle cx="${X(s.d.length - 1)}" cy="${Y(s.d[s.d.length - 1])}" r="2.6" fill="${s.c}"/>`;
  });
  for (let h = 0; h <= xmax; h += 12) o += `<text x="${X(h)}" y="${H - 3}" class="ax" text-anchor="${h === 0 ? 'start' : h === xmax ? 'end' : 'middle'}">${h}h</text>`;
  return o + '</svg>';
}
function bars(vals, { W = 360, H = 64, labels, c = 'var(--acc)', hot = 0 } = {}) {
  const mx = Math.max(...vals, 1e-9), bw = W / vals.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">` + vals.map((v, i) => { const h = Math.max(1, v / mx * (H - 20)); return `<rect x="${i * bw + 3}" y="${H - 16 - h}" width="${bw - 6}" height="${h}" fill="${i <= hot ? 'var(--bad)' : c}" opacity="${i <= hot ? .9 : .55}" rx="1.5"/><text x="${i * bw + bw / 2}" y="${H - 3}" class="ax" text-anchor="middle">${labels[i]}</text>`; }).join('') + '</svg>';
}
