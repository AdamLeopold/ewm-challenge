'use strict';
/* Models and experiments. A model is a template with its parameters and seed; every run and every chart is recomputed from those.
   A thread holds one model (its canvas, parameters and runs) and the experiments made on it. */
const Models = (() => {
  const P = (k, n, v, min, max, step, u = '', d = 0) => ({ k, n, v, min, max, step, u, d });
  const fx = (p, v) => p.opts ? LA(p.opts.find(o => o[0] === v)[1]) : nf(v, p.d) + p.u;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  const TPL = [
    { id: 'amm', tag: ['DeFi', 'DeFi'], n: ['AMM with arbitrage', '带套利的 AMM'], ask: ['Do fees pay liquidity providers for what arbitrage takes?', '手续费补得上套利从 LP 手里拿走的吗？'],
      rx: /\bamm\b|swap|uniswap|arbitrag|liquidity pool|impermanent|做市|套利|流动性池/i, ticks: 240, tick: ['hour', '小时'],
      nodes: [['lp', 'agent', ['Liquidity providers', '流动性提供者'], 20, ['Hold the pool’s two assets and earn its fees.', '持有池中两种资产，赚取手续费。'], ['depth']], ['noise', 'agent', ['Noise traders', '噪声交易者'], 200, ['Trade for their own reasons, in both directions.', '出于各自的原因双向交易。'], ['flow']], ['arb', 'agent', ['Arbitrageurs', '套利者'], 3, ['Trade whenever the pool price leaves the market price by more than the fee.', '池价偏离市价超过手续费时出手。'], ['lag']],
        ['pool', 'cell', ['Pool · x·y = k', '资金池 · x·y = k'], 1, ['A constant-product pool of WETH and USDC.', 'WETH 与 USDC 的恒定乘积池。'], ['fee', 'depth']], ['mkt', 'var', ['Market price', '市场价'], 0, ['A random walk with the volatility you set.', '按设定波动率随机游走。'], ['vol']], ['fee', 'var', ['Fee', '手续费'], 0, ['Charged on every swap, paid to liquidity providers.', '每笔换币收取，付给流动性提供者。'], ['fee']]],
      edges: [['lp', 'pool', ['provide', '注入']], ['noise', 'pool', ['swap', '换币']], ['arb', 'pool', ['arbitrage', '套利']], ['mkt', 'arb', ['observe', '观察']], ['fee', 'pool', ['', '']]],
      params: [P('fee', ['Fee', '手续费'], 30, 5, 100, 5, ' bps'), P('depth', ['Pool depth', '池子深度'], 10, 1, 50, 1, ' $m'), P('vol', ['Daily volatility', '日波动率'], 4, 1, 10, .5, '%', 1), P('flow', ['Noise flow per hour', '每小时噪声交易量'], 120, 10, 500, 10, ' $k'), P('lag', ['Arbitrage latency', '套利延迟'], 1, 1, 12, 1, ' h')],
      metrics: [['lp', ['LP vs holding', 'LP 相对持有'], v => bps(v), 1], ['fees', ['Fees earned', '手续费收入'], v => '$' + nf(v, 1) + 'k', 1], ['arb', ['Arbitrage profit', '套利利润'], v => '$' + nf(v, 1) + 'k', -1], ['gap', ['Mean price gap', '平均价差'], v => nf(v, 1) + ' bps', -1]],
      charts: [{ n: ['Pool price · market price', '池价 · 市价'], s: [['m', 'var(--mut)', 1], ['p', 'var(--acc)']], fmt: x => nf(x, 0) }, { n: ['LP value vs holding', 'LP 价值相对持有'], s: [['lp', 'var(--acc)']], fmt: x => sgn(x, 2) + '%', zero: 0 }],
      sim(q, seed, N) {
        const r = rng(seed), fee = q.fee / 1e4, sig = q.vol / 100 / Math.sqrt(24);
        let m = 3000, y = q.depth * 5e5, x = y / m, fees = 0, arb = 0, gap = 0; const x0 = x, y0 = y, o = { m: [m], p: [m], lp: [0] };
        for (let t = 1; t <= N; t++) {
          m *= Math.exp(sig * r.g());
          for (let i = 1 + Math.floor(r() * 3); i > 0; i--) {
            const usd = q.flow * 1e3 * Math.abs(r.g()) * .5 * Math.exp((30 - q.fee) / 40); fees += usd * fee;      // traders go elsewhere as the fee rises
            if (r() < .5) { const dy = usd * (1 - fee), nx = x * y / (y + dy); x = nx; y += dy; } else { const dx = usd / (y / x) * (1 - fee), ny = x * y / (x + dx); x += dx; y = ny; }
          }
          if (t % q.lag === 0) {
            const p = y / x, k = x * y;
            if (p < m * (1 - fee)) { const ny = Math.sqrt(k * m * (1 - fee)), nx = k / ny, pay = (ny - y) / (1 - fee); arb += (x - nx) * m - pay; fees += pay * fee; x = nx; y = ny; }
            else if (p > m * (1 + fee)) { const ny = Math.sqrt(k * m * (1 + fee)), nx = k / ny, pay = (nx - x) / (1 - fee) * m; arb += (y - ny) - pay; fees += pay * fee; x = nx; y = ny; }
          }
          const p = y / x; gap += Math.abs(p / m - 1);
          o.m.push(m); o.p.push(p); o.lp.push(((x * m + y + fees) / (x0 * m + y0) - 1) * 100);
        }
        return { series: o, m: { lp: o.lp[N] * 100, fees: fees / 1e3, arb: arb / 1e3, gap: gap / N * 1e4 } };
      } },
    { id: 'lend', tag: ['DeFi', 'DeFi'], n: ['Lending market under stress', '压力下的借贷市场'], ask: ['How much bad debt does a liquidation cascade leave behind?', '一轮清算连锁会留下多少坏账？'],
      rx: /lend|aave|compound|borrow|liquidat|bad debt|bank run|collateral|借贷|清算|坏账|挤兑/i, ticks: 48, tick: ['hour', '小时'],
      nodes: [['dep', 'agent', ['Depositors', '存款人'], 1200, ['Supply USDC and withdraw it when they need to.', '存入 USDC，需要时取出。'], []], ['bor', 'agent', ['Borrowers', '借款人'], 480, ['Borrow USDC against WETH, spread across health factors.', '以 WETH 抵押借 USDC，分布在不同健康度上。'], ['lt']], ['liq', 'agent', ['Liquidators', '清算人'], 8, ['Repay unhealthy debt for the bonus, when the bonus covers their slippage.', '当奖励盖过滑点时，替不健康的债还款并拿走奖励。'], ['bonus']],
        ['res', 'cell', ['USDC reserve', 'USDC 储备'], 1, ['Supply, debt and the interest-rate curve between them.', '存款、借款，以及两者之间的利率曲线。'], ['s2', 'uopt']], ['orc', 'var', ['Oracle price', '预言机价格'], 0, ['WETH price, following the scenario you choose.', 'WETH 价格，按所选情景变化。'], ['fam']], ['thr', 'var', ['Liquidation threshold', '清算阈值'], 0, ['Where a position becomes liquidatable.', '仓位可被清算的界线。'], ['lt']]],
      edges: [['dep', 'res', ['supply', '存入']], ['bor', 'res', ['borrow', '借出']], ['liq', 'bor', ['liquidate', '清算']], ['orc', 'bor', ['health', '健康度']], ['thr', 'bor', ['', '']]],
      params: [{ k: 'fam', n: ['Scenario', '情景'], v: 'F5', opts: ['F0', 'F2', 'F4', 'F5', 'F9', 'F10'].map(f => [f, FAMS[f].n]) }, P('lt', ['Liquidation threshold', '清算阈值'], 83, 78, 88, .5, '%', 1), P('bonus', ['Liquidation bonus', '清算奖励'], 5, 2, 10, .5, '%', 1), P('s2', ['Rate slope above optimal', '最优点以上的利率斜率'], 60, 20, 120, 10, '%'), P('uopt', ['Optimal utilisation', '最优利用率'], 90, 70, 95, 1, '%')],
      metrics: [['bd', ['Bad debt', '坏账'], v => '$' + nf(v, 2) + 'm', -1], ['liq', ['Liquidated', '已清算'], v => '$' + nf(v, 1) + 'm', -1], ['rv', ['Protocol revenue', '协议收入'], v => '$' + nf(v, 1) + 'k', 1], ['peak', ['Peak utilisation', '利用率峰值'], v => nf(v, 1) + '%', -1]],
      charts: [{ n: ['Utilisation', '利用率'], s: [['U', 'var(--acc)']], fmt: x => nf(x, 1) + '%' }, { n: ['Bad debt', '坏账'], s: [['BD', 'var(--bad)']], fmt: x => '$' + nf(x, 1) + 'm' }, { n: ['WETH', 'WETH'], s: [['px', 'var(--mut)']], fmt: x => nf(x, 0) }],
      sim(q, seed, N) {
        let sd = seed; for (let i = 0; i < 40 && q.fam !== 'F0' && genWorld(q.fam, sd).dud; i++) sd++;      // a stress scenario where the stress arrives
        const w = new World2(q.fam, sd), px = [w.p]; Object.assign(w.P, { lt: q.lt, bonus: q.bonus, s2: q.s2, uopt: q.uopt });
        for (let h = 0; h < N; h++) { w.hour(); px.push(w.p); }
        return { series: { U: w.hist.map(x => x.U * 100), BD: w.hist.map(x => x.BD), px }, m: { bd: w.BD, liq: w.liq, rv: w.RV * 1e3, peak: Math.max(...w.hist.map(x => x.U)) * 100 } };
      } },
    { id: 'sir', tag: ['Systems', '系统'], n: ['Epidemic on a grid', '网格上的传染'], ask: ['How fast does it spread, and how many does it reach?', '传播有多快，最终波及多少人？'],
      rx: /\bsir\b|epidemi|infect|contagio|virus|disease|spread of|rumou?r|传染|疫情|病毒|扩散|谣言/i, ticks: 120, tick: ['day', '天'],
      nodes: [['ppl', 'agent', ['People', '人群'], 600, ['Susceptible, infected or recovered. One per cell.', '易感、感染或康复。每格一人。'], ['beta', 'gamma', 'i0']], ['grid', 'cell', ['Grid 30 × 20', '网格 30 × 20'], 600, ['Each person meets their four neighbours every day.', '每人每天接触四个邻居。'], []], ['far', 'link', ['Distant contacts', '远距离接触'], 0, ['Now and then, someone meets a stranger from anywhere on the grid.', '偶尔会接触网格上任意位置的陌生人。'], ['mix']],
        ['beta', 'var', ['Transmission', '传染率'], 0, ['Chance of infection per infected contact per day.', '每天每个感染接触带来的感染概率。'], ['beta']], ['gamma', 'var', ['Recovery', '康复率'], 0, ['Chance an infected person recovers each day.', '感染者每天康复的概率。'], ['gamma']]],
      edges: [['ppl', 'grid', ['live on', '位于']], ['ppl', 'far', ['meet', '接触']], ['beta', 'ppl', ['infect', '感染']], ['gamma', 'ppl', ['recover', '康复']]],
      params: [P('beta', ['Transmission', '传染率'], .12, .02, .4, .01, '', 2), P('gamma', ['Recovery', '康复率'], .08, .02, .3, .01, '', 2), P('mix', ['Distant contacts', '远距离接触'], .05, 0, .3, .01, '', 2), P('i0', ['Initially infected', '初始感染人数'], 3, 1, 20, 1)],
      metrics: [['attack', ['Ever infected', '累计感染'], v => nf(v, 1) + '%', -1], ['peak', ['Peak infected', '感染峰值'], v => nf(v, 1) + '%', -1], ['pt', ['Day of peak', '峰值出现日'], v => nf(v, 0), 1], ['r0', ['Contacts × transmission ÷ recovery', '接触 × 传染 ÷ 康复'], v => nf(v, 1), -1]],
      charts: [{ n: ['Susceptible · infected · recovered', '易感 · 感染 · 康复'], s: [['s', 'var(--mut)', 1], ['r', 'var(--t2)'], ['i', 'var(--bad)']], fmt: x => nf(x, 0) + '%' }],
      sim(q, seed, N) {
        const r = rng(seed), W = 30, H = 20, n = W * H; let g = new Uint8Array(n), peak = 0, pt = 0;
        for (let i = 0; i < q.i0; i++) g[Math.floor(r() * n)] = 1;
        const o = { s: [], i: [], r: [] }, frames = [], push = t => { const c = [0, 0, 0]; for (const v of g) c[v]++; o.s.push(c[0] / n * 100); o.i.push(c[1] / n * 100); o.r.push(c[2] / n * 100); if (c[1] > peak) { peak = c[1]; pt = t; } frames.push(g); };
        push(0);
        for (let t = 1; t <= N; t++) {
          const nx = g.slice();
          for (let k = 0; k < n; k++) {
            if (g[k] === 1) { if (r() < q.gamma) nx[k] = 2; continue; } if (g[k] === 2) continue;
            const x = k % W, y = (k / W) | 0; let inf = (x > 0 && g[k - 1] === 1) + (x < W - 1 && g[k + 1] === 1) + (y > 0 && g[k - W] === 1) + (y < H - 1 && g[k + W] === 1);
            if (r() < q.mix && g[Math.floor(r() * n)] === 1) inf++;
            if (inf && r() < 1 - Math.pow(1 - q.beta, inf)) nx[k] = 1;
          }
          g = nx; push(t);
        }
        return { series: o, frames, grid: [W, H], m: { attack: o.i[N] + o.r[N], peak: peak / n * 100, pt, r0: q.beta * 4 / q.gamma } };
      } },
    { id: 'curve', tag: ['Memecoins', 'Memecoins'], n: ['Bonding curve launch', 'Bonding Curve 发行'], ask: ['Who is left holding when sentiment turns?', '情绪反转时，谁还握着筹码？'],
      rx: /bonding|curve|token launch|memecoin|meme|pump|mint|发行|曲线|代币发行|土狗/i, ticks: 200, tick: ['step', '步'],
      nodes: [['trd', 'agent', ['Traders', '交易者'], 120, ['Buy when the mood and the trend are with them, sell when they aren’t. A sell tax makes them slower to do either.', '情绪与趋势向好时买入，反之卖出。卖出税让他们两头都更迟疑。'], ['traders', 'hype']], ['crv', 'cell', ['Bonding curve', 'Bonding Curve'], 1, ['Mints and burns at a price set by supply alone.', '铸造与销毁的价格只由供应量决定。'], ['n', 'tax']],
        ['rsv', 'var', ['Reserve', '储备'], 0, ['What buyers paid in, less what sellers took out.', '买入付进来的，减去卖出取走的。'], []], ['mood', 'var', ['Sentiment', '情绪'], 0, ['Drifts with hype and wanders on its own.', '随热度漂移，也自己游走。'], ['hype']], ['tax', 'var', ['Sell tax', '卖出税'], 0, ['Kept in the reserve on every sale.', '每次卖出时留在储备里。'], ['tax']]],
      edges: [['trd', 'crv', ['mint · burn', '铸造 · 销毁']], ['crv', 'rsv', ['fund', '注入']], ['mood', 'trd', ['sway', '左右']], ['tax', 'crv', ['', '']]],
      params: [P('n', ['Curve exponent', '曲线指数'], 2, 1, 3, .25, '', 2), P('tax', ['Sell tax', '卖出税'], 5, 0, 20, 1, '%'), P('traders', ['Traders', '交易者'], 120, 20, 400, 20), P('hype', ['Hype', '热度'], .3, -1, 1, .1, '', 1)],
      metrics: [['dd', ['Fall from the peak', '自峰值回落'], v => nf(v, 1) + '%', -1], ['price', ['Final price', '最终价格'], v => '$' + nf(v, 3), 1], ['win', ['Holders in profit', '盈利的持有者'], v => nf(v, 0) + '%', 1], ['gini', ['Holding inequality', '持仓不均度'], v => nf(v, 2), -1]],
      charts: [{ n: ['Price', '价格'], s: [['price', 'var(--acc)']], fmt: x => '$' + nf(x, 2) }, { n: ['Reserve', '储备'], s: [['reserve', 'var(--t2)']], fmt: x => '$' + nf(x, 0) }],
      sim(q, seed, N) {
        const r = rng(seed), T = q.traders, a = .1 / Math.pow(1000, q.n), cost = (s0, s1) => a / (q.n + 1) * (Math.pow(s1, q.n + 1) - Math.pow(s0, q.n + 1));
        let s = 1000, reserve = cost(0, s), mood = 0, peak = 0; const hold = new Float64Array(T), paid = new Float64Array(T), o = { price: [], reserve: [] };
        for (let t = 0; t <= N; t++) {
          if (t) {
            mood = clamp(mood * .94 + r.g() * .18 + q.hype * .03, -1, 1);
            const up = o.price[t - 1] > o.price[Math.max(0, t - 6)];
            for (let i = 0; i < T; i++) {
              if (r() > .12) continue;
              if (r() < .5 + mood * .35 + (up ? .08 : -.08) - q.tax * .006) { const d = 5 + r() * 40, c = cost(s, s + d); s += d; reserve += c; hold[i] += d; paid[i] += c; }
              else if (hold[i] > 0 && r() > q.tax * .02) { const d = hold[i] * (.3 + r() * .7), back = cost(s - d, s) * (1 - q.tax / 100); s -= d; reserve -= back; hold[i] -= d; paid[i] -= back; }
            }
          }
          const p = a * Math.pow(s, q.n); peak = Math.max(peak, p); o.price.push(p); o.reserve.push(reserve);
        }
        const p = o.price[N], vals = [...hold].map(h => h * p).sort((x, y) => x - y), tot = vals.reduce((x, y) => x + y, 0) || 1; let cum = 0, gin = 0; vals.forEach(v => { cum += v; gin += cum; });
        const held = [...hold].filter(h => h > 0).length || 1, win = [...hold].filter((h, i) => h > 0 && h * p * (1 - q.tax / 100) > paid[i]).length;
        return { series: o, m: { dd: (1 - p / peak) * 100, price: p, win: win / held * 100, gini: clamp(1 - 2 * gin / (T * tot) + 1 / T, 0, 1) } };
      } },
  ];
  const tplOf = id => TPL.find(t => t.id === id), of = m => tplOf(m.tpl);
  const defaults = t => Object.fromEntries(t.params.map(p => [p.k, p.v]));
  const count = t => t.nodes.reduce((s, n) => s + 1, 0) + t.edges.length + t.charts.length;
  const run1 = (m, q = m.P, seed = m.seed) => of(m).sim(q, seed, of(m).ticks);
  const metricsHTML = (t, mm, prev) => UI.kv(t.metrics.map(([k, n, f]) => [TA(n), f(mm[k]) + (prev && Math.abs(mm[k] - prev[k]) > 1e-9 ? ` <small>${T('was', '此前')} ${f(prev[k])}</small>` : '')]));
  const live = {};                                             // model id → { R, tick, timer } while a run is on screen

  /* ── conversation ── */
  const turn = (t, label, fn) => Flow.sideflow(t.id, async () => { if (label) me(label); UI.suggest(t.id, []); await fn(); App.touch(t.id); });
  const match = s => { const t = TPL.find(x => x.rx.test(s)); return t && /model|simulat|build|stress|run|what if|how (much|fast|many)|建模|模拟|搭|仿真|压力|跑/i.test(s) || t && s.length < 40 ? t.id : null; };
  const SUG = { built: m => [{ do: 'm:run', t: [`Run ${of(m).ticks} ticks`, `运行 ${of(m).ticks} 个 tick`] }, { do: 'm:exp', t: ['Set up an experiment', '做一个实验'] }], ran: () => [{ do: 'm:exp', t: ['Set up an experiment', '做一个实验'] }, { do: 'lib:draft', t: ['Draft an insight', '起草一篇洞见'] }, { do: 'lib:publish', t: ['Publish to Marketplace', '发布到市场'] }] };

  function start(id, text, preset) {
    const tp = tplOf(id); if (!tp) return;
    const v = UI.vis, here = v && App.thread(v.id), empty = here && here.kind === 'chat' && !here.model && !$('.msg', v.el);
    const t = empty ? here : App.make('chat', tp.n); t.title = preset && preset.name ? preset.name : tp.n; t.tpl = id; t.preset = preset || null;
    App.open(t.id);
    turn(t, esc(text || LA(tp.ask)), async () => {
      const by = k => tp.nodes.filter(n => n[1] === k).map(n => `<li><b>${TA(n[2])}</b>${n[3] > 1 ? `<small>× ${nf(n[3])}</small>` : ''}</li>`).join('');
      await say(preset ? T(`Forked <b>${esc(LA(preset.name))}</b> into your workspace. This is what it is made of.`, `已把 <b>${esc(preset.name[1])}</b> Fork 到你的工作区。它由这些部分组成。`) : T('Here is how I’d model it.', '我会这样建模。'));
      await say(`<div class="card plan-c done"><header><h4>${TA(tp.n)}</h4><small>${count(tp)} ${L('components', '个组件')} · ${tp.ticks} ticks</small></header><div class="plan-g"><div><h6>${T('Agents', 'Agent')}</h6><ul>${by('agent')}</ul></div><div><h6>${T('Space', '空间')}</h6><ul>${by('cell')}${by('link')}</ul></div><div><h6>${T('Variables', '变量')}</h6><ul>${by('var')}</ul></div></div><p class="hint">${tp.edges.filter(e => e[2][0]).map(e => LA(e[2])).join(' · ')}</p></div>`, { cls: 'wide', delay: 380 });
      UI.suggest(t.id, [{ do: 'm:build', t: preset ? ['Open it', '打开'] : ['Build it', '就这样搭'] }]);
    });
  }
  function build(t) {
    const tp = tplOf(t.tpl), pre = t.preset || {};
    return turn(t, T(pre.name ? 'Open it.' : 'Build it.', pre.name ? '打开。' : '就这样搭。'), async () => {
      await term([[T(`${tp.nodes.filter(n => n[1] !== 'var').length} entities placed on the root canvas`, `在根画布上放置 ${tp.nodes.filter(n => n[1] !== 'var').length} 个实体`), '', 320], [T(`${tp.edges.length} processes wired`, `连接 ${tp.edges.length} 个流程`), '', 320], [T(`${tp.params.length} parameters and ${tp.charts.length} charts bound`, `绑定 ${tp.params.length} 个参数与 ${tp.charts.length} 张图表`), '', 320]]);
      const id = 'm' + (++S.n), m = S.models[id] = { id, tpl: tp.id, name: t.title, P: { ...defaults(tp), ...pre.P }, seed: pre.seed || 1000 + Math.floor(Math.random() * 9000), runs: [], at: Date.now(), from: pre.from || null };
      t.model = id; t.mode = 'model'; delete t.preset; save(); App.tabs(); App.bar(); UI.tab('canvas');
      await say(T('It’s on the canvas. Select anything there to see what it does.', '已经在画布上了。点选任何一项可以看它做什么。'));
      UI.suggest(t.id, SUG.built(m));
    });
  }
  /* run the model; `why` is the sentence that leads the result */
  function run(t, label, why) {
    const m = S.models[t.model], tp = of(m);
    return turn(t, label, async () => {
      const prev = m.runs[0], R = run1(m);
      UI.tab('canvas'); await animate(m, R);
      m.runs.unshift({ n: (prev ? prev.n : 0) + 1, at: Date.now(), P: { ...m.P }, seed: m.seed, m: R.m }); m.runs.length = Math.min(m.runs.length, 12); save(); pane(UI.vis && UI.vis.tab, t);
      const [k, n, f, good] = tp.metrics[0], d = prev ? R.m[k] - prev.m[k] : 0;
      await say((why || '') + T(`${tp.ticks} ticks. <b>${n[0]}: ${f(R.m[k])}</b>${prev && Math.abs(d) > 1e-9 ? (d * good > 0 ? ', better than the last run.' : ', worse than the last run.') : '.'}`, `${tp.ticks} 个 tick。<b>${n[1]}：${f(R.m[k])}</b>${prev && Math.abs(d) > 1e-9 ? (d * good > 0 ? '，比上一次好。' : '，比上一次差。') : '。'}`));
      await say(`<div class="card done res-c">${tp.charts.slice(0, 1).map(c => `<div class="cap"><span>${TA(c.n)}</span></div>` + draw(tp, c, R, tp.ticks, 1)).join('')}${metricsHTML(tp, R.m, prev && prev.m)}</div>`, { cls: 'wide', delay: 300 });
      UI.suggest(t.id, SUG.ran());
    });
  }
  const draw = (tp, c, R, upto, wide) => chart({ W: wide ? 580 : 360, series: c.s.map(([k, col, dash]) => ({ d: R.series[k].slice(0, upto + 1), c: col, dash, w: dash ? 1 : 1.8, fill: !dash && c.s.length === 1 })), xmax: tp.ticks, fmt: c.fmt, zero: c.zero, H: wide ? 150 : 118, xstep: tp.ticks / 4, xfmt: h => String(h) });

  /* ── experiment: parameter exploration ── */
  const steps = p => p.opts ? p.opts.map(o => o[0]) : Array.from({ length: 6 }, (_, i) => +(p.min + (p.max - p.min) * i / 5).toFixed(4)).map(v => +(Math.round(v / p.step) * p.step).toFixed(4)).filter((v, i, a) => a.indexOf(v) === i);
  function explore(m, pk) {
    const tp = of(m), p = tp.params.find(x => x.k === pk), vals = steps(p);
    const rows = sweep(tp, m.P, pk, vals, m.seed);
    const id = 'e' + (++S.n), prevN = Object.values(S.exps).filter(e => e.model === m.id).length;
    return S.exps[id] = { id, model: m.id, n: prevN + 1, param: pk, metric: tp.metrics[0][0], rows, at: Date.now(), base: { ...m.P } };
  }
  const SEEDS = 8;
  function sweep(tp, base, pk, vals, seed) { return vals.map(v => { const rs = Array.from({ length: SEEDS }, (_, i) => tp.sim({ ...base, [pk]: v }, seed + i * 7919, tp.ticks).m); return { v, m: Object.fromEntries(tp.metrics.map(([k]) => [k, avg(rs.map(r => r[k]))])) }; }); }
  const exps = mid => Object.values(S.exps).filter(e => e.model === mid).sort((a, b) => b.at - a.at);
  const best = (tp, e, mk = e.metric) => { const g = tp.metrics.find(x => x[0] === mk)[3]; return e.rows.reduce((a, b) => (b.m[mk] - a.m[mk]) * g > 0 ? b : a); };
  function expChart(tp, e, mk = e.metric, wide) {
    const p = tp.params.find(x => x.k === e.param), mt = tp.metrics.find(x => x[0] === mk);
    return chart({ series: [{ d: e.rows.map(r => r.m[mk]), c: 'var(--acc)', w: 1.8, fill: 1 }], xmax: e.rows.length - 1, xstep: 1, xfmt: i => fx(p, e.rows[i].v).trim(), fmt: mt[2], W: wide ? 580 : 360, H: wide ? 160 : 132, pad: [12, 64, 16, 4] });
  }
  /* what the numbers say, in sentences made from the numbers */
  function reading(tp, e) {
    const p = tp.params.find(x => x.k === e.param), [k, n, f, g] = tp.metrics.find(x => x[0] === e.metric), b = best(tp, e), w = e.rows.reduce((a, c) => (c.m[k] - a.m[k]) * g < 0 ? c : a);
    const first = e.rows[0].m[k], last = e.rows[e.rows.length - 1].m[k], edge = b === e.rows[0] || b === e.rows[e.rows.length - 1], mono = e.rows.every((r, i) => !i || (r.m[k] - e.rows[i - 1].m[k]) * (last - first) >= -1e-9) && !p.opts;
    const o = tp.metrics[1], ob = b.m[o[0]], ow = w.m[o[0]];
    return [
      [`<b>${n[0]}</b> is best at <b>${p.n[0]} ${fx(p, b.v)}</b>: ${f(b.m[k])}, against ${f(w.m[k])} at ${fx(p, w.v)}.`, `<b>${n[1]}</b>在<b>${p.n[1]} ${fx(p, b.v)}</b>时最好：${f(b.m[k])}；在 ${fx(p, w.v)} 时为 ${f(w.m[k])}。`],
      mono ? [`It moves one way across the whole range, so the answer is at the edge of the range.`, `它在整个范围内单向变化，所以答案在范围的边上。`] : edge ? [`The best value is at the edge of the range, though the way there is not a straight line.`, `最优值在范围的边上，不过一路过去并不是一条直线。`] : [`The best value sits inside the range, with worse results on both sides of it.`, `最优值在范围内部，两侧的结果都更差。`],
      [`The same choice moves <b>${o[1][0]}</b> from ${o[2](ow)} to ${o[2](ob)}.`, `同一选择让<b>${o[1][1]}</b>从 ${o[2](ow)} 变为 ${o[2](ob)}。`],
    ];
  }
  function experiment(t, pk, label) {
    const m = S.models[t.model], tp = of(m), p = tp.params.find(x => x.k === pk);
    return turn(t, label, async () => {
      await term([[T(`Parameter exploration · ${p.n[0]} · ${steps(p).length} values × ${SEEDS} seeds`, `参数探索 · ${p.n[1]} · ${steps(p).length} 个取值 × ${SEEDS} 个种子`), '', 360], [T(`${steps(p).length * SEEDS} runs of ${tp.ticks} ticks`, `${steps(p).length * SEEDS} 次运行，每次 ${tp.ticks} 个 tick`), '', 520]]);
      const e = explore(m, pk), b = best(tp, e); t.mode = 'exp'; save(); App.tabs(); UI.tab('dash');
      await say(`<div class="card done res-c"><header><h4>${T('Experiment', '实验')} ${e.n}<small>${TA(p.n)}</small></h4></header><div class="cap"><span>${TA(tp.metrics[0][1])}</span></div>${expChart(tp, e, e.metric, 1)}<ul class="read">${reading(tp, e).map(r => `<li>${TA(r)}</li>`).join('')}</ul></div>`, { cls: 'wide', delay: 320 });
      UI.suggest(t.id, [{ do: `m:set:${pk}=${b.v}`, t: [`Set ${p.n[0]} to ${fx(p, b.v)}`, `把${p.n[1]}设为 ${fx(p, b.v)}`] }, { do: 'm:exp', t: ['Vary another parameter', '换一个参数'] }, { do: 'lib:draft', t: ['Draft an insight', '起草一篇洞见'] }]);
    });
  }
  const askWhich = t => turn(t, T('Set up an experiment.', '做一个实验。'), async () => { const tp = of(S.models[t.model]); await say(T('Which parameter should it explore? Everything else stays as it is.', '探索哪个参数？其余保持不变。')); UI.suggest(t.id, tp.params.map(p => ({ do: 'm:exp:' + p.k, t: p.n }))); });

  /* typed requests inside a model thread */
  function ask(t, s) {
    const m = S.models[t.model]; if (!m) { if (t.tpl && /build|go|yes|ok|好|搭|开始/i.test(s)) { build(t); return true; } return false; }
    const tp = of(m), low = s.toLowerCase(), hit = tp.params.find(p => p.n.some(x => low.includes(x.toLowerCase())) || low.includes(p.k)), num = (s.match(/-?\d+(?:\.\d+)?/) || [])[0];
    if (/experiment|explore|sweep|vary|compare|what if|sensitiv|实验|探索|对比|如果/i.test(s)) { hit ? experiment(t, hit.k, esc(s)) : askWhich(t); return true; }
    if (hit && num != null && !hit.opts) { setParam(t, hit.k, +num, esc(s)); return true; }
    if (hit && hit.opts) { const o = hit.opts.find(o => low.includes(o[0].toLowerCase()) || o[1].some(x => low.includes(x.toLowerCase()))); if (o) { setParam(t, hit.k, o[0], esc(s)); return true; } }
    if (/\brun\b|again|re-?run|simulate|运行|再跑|跑一/i.test(s)) { run(t, esc(s)); return true; }
    if (/seed|种子/i.test(s)) { m.seed = 1000 + Math.floor(Math.random() * 9000); save(); run(t, esc(s), T(`New seed <code>${m.seed}</code>. `, `新种子 <code>${m.seed}</code>。`)); return true; }
    if (/reset|default|重置|默认/i.test(s)) { m.P = defaults(tp); save(); run(t, esc(s), T('Back to the defaults. ', '已恢复默认值。')); return true; }
    if (/publish|market|list it|上架|发布/i.test(s)) { Library.act('publish'); return true; }
    if (/insight|report|write.?up|洞见|报告|写/i.test(s)) { Library.act('draft'); return true; }
    if (/explain|what is|what does|how does|canvas|describe|解释|是什么|怎么/i.test(s)) {
      const n = tp.nodes.find(x => x[2].some(y => low.includes(y.toLowerCase().split(' ')[0])));
      turn(t, esc(s), () => say(n ? `<b>${TA(n[2])}</b> · ${TA(n[4])}` : tp.nodes.filter(x => x[1] !== 'var').map(x => `<b>${TA(x[2])}</b> · ${TA(x[4])}`).join('<br>'))); return true;
    }
    return false;
  }
  function setParam(t, k, v, label) {
    const m = S.models[t.model], tp = of(m), p = tp.params.find(x => x.k === k);
    if (!p.opts) v = +clamp(Math.round(v / p.step) * p.step, p.min, p.max).toFixed(4);
    const was = m.P[k]; m.P[k] = v; save();
    run(t, label, T(`<b>${p.n[0]}</b> ${fx(p, was)} → ${fx(p, v)}. `, `<b>${p.n[1]}</b> ${fx(p, was)} → ${fx(p, v)}。`));
  }
  function act(a) {
    const t = App.thread(UI.vis && UI.vis.id); if (!t) return;
    const [verb, arg] = a.split(/:(.*)/s);
    if (verb === 'build') build(t);
    else if (verb === 'run') run(t, T('Run it.', '运行。'));
    else if (verb === 'exp') arg ? experiment(t, arg, TA(of(S.models[t.model]).params.find(p => p.k === arg).n)) : askWhich(t);
    else if (verb === 'set') { const [k, v] = arg.split('='), p = of(S.models[t.model]).params.find(x => x.k === k); setParam(t, k, p.opts ? v : +v, T(`Set ${p.n[0]} to ${fx(p, p.opts ? v : +v)}.`, `把${p.n[1]}设为 ${fx(p, p.opts ? v : +v)}。`)); }
  }

  /* ── side panel ── */
  function canvasSVG(tp, sel) {
    const col = { agent: 0, cell: 1, link: 1, var: 2 }, cols = [[], [], []]; tp.nodes.forEach(n => cols[col[n[1]]].push(n));
    const W = 344, bw = 100, bh = 40, H = Math.max(...cols.map(c => c.length)) * 62 + 14, pos = {};
    cols.forEach((c, ci) => c.forEach((n, i) => { pos[n[0]] = [4 + ci * 118, 12 + (H - 24 - c.length * bh) / (c.length + 1) * (i + 1) + i * bh]; }));
    const edge = ([a, b, lab]) => { const A = pos[a], B = pos[b], l2r = A[0] < B[0], x1 = A[0] + (l2r ? bw : 0), x2 = B[0] + (l2r ? 0 : bw), y1 = A[1] + bh / 2, y2 = B[1] + bh / 2, same = A[0] === B[0];
      const d = same ? `M${A[0] + bw / 2} ${A[1] + (A[1] < B[1] ? bh : 0)} L${B[0] + bw / 2} ${B[1] + (A[1] < B[1] ? 0 : bh)}` : `M${x1} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
      return `<path d="${d}" class="e"/>` + (LA(lab) ? `<text x="${same ? A[0] + bw / 2 + 6 : (x1 + x2) / 2}" y="${same ? (A[1] + B[1] + bh) / 2 + 3 : (y1 + y2) / 2 - 4}" text-anchor="${same ? 'start' : 'middle'}" class="el">${LA(lab)}</text>` : ''); };
    return `<svg class="cv" viewBox="0 0 ${W} ${H}" role="img">${tp.edges.map(edge).join('')}${tp.nodes.map(n => { const [x, y] = pos[n[0]]; return `<g class="n ${n[1]} ${sel === n[0] ? 'on' : ''}" data-node="${n[0]}" tabindex="0"><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${n[1] === 'var' ? 19 : 7}"/><text x="${x + 10}" y="${y + (n[3] > 1 ? 16 : 23)}">${LA(n[2]).length > 17 ? LA(n[2]).slice(0, 16) + '…' : LA(n[2])}</text>${n[3] > 1 ? `<text x="${x + 10}" y="${y + 29}" class="c">× ${nf(n[3])}</text>` : ''}</g>`; }).join('')}</svg>`;
  }
  const gridSVG = (g, [W, H]) => `<svg class="wv" viewBox="0 0 ${W * 4} ${H * 4}" shape-rendering="crispEdges">${[...g].map((v, k) => v ? `<rect x="${k % W * 4}" y="${((k / W) | 0) * 4}" width="3.4" height="3.4" class="s${v}"/>` : '').join('')}</svg>`;
  function liveHTML(m, R, tick) { const tp = of(m); return (R.frames ? gridSVG(R.frames[tick], R.grid) : '') + tp.charts.map(c => `<div class="cap"><span>${TA(c.n)}</span></div>` + draw(tp, c, R, tick)).join(''); }
  function animate(m, R) {
    const tp = of(m), L_ = live[m.id] || (live[m.id] = {}); clearInterval(L_.timer); L_.R = R; L_.tick = 0;
    const paint = () => { const box = $('#cv-live'), t = App.thread(S.cur); if (box && t && t.model === m.id) { box.innerHTML = liveHTML(m, R, L_.tick); const c = $('#cv-tick'); if (c) c.textContent = `${L_.tick} / ${tp.ticks}`; } };
    return new Promise(res => {
      const on = () => { const t = App.thread(S.cur); return t && t.model === m.id && $('#cv-live') && $('#cv-live').offsetParent; };
      if (REDUCED || !on()) { L_.tick = tp.ticks; paint(); return res(); }
      const step = Math.max(1, Math.round(tp.ticks / 48));
      L_.timer = setInterval(() => { L_.tick = Math.min(tp.ticks, L_.tick + step); paint(); if (L_.tick >= tp.ticks || !on()) { clearInterval(L_.timer); L_.tick = tp.ticks; res(); } }, 36);
    });
  }
  let sel = null;
  function pane(name, t) {
    const m = S.models[t.model]; if (!m) return; const tp = of(m), L_ = live[m.id] || (live[m.id] = {});
    if (name === 'canvas') {
      if (!L_.R && m.runs[0]) { L_.R = run1(m, m.runs[0].P, m.runs[0].seed); L_.tick = tp.ticks; }
      const n = tp.nodes.find(x => x[0] === sel);
      $('#w-canvas').innerHTML = `<div class="w-phase"><h2>${esc(Array.isArray(m.name) ? LA(m.name) : m.name)}</h2><p>${count(tp)} ${L('components', '个组件')} · ${L('seed', '种子')} ${m.seed}${m.from ? ' · ' + L('forked from', 'Fork 自') + ' ' + esc(m.from) : ''}</p></div>${canvasSVG(tp, sel)}
        <div class="cv-prop">${n ? `<b>${TA(n[2])}</b><small>${{ agent: 'Agent', cell: 'Cell', link: 'Link', var: 'Variable' }[n[1]]}${n[3] > 1 ? ' · × ' + nf(n[3]) : ''}</small><p>${TA(n[4])}</p>${n[5].length ? UI.kv(n[5].map(k => { const p = tp.params.find(x => x.k === k); return [TA(p.n), fx(p, m.P[k])]; })) : ''}` : ''}</div>
        <div class="cv-bar"><button class="btn sm solid" data-do="m:run">▶ ${T('Run', '运行')}</button><button class="btn sm" data-cv="step">${T('Step', '单步')}</button><button class="btn sm" data-cv="reset">${T('Reset', '复位')}</button><span id="cv-tick">${L_.R ? L_.tick : 0} / ${tp.ticks}</span></div>
        <div id="cv-live">${L_.R ? liveHTML(m, L_.R, L_.tick) : ''}</div>`;
    } else if (name === 'params') {
      $('#w-params').innerHTML = `<div class="pr">${tp.params.map(p => `<label class="fld"><span>${TA(p.n)}<output>${fx(p, m.P[p.k])}</output></span>${p.opts ? `<select data-p="${p.k}">${p.opts.map(o => `<option value="${o[0]}" ${m.P[p.k] === o[0] ? 'selected' : ''}>${o[0]} · ${LA(o[1])}</option>`).join('')}</select>` : `<input type="range" data-p="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${m.P[p.k]}">`}</label>`).join('')}
        <label class="fld"><span>${T('Random seed', '随机种子')}</span><input type="number" data-p="seed" value="${m.seed}" min="1" max="99999"></label></div>
        <div class="acts"><button class="btn sm solid" data-do="m:run">▶ ${T('Run', '运行')}</button><button class="btn sm" data-cv="defaults">${T('Defaults', '默认值')}</button></div>`;
    } else if (name === 'runs') {
      $('#w-runs').innerHTML = m.runs.length ? `<ol class="rl">${m.runs.map((r, i) => { const ch = tp.params.filter(p => r.P[p.k] !== p.v);
        return `<li><header><b>#${r.n}</b><time>${new Date(r.at).toISOString().slice(11, 16)}</time><button class="btn sm link" data-load="${i}">${T('Load', '载入')}</button></header><p>${ch.length ? ch.map(p => `${LA(p.n)} ${fx(p, r.P[p.k])}`).join(' · ') : L('defaults', '默认值')}</p>${UI.kv(tp.metrics.slice(0, 2).map(([k, n, f]) => [TA(n), f(r.m[k])]))}</li>`; }).join('')}</ol>` : `<p class="empty">${T('Run records appear here.', '运行记录会出现在这里。')}</p>`;
    } else {
      const list = exps(m.id), e = list.find(x => x.id === t.exp) || list[0]; if (!e) return;
      const p = tp.params.find(x => x.k === e.param);
      if (name === 'dash') $('#w-dash').innerHTML = `<div class="w-phase"><h2>${T('Experiment', '实验')} ${e.n}</h2><p>${L('Parameter exploration', '参数探索')} · ${LA(p.n)}</p></div>
        <div class="dcard"><h6>${T('Panel', '面板')}</h6><label class="fld"><span>${T('Explore', '探索')}</span><select data-e="param">${tp.params.map(x => `<option value="${x.k}" ${x.k === e.param ? 'selected' : ''}>${LA(x.n)}</option>`).join('')}</select></label><label class="fld"><span>${T('Chart', '图表')}</span><select data-e="metric">${tp.metrics.map(x => `<option value="${x[0]}" ${x[0] === e.metric ? 'selected' : ''}>${LA(x[1])}</option>`).join('')}</select></label></div>
        <div class="dcard"><h6>${TA(tp.metrics.find(x => x[0] === e.metric)[1])}</h6>${expChart(tp, e)}</div>
        <ul class="read">${reading(tp, e).map(r => `<li>${TA(r)}</li>`).join('')}</ul>`;
      else if (name === 'table') $('#w-table').innerHTML = `<table class="tb"><tr><th>${LA(p.n)}</th>${tp.metrics.map(x => `<th>${LA(x[1])}</th>`).join('')}</tr>${e.rows.map(r => `<tr class="${r === best(tp, e) ? 'on' : ''}"><td>${fx(p, r.v)}</td>${tp.metrics.map(x => `<td>${x[2](r.m[x[0]])}</td>`).join('')}</tr>`).join('')}</table><p class="hint">${T(`Each row is the mean of ${SEEDS} seeds.`, `每一行是 ${SEEDS} 个种子的平均。`)}</p>`;
      else $('#w-history').innerHTML = `<ol class="rl">${list.map(x => { const xp = tp.params.find(q => q.k === x.param), b = best(tp, x); return `<li class="${x.id === e.id ? 'on' : ''}"><header><b>${T('Experiment', '实验')} ${x.n}</b><time>${new Date(x.at).toISOString().slice(11, 16)}</time><button class="btn sm link" data-exp="${x.id}">${T('Open', '打开')}</button></header><p>${LA(xp.n)} · ${x.rows.length} ${L('values', '个取值')}</p>${UI.kv([[T('Best', '最优'), fx(xp, b.v)]])}</li>`; }).join('')}</ol>`;
    }
    applyLang($('#world'));
  }
  $('#world').addEventListener('click', e => {
    const t = App.thread(S.cur), m = t && S.models[t.model]; if (!m) return; const tp = of(m), L_ = live[m.id] || (live[m.id] = {});
    const nd = e.target.closest('[data-node]'), cv = e.target.closest('[data-cv]'), ld = e.target.closest('[data-load]'), ex = e.target.closest('[data-exp]');
    if (nd) { sel = sel === nd.dataset.node ? null : nd.dataset.node; pane('canvas', t); }
    else if (cv && cv.dataset.cv === 'step') { clearInterval(L_.timer); if (!L_.R || L_.tick >= tp.ticks) { L_.R = run1(m); L_.tick = 0; } L_.tick = Math.min(tp.ticks, L_.tick + Math.max(1, Math.round(tp.ticks / 24))); pane('canvas', t); }
    else if (cv && cv.dataset.cv === 'reset') { clearInterval(L_.timer); L_.R = null; L_.tick = 0; pane('canvas', t); }
    else if (cv && cv.dataset.cv === 'defaults') { m.P = defaults(tp); save(); pane('params', t); }
    else if (ld) { const r = m.runs[+ld.dataset.load]; m.P = { ...r.P }; m.seed = r.seed; L_.R = run1(m); L_.tick = tp.ticks; save(); UI.tab('canvas'); }
    else if (ex) { t.exp = ex.dataset.exp; save(); UI.tab('dash'); }
  });
  $('#world').addEventListener('input', e => {
    const k = e.target.dataset.p, t = App.thread(S.cur), m = t && S.models[t.model]; if (!k || !m) return;
    if (k === 'seed') m.seed = clamp(+e.target.value || 1, 1, 99999); else { const p = of(m).params.find(x => x.k === k); m.P[k] = p.opts ? e.target.value : +e.target.value; const o = $('output', e.target.closest('.fld')); if (o) o.textContent = fx(p, m.P[k]); }
    save();
  });
  $('#world').addEventListener('change', e => {
    const k = e.target.dataset.e, t = App.thread(S.cur), m = t && S.models[t.model]; if (!k || !m) return;
    const cur = exps(m.id).find(x => x.id === t.exp) || exps(m.id)[0];
    if (k === 'metric') { cur.metric = e.target.value; save(); pane('dash', t); } else act('exp:' + e.target.value);
  });

  return { TPL, tplOf, of, match, start, ask, act, pane, run1, exps, best, sweep, steps, expChart, reading, draw, fx, defaults, count, metricsHTML, hasExp: mid => Object.values(S.exps).some(e => e.model === mid) };
})();
