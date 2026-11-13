'use strict';
/* Track stages, part 1: brief → decision loop. `k` is 't1' | 't2'. */
const p2 = n => String(n).padStart(2, '0');
const AS = { u: 'USDC', e: 'WETH' };
const hfTxt = x => x === Infinity ? '∞' : nf(x, 2);
const hfTone = x => x < 1.1 ? 'bad' : x < 1.3 ? 'warn' : '';
const STATUS = { completed: ['completed', '已完成', 'ok'], failed: ['failed', '失败', 'bad'], rejected: ['rejected', '被拒', 'warn'] };

/* ───────── world panel views ───────── */
function view1(sim) {
  const h = sim.hist, s = sim.score(), act = sim.w.active(sim.h);
  world({
    phase: ['Practise', '练习'], sub: `${sim.fam} · ${LA(FAMS[sim.fam].n)} · t+${sim.h}h`, stress: clamp(Math.abs(sim.p / 3000 - 1) * 3 + (act ? .35 : 0), 0, 1),
    viz: `<div class="cap"><span>WETH / USDC</span><b>${nf(sim.p, 2)}</b></div>` + chart({ series: [{ d: h.map(x => x.p), c: 'var(--ink)', w: 1.3 }], xmax: HOURS, band: sim.lp && { a: sim.lp.a, b: sim.lp.b, from: sim.lp.h0 || 0 }, fmt: x => nf(x, 0) })
      + `<div class="cap"><span>${L('Net value · vs hold', '净值 · 对比持有')}</span><b>${usd(s.nav)}</b></div>` + chart({ series: [{ d: h.map(x => x.hold), c: 'var(--mut)', dash: 1, w: 1 }, { d: h.map(x => x.nav), c: 'var(--acc)', fill: 1, w: 1.8 }], xmax: HOURS, fmt: x => nf(x / 1000, 1) + 'k' }),
    vitals: [['S', bps(s.S), s.S < 0 ? 'bad' : 'acc'], [L('Health', '健康度'), hfTxt(sim.hf()), hfTone(sim.hf())], ['r', bps(s.r)], ['MDD', nf(s.mdd, 0) + ' bps'], [L('vs hold', '相对持有'), bps(s.dH)], ['Gas', usd(s.gas)]],
  });
}
function view2(sim) {
  const a = sim.a, b = sim.b, s = sim.score(), act = a.w.active(a.h);
  world({
    phase: ['Practise', '练习'], sub: `${sim.fam} · ${LA(FAMS[sim.fam].n)} · t+${a.h}h`, stress: clamp(Math.abs(a.p / 3000 - 1) * 3 + (act ? .35 : 0) + a.BD / 40, 0, 1),
    viz: `<div class="cap"><span>${L('USDC utilisation · vs unchanged', 'USDC 利用率 · 对比参数不变')}</span><b>${pct(a.U())}</b></div>` + chart({ series: [{ d: b.hist.map(x => x.U * 100), c: 'var(--mut)', dash: 1, w: 1 }, { d: a.hist.map(x => x.U * 100), c: 'var(--acc)', w: 1.8, fill: 1 }], xmax: HOURS, fmt: x => nf(x, 1) + '%' })
      + `<div class="cap"><span>${L('Bad debt · vs unchanged', '坏账 · 对比参数不变')}</span><b>${usdc(a.BD * 1e6)}</b></div>` + chart({ series: [{ d: b.hist.map(x => x.BD), c: 'var(--mut)', dash: 1, w: 1 }, { d: a.hist.map(x => x.BD), c: 'var(--bad)', w: 1.8, fill: 1 }], xmax: HOURS, fmt: x => '$' + nf(x, 1) + 'm', H: 110 }),
    vitals: [['S', bps(s.S), s.S < 0 ? 'bad' : 'acc'], ['WETH', nf(a.p, 0)], [L('Borrow rate', '借款利率'), nf(a.rate(), 1) + '%'], [L('Liquidated', '已清算'), usdc(a.liq * 1e6)], [L('Withdrawals stuck', '取不出'), nf(a.W, 2) + ' $m·d', a.W > b.W + .01 ? 'warn' : ''], [L('Revenue', '协议收入'), usdc(a.RV * 1e6)]],
  });
}

