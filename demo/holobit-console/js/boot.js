'use strict';
/* The play loop, time travel between stages, commands, free-text answers, and the three views. */
const Flow = (() => {
  let target = null, side = false;
  const A = MAP.acct.length;

  function snap(sc, i) { SNAP[sc].length = i; SNAP[sc][i] = { s: JSON.stringify(S[sc]), h: UI.th[sc].innerHTML }; }
  function restore(sc, i) { const sn = SNAP[sc][i]; if (!sn) return false; S[sc] = JSON.parse(sn.s); UI.th[sc].innerHTML = sn.h; SNAP[sc].length = i + 1; applyLang(UI.th[sc]); return true; }
  const reached = () => target && (target.sc === 'acct' ? S.acct.done || S.acct.i >= target.i : S.acct.done && S.active === target.sc && (S[target.sc].i >= target.i || S[target.sc].status !== 'active'));

  async function play() {
    const tok = ++RUN; UI.reset();
    try {
      for (;;) {
        if (reached()) { target = null; UI.fast = false; UI.toEnd(true); }
        const a = S.acct;
        if (!a.done) {
          UI.scope = 'acct';
          if (a.i >= A) { a.done = true; SNAP.acctEnd = UI.th.acct.innerHTML; continue; }
          snap('acct', a.i); save(); UI.rail();
          UI.chapter(a.i + 1, MAP.acct[a.i].n);
          await ACCT[MAP.acct[a.i].id](); guard(tok); a.i++; continue;
        }
        const k = S.active, t = S[k]; UI.scope = k;
        if (!t.on) { t.on = true; a.tracks.includes(k) || a.tracks.push(k); }
        if (t.status !== 'active' || t.i >= MAP.track.length) { target = null; UI.fast = false; save(); UI.rail(); await ending(k); return; }
        snap(k, t.i); save(); UI.rail();
        if (t.i === 0) UI.th[k].innerHTML || await UI.say(`<div class="enter"><small>${TA(TRACK[k].s)}</small><h3>${TA(TRACK[k].n)}</h3></div>`, { cls: 'wide', delay: 200 });
        UI.chapter(A + t.i + 1, MAP.track[t.i].n);
        const r = await TRK[MAP.track[t.i].id](k); guard(tok);
        if (r !== HALT) t.i++;
      }
    } catch (e) { if (e !== CANCEL) { console.error(e); throw e; } }
  }

  function jump(sc, i) {
    const a = S.acct;
    if (sc !== 'acct' && !a.done) return UI.toast(T('Finish registration first.', '请先完成报名。'));
    RUN++; UI.reset(); UI.fast = false; target = null;
    if (sc === 'acct') {
      if (!a.done && i > a.i) { restore('acct', a.i); target = { sc, i }; UI.fast = true; return play(); }
      if (!restore('acct', i)) return play();
      S.t1 = freshTrack(); S.t2 = freshTrack(); SNAP.t1 = []; SNAP.t2 = []; UI.th.t1.innerHTML = UI.th.t2.innerHTML = '';
    } else {
      const cur = S.active; if (S[cur].on) restore(cur, S[cur].i);
      S.active = sc;
      if (!S[sc].on) return play();
      if (i > S[sc].i) { restore(sc, S[sc].i); target = { sc, i }; UI.fast = true; return play(); }
      restore(sc, i);
    }
    play();
  }
  function track(k) { if (!S.acct.done) return UI.toast(T('Finish registration first.', '请先完成报名。')); if (k === S.active) return; RUN++; UI.reset(); const c = S.active; if (S[c].on && S[c].status === 'active') restore(c, S[c].i); S.active = k; if (S[k].on && S[k].status === 'active') restore(k, S[k].i); play(); }
  function restartStage() { const sc = S.acct.done ? S.active : 'acct'; RUN++; UI.reset(); restore(sc, S[sc].i); play(); }

  /* ── commands ── */
  const CMDS = [
    ['status', ['Where am I', '我在哪一步']], ['info', ['Track details', '赛道详情']], ['map', ['Branch map', '分支地图']], ['auto', ['Autoplay on / off', '自动演示 开 / 关']], ['track', ['Switch track', '切换赛道']], ['inbox', ['Inbox', '收件箱']], ['team', ['Team', '队伍']], ['record', ['Decision record', '决策记录']],
    ['keylost', ['Report the team key lost', '队伍钥匙报失']], ['withdraw', ['Withdraw from this track', '从这条赛道退赛']], ['reapply', ['Revise the application', '修改报名申请']], ['lang', ['English / 中文', 'English / 中文']], ['home', ['HoloBit home', 'HoloBit 首页']], ['restart', ['Restart the demo', '重新开始演示']], ['help', ['What can I ask', '可以问什么']],
  ];
  async function sideflow(fn) { if (side) return; side = true; try { await fn(); } catch (e) { if (e !== CANCEL) console.error(e); } finally { side = false; UI.chips(); } }
  function cmd(c) {
    const a = S.acct, k = S.active;
    if (c === 'map') { const m = $('#map'); m.hidden = !m.hidden; if (!m.hidden) { UI.map(); const cur = $('.m-st.cur', m); cur && cur.scrollIntoView({ inline: 'center', block: 'nearest' }); } }
    else if (c === 'lang') { LANG = LANG === 'en' ? 'zh' : 'en'; sset('hb-lang', LANG); applyLang(); Apply.relang(); Info.relang(); }
    else if (c === 'info') Info.toggle(a.app ? k : undefined);
    else if (c === 'info-x') Info.close();
    else if (c === 'home') view('home');
    else if (c === 'top') Home.top();
    else if (c === 'join') a.app ? view('app') : Apply.open();
    else if (c === 'apply-x') Apply.close();
    else if (c === 'reapply') { if (!a.app) return; Info.close(); Apply.open({ revise: true }); }
    else if (c === 'auto') { UI.auto = !UI.auto; if (UI.auto && $('#app').hidden === false) restartStage(); }
    else if (c === 'inbox' || c === 'team' || c === 'record') { UI.tab(c); document.body.classList.add('world-open'); }
    else if (c === 'track') track(k === 't1' ? 't2' : 't1');
    else if (c === 'restart' || c === 'signout') { RUN++; wipe(); location.reload(); }
    else if (c === 'status') sideflow(async () => { const st = a.done ? MAP.track[Math.min(S[k].i, MAP.track.length - 1)] : MAP.acct[a.i], cv = coverage(); await say(T(`You’re at <b>${st.n[0]}</b>${a.done ? ' on ' + TRACK[k].s[0] : ''}. ${cv.n} of ${cv.of} branches seen.`, `你在<b>${st.n[1]}</b>${a.done ? '（' + TRACK[k].s[1] + '）' : ''}。${cv.of} 条分支里已走过 ${cv.n} 条。`)); });
    else if (c === 'help') sideflow(async () => { await say(T('Ask about the <b>score</b>, the <b>survival gate</b>, <b>stress tests</b>, the <b>forward window</b>, <b>models</b>, <b>limits</b>, <b>teams</b>, <b>prizes</b> or how to <b>verify</b> a result. Type <code>/</code> for commands.', '可以问：<b>计分</b>、<b>生存门</b>、<b>压力题</b>、<b>前向窗口</b>、<b>模型</b>、<b>限制</b>、<b>队伍</b>、<b>奖项</b>，或怎样<b>核实</b>结果。输入 <code>/</code> 调出命令。')); });
    else if (c === 'keylost') { if (!a.key) return UI.toast(T('No team key registered yet.', '还没有登记队伍钥匙。')); sideflow(() => keyLost(a.done ? k : null, false)); }
    else if (c === 'withdraw') { if (!a.done || S[k].status !== 'active') return UI.toast(T('Nothing to withdraw from yet.', '现在还没有可退的赛道。')); sideflow(async () => { if (await withdraw(k)) { RUN++; UI.reset(); play(); } }); }
  }

  /* ── free text: answered from the rulebook, no model behind it ── */
  const KB = [
    [/score|scor|formula|S ?=|计分|分数|怎么算|公式/i, ['Track 1: <code>S = r − 0.5 × MDD</code>, net return minus half the worst drawdown. Track 2: bad debt, liquidation penalties, revenue and stuck withdrawals, each measured against the same world with parameters unchanged. Hidden stress tests are 80% of the total, the forward window 20%.', '赛道 1：<code>S = r − 0.5 × MDD</code>，净收益减去最大回撤的一半。赛道 2：坏账、清算罚金、协议收入与取不出的存款，都与“参数不变”的同一世界相比。隐藏压力题占 80%，前向段占 20%。']],
    [/gate|surviv|liquidat|生存门|清算|破产/i, ['The survival gate is a gate, not a score. A Track 1 run fails on liquidation, insolvency, bad debt, or more than 5% missed decisions. A Track 2 run fails on excess bad debt against the baseline, liquidations your own change caused, or missed decisions. Fail too often and you keep your rank but can’t take a prize or reach the finals.', '生存门是门，不是分。赛道 1 的运行在被清算、破产、坏账或超过 5% 的决定缺失时记门失败。赛道 2 在坏账比基线多出、调参直接引发清算或决定缺失时记门失败。失败太多，名次照列，但不能获奖，也不进决赛。']],
    [/stress|scenario|famil|hidden|压力|情景|隐藏|留出/i, ['Thirteen scenario families: eleven published, two held out. Units are generated after the freeze from a public randomness beacon, so nobody can pick the questions. In a third to a half of units the alarm fires and the event never comes.', '13 个情景族：11 个公开，2 个留出。题目在冻结之后用公开随机信标生成，谁也挑不了题。每族有三到五成的单元，信号来了，事件却不来。']],
    [/forward|real week|前向|真实/i, ['The forward window is one week of real markets that happens after the freeze, recorded and replayed at speed. It is a single path, so it is noisy, and it carries 20% of the score.', '前向窗口是冻结之后真实发生的一周行情，录下来高速重放。它只有一条路径，噪声大，所以只占 20%。']],
    [/llm|model|gpt|claude|gemini|模型|大模型|密钥|key/i, ['Your agent may call a language model, through the competition gateway only, on your own provider key. Only dated snapshots on the whitelist; no server-side tools, no stored objects. Every team has the same budget per decision and per simulated day.', 'Agent 可以调用大模型，但只能经比赛网关，用你自己的服务方密钥。只接受白名单里带日期的快照；不许服务端工具，不许服务端保存的对象。各队每次决定、每个模拟日的预算上限相同。']],
    [/limit|size|4 ?gb|time|timeout|second|cpu|memory|限制|大小|超时|资源/i, ['Image: OCI, linux/amd64, 4 GB at most. Track 1: 90 s per decision, 2 vCPU, 4 GiB. Track 2: 180 s, 4 vCPU, 8 GiB. A late decision is treated as a hold and counted.', '镜像：OCI，linux/amd64，不超过 4 GB。赛道 1：每次决定 90 秒，2 vCPU，4 GiB。赛道 2：180 秒，4 vCPU，8 GiB。超时的决定按保持处理并计数。']],
    [/team|member|both|two tracks|队|成员|两条/i, ['Teams are one to five people. Enter Track 1, Track 2 or both; each is ranked separately. One control group submits one official version per track.', '一支队伍 1 到 5 人。可以参加赛道 1、赛道 2 或两条；各自单独排名。同一控制关系组在每条赛道只交一个正式版本。']],
    [/language|python|typescript|rust|语言/i, ['Any language. The agent is a container that speaks the interface. Starter kits exist for Python and TypeScript.', '语言不限。Agent 是一个按接口说话的容器。起步包有 Python 与 TypeScript 两种。']],
    [/where.*run|hosted|container|internet|在哪.*跑|托管|联网/i, ['While you practise, on your own machine against the remote interface. In evaluation, in a hosted container with no internet: only the context API and the model gateway are reachable.', '练习时在你自己的机器上，经远程接口接入。正式评测在托管容器里，没有外网，只通上下文 API 与大模型网关。']],
    [/update|change.*agent|after.*freeze|freeze|冻结|更新|改/i, ['Until the freeze, submit as many versions as you like. The freeze fixes one. After it nothing changes.', '冻结之前可以反复提交。冻结锁定其中一个，之后什么都不能改。']],
    [/verify|check.*result|recompute|reproduc|核实|重算|复现/i, ['After the finals the seeds, scenarios and scoring code are published. Run the verification script and you should get the published score, integer for integer.', '决赛之后，种子、情景与评分程序全部公开。运行核实脚本，应当得到与公布分数逐个整数相同的结果。']],
    [/prize|award|money|奖/i, ['Prizes are announced on the challenge site. Awards go to finalists by rank, and are confirmed after the appeal window and identity verification.', '奖项在比赛官网公布。奖只发给决赛 Agent，按名次发；申诉期结束、身份核验通过后确认。']],
    [/appeal|dispute|申诉/i, ['Each ruling has an appeal window. An appeal gets a case number and a written answer with reasons. If a recomputation is upheld, it is redone for every agent it touches.', '每个结论都有申诉窗口。申诉会得到受理编号和附理由的书面答复。重算成立时，对所有受影响的 Agent 一并重算。']],
    [/(hi|hello|hey)|你好|嗨/i, ['Hello. Pick a reply below, or ask me about the rules.', '你好。点下面的回复继续，或者问我规则。']],
  ];
  function text(s) {
    s = s.trim(); if (!s) return;
    if (s[0] === '/') { const c = CMDS.find(x => x[0].startsWith(s.slice(1).toLowerCase())); return c ? cmd(c[0]) : UI.toast(T('Unknown command.', '没有这个命令。')); }
    const top = UI.top();
    if (top) { const n = parseInt(s, 10), low = s.toLowerCase(); const i = n >= 1 && n <= top.opts.length && String(n) === s ? n - 1 : top.opts.findIndex(o => o.t.some(x => x.toLowerCase() === low || (low.length > 2 && x.toLowerCase().includes(low)))); if (i >= 0) return UI.pick(i); }
    const hit = KB.find(x => x[0].test(s));
    UI.me(esc(s));
    sideflow(() => say(hit ? TA(hit[1]) : T('No model is wired to this demo, so I answer from the rulebook. Try <b>score</b>, <b>gate</b>, <b>stress tests</b> or <code>/help</code>.', '这个演示没有接模型，我只按规则手册回答。试试<b>计分</b>、<b>生存门</b>、<b>压力题</b>，或输入 <code>/help</code>。')));
  }
  return { play, jump, track, cmd, text, CMDS, restore };
})();

