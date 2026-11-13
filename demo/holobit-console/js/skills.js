'use strict';
/* What a typed message turns into: an edit to the agent, a step in a model, a new model, a page, or an answer from the rulebook. */
const Skills = (() => {
  const chal = id => id === 'acct' || id === 't1' || id === 't2';
  const KB = [
    [/score|scor|formula|S ?=|计分|分数|怎么算|公式/i, ['Track 1: <code>S = r − 0.5 × MDD</code>, net return minus half the worst drawdown. Track 2: bad debt, liquidation penalties, revenue and stuck withdrawals, each measured against the same world with parameters unchanged. Hidden stress tests are 80% of the total, the forward window 20%.', '赛道 1：<code>S = r − 0.5 × MDD</code>，净收益减去最大回撤的一半。赛道 2：坏账、清算罚金、协议收入与取不出的存款，都与“参数不变”的同一世界相比。隐藏压力题占 80%，前向段占 20%。']],
    [/gate|surviv|liquidat|生存门|清算|破产/i, ['The survival gate is a gate, not a score. A Track 1 run fails on liquidation, insolvency, bad debt, or more than 5% missed decisions. A Track 2 run fails on excess bad debt against the baseline, liquidations your own change caused, or missed decisions. Fail too often and you keep your rank but can’t take a prize or reach the finals.', '生存门是门，不是分。赛道 1 的运行在被清算、破产、坏账或超过 5% 的决定缺失时记门失败。赛道 2 在坏账比基线多出、调参直接引发清算或决定缺失时记门失败。失败太多，名次照列，但不能获奖，也不进决赛。']],
    [/stress|scenario|famil|hidden|压力|情景|隐藏|留出/i, ['Thirteen scenario families: eleven published, two held out. Units are generated after the freeze from a public randomness beacon, so nobody can pick the questions. In a third to a half of units the alarm fires and the event never comes.', '13 个情景族：11 个公开，2 个留出。题目在冻结之后用公开随机信标生成，谁也挑不了题。每族有三到五成的单元，信号来了，事件却不来。']],
    [/forward|real week|前向|真实/i, ['The forward window is one week of real markets that happens after the freeze, recorded and replayed at speed. It is a single path, so it is noisy, and it carries 20% of the score.', '前向窗口是冻结之后真实发生的一周行情，录下来高速重放。它只有一条路径，噪声大，所以只占 20%。']],
    [/llm|language model|gpt|claude|gemini|provider|gateway|大模型|密钥|api key/i, ['Your agent may call a language model, through the competition gateway only, on your own provider key. Only dated snapshots on the whitelist; no server-side tools, no stored objects. Every team has the same budget per decision and per simulated day.', 'Agent 可以调用大模型，但只能经比赛网关，用你自己的服务方密钥。只接受白名单里带日期的快照；不许服务端工具，不许服务端保存的对象。各队每次决定、每个模拟日的预算上限相同。']],
    [/limit|size|4 ?gb|timeout|second|cpu|memory|限制|大小|超时|资源/i, ['Image: OCI, linux/amd64, 4 GB at most. Track 1: 90 s per decision, 2 vCPU, 4 GiB. Track 2: 180 s, 4 vCPU, 8 GiB. A late decision is treated as a hold and counted.', '镜像：OCI，linux/amd64，不超过 4 GB。赛道 1：每次决定 90 秒，2 vCPU，4 GiB。赛道 2：180 秒，4 vCPU，8 GiB。超时的决定按保持处理并计数。']],
    [/team|member|both|two tracks|队|成员|两条/i, ['Teams are one to five people. Enter Track 1, Track 2 or both; each is ranked separately. One control group submits one official version per track.', '一支队伍 1 到 5 人。可以参加赛道 1、赛道 2 或两条；各自单独排名。同一控制关系组在每条赛道只交一个正式版本。']],
    [/language|python|typescript|rust|语言/i, ['Any language. The agent is a container that speaks the interface. Starter kits exist for Python and TypeScript.', '语言不限。Agent 是一个按接口说话的容器。起步包有 Python 与 TypeScript 两种。']],
    [/where.*run|hosted|container|internet|在哪.*跑|托管|联网/i, ['Practice runs happen here, or on your own machine through the CLI. In evaluation, your agent runs in a hosted container with no internet: only the context API and the model gateway are reachable.', '练习在这里跑，也可以经 CLI 在自己的机器上跑。正式评测在托管容器里，没有外网，只通上下文 API 与大模型网关。']],
    [/update|after.*freeze|freeze|冻结|更新/i, ['Until the freeze, submit as many versions as you like. The freeze fixes one. After it nothing changes.', '冻结之前可以反复提交。冻结锁定其中一个，之后什么都不能改。']],
    [/verify|check.*result|recompute|reproduc|核实|重算|复现/i, ['After the finals the seeds, scenarios and scoring code are published. Recompute your score from the result card, or with <code>holobit verify</code>, and you should get the published number, integer for integer.', '决赛之后，种子、情景与评分程序全部公开。在结果卡片上重算，或用 <code>holobit verify</code>，应当得到与公布分数逐个整数相同的结果。']],
    [/prize|award|money|奖/i, ['Prizes are announced on the challenge site. Awards go to finalists by rank, and are confirmed after the appeal window and identity verification.', '奖项在比赛官网公布。奖只发给决赛 Agent，按名次发；申诉期结束、身份核验通过后确认。']],
    [/appeal|dispute|申诉/i, ['Each ruling has an appeal window. An appeal gets a case number and a written answer with reasons. If a recomputation is upheld, it is redone for every agent it touches.', '每个结论都有申诉窗口。申诉会得到受理编号和附理由的书面答复。重算成立时，对所有受影响的 Agent 一并重算。']],
  ];
  const CUE = /challenge|competition|ewm|track|agent|score|gate|freeze|submit|stress|forward|prize|appeal|比赛|赛道|计分|分数|生存门|冻结|提交|压力|前向|奖|申诉/i;
  const CAN = () => T('Here I can <b>build and run a model</b> (an AMM with arbitrage, a lending market under stress, an epidemic, a bonding curve), <b>set up an experiment</b> on it, <b>write up an insight</b>, <b>find something to fork</b> in the Marketplace, or take you through the <b>Economic World Model Challenge</b>.',
    '在这里我可以<b>搭建并运行模型</b>（带套利的 AMM、压力下的借贷市场、传染病传播、Bonding Curve），在模型上<b>做实验</b>，<b>写一篇洞见</b>，在市场里<b>找一个模型来 Fork</b>，或者带你走一遍<b>经济世界模型挑战赛</b>。');

  /* say something in the thread on screen; from a page, in a fresh chat */
  function reply(s, html, sugg) {
    const id = UI.vis ? UI.vis.id : App.fresh(true);
    Flow.sideflow(id, async () => { if (s) me(esc(s)); await say(html); if (sugg && !chal(id)) UI.suggest(id, sugg); App.touch(id, s); });
  }
  const START = () => [{ do: 'new:amm', t: ['Model an AMM with arbitrage', '搭一个带套利的 AMM'] }, { do: 'new:lend', t: ['Stress a lending market', '给借贷市场加压'] }, { do: 'open:p:market', t: ['Browse the Marketplace', '逛逛市场'] }];

  function route(s) {
    const v = UI.vis, id = v && v.id;
    if (id === 't1' || id === 't2') { const out = Agent.ask(id, s); if (out) return reply(s, out); }
    if (id && chal(id)) { const hit = KB.find(x => x[0].test(s)); if (hit) return reply(s, TA(hit[1])); }
    if (id && !chal(id)) { const t = App.thread(id); if (t && t.model && Models.ask(t, s)) return; }
    const tpl = Models.match(s); if (tpl) return Models.start(tpl, s);
    if (/template|example|what (can|could) (you|i)|能做什么|有哪些模板/i.test(s)) return reply(s, CAN(), START());
    if (/market ?place|fork|市场/i.test(s)) { App.open('p:market'); return; }
    if (/insight|report|洞见|报告/i.test(s) && !(id && App.thread(id) && App.thread(id).model)) { App.open('p:insights'); return; }
    if (/^(hi|hello|hey|你好|嗨)\b/i.test(s)) return reply(s, T('Hello. What do you want to simulate?', '你好。想模拟什么？'), START());
    if (CUE.test(s)) {
      const hit = KB.find(x => x[0].test(s)); if (hit) return reply(s, TA(hit[1]));
      return reply(s, T('The Economic World Model Challenge has two tracks here: a <b>strategy agent</b> on Uniswap V3 and Aave v3, and a <b>protocol risk agent</b> for Aave’s reserves.', '经济世界模型挑战赛在这里有两条赛道：在 Uniswap V3 与 Aave v3 上运作的<b>策略 Agent</b>，以及管理 Aave 储备的<b>协议风险 Agent</b>。'), [{ do: 'challenge', t: S.acct.app ? ['Open the challenge', '打开比赛'] : ['Join the challenge', '报名参赛'] }]);
    }
    reply(s, T('That isn’t something I can do in this workspace yet. ', '这件事我在这个工作台里还做不了。') + CAN(), id && chal(id) ? null : START());
  }
  function help() { reply('', (UI.vis && chal(UI.vis.id) ? T('Ask about the <b>score</b>, the <b>survival gate</b>, <b>stress tests</b>, the <b>forward window</b>, <b>models</b>, <b>limits</b>, <b>teams</b>, <b>prizes</b> or how to <b>verify</b> a result. In a track, tell me how to change your agent: “widen the range to 30%”, “be more careful”, “backtest on F5”. ', '可以问：<b>计分</b>、<b>生存门</b>、<b>压力题</b>、<b>前向窗口</b>、<b>模型</b>、<b>限制</b>、<b>队伍</b>、<b>奖项</b>，或怎样<b>核实</b>结果。在赛道里，直接说要怎么改 Agent：“把区间放宽到 30%”“保守一点”“在 F5 上回测”。') : CAN()) + T(' Type <code>/</code> for commands.', ' 输入 <code>/</code> 调出命令。')); }

  /* buttons and standing suggestions: data-do="verb:argument" */
  function act(d, el) {
    const i = d.indexOf(':'), verb = i < 0 ? d : d.slice(0, i), arg = i < 0 ? '' : d.slice(i + 1);
    if (verb === 'open') App.open(arg);
    else if (verb === 'challenge') Flow.cmd('challenge');
    else if (verb === 'reapply') Flow.cmd('reapply');
    else if (verb === 'say') Flow.text(arg);
    else if (verb === 'new') Models.start(arg, el && el.dataset.say);
    else if (verb === 'bt') { const r = Agent.backtest(arg, $('#bt-fam').value); r && UI.toast(`${r.fam} · ${bps(r.S)}`); }
    else if (verb === 'gh') Agent.connect(arg);
    else if (verb === 'ghx') Agent.disconnect();
    else if (verb === 'dl') { const row = S[arg].res && S[arg].res.row; if (row) save_(JSON.stringify(row, null, 2), `result-${arg}.json`, 'application/json'); }
    else if (verb === 'm') Models.act(arg, el);
    else if (verb === 'lib') Library.act(arg, el);
  }
  function save_(text, name, type) { const u = URL.createObjectURL(new Blob([text], { type })), l = document.createElement('a'); l.href = u; l.download = name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }

  return { route, act, help, reply, download: save_ };
})();