/* ───────── decision cards ───────── */
function clockHTML(secs) { return `<button class="clock" data-x="clock" data-keep title="${L('Run the clock out', '让时钟走完')}"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/><circle class="arc" cx="10" cy="10" r="8" style="animation-duration:${secs}s"/></svg><span>${secs}</span></button>`; }
function runClock(c, secs, done) {
  const b = $('[data-x=clock]', c), sp = $('span', b); let left = secs;
  const fin = () => { clearInterval(iv); done({ type: 'timeout' }); };
  const iv = setInterval(() => { if (!c.isConnected || c.classList.contains('done')) return clearInterval(iv); if (UI.auto || UI.fast) return; sp.textContent = --left; if (left <= 0) fin(); }, 1000);
  b.onclick = () => { if (!c.classList.contains('done')) { sp.textContent = 0; fin(); } };
}
const sigHTML = s => s ? `<div class="sig"><i>⚑</i><b>${TA(s.type)}</b><span>${T('severity', '严重度')} ${s.sev}/5</span><span>${T('credibility', '可信度')} ${nf(s.cred, 2)}</span></div>` : '';
const noteHTML = id => `<textarea id="${id}r" rows="1" maxlength="1024" class="why" data-ph-en="Why — your agent’s half of the record" data-ph-zh="理由 · Agent 写的那一半记录"></textarea>`;

const ACT1 = {
  swap: { n: ['Swap', '换币'], mk: () => ({ k: 'swap', from: 'u', x: .25 }) }, lp: { n: ['LP range', '做 LP'], mk: () => ({ k: 'lp', w: .1, x: .6 }) }, unlp: { n: ['Remove LP', '撤 LP'], mk: () => ({ k: 'unlp' }) },
  supply: { n: ['Supply', '存入'], mk: () => ({ k: 'supply', a: 'e', x: .5 }) }, borrow: { n: ['Borrow', '借出'], mk: () => ({ k: 'borrow', a: 'u', x: .2 }) }, repay: { n: ['Repay', '还款'], mk: () => ({ k: 'repay', a: 'u', x: 1 }) },
  withdraw: { n: ['Withdraw', '取回'], mk: () => ({ k: 'withdraw', a: 'e', x: .5 }) }, flash: { n: ['Flash loan', '闪电贷'], mk: () => ({ k: 'flash', amt: 50000 }) },
};
function actText(a) {
  const x = Math.round((a.x || 0) * 100);
  return { swap: [`Swap ${x}% ${AS[a.from]} → ${AS[a.from === 'u' ? 'e' : 'u']}`, `换 ${x}% ${AS[a.from]} → ${AS[a.from === 'u' ? 'e' : 'u']}`], lp: [`LP ±${a.w * 100}% with ${x}% of wallet`, `用钱包的 ${x}% 做 ±${a.w * 100}% LP`], unlp: ['Remove LP', '撤出 LP'],
    supply: [`Supply ${x}% ${AS[a.a]}`, `存入 ${x}% ${AS[a.a]}`], withdraw: [`Withdraw ${x}% ${AS[a.a]}`, `取回 ${x}% ${AS[a.a]}`], borrow: [`Borrow ${AS[a.a]} · ${x}% of NAV`, `借 ${AS[a.a]} · 净值的 ${x}%`], repay: [`Repay ${x}% ${AS[a.a]}`, `还 ${x}% ${AS[a.a]}`], flash: [`Flash ${usdc(a.amt)} USDC`, `闪电贷 ${usdc(a.amt)} USDC`] }[a.k];
}
const planText = plan => [plan.map(a => actText(a)[0]).join(' · '), plan.map(a => actText(a)[1]).join(' · ')];

