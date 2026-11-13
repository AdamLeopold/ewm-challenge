'use strict';
/* The track sheet behind the ⓘ: what the track asks, what you control, how it is scored, what you ship. */
const Info = (() => {
  const root = $('#info'), panel = $('.i-panel', root), body = $('#i-body');
  let k = 't1', timer = 0;
  const SHIP = cpu => [
    ['One OCI image · linux/amd64 · 4 GB at most', '一个 OCI 容器镜像 · linux/amd64 · 不超过 4 GB'],
    ['A JSON manifest: team, track, pinned image digest, model settings, event subscriptions, resources', '一份 JSON 清单：队伍标识、赛道、固定版本的镜像摘要、模型设置、订阅事件与资源需求'],
    ['Your team’s OpenSSH ed25519 signature on the frozen submission', '队伍的 OpenSSH ed25519 签名，用于验证冻结提交物'],
    [`Evaluated in a hosted container · ${cpu} · no internet beyond the context API and the model gateway`, `正式评测在托管容器内 · ${cpu} · 只通上下文 API 与大模型网关`],
  ];
  const DATA = {
    t1: {
      lead: ['Manage a simulated portfolio across Uniswap V3 and Aave v3. Raise return while holding drawdown down and the account healthy.', '在 Uniswap V3 与 Aave v3 之间管理模拟投资组合，在控制回撤、维持账户健康的同时提升收益。'],
      stats: [['$100,000', ['simulated capital · half USDC, half WETH', '模拟资金 · USDC 与 WETH 各半']], ['1 h', ['between decisions · plus event triggers', '决策间隔 · 另可订阅事件']], ['90 s', ['wall clock per decision', '每次决定的时限']]],
      scope: [
        ['Provide liquidity and swap in the Uniswap V3 WETH / USDC pool', '在 Uniswap V3 的 WETH / USDC 池做流动性和换币'],
        ['Supply, withdraw, borrow and repay on Aave v3', '在 Aave v3 存、取、借、还'],
        ['Use a flash loan inside a single plan', '一份计划内可使用闪电贷'],
        ['Decide once every simulated hour, and on the events you subscribe to', '每个模拟小时决策一次，另可订阅事件触发'],
      ],
      formula: 'S = r − 0.5 × MDD',
      score: ['r is the net portfolio return, MDD the largest peak-to-trough drawdown, both in the same percentage units. Higher is better.', 'r 为投资组合净收益率，MDD 为从峰值到谷值的最大回撤，两者单位相同。S 越高越好。'],
      gate: ['A run fails on liquidation, insolvency, bad debt, or when more than 5% of decisions are missed or in error.', '运行中被清算、破产、出现坏账，或超时与决策错误超过 5%，这次运行记为失败。'],
      ship: SHIP('2 vCPU · 4 GiB'),
      path: [['Build & practise', '开发与练习'], ['Warm-up', '热身检查'], ['Signed freeze', '签名冻结'], ['Stress + forward evaluation', '压力题与前向段评测'], ['Verification', '成绩复核']],
    },
    t2: {
      lead: ['Act as Aave’s risk steward. Manage the WETH and USDC reserves so the protocol stays solvent, users can withdraw, and revenue holds as the market moves.', '扮演 Aave 的风险管理者：管理 WETH 与 USDC 储备，在变化的市场中兼顾协议偿付能力、用户提款流动性和协议收入。'],
      stats: [['2', ['reserves · WETH and USDC', '个储备 · WETH 与 USDC']], ['6 h', ['between decisions', '决策间隔']], ['180 s', ['wall clock per decision', '每次决定的时限']]],
      scope: [
        ['Loan-to-value, liquidation threshold and liquidation bonus', '贷款价值比（LTV）、清算阈值与清算奖励'],
        ['Supply and borrow caps', '存款与借款上限'],
        ['The interest-rate curve and the reserve factor', '利率曲线与储备因子'],
        ['Freeze or unfreeze a reserve', '冻结或解冻储备'],
        ['Every change obeys step bounds, cooldowns of 36 h and 72 h, and governance timing', '每次调整都受幅度上限、36 小时与 72 小时冷却期和治理时序约束'],
      ],
      terms: [['ΔBD', ['bad debt', '坏账']], ['ΔLP', ['liquidation penalties', '清算罚金']], ['ΔRV', ['protocol revenue', '协议收入']], ['ΔW', ['withdrawals stuck · dollar-days', '取不出的存款 · 美元·天']]],
      score: ['Each term is the difference from the same scenario and seed with the parameters left unchanged.', '每一项都是与同一情景、同一种子下“参数不变”的基线之差。'],
      gate: ['A run fails on bad debt beyond the baseline’s allowance, on liquidations your own change triggered, or when more than 5% of decisions are missed or in error.', '相对基线的新增坏账超过限制、调参直接触发清算，或超时与决策错误超过 5%，这次运行记为失败。'],
      ship: SHIP('4 vCPU · 8 GiB'),
      path: [['Build & practise', '开发与练习'], ['Warm-up', '热身检查'], ['Signed freeze', '签名冻结'], ['Paired evaluation against the baseline', '与基线配对评测'], ['Verification', '成绩复核']],
    },
  };
  const sec = (h, inner) => `<section class="i-sec"><h5>${TA(h)}</h5>${inner}</section>`;
  const list = rows => `<ul class="i-list">${rows.map(r => `<li>${TA(r)}</li>`).join('')}</ul>`;

  function render() {
    const d = DATA[k];
    panel.dataset.k = k; $$('#i-tabs button').forEach(b => { b.classList.toggle('on', b.dataset.it === k); b.innerHTML = TA(TRACK[b.dataset.it].s); });
    body.innerHTML = `
      <div class="i-hero"><h2 class="h-h2">${TA(TRACK[k].n)}</h2><p>${TA(d.lead)}</p></div>
      <div class="i-stats">${d.stats.map(s => `<div><b>${s[0]}</b><span>${TA(s[1])}</span></div>`).join('')}</div>
      ${sec(['You control', '你能做什么'], list(d.scope))}
      ${sec(['Score', '计分'], (d.formula ? `<div class="i-formula">${d.formula}</div>` : `<div class="i-terms">${d.terms.map(t => `<div><b>${t[0]}</b><span>${TA(t[1])}</span></div>`).join('')}</div>`) + `<p>${TA(d.score)}</p>`)}
      ${sec(['Weight', '权重'], `<div class="i-split"><div><b>80</b><span>${T('hidden stress tests', '隐藏压力题')}</span></div><div><b>20</b><span>${T('forward', '前向段')}</span></div></div><p>${T('Thirteen scenario families, eleven published and two held out, generated after the freeze from a public randomness beacon. The forward window is one real week that happens after the freeze.', '13 个情景族，11 个公开、2 个留出，冻结后由公开随机信标生成。前向段是冻结之后真实发生的一周行情。')}</p>`)}
      ${sec(['Survival gate', '生存门'], `<p>${TA(d.gate)} ${T('Fail too often and the rank still stands, but prizes and the finals are out of reach.', '失败率超过门槛，名次照列，但不能获奖，也不进决赛。')}</p>`)}
      ${sec(['You ship', '提交什么'], list(d.ship))}
      ${sec(['Path', '流程'], `<div class="i-path">${d.path.map(p => `<span>${TA(p)}</span>`).join('<i>→</i>')}</div>`)}
      <a class="hb o i-more" href="../../holobit.html" target="_blank" rel="noopener">${T('Challenge site', '比赛官网')} ↗</a>`;
    body.scrollTop = 0;
  }
  function open(track) {
    clearTimeout(timer); k = track || k; root.classList.remove('out'); root.hidden = false; render(); $('.i-top .ib', root).focus({ preventScroll: true });
  }
  function close() { if (root.hidden) return; root.classList.add('out'); timer = setTimeout(() => { root.hidden = true; root.classList.remove('out'); }, REDUCED ? 0 : 340); }
  $('#i-tabs').addEventListener('click', e => { const b = e.target.closest('[data-it]'); if (b && b.dataset.it !== k) { k = b.dataset.it; render(); } });
  return { open, close, toggle(track) { root.hidden ? open(track) : close(); }, relang() { root.hidden || render(); }, get isOpen() { return !root.hidden; } };
})();