/* ───────── chrome wiring ───────── */
document.addEventListener('click', e => {
  const act = e.target.closest('[data-act]'), c = e.target.closest('[data-cmd]'), st = e.target.closest('#spine .st'), tr = e.target.closest('#tracks [data-track]'), mg = e.target.closest('.m-go');
  if (act) { const a = act.dataset.act; if (act.tagName === 'A') e.preventDefault(); a === 'rail' ? document.body.classList.toggle('rail-open') : a === 'world' ? document.body.classList.toggle('world-open') : Flow.cmd(a); }
  else if (c) Flow.cmd(c.dataset.cmd);
  else if (st) { document.body.classList.remove('rail-open'); Flow.jump(st.dataset.sc, +st.dataset.ix); }
  else if (tr) Flow.track(tr.dataset.track);
  else if (mg) { const s = mg.closest('.m-st'); $('#map').hidden = true; if (s.dataset.sc !== 'acct' && S.acct.done && s.dataset.sc !== S.active && !S[s.dataset.sc].on) Flow.track(s.dataset.sc); else Flow.jump(s.dataset.sc, +s.dataset.ix); }
  else if (!e.target.closest('#rail,[data-act=rail]')) document.body.classList.remove('rail-open');
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (Info.isOpen) return Info.close(); $('#map').hidden = true; $('#slash').hidden = true; document.body.classList.remove('rail-open', 'world-open'); }
  if (document.body.dataset.view !== 'app' || Info.isOpen) return;
  if (/^[1-9]$/.test(e.key) && UI.top() && +e.key <= UI.top().opts.length && (document.activeElement === document.body || (document.activeElement.id === 'in' && !$('#in').value))) { e.preventDefault(); UI.pick(+e.key - 1); }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#app').hidden) { e.preventDefault(); $('#in').focus(); $('#in').value = '/'; slash(); }
});
function slash() {
  const v = $('#in').value, box = $('#slash');
  if (v[0] !== '/') return (box.hidden = true);
  const q = v.slice(1).toLowerCase(), list = Flow.CMDS.filter(c => c[0].startsWith(q));
  box.hidden = !list.length; box.innerHTML = list.map((c, i) => `<button data-c="${c[0]}" class="${i ? '' : 'on'}"><code>/${c[0]}</code><span>${TA(c[1])}</span></button>`).join('');
}
$('#in').addEventListener('input', slash);
$('#slash').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { $('#in').value = ''; $('#slash').hidden = true; Flow.cmd(b.dataset.c); } });
$('#say').addEventListener('submit', e => { e.preventDefault(); const v = $('#in').value; $('#in').value = ''; $('#slash').hidden = true; Flow.text(v); });

$('#thread').addEventListener('pointermove', e => { const c = e.target.closest('.card'); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px'); }, { passive: true });

/* ───────── views: home → apply → console ───────── */
function view(v) {
  document.body.dataset.view = v; document.body.classList.remove('rail-open', 'world-open');
  $('#home').hidden = v !== 'home'; $('#apply').hidden = v !== 'apply'; $('#app').hidden = v !== 'app';
  if (v === 'home') Home.show(); else { $('#h-vid').pause(); Field.redraw(); }
}
function enterConsole() { S.draft = null; view('app'); UI.rail(); UI.inbox(); UI.coverage(); Flow.play(); }

/* ───────── start ───────── */
applyLang();
if (load() && S.acct.app) {
  const a = S.acct; S.draft = null;
  if (!a.done) Flow.restore('acct', a.i);
  else { UI.th.acct.innerHTML = SNAP.acctEnd || ''; ['t1', 't2'].forEach(k => { if (S[k].on && SNAP[k][S[k].i]) Flow.restore(k, S[k].i); }); }
  applyLang(); enterConsole();
} else if (S.draft && !S.draft.done) { UI.idle(['Register', '报名'], ''); Apply.open(); }
else { wipe(); UI.idle(['Register', '报名'], ''); view('home'); }