function policy1(sim) {                                    // the example agent: a fixed-range LP that steps aside on credible alarms
  const o = sim.obs();
  if (o.sig && o.sig.sev >= 4 && o.sig.cred > .5 && o.lp) return { type: 'plan', plan: [{ k: 'unlp' }] };
  if (!o.lp && !(o.sig && o.sig.sev >= 4 && o.sig.cred > .5 && o.h < sim.w.sig.h + 18)) return { type: 'plan', plan: [{ k: 'lp', w: .1, x: .6 }] };
  if (o.lp && !o.lp.inr) return { type: 'plan', plan: [{ k: 'lp', w: .1, x: .6 }] };
  return { type: 'hold' };
}
function decide1(sim) {
  const o = sim.obs(), id = uid(), plan = [];
  return card(`<header><h4>#${p2(o.n)}<small>t+${o.h}h</small></h4>${pill(TA(o.trig))}${clockHTML(90)}</header>
    <div class="obs"><div><span>WETH</span><b>${o.stale ? `<em class="warn">${T('unknown', '未知')}</em>` : nf(o.price, 2)}</b></div><div><span>USDC</span><b class="${o.usdc < .985 ? 'bad' : ''}">${nf(o.usdc, 4)}</b></div><div><span>Gas</span><b class="${o.gas > 4 ? 'warn' : ''}">×${nf(o.gas, 1)}</b></div><div><span>${T('Net value', '净值')}</span><b>${usd(o.nav)}</b></div><div><span>${T('Health', '健康度')}</span><b class="${hfTone(o.hf)}">${hfTxt(o.hf)}</b></div></div>
    ${sigHTML(o.sig)}
    <div class="hold3"><div><small>${T('Wallet', '钱包')}</small>${usd(o.bal.u)} USDC<br>${nf(o.bal.e, 3)} WETH</div><div><small>Uniswap V3</small>${o.lp ? `${nf(o.lp.a, 0)} – ${nf(o.lp.b, 0)}<br>${usd(o.lp.val)} ${o.lp.inr ? pill(T('in range', '区间内'), 'ok') : pill(T('out of range', '出界'), 'warn')}` : '—'}</div><div><small>Aave v3</small>${o.av.su + o.av.se + o.av.du + o.av.de > 1e-9 ? `${T('in', '存')} ${usd(o.av.su * o.usdc + o.av.se * o.price)}<br>${T('owed', '借')} ${usd(o.debt)}` : '—'}</div></div>
    <div class="adds" id="${id}a">${Object.entries(ACT1).map(([k, v]) => `<button data-a="${k}">+ ${TA(v.n)}</button>`).join('')}</div>
    <ol class="plan" id="${id}p"></ol>
    <p class="dry" id="${id}d" hidden></p>
    ${noteHTML(id)}
    <footer><button class="btn link" data-x="auto">${T('Let the example agent finish', '交给例子 Agent 跑完')}</button><span class="sp"></span><button class="btn" data-x="dry">${T('Dry-run', '试执行')}</button><button class="btn" data-x="abstain">${T('Abstain', '弃权')}</button><button class="btn" data-x="hold">${T('Hold', '保持')}</button><button class="btn solid" data-x="go">${T('Submit plan', '提交计划')}</button></footer>`, (c, done) => {
    applyLang(c);
    const ol = $(`#${id}p`, c), dry = $(`#${id}d`, c), why = () => $(`#${id}r`, c).value.trim();
    const asset = (a, f) => `<select data-f="${f}"><option value="u" ${a[f] === 'u' ? 'selected' : ''}>USDC</option><option value="e" ${a[f] === 'e' ? 'selected' : ''}>WETH</option></select>`;
    const rng_ = (a, max = 100) => `<input type="range" data-f="x" min="5" max="${max}" step="5" value="${Math.round(a.x * 100)}"><output>${Math.round(a.x * 100)}%</output>`;
    const row = (a, i) => `<li data-ix="${i}"><b>${TA(ACT1[a.k].n)}</b>${a.k === 'swap' ? asset(a, 'from') + `<em>→ ${AS[a.from === 'u' ? 'e' : 'u']}</em>` + rng_(a) : a.k === 'lp' ? `<select data-f="w">${[.05, .1, .3].map(w => `<option value="${w}" ${a.w === w ? 'selected' : ''}>±${w * 100}%</option>`).join('')}</select>` + rng_(a) : a.k === 'borrow' ? asset(a, 'a') + rng_(a, 150) + `<em>${T('of NAV', '净值')}</em>` : a.k === 'flash' ? `<select data-f="amt">${[25000, 50000, 100000].map(v => `<option value="${v}" ${a.amt === v ? 'selected' : ''}>${usdc(v)} USDC</option>`).join('')}</select>` : a.k === 'unlp' ? '' : asset(a, 'a') + rng_(a)}<button class="x" data-x="rm" aria-label="remove">×</button></li>`;
    const draw = () => { ol.innerHTML = plan.map(row).join(''); dry.hidden = true; };
    $(`#${id}a`, c).onclick = e => { const b = e.target.closest('[data-a]'); if (b) { plan.push(ACT1[b.dataset.a].mk()); draw(); } };
    ol.addEventListener('input', e => { const li = e.target.closest('li'), f = e.target.dataset.f; if (!li || !f) return; const a = plan[+li.dataset.ix]; a[f] = f === 'x' ? +e.target.value / 100 : f === 'w' || f === 'amt' ? +e.target.value : e.target.value; if (f === 'x') e.target.nextElementSibling.textContent = e.target.value + '%'; else draw(); dry.hidden = true; });
    ol.addEventListener('click', e => { if (e.target.dataset.x === 'rm') { plan.splice(+e.target.closest('li').dataset.ix, 1); draw(); } });
    $('[data-x=dry]', c).onclick = () => {
      if (!plan.length) return shake(ol.previousElementSibling);
      const rej = sim.validate(plan), r = rej ? { status: 'rejected', why: rej } : sim.run(plan, false), s = STATUS[r.status];
      dry.hidden = false; dry.innerHTML = `${pill(T(s[0], s[1]), s[2])} ${r.why ? TA(r.why) : `${T('net value', '净值')} ${usd(r.after.nav)} · ${T('health', '健康度')} ${hfTxt(r.after.hf)} · gas ${usd(r.gas, 2)}`}`;
    };
    $('[data-x=hold]', c).onclick = () => done({ type: 'hold', why: why() });
    $('[data-x=abstain]', c).onclick = () => done(why() ? { type: 'abstain', why: why() } : { type: 'error', err: ['abstained without a reason', '弃权却没有写原因'] });
    $('[data-x=go]', c).onclick = () => plan.length ? done({ type: 'plan', plan: clone(plan), why: why() }) : shake($(`#${id}a`, c));
    $('[data-x=auto]', c).onclick = () => done({ type: 'auto' });
    runClock(c, 90, done);
    return () => done(policy1(sim));
  }, { cls: 'decide' });
}

