'use strict';
/* The four library pages (Models, Experiments, Insights, Marketplace) and the two ways work leaves a thread: an insight, a listing. */
const Library = (() => {
  const page$ = $('#page');
  const me_ = () => (S.user && (S.user.name || S.user.handle)) || 'you';
  const MARKET = [
    { id: 'k1', type: 'model', cat: 'DeFi', n: ['Fee-tier lab', '费率档位实验室'], by: 'HoloBit', badges: ['Official'], price: 0, st: [18400, 912, 640], tpl: 'amm', P: { fee: 30, depth: 12 }, d: ['A constant-product pool with noise flow and arbitrage. Start here to ask what a fee tier is worth to its liquidity providers.', '带噪声交易与套利的恒定乘积池。想知道某个费率档位对 LP 值多少，从这里开始。'] },
    { id: 'k2', type: 'experiment', cat: 'DeFi', n: ['Arbitrage latency race', '套利延迟竞速'], by: 'mev.watch', badges: ['Popular'], price: 0, st: [9200, 431, 208], tpl: 'amm', P: { lag: 4, vol: 6 }, exp: 'lag', d: ['Arbitrage latency from one hour to twelve, and what it does to liquidity providers.', '套利延迟从 1 小时到 12 小时，以及它对 LP 的影响。'] },
    { id: 'k3', type: 'block', cat: 'DeFi', n: ['Constant-product pool', '恒定乘积池'], by: 'HoloBit', badges: ['Official'], price: 0, st: [22100, 1304, 2950], tpl: 'amm', P: {}, d: ['The x·y = k pool as a reusable block: reserves, a fee, and a swap process.', 'x·y = k 资金池做成的可复用 Block：储备、手续费与换币流程。'] },
    { id: 'k4', type: 'model', cat: 'DeFi', n: ['Reserve stress kit', '储备压力套件'], by: 'HoloBit', badges: ['Official', 'Top Ranking'], price: 0, st: [15700, 1120, 873], tpl: 'lend', P: { fam: 'F5' }, d: ['A lending reserve with borrowers spread across health factors, and six stress scenarios to throw at it.', '借款人分布在不同健康度上的借贷储备，外加六种压力情景。'] },
    { id: 'k5', type: 'report', cat: 'DeFi', n: ['What a liquidation bonus buys', '清算奖励买到了什么'], by: 'Gauntlet-style', badges: ['Pro'], price: 12, st: [4100, 356, 0], post: 'f2', d: ['A written reading of the cascade scenario across bonus levels.', '对不同奖励水平下清算连锁情景的书面解读。'] },
    { id: 'k6', type: 'model', cat: 'RWA', n: ['Backed-asset failure drill', '背书资产失效演练'], by: 'rwa.risk', badges: ['Popular'], price: 0, st: [6300, 288, 190], tpl: 'lend', P: { fam: 'F9', s2: 80 }, d: ['What an unbacked collateral asset does to a reserve before anyone freezes it.', '在有人冻结之前，一种失去背书的抵押资产会对储备做什么。'] },
    { id: 'k7', type: 'model', cat: 'RWA', n: ['Treasury vault run', '国债金库挤兑'], by: 'onchain.fi', badges: ['Pro'], price: 29, st: [2800, 164, 71], tpl: 'lend', P: { fam: 'F4', uopt: 80 }, d: ['A utilisation shock against a vault whose depositors all want out in the same week.', '储户在同一周全想取款时，金库面对的利用率冲击。'] },
    { id: 'k8', type: 'model', cat: 'Memecoins', n: ['Fair-launch curve', '公平发行曲线'], by: 'curve.fun', badges: ['Popular'], price: 0, st: [31000, 2210, 1840], tpl: 'curve', P: { n: 2, tax: 0, hype: .5 }, d: ['A bonding curve with momentum traders and a mood that turns.', '带动量交易者与会反转的情绪的 Bonding Curve。'] },
    { id: 'k9', type: 'experiment', cat: 'Memecoins', n: ['Sell-tax sweet spot', '卖出税的甜点'], by: 'tokenlab', badges: ['Top Ranking'], price: 0, st: [12600, 780, 512], tpl: 'curve', P: { hype: .1 }, exp: 'tax', d: ['Sell tax from 0 to 20%, and what it does to the fall from the peak and to who ends in profit.', '卖出税从 0 到 20%，以及它对峰值回落和最终谁盈利的影响。'] },
    { id: 'k10', type: 'model', cat: 'Gaming', n: ['How a meta spreads', '一套打法如何扩散'], by: 'guildmath', badges: ['Popular'], price: 0, st: [5400, 301, 166], tpl: 'sir', P: { beta: .18, gamma: .05, mix: .12 }, d: ['A dominant strategy passing through a player base by contact, then burning out.', '一套强势打法靠接触在玩家中传开，然后退烧。'] },
    { id: 'k11', type: 'report', cat: 'Gaming', n: ['Distant contacts and how far it spreads', '远距离接触与传播能走多远'], by: 'guildmath', badges: [], price: 9, st: [1900, 88, 0], post: 'f4', d: ['A written reading of the contact model across mixing levels.', '对不同混合程度下接触模型的书面解读。'] },
    { id: 'k12', type: 'block', cat: 'Memecoins', n: ['Sentiment walker', '情绪游走器'], by: 'tokenlab', badges: [], price: 0, st: [3300, 140, 420], tpl: 'curve', P: {}, d: ['A mood variable that drifts with hype and wanders on its own, ready to wire to any agent.', '随热度漂移、也自己游走的情绪变量，可接到任何 Agent 上。'] },
  ];
  /* community posts: each states its setup; what it found is read off the experiment beside it */
  const FEED = [
    { id: 'f1', t: ['What a fee tier is worth to its liquidity providers', '一个费率档位对 LP 值多少'], by: 'mev.watch', tags: ['DeFi', 'AMM'], tpl: 'amm', P: { vol: 6 }, param: 'fee', st: [412, 37], b: [['A constant-product pool at 6% daily volatility. Traders go elsewhere as the fee rises; arbitrageurs trade whenever the gap to the market beats the fee.', '一个日波动率 6% 的恒定乘积池。手续费越高，交易者越会去别处；只要与市价的差超过手续费，套利者就出手。'], ['So the fee is two things at once: the income, and the band inside which arbitrage leaves the pool alone.', '所以手续费同时是两样东西：收入，以及套利者不去碰池子的那条带。']] },
    { id: 'f2', t: ['What a liquidation bonus buys', '清算奖励买到了什么'], by: 'Gauntlet-style', tags: ['DeFi', 'Lending'], tpl: 'lend', P: { fam: 'F5' }, param: 'bonus', st: [356, 52], b: [['A liquidation cascade against a lending reserve. Liquidators repay unhealthy debt only while the bonus covers their slippage; when it doesn’t, the reserve keeps the position.', '清算连锁冲击下的借贷储备。只有奖励盖得过滑点，清算人才会替不健康的债还款；盖不过，仓位就留在储备里。'], ['The bonus is paid out of the borrower’s collateral, so what it buys shows up in one column and what it costs in another.', '奖励出自借款人的抵押品，所以它买到的东西在一列，它的代价在另一列。']] },
    { id: 'f3', t: ['Sell tax and who is left holding', '卖出税，以及最后是谁握着筹码'], by: 'tokenlab', tags: ['Memecoins'], tpl: 'curve', P: { hype: .1 }, param: 'tax', st: [298, 41], b: [['A bonding curve with momentum traders and a mood that turns. The tax is kept in the reserve on every sale, and it makes traders slower both to sell and to buy.', '带动量交易者与会反转的情绪的 Bonding Curve。每次卖出，税都留在储备里；它也让交易者卖得更慢、买得更慢。']] },
    { id: 'f4', t: ['Distant contacts and how far it spreads', '远距离接触与传播能走多远'], by: 'guildmath', tags: ['Gaming', 'Systems'], tpl: 'sir', P: { beta: .16, gamma: .06 }, param: 'mix', st: [141, 12], b: [['Six hundred people on a grid, each meeting four neighbours a day and, now and then, a stranger from anywhere. The same model reads as a rumour, a strategy or a habit passing through a player base.', '网格上的 600 人，每人每天接触四个邻居，偶尔接触任意位置的陌生人。同一个模型可以读作在玩家中传开的一条传闻、一套打法或一种习惯。']] },
  ];
  const sims = {};                                             // post id → { e, run } computed once
  function data(p) {
    if (sims[p.id]) return sims[p.id];
    const tp = Models.tplOf(p.tpl), q = { ...Models.defaults(tp), ...p.P }, seed = p.seed || 4242;
    const rows = p.rows || Models.sweep(tp, q, p.param, Models.steps(tp.params.find(x => x.k === p.param)), seed);
    return sims[p.id] = { tp, e: { param: p.param, metric: p.metric || tp.metrics[0][0], rows } };
  }
  const posts = () => S.posts.concat(FEED);
  const likes = p => (p.st ? p.st[0] : 0) + (S.likes[p.id] && S.likes[p.id].on ? 1 : 0);
  const title = p => Array.isArray(p.t) ? TA(p.t) : esc(p.t);

  /* ── pages ── */
  let mk = { q: '', type: 'all', cat: 'all' }, openPost = null, openItem = null;
  const head = (h, extra = '') => `<header class="pg-h"><h2 class="h-h2">${h}</h2>${extra}</header>`;
  const PAGES = {
    models() {
      const ms = Object.values(S.models).sort((a, b) => b.at - a.at);
      return head(T('Models', '模型')) + (ms.length ? `<div class="pg-grid">${ms.map(m => { const tp = Models.of(m), t = S.threads.find(x => x.model === m.id), r = m.runs[0], mt = tp.metrics[0];
        return `<button class="pcard" data-open="${t ? t.id : ''}"><small>${TA(tp.tag)}</small><b>${esc(Array.isArray(m.name) ? LA(m.name) : m.name)}</b><span>${Models.count(tp)} ${L('components', '个组件')} · ${m.runs.length} ${L('runs', '次运行')}</span>${r ? `<em>${LA(mt[1])} ${mt[2](r.m[mt[0]])}</em>` : ''}</button>`; }).join('')}</div>` : '')
        + `<h5 class="pg-s">${T('Start from', '从这些开始')}</h5><div class="pg-grid">${Models.TPL.map(m => `<button class="pcard new" data-do="new:${m.id}"><small>${TA(m.tag)}</small><b>${TA(m.n)}</b><span>${TA(m.ask)}</span></button>`).join('')}</div>`;
    },
    exps() {
      const es = Object.values(S.exps).sort((a, b) => b.at - a.at);
      return head(T('Experiments', '实验')) + (es.length ? `<div class="pg-list">${es.map(e => { const m = S.models[e.model]; if (!m) return ''; const tp = Models.of(m), p = tp.params.find(x => x.k === e.param), b = Models.best(tp, e), mt = tp.metrics.find(x => x[0] === e.metric);
        return `<button class="prow" data-do="lib:exp:${e.id}"><b>${esc(Array.isArray(m.name) ? LA(m.name) : m.name)} · ${L('Experiment', '实验')} ${e.n}</b><span>${L('Parameter exploration', '参数探索')} · ${LA(p.n)} · ${e.rows.length} ${L('values', '个取值')}</span><em>${L('best', '最优')} ${Models.fx(p, b.v)} · ${mt[2](b.m[mt[0]])}</em></button>`; }).join('')}</div>`
        : `<p class="empty">${T('An experiment explores one parameter of a model and keeps every run. Build a model, then ask for one.', '实验探索模型的一个参数，并保留每一次运行。先搭一个模型，再让我做实验。')}</p>`);
    },
    insights() {
      if (openPost) { const p = posts().find(x => x.id === openPost); if (p) return postHTML(p); openPost = null; }
      return head(T('Insights', '洞见')) + `<div class="pg-feed">${posts().map(p => { const d = data(p);
        return `<article class="post" data-do="lib:post:${p.id}"><div><small>${esc(p.by)}${p.mine ? ' · ' + L('you', '你') : ''}</small><h3>${title(p)}</h3><p>${p.b ? TA(p.b[0]) : TA(p.read[0])}</p><footer>${(p.tags || []).map(x => `<i>${x}</i>`).join('')}<span>♥ ${nf(likes(p))}</span></footer></div><div class="post-c">${Models.expChart(d.tp, d.e)}</div></article>`; }).join('')}</div>`;
    },
    market() {
      if (openItem) { const it = all().find(x => x.id === openItem); if (it) return itemHTML(it); openItem = null; }
      const TY = [['all', 'All', '全部'], ['model', 'Models', '模型'], ['block', 'Blocks', 'Block'], ['experiment', 'Experiments', '实验'], ['report', 'Reports', '报告']], CT = ['all', 'DeFi', 'RWA', 'Gaming', 'Memecoins'];
      const list = all().filter(x => (mk.type === 'all' || x.type === mk.type) && (mk.cat === 'all' || x.cat === mk.cat) && (!mk.q || (x.n.join(' ') + x.by + x.d.join(' ')).toLowerCase().includes(mk.q.toLowerCase())));
      return head(T('Marketplace', '市场'), `<input id="mk-q" type="search" value="${esc(mk.q)}" data-ph-en="Search models, blocks, reports" data-ph-zh="搜索模型、Block、报告">`)
        + `<div class="mk-f"><div class="a-seg">${TY.map(t => `<button data-mt="${t[0]}" class="${mk.type === t[0] ? 'on' : ''}">${T(t[1], t[2])}</button>`).join('')}</div><div class="mk-c">${CT.map(c => `<button data-mc="${c}" class="${mk.cat === c ? 'on' : ''}">${c === 'all' ? T('All', '全部') : c}</button>`).join('')}</div></div>`
        + (list.length ? `<div class="pg-grid">${list.map(itemCard).join('')}</div>` : `<p class="empty">${T('Nothing matches.', '没有匹配的内容。')}</p>`);
    },
  };
  const all = () => S.listings.concat(MARKET);
  const TYN = { model: ['Model', '模型'], block: ['Block', 'Block'], experiment: ['Experiment', '实验'], report: ['Report', '报告'] };
  const price = it => it.price ? '$' + it.price : L('Free', '免费');
  const itemCard = it => `<button class="pcard mk ${it.shelf === false ? 'off' : ''}" data-do="lib:item:${it.id}"><small>${TA(TYN[it.type])} · ${it.cat}</small><b>${TA(it.n)}</b><span>${esc(it.by)}${it.mine ? ' · ' + L('you', '你') : ''}</span><footer>${it.badges.map(b => `<i class="bd-${b.split(' ')[0].toLowerCase()}">${b}</i>`).join('')}${it.shelf === false ? `<i>${L('Off shelf', '已下架')}</i>` : ''}<em>${price(it)}</em></footer></button>`;
  function itemHTML(it) {
    const tp = it.tpl && Models.tplOf(it.tpl), got = S.got.includes(it.id) || !it.price || it.mine;
    const cta = it.type === 'report' ? `<button class="btn solid" data-do="lib:read:${it.id}">${got ? T('Read', '阅读') : T('Get', '获取') + ' · ' + price(it)}</button>`
      : `<button class="btn solid" data-do="lib:fork:${it.id}">${!got ? T('Get', '获取') + ' · ' + price(it) : it.type === 'block' ? T('Reuse in a new model', '在新模型中复用') : T('Fork', 'Fork')}</button>`;
    return `<button class="btn link pg-back" data-do="lib:back">← ${T('Marketplace', '市场')}</button><div class="item"><div><small>${TA(TYN[it.type])} · ${it.cat}</small><h2 class="h-h2">${TA(it.n)}</h2><p class="by">${esc(it.by)}${it.badges.map(b => ` <i class="bd-${b.split(' ')[0].toLowerCase()}">${b}</i>`).join('')}</p><p>${TA(it.d)}</p>
      <div class="acts">${cta}${it.mine ? `<label class="sw"><input type="checkbox" data-shelf="${it.id}" ${it.shelf !== false ? 'checked' : ''}><i></i><span>${T('On shelf', '上架中')}</span></label>` : ''}</div></div>
      <dl class="kv">${[[T('Views', '浏览'), nf(it.st[0])], [T('Likes', '点赞'), nf(it.st[1])], [it.type === 'block' ? T('Reuses', '复用') : T('Forks', 'Fork'), nf(it.st[2])], tp && [T('Components', '组件'), Models.count(tp)], tp && [T('Ticks', 'Tick'), tp.ticks], [T('Price', '价格'), price(it)], it.ref != null && [T('Referral reward', '推荐奖励'), it.ref + '%']].filter(Boolean).map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl></div>`;
  }
  function postHTML(p) {
    const d = data(p), tp = d.tp, read = p.read || Models.reading(tp, d.e), lk = S.likes[p.id] || {};
    return `<button class="btn link pg-back" data-do="lib:back">← ${T('Insights', '洞见')}</button><article class="post-d"><small>${esc(p.by)}${(p.tags || []).map(x => ` · ${x}`).join('')}</small><h2 class="h-h2">${title(p)}</h2>
      ${(p.b || []).map(x => `<p>${TA(x)}</p>`).join('')}
      <div class="dcard"><h6>${TA(tp.metrics.find(x => x[0] === d.e.metric)[1])} · ${TA(tp.params.find(x => x.k === d.e.param).n)}</h6>${Models.expChart(tp, d.e, d.e.metric, 1)}</div>
      <ul class="read">${read.map(r => `<li>${TA(r)}</li>`).join('')}</ul>
      <div class="acts"><button class="btn solid" data-do="lib:open:${p.id}">${T('Open the model', '打开模型')}</button><button class="btn ${lk.on ? 'on' : ''}" data-do="lib:like:${p.id}">♥ ${nf(likes(p))}</button></div>
      <div class="cm">${(lk.c || []).map(c => `<p><b>${esc(me_())}</b>${esc(c)}</p>`).join('')}<form data-cm="${p.id}"><input data-ph-en="Add a comment" data-ph-zh="写一条评论" maxlength="280"><button class="btn sm" type="submit">${T('Post', '发布')}</button></form></div></article>`;
  }
  function page(name) { page$.dataset.pg = name; page$.innerHTML = `<div class="pg">${PAGES[name]()}</div>`; applyLang(page$); }
  const here = () => S.cur && S.cur.slice(0, 2) === 'p:' ? S.cur.slice(2) : null, repaint = () => here() && page(here());
  page$.addEventListener('click', e => { const t = e.target.closest('[data-mt]'), c = e.target.closest('[data-mc]'); if (t) { mk.type = t.dataset.mt; repaint(); } else if (c) { mk.cat = c.dataset.mc; repaint(); } });
  page$.addEventListener('input', e => { if (e.target.id === 'mk-q') { mk.q = e.target.value; const pos = e.target.selectionStart; repaint(); const i = $('#mk-q'); i.focus(); i.setSelectionRange(pos, pos); } });
  page$.addEventListener('change', e => { const s = e.target.dataset.shelf; if (s) { S.listings.find(x => x.id === s).shelf = e.target.checked; save(); } });
  page$.addEventListener('submit', e => { const f = e.target.closest('[data-cm]'); if (!f) return; e.preventDefault(); const v = $('input', f).value.trim(); if (!v) return; const k = S.likes[f.dataset.cm] || (S.likes[f.dataset.cm] = {}); (k.c = k.c || []).push(v); save(); repaint(); });

  /* ── out of a thread: an insight ── */
  function draft(t) {
    const m = S.models[t.model], tp = Models.of(m);
    Flow.sideflow(t.id, async () => {
      me(T('Draft an insight.', '起草一篇洞见。')); UI.suggest(t.id, []);
      const e = Models.exps(m.id)[0];
      if (!e) { await say(T('An insight needs evidence. Run an experiment first and I’ll write up what it shows.', '洞见需要证据。先做一个实验，我再把它说明的东西写出来。')); UI.suggest(t.id, [{ do: 'm:exp', t: ['Set up an experiment', '做一个实验'] }]); return App.touch(t.id); }
      const p = tp.params.find(x => x.k === e.param), b = Models.best(tp, e), mt = tp.metrics.find(x => x[0] === e.metric), read = Models.reading(tp, e);
      const name = Array.isArray(m.name) ? m.name : [m.name, m.name];
      t.draft = { t: [`${name[0]}: ${p.n[0]} ${Models.fx(p, b.v).trim()} gives the best ${mt[1][0]}`, `${name[1]}：${p.n[1]}取 ${Models.fx(p, b.v).trim()} 时${mt[1][1]}最好`], tpl: tp.id, P: { ...e.base }, param: e.param, metric: e.metric, rows: e.rows, read };
      await say(`<div class="card done res-c draft"><header><h4>${T('Insight · draft', '洞见 · 草稿')}</h4></header><h3>${TA(t.draft.t)}</h3><div class="cap"><span>${TA(mt[1])} · ${TA(p.n)}</span></div>${Models.expChart(tp, e, e.metric, 1)}<ul class="read">${read.map(r => `<li>${TA(r)}</li>`).join('')}</ul></div>`, { cls: 'wide', delay: 420 });
      UI.suggest(t.id, [{ do: 'lib:post', t: ['Publish it', '发布'] }, { do: 'm:exp', t: ['Add another experiment', '再做一个实验'] }]); App.touch(t.id);
    });
  }
  function publishPost(t) {
    if (!t.draft) return;
    const p = Object.assign({ id: 'u' + (++S.n), by: me_(), mine: true, tags: [LA(Models.tplOf(t.draft.tpl).tag)], at: Date.now(), st: [0, 0] }, t.draft); delete t.draft; S.posts.unshift(p);
    Flow.sideflow(t.id, async () => { me(T('Publish it.', '发布。')); await say(T('Published. It’s at the top of Insights, with the model attached so anyone can open it.', '已发布。它在洞见的最上面，并附带模型，任何人都能打开。')); UI.suggest(t.id, [{ do: 'open:p:insights', t: ['View in Insights', '在洞见中查看'] }, { do: 'lib:publish', t: ['Publish the model to Marketplace', '把模型发布到市场'] }]); App.touch(t.id); });
  }

  /* ── out of a thread: a Marketplace listing, in four steps ── */
  function publish(t) {
    const m = S.models[t.model], tp = Models.of(m), has = Models.hasExp(m.id), nm = Array.isArray(m.name) ? LA(m.name) : m.name;
    Flow.sideflow(t.id, async () => {
      me(T('Publish to Marketplace.', '发布到市场。')); UI.suggest(t.id, []);
      const id = uid(), STEPS = [['Basic information', '基本信息'], ['Content', '内容范围'], ['Marketplace', '市场'], ['Incentives', '激励设置']];
      const r = await card(`<header><h4>${T('Publish to Marketplace', '发布到市场')}</h4><span class="cnt"></span></header><ol class="pub-s">${STEPS.map(s => `<li>${TA(s)}</li>`).join('')}</ol>
        <div class="pub" data-s="0">${fld(T('Name', '名称'), `<input id="${id}n" value="${esc(nm)}" maxlength="60">`)}${fld(T('Description', '描述'), `<textarea id="${id}d" rows="2" maxlength="240">${esc(LA(tp.ask))}</textarea>`)}${fld(T('Category', '分类'), `<select id="${id}c">${['DeFi', 'RWA', 'Gaming', 'Memecoins'].map(c => `<option ${c === tp.tag[0] ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}</div>
        <div class="pub" data-s="1" hidden><div class="checks"><label class="ck"><input type="checkbox" checked disabled><i></i><span>${T('Model scenario', '模型场景')}</span></label><label class="ck"><input type="checkbox" id="${id}e" ${has ? 'checked' : 'disabled'}><i></i><span>${T('Experiment scenarios', '实验场景')}</span></label></div>${fld(T('Opens first', '默认打开'), `<select id="${id}o"><option value="model">${L('Model', '模型')}</option>${has ? `<option value="exp">${L('Experiment', '实验')}</option>` : ''}</select>`)}</div>
        <div class="pub" data-s="2" hidden><div class="a-seg"><button data-pay="0" class="on">${T('Free for download', '免费下载')}</button><button data-pay="1">${T('Pay for download', '付费下载')}</button></div><div class="pay" hidden>${fld(T('Price', '价格'), `<input id="${id}p" type="number" min="1" max="999" value="9">`)}</div></div>
        <div class="pub" data-s="3" hidden>${fld(T('Referral reward', '推荐奖励') + ` <output id="${id}ro">10%</output>`, `<input id="${id}r" type="range" min="0" max="30" step="5" value="10">`)}${fld(T('Block reuse royalty', 'Block 复用版税') + ` <output id="${id}yo">5%</output>`, `<input id="${id}y" type="range" min="0" max="20" step="5" value="5">`)}</div>
        <p class="err" hidden></p><footer><button class="btn link" data-x="no">${T('Cancel', '取消')}</button><span class="sp"></span><button class="btn" data-x="back" hidden>←</button><button class="btn solid" data-x="next">${T('Continue', '继续')}</button></footer>`, (c, done) => {
        let s = 0, pay = 0; const q = x => $(`#${id}${x}`, c);
        const show = () => { $$('.pub', c).forEach(p => { p.hidden = +p.dataset.s !== s; }); $$('.pub-s li', c).forEach((li, i) => li.className = i < s ? 'done' : i === s ? 'cur' : ''); $('[data-x=back]', c).hidden = !s; $('[data-x=next]', c).innerHTML = s === 3 ? T('Publish', '发布') : T('Continue', '继续'); $('.cnt', c).textContent = `${s + 1} / 4`; };
        const fin = () => done({ name: q('n').value.trim() || nm, d: q('d').value.trim(), cat: q('c').value, exp: q('e').checked, first: q('o').value, price: pay ? clamp(+q('p').value || 1, 1, 999) : 0, ref: +q('r').value, roy: +q('y').value });
        c.addEventListener('click', e => { const x = e.target.closest('[data-x]'), p = e.target.closest('[data-pay]');
          if (p) { pay = +p.dataset.pay; $$('[data-pay]', c).forEach(b => b.classList.toggle('on', b === p)); $('.pub[data-s="2"] .pay', c).hidden = !pay; }
          else if (!x) return; else if (x.dataset.x === 'no') done(null); else if (x.dataset.x === 'back') { s--; show(); }
          else if (s === 0 && q('n').value.trim().length < 2) { const er = $('.err', c); er.hidden = false; er.innerHTML = T('Give it a name.', '请起个名字。'); shake(c); } else if (s < 3) { $('.err', c).hidden = true; s++; show(); } else fin(); });
        c.addEventListener('input', e => { if (e.target === q('r')) q('ro').textContent = q('r').value + '%'; if (e.target === q('y')) q('yo').textContent = q('y').value + '%'; });
        show(); return fin;
      }, { cls: 'pubc' });
      if (!r) { UI.suggest(t.id, [{ do: 'lib:publish', t: ['Publish to Marketplace', '发布到市场'] }]); return App.touch(t.id); }
      const it = { id: 'l' + (++S.n), type: 'model', cat: r.cat, n: [r.name, r.name], by: me_(), mine: true, shelf: true, badges: [], price: r.price, st: [0, 0, 0], tpl: tp.id, P: { ...m.P }, seed: m.seed, d: [r.d, r.d], ref: r.ref, roy: r.roy, at: Date.now() };
      S.listings.unshift(it); save();
      await say(UI.receipt(T('On the shelf', '已上架'), [[T('Listing', '条目'), esc(r.name)], [T('Category', '分类'), r.cat], [T('Price', '价格'), price(it)], [T('Referral reward', '推荐奖励'), r.ref + '%']], hx(it.id + r.name, 64)), { cls: 'wide' });
      UI.suggest(t.id, [{ do: 'lib:item:' + it.id, t: ['View the listing', '查看条目'] }]); App.touch(t.id);
    });
  }

  function act(a, el) {
    const [verb, arg] = a.split(/:(.*)/s), t = App.thread(UI.vis && UI.vis.id);
    if (verb === 'draft') t && t.model && draft(t);
    else if (verb === 'post' && !arg) t && publishPost(t);
    else if (verb === 'publish') t && t.model && publish(t);
    else if (verb === 'back') { openPost = openItem = null; repaint(); }
    else if (verb === 'post') { openPost = arg; App.open('p:insights'); }
    else if (verb === 'item') { openItem = arg; App.open('p:market'); }
    else if (verb === 'like') { const k = S.likes[arg] || (S.likes[arg] = {}); k.on = !k.on; save(); repaint(); }
    else if (verb === 'exp') { const e = S.exps[arg], th = e && S.threads.find(x => x.model === e.model); if (th) { th.mode = 'exp'; th.exp = e.id; save(); App.open(th.id); } }
    else if (verb === 'open') { const p = posts().find(x => x.id === arg); if (p) Models.start(p.tpl, L('Open the model behind “', '打开“') + (Array.isArray(p.t) ? LA(p.t) : p.t) + L('”.', '”背后的模型。'), { name: Array.isArray(p.t) ? p.t : [p.t, p.t], P: p.P, seed: p.seed || 4242, from: p.by }); }
    else if (verb === 'fork' || verb === 'read') {
      const it = all().find(x => x.id === arg); if (!it) return;
      if (it.price && !it.mine && !S.got.includes(it.id)) { S.got.push(it.id); save(); UI.toast(T('Added to your library. Sandbox: nothing was charged.', '已加入你的资料库。沙盒：没有扣费。')); return repaint(); }
      if (verb === 'read') { openPost = it.post; return App.open('p:insights'); }
      Models.start(it.tpl, (it.type === 'block' ? L('Start a model with “', '用“') : L('Fork “', 'Fork “')) + LA(it.n) + (it.type === 'block' ? L('”.', '”搭一个模型。') : '”.'), { name: it.n, P: it.P, seed: it.seed, from: it.by });
    }
  }
  return { page, act };
})();