function policy2(sim) {                                    // the example steward: tighten once, lean on bonus when alarms are credible
  const o = sim.obs(), ch = [], free = k => (o.cool[k] || 0) <= o.h;
  if (o.n === 1) return { type: 'plan', ch: [{ k: 'ltv', v: o.P.ltv - .5 }, { k: 's1', v: o.P.s1 + 1 }] };
  if (o.sig && o.sig.sev >= 4 && o.sig.cred > .5) {
    if (sim.fam === 'F9' && !o.frozen) return { type: 'plan', ch: [], freeze: true };
    if (free('bonus')) ch.push({ k: 'bonus', v: o.P.bonus + .5 });
    if (o.U > .9 && free('s2')) ch.push({ k: 's2', v: o.P.s2 + 20 });
  }
  return ch.length ? { type: 'plan', ch } : { type: 'hold' };
}
function decide2(sim) {
  const o = sim.obs(), id = uid(), next = { ...o.P }, HFL = ['<1', '1–1.1', '–1.25', '–1.5', '–2', '>2'];
  const fmtP = (k, v) => nf(v, P2[k].d) + (P2[k].u === 'm' ? 'm' : '%');
  return card(`<header><h4>#${p2(o.n)}<small>t+${o.h}h</small></h4>${pill(TA(o.trig))}${clockHTML(180)}</header>
    <div class="obs"><div><span>WETH</span><b>${o.stale ? `<em class="warn">${T('unknown', '未知')}</em>` : nf(o.price, 2)}</b></div><div><span>${T('Utilisation', '利用率')}</span><b class="${o.U > .9 ? 'warn' : ''}">${pct(o.U)}</b></div><div><span>${T('Borrow rate', '借款利率')}</span><b>${nf(o.rate, 1)}%</b></div><div><span>${T('Borrowed', '借款')}</span><b>$${nf(o.debt, 0)}m</b></div><div><span>${T('Bad debt', '坏账')}</span><b class="${o.BD > .01 ? 'bad' : ''}">$${nf(o.BD, 2)}m</b></div></div>
    ${sigHTML(o.sig)}
    <div class="cap"><span>${T('Debt by health factor', '按健康度分布的债')}</span></div>${bars(o.dist, { labels: HFL, H: 58 })}
    <table class="params" id="${id}t">${Object.entries(P2).map(([k, d]) => { const cd = (o.cool[k] || 0) > o.h; return `<tr data-k="${k}" class="${cd ? 'cd' : ''}"><th>${TA(d.n)}</th><td class="cur">${fmtP(k, o.P[k])}</td><td class="st"><button data-d="-1" aria-label="lower">−</button><output>${fmtP(k, o.P[k])}</output><button data-d="1" aria-label="raise">+</button></td><td class="lim">${cd ? `${T('cooling', '冷却')} t+${o.cool[k]}h` : '±' + (d.rel ? d.max * 100 + '%' : d.max + ' pp')}</td></tr>`; }).join('')}</table>
    <div class="switches"><label class="sw"><input type="checkbox" id="${id}f" ${o.frozen ? 'checked' : ''}><i></i><span>${T('Freeze new borrowing', '冻结新增借款')}</span></label><label class="sw"><input type="checkbox" id="${id}g"><i></i><span>${T('Governance channel · takes 5 sim-days · ×10 range', '治理通道 · 5 个模拟日后生效 · 幅度 ×10')}</span></label></div>
    ${noteHTML(id)}
    <footer><button class="btn link" data-x="auto">${T('Let the example agent finish', '交给例子 Agent 跑完')}</button><span class="sp"></span><button class="btn" data-x="abstain">${T('Abstain', '弃权')}</button><button class="btn" data-x="hold">${T('Hold', '保持')}</button><button class="btn solid" data-x="go">${T('Propose', '提交调参')}</button></footer>`, (c, done) => {
    applyLang(c);
    const tb = $(`#${id}t`, c), why = () => $(`#${id}r`, c).value.trim(), gov = () => $(`#${id}g`, c).checked;
    const paint = () => $$('tr', tb).forEach(tr => { const k = tr.dataset.k, d = P2[k], dv = next[k] - o.P[k], lim = (d.rel ? o.P[k] * d.max : d.max) * (gov() ? 10 : 1); $('output', tr).textContent = fmtP(k, next[k]); tr.classList.toggle('ch', Math.abs(dv) > 1e-9); tr.classList.toggle('over', Math.abs(dv) > lim + 1e-9); });
    tb.onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; const k = b.closest('tr').dataset.k, d = P2[k]; next[k] = Math.round((next[k] + +b.dataset.d * (d.rel ? o.P[k] * d.step : d.step)) * 1000) / 1000; paint(); };
    $(`#${id}g`, c).onchange = paint;
    const changes = () => Object.keys(P2).filter(k => Math.abs(next[k] - o.P[k]) > 1e-9).map(k => ({ k, v: next[k] }));
    $('[data-x=hold]', c).onclick = () => done({ type: 'hold', why: why() });
    $('[data-x=abstain]', c).onclick = () => done(why() ? { type: 'abstain', why: why() } : { type: 'error', err: ['abstained without a reason', '弃权却没有写原因'] });
    $('[data-x=go]', c).onclick = () => { const ch = changes(), fz = $(`#${id}f`, c).checked; if (!ch.length && fz === o.frozen) return shake(tb); done({ type: 'plan', ch, freeze: fz === o.frozen ? undefined : fz, gov: gov(), why: why() }); };
    $('[data-x=auto]', c).onclick = () => done({ type: 'auto' });
    runClock(c, 180, done);
    return () => done(policy2(sim));
  }, { cls: 'decide' });
}
const chText = d => { const p = d.ch.map(c => [`${P2[c.k].n[0]} → ${nf(c.v, P2[c.k].d)}`, `${P2[c.k].n[1]} → ${nf(c.v, P2[c.k].d)}`]); if (d.freeze != null) p.push(d.freeze ? ['Freeze borrowing', '冻结借款'] : ['Unfreeze borrowing', '解冻借款']); if (d.gov) p.push(['via governance', '走治理通道']); return [p.map(x => x[0]).join(' · '), p.map(x => x[1]).join(' · ')]; };

/* ───────── stages ───────── */
const TRK = {
  /* 07 ─────────────────────────────────────────── */
  async brief(k) {
    const t = S[k], one = k === 't1';
    UI.idle(['Build', '构建'], LA(TRACK[k].n));
    await say(one ? T('You run <b>$100,000</b> of simulated capital, half USDC and half WETH, across Uniswap V3 and Aave v3. Returns count. Surviving stress counts more.', '你管理 <b>10 万美元</b>模拟资金，一半 USDC、一半 WETH，在 Uniswap V3 与 Aave v3 上运作。收益算分，扛住压力更算分。')
      : T('You are Aave’s risk steward for the <b>WETH and USDC reserves</b>. Every run is paired with the same world left untouched. You score on the difference.', '你是 Aave <b>WETH 与 USDC 储备</b>的风险管理者。每次运行都配一份“参数不变”的同一世界，按两者的差计分。'));
    await card(`<div class="formula">${one ? 'S = r − 0.5 × MDD' : 'S = ΔBD + ΔLP + ΔRV − c·ΔW'}</div>
      ${kv(one ? [[T('Decides', '决定'), T('every simulated hour, plus events', '每个模拟小时，另加事件')], [T('Time per decision', '单次决定用时'), '90 s'], [T('Container', '容器'), '2 vCPU · 4 GiB · 10 GiB'], [T('Model budget', '模型预算'), '$0.30 / ' + L('sim-day', '模拟日') + ' · $0.10 / ' + L('decision', '次')], [T('Hard limits', '硬限'), T('debt ≤ 100% of NAV · swaps ≤ 50% of NAV per plan · 10 positions', '债 ≤ 净值 100% · 每份计划换币 ≤ 净值 50% · 仓位 ≤ 10 个')], [T('Gate', '生存门'), T('liquidation · insolvency · bad debt · >5% missed decisions', '被清算 · 破产 · 坏账 · 超过 5% 的决定缺失')]]
        : [[T('Decides', '决定'), T('every 6 simulated hours, plus events', '每 6 个模拟小时，另加事件')], [T('Time per decision', '单次决定用时'), '180 s'], [T('Container', '容器'), '4 vCPU · 8 GiB · 20 GiB'], [T('Model budget', '模型预算'), '$0.30 / ' + L('sim-day', '模拟日') + ' · $0.15 / ' + L('decision', '次')], [T('Bounds', '幅度'), T('LTV, threshold, bonus ±0.5 pp · rates ±1 pp · caps ±100%', 'LTV、阈值、奖励 ±0.5 个百分点 · 利率 ±1 · 上限 ±100%')], [T('Gate', '生存门'), T('excess bad debt · liquidations you caused · >5% missed decisions', '多出的坏账 · 调参直接引发的清算 · 超过 5% 的决定缺失')]])}`, null, { cls: 'spec' });
    await say(T('Which starter kit?', '用哪个起步包？'));
    const kit = await choose([O('python', 'Python', 'Python'), O('typescript', 'TypeScript', 'TypeScript')], { def: 'python' });
    mark(k, 'kit', kit); t.kit = kit;
    const file = `holobit-starter-${kit}-1.0.tar.gz`, sum = hx(file, 64);
    await term([[`$ curl -LO https://starter.holobit.example/${file}`, 'cmd'], [`  ${kit === 'python' ? '4.1' : '2.8'} MB · interface stub · example agent · 90-day history`, 'dim', 380], [`$ sha256sum ${file}`, 'cmd']]);
    if (await fork('sum', ['Does the checksum match the published one?', '校验和与公布的一致吗？'], { def: 'match' }) === 'mismatch') {
      await say(T(`<code>${short(hx(file + 'x', 64))}</code> is not the published <code>${short(sum)}</code>. Don’t run it. Use the second download address.`, `<code>${short(hx(file + 'x', 64))}</code> 与公布的 <code>${short(sum)}</code> 不符。不要运行它，请用第二个下载地址。`), { cls: 'bad' });
      await choose([O('m', 'Download from the mirror', '从第二地址下载')]);
      await term([[`$ curl -LO https://mirror.holobit.example/${file} && sha256sum ${file}`, 'cmd']]);
    }
    await say(T(`<code>${short(sum)}</code> ✓`, `<code>${short(sum)}</code> ✓`));
    await say(T('Every agent is the same loop: <b>observe → decide → check the result → write the record</b>. Run it by hand before you automate it.', '所有 Agent 都是同一个循环：<b>观察 → 决定 → 核对结果 → 写记录</b>。自动化之前，先手动走一遍。'));
  },

  /* 08 ─────────────────────────────────────────── */
  async loop(k) {
    const t = S[k], one = k === 't1'; let first = true;
    for (;;) {
      await say(first ? T('Eleven scenario families are public. Two more stay hidden until the results. Pick one to practise on.', '11 个情景族是公开的，另有 2 个留出族到结果公布才揭示。挑一个来练。') : T('Pick the next one.', '挑下一个。'));
      const fam = await card(`<div class="fams">${FAM.map(f => `<button data-f="${f.id}"><small>${f.id}</small><span>${TA(f.n)}</span></button>`).join('')}</div>`, (c, done) => {
        c.onclick = e => { const b = e.target.closest('[data-f]'); if (b && !c.classList.contains('done')) { b.classList.add('on'); done(b.dataset.f); } };
        return () => { const b = $(`[data-f=${one ? 'F2' : 'F5'}]`, c); b.classList.add('on'); done(b.dataset.f); };
      }, { cls: 'bare' });
      me(`${fam} · ${TA(FAMS[fam].n)}`);
      if (first) {
        await term([[`→ practice token pt_${hx(S.acct.team + k, 10)}…`, 'dim'], ['POST /v1/practice/units', 'cmd', 300]]);
        if (await fork('token', ['Does the remote interface take the call?', '远程接口接受这次调用吗？'], { def: 'ok' }) === 'limited') {
          await say(T('<code>429</code>. Practice calls are rate limited per team. Retrying after the window.', '<code>429</code>。练习调用按队限速，窗口过后重试。'), { cls: 'warn' });
          await pace(900);
        }
      }
      const seed = seedOf(fam + k + (t.loop ? t.loop.n : 0) + S.acct.team), sim = one ? new Sim1(fam, seed) : new Sim2(fam, seed), view = one ? view1 : view2;
      view(sim);
      await say(T(`Unit open: 48 simulated hours, seed <code>${hx(seed, 8)}</code>. The world waits while you think.`, `单元已开：48 个模拟小时，种子 <code>${hx(seed, 8)}</code>。你思考时，世界停住等你。`));
      let handed = false;
      while (!sim.done) {
        let d = handed ? (one ? policy1(sim) : policy2(sim)) : await (one ? decide1(sim) : decide2(sim));
        if (d.type === 'auto') { handed = true; me(T('Let the example agent finish.', '交给例子 Agent 跑完。')); d = one ? policy1(sim) : policy2(sim); }
        if (!handed) me(d.type === 'plan' ? TA(one ? planText(d.plan) : chText(d)) : d.type === 'hold' ? T('Hold.', '保持。') : d.type === 'abstain' ? T('Abstain', '弃权') + ' · ' + esc(d.why) : d.type === 'timeout' ? '…' : T('Abstain.', '弃权。'));
        if (one && d.type === 'plan') d.plan.forEach(a => { if (a.k === 'lp') a._h = sim.h; });
        const out = sim.decide(d);
        if (one && sim.lp && sim.lp.h0 == null) sim.lp.h0 = out.h;
        mark(k, 'decision', d.type); if (d.type === 'plan') mark(k, 'outcome', out.status);
        UI.logRecord(k, d.type, out.status || '', out.h);
        view(sim);
        if (handed) { await pace(260); continue; }
        const s = out.status && STATUS[out.status];
        const tail = one ? `${T('net value', '净值')} ${usd(out.post.nav)} · ${T('health', '健康度')} ${hfTxt(out.post.hf)}` : `${T('utilisation', '利用率')} ${pct(out.post.U)} · ${T('bad debt', '坏账')} $${nf(out.post.BD, 2)}m <small>(${T('unchanged', '参数不变')} $${nf(out.post.BD0, 2)}m)</small>`;
        await say(`<div class="res">${d.type === 'plan' ? pill(T(s[0], s[1]), s[2]) + (out.why ? ` <span>${TA(out.why)}</span>` : '') + (out.lines ? out.lines.map(l => ` <span>${TA(l)}</span>`).join('') : '') + (one ? ` <small>${out.status === 'rejected' || out.dropped ? T('no gas', '不付 gas') : 'gas ' + usd(out.gas, 2)}</small>` : '')
          : d.type === 'error' ? pill(T('decision error', '决策错误'), 'warn') + ` <span>${TA(d.err)} · ${T('treated as hold and counted', '按保持处理并计数')}</span>`
            : d.type === 'timeout' ? pill(T('timeout', '超时'), 'warn') + ` <span>${T('treated as hold and counted', '按保持处理并计数')}</span>` : pill(d.type === 'hold' ? T('held', '已保持') : T('abstained', '已弃权'))}
          <p>t+${out.h - STEP}h → t+${out.post.h}h · ${tail}</p></div>`, { delay: 420 });
        if (one && out.post.dead) await say({ liquidated: T('Your Aave position was <b>liquidated</b>. The run is a gate failure.', '你的 Aave 仓位<b>被清算</b>。这次运行记为门失败。'), baddebt: T('Your debt now exceeds your assets. <b>Bad debt</b>: a gate failure.', '你的债已超过全部资产。<b>坏账</b>：门失败。'), insolvent: T('Net value fell below 5% of the start. <b>Insolvent</b>: a gate failure.', '净值跌破起点的 5%。<b>破产</b>：门失败。') }[out.post.dead], { cls: 'bad' });
        if (one && out.post.exited) await say(T('You fell more than 5% behind simply holding. The platform <b>forced an exit</b> and stopped waking your agent. It isn’t a gate failure, but it is counted.', '你比原样持有落后超过 5%。平台执行了<b>强制退出</b>，不再叫醒你的 Agent。这不算门失败，但会计数。'), { cls: 'warn' });
      }
      const sc = sim.score(), end = sc.gate ? 'gate' : sc.exited ? 'exit' : 'survived';
      mark(k, 'unit', end); Field.stress(0);
      const GATE = { liquidated: ['liquidated', '被清算'], baddebt: ['bad debt', '坏账'], insolvent: ['insolvent', '破产'], missed: ['over 5% of decisions missed', '超过 5% 的决定缺失'], direct: ['your change triggered liquidations', '调参直接引发清算'] };
      await card(`<header><h4>${fam}<small>${TA(FAMS[fam].n)}</small></h4>${sc.gate ? pill(T('gate failed', '门失败') + ' · ' + TA(GATE[sc.gate]), 'bad') : sc.exited ? pill(T('forced exit', '强制退出'), 'warn') : pill(T('survived', '存活'), 'ok')}</header>
        <div class="bigS ${sc.S < 0 ? 'neg' : ''}"><b>${sgn(sc.S, 0)}</b><span>bps</span></div>
        ${one ? kv([['r', bps(sc.r)], ['MDD', nf(sc.mdd, 0) + ' bps'], [T('vs hold', '相对持有'), bps(sc.dH)], ['Gas', usd(sc.gas, 2)]])
          : `<div class="terms">${[[T('Bad debt avoided', '少出的坏账'), sc.t.bd], [T('Liquidation penalties spared', '少付的清算罚金'), sc.t.lp], [T('Revenue', '协议收入'), sc.t.rv], [T('Withdrawals stuck', '取不出的存款'), sc.t.w]].map(([n, v]) => `<div><span>${n}</span><i class="${v < 0 ? 'neg' : ''}" style="--v:${clamp(Math.abs(v) / Math.max(.02, Math.abs(sc.t.bd), Math.abs(sc.t.lp), Math.abs(sc.t.rv)) * 100, 1, 100)}%"></i><b>${sgn(v * 1e6 / 1e3, 0)}k</b></div>`).join('')}</div>`}
        ${sim.w.dud && fam !== 'F0' ? `<p class="hint">${T('The alarm fired. The event never came. A third to a half of units are like this.', '信号来了，事件没来。每族有三到五成的单元是这样。')}</p>` : ''}`, null, { cls: 'score' });
      t.loop = { fam, S: Math.round(sc.S), gate: sc.gate, n: (t.loop ? t.loop.n : 0) + 1, best: Math.max(Math.round(sc.S), t.loop ? t.loop.best : -1e9) };
      first = false;
      if (await choose([O('next', 'Package the agent', '去打包 Agent'), O('again', 'Another unit', '再练一个单元')], { def: 'next' }) === 'next') break;
    }
  },
};
