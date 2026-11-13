'use strict';
/* One stage script per challenge thread, the sandbox clock that moves a thread between stages, commands, and the four views. */
const Flow = (() => {
  const A = MAP.acct.length, stages = sc => sc === 'acct' ? MAP.acct : MAP.track;
  const over = sc => sc === 'acct' ? S.acct.i >= A : S[sc].status !== 'active' || S[sc].i >= MAP.track.length;

  /* a thread only ever grows, so a stage snapshot is its state plus how long the thread was */
  function snap(sc, i) { SNAP[sc].length = i; SNAP[sc][i] = { s: JSON.stringify(S[sc]), n: UI.ctx(sc).el.children.length }; saveSnap(); App.keep(sc); save(); }
  function restore(sc, i) { const sn = SNAP[sc][i]; if (!sn) return false; S[sc] = JSON.parse(sn.s); const el = UI.ctx(sc).el; while (el.children.length > sn.n) el.lastChild.remove(); SNAP[sc].length = i + 1; return true; }
  const land = C => { C.target = null; if (C.fast) UI.run(C.id, () => { UI.fast = false; UI.toEnd(true); }); };
  const hub = () => UI.suggest('acct', ['t1', 't2'].filter(k => S[k].on).map(k => ({ do: 'open:' + k, t: [`Open ${TRACK[k].s[0]}`, `打开${TRACK[k].s[1]}`] })));

  async function play(sc) {
    const C = UI.ctx(sc), tok = ++C.run, list = stages(sc); UI.reset(sc); C.live = true;
    const mine = () => { if (tok !== C.run) throw CANCEL; UI.scope = sc; };
    try {
      for (;;) {
        mine();
        if (C.target != null && (S[sc].i >= C.target || over(sc))) land(C);
        if (over(sc)) {
          land(C);
          if (sc === 'acct') { S.acct.done = true; hub(); App.keep('acct'); } else await ending(sc);
          save(); App.rail(); return;
        }
        const i = S[sc].i; snap(sc, i); App.rail();
        UI.chapter(i, list[i].n);
        const r = await (sc === 'acct' ? ACCT[list[i].id]() : TRK[list[i].id](sc)); mine();
        if (r !== HALT) S[sc].i++;
      }
    } catch (e) { if (e !== CANCEL) { console.error(e); throw e; } }
    finally { if (tok === C.run) { C.live = false; App.rail(); } }
  }
  /* start a thread's script if it has one and it isn't already running */
  function ensure(sc) {
    const C = UI.ctx(sc); if (C.live) return;
    if (sc === 'acct') { if (!S.acct.app) return; if (S.acct.done) return hub(); }
    else if (!S.acct.done || !S[sc].on || S[sc].ended) return;
    play(sc);
  }
  function stop(sc) { const C = UI.ctx(sc); C.run++; C.live = false; C.target = null; UI.reset(sc); if (C.fast) UI.run(sc, () => { UI.fast = false; }); }

  /* the sandbox clock: back is a rewind to that stage's snapshot, forward replays with the defaults */
  function jump(sc, i) {
    const cur = S[sc].i, C = UI.ctx(sc);
    if (sc !== 'acct' && !S.acct.done) return UI.toast(T('Finish the challenge setup first.', '请先完成比赛准备。'));
    if (i > cur) { if (over(sc)) return; stop(sc); restore(sc, cur); C.target = i; UI.run(sc, () => { UI.fast = true; }); return play(sc); }
    stop(sc); if (!restore(sc, i)) return;
    S.sugg[sc] = [];
    if (sc === 'acct') ['t1', 't2'].forEach(k => { stop(k); S[k] = Object.assign(freshTrack(), { on: S.acct.tracks.includes(k) }); SNAP[k] = []; UI.ctx(k).el.innerHTML = ''; S.sugg[k] = []; UI.ctx(k).twin = null; App.keep(k); });
    saveSnap(); play(sc);
  }
  async function sideflow(id, fn) {
    const C = UI.ctx(id); if (C.side) return; C.side = true;
    try { await UI.run(id, fn); } catch (e) { if (e !== CANCEL) console.error(e); } finally { C.side = false; UI.chips(); App.keep(id); }
  }

  /* ── commands ── */
  const CMDS = [
    ['new', ['New chat', '新对话']], ['models', ['Models', '模型']], ['experiments', ['Experiments', '实验']], ['insights', ['Insights', '洞见']], ['marketplace', ['Marketplace', '市场']],
    ['challenge', ['Challenge overview', '比赛总览']], ['status', ['Where am I', '我在哪一步']], ['info', ['Track details', '赛道详情']], ['track', ['Switch track', '切换赛道']], ['inbox', ['Notifications', '通知']],
    ['keylost', ['Report the signing key lost', '签名钥匙报失']], ['withdraw', ['Withdraw from this track', '从这条赛道退赛']], ['reapply', ['Revise the application', '修改报名申请']],
    ['settings', ['Settings', '设置']], ['lang', ['English / 中文', 'English / 中文']], ['help', ['What can I ask', '可以问什么']],
  ];
  const trackInView = () => { const v = UI.vis; return v && (v.id === 't1' || v.id === 't2') ? v.id : null; };
  function cmd(c, el) {
    const a = S.acct, k = trackInView() || S.active;
    if (c === 'lang') { LANG = LANG === 'en' ? 'zh' : 'en'; sset('hb-lang', LANG); applyLang(); Apply.relang(); Info.relang(); Auth.relang(); App.relang(); Settings.relang(); Sandbox.refresh(); }
    else if (c === 'info') Info.toggle(a.app ? k : undefined);
    else if (c === 'info-x') Info.close();
    else if (c === 'home') view('home');
    else if (c === 'top') Home.top();
    else if (c === 'start') S.user ? enterApp() : Auth.open('app');
    else if (c === 'join' || c === 'challenge') !S.user ? Auth.open('apply') : a.app ? enterApp('acct') : Apply.open();
    else if (c === 'apply-x') Apply.close();
    else if (c === 'auth-x') view('home');
    else if (c === 'reapply') { if (!a.app) return Apply.open(); Info.close(); Apply.open({ revise: true }); }
    else if (c === 'new') App.fresh();
    else if (c === 'models' || c === 'experiments' || c === 'insights' || c === 'marketplace') App.open('p:' + { models: 'models', experiments: 'exps', insights: 'insights', marketplace: 'market' }[c]);
    else if (c === 'bell' || c === 'inbox') App.pop('bell');
    else if (c === 'sandbox') Sandbox.toggle();
    else if (c === 'account') App.pop('acct-menu');
    else if (c === 'stages') App.pop('stage-pop');
    else if (c === 'settings') Settings.open(el && el.dataset.tab);
    else if (c === 'settings-x') Settings.close();
    else if (c === 'signout') { App.pop(); S.user = null; S.cur = null; save(); view('home'); }
    else if (c === 'maillink') Auth.openLink();
    else if (c === 'team') { App.open('acct'); UI.tab('team'); document.body.classList.add('world-open'); }
    else if (c === 'record') { if (trackInView()) { UI.tab('record'); document.body.classList.add('world-open'); } }
    else if (c === 'track') { const o = k === 't1' ? 't2' : 't1'; S[o].on ? App.open(o) : UI.toast(T(`You haven’t entered ${TRACK[o].s[0]}.`, `你没有报名${TRACK[o].s[1]}。`)); }
    else if (c === 'status') {
      const v = UI.vis; if (!v || !S[v.id] || !a.app) return UI.toast(T('Open the challenge first.', '请先打开比赛。'));
      const list = stages(v.id), st = list[Math.min(S[v.id].i, list.length - 1)];
      sideflow(v.id, () => say(T(`You’re at <b>${st.n[0]}</b>${v.id === 'acct' ? '' : ' on ' + TRACK[v.id].s[0]}.`, `你在<b>${st.n[1]}</b>${v.id === 'acct' ? '' : '（' + TRACK[v.id].s[1] + '）'}。`)));
    }
    else if (c === 'help') Skills.help();
    else if (c === 'keylost') { if (!a.key) return UI.toast(T('No signing key registered yet.', '还没有登记签名钥匙。')); const id = trackInView() || 'acct'; App.open(id); sideflow(id, () => keyLost(id === 'acct' ? ['t1', 't2'].find(x => S[x].freeze) || null : id, false)); }
    else if (c === 'withdraw') {
      const w = (el && el.dataset.k) || trackInView(); if (!w || !a.done || !S[w].on || S[w].status !== 'active') return UI.toast(T('Nothing to withdraw from yet.', '现在还没有可退的赛道。'));
      App.open(w); sideflow(w, async () => { if (await withdraw(w)) { stop(w); play(w); } });
    }
  }

  function text(s) {
    s = s.trim(); if (!s) return;
    if (s[0] === '/') { const c = CMDS.find(x => x[0].startsWith(s.slice(1).toLowerCase())); return c ? cmd(c[0]) : UI.toast(T('Unknown command.', '没有这个命令。')); }
    const top = UI.top();
    if (top) { const n = parseInt(s, 10), low = s.toLowerCase(); const i = n >= 1 && n <= top.opts.length && String(n) === s ? n - 1 : top.opts.findIndex(o => o.t.some(x => x.toLowerCase() === low || (low.length > 2 && x.toLowerCase().includes(low)))); if (i >= 0) return UI.pick(i); }
    Skills.route(s);
  }
  return { play, ensure, stop, jump, cmd, text, sideflow, restore, CMDS, stages, over };
})();

/* ───────── chrome wiring ───────── */
document.addEventListener('click', e => {
  const act = e.target.closest('[data-act]'), d = e.target.closest('[data-do]'), o = e.target.closest('[data-open]');
  if (!e.target.closest('.pop, [data-act=bell], [data-act=account], [data-act=stages]')) App.pop();
  if (act) { const a = act.dataset.act; if (act.tagName === 'A') e.preventDefault(); a === 'rail' ? document.body.classList.toggle('rail-open') : a === 'world' ? document.body.classList.toggle('world-open') : Flow.cmd(a, act); }
  else if (d) Skills.act(d.dataset.do, d);
  else if (o) { document.body.classList.remove('rail-open'); App.open(o.dataset.open); }
  else if (!e.target.closest('#rail,[data-act=rail]')) document.body.classList.remove('rail-open');
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (Info.isOpen) return Info.close(); if (Settings.isOpen) return Settings.close(); if (Sandbox.isOpen) return Sandbox.close(); App.pop(); $('#slash').hidden = true; document.body.classList.remove('rail-open', 'world-open'); }
  if (document.body.dataset.view !== 'app' || Info.isOpen || Settings.isOpen) return;
  const ae = document.activeElement, typing = /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if (/^[1-9]$/.test(e.key) && UI.top() && +e.key <= UI.top().opts.length && (!typing || (ae.id === 'in' && !$('#in').value))) { e.preventDefault(); UI.pick(+e.key - 1); }
  if (e.key === '/' && !typing) { e.preventDefault(); $('#in').focus(); $('#in').value = '/'; slash(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#in').focus(); }
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
addEventListener('pagehide', () => { const v = UI.vis; if (v && !S[v.id]) App.keep(v.id); save(); });

/* ───────── views: home → sign in → (apply) → workspace ───────── */
function view(v) {
  document.body.dataset.view = v; document.body.classList.remove('rail-open', 'world-open'); App.pop(); Sandbox.close();
  $('#home').hidden = v !== 'home'; $('#auth').hidden = v !== 'auth'; $('#apply').hidden = v !== 'apply'; $('#app').hidden = v !== 'app';
  if (v === 'home') Home.show(); else { $('#h-vid').pause(); Field.redraw(); }
  Sandbox.refresh();
}
function enterApp(id) { S.draft = null; view('app'); App.start(id); }
const enterConsole = () => enterApp('acct');

/* ───────── start ───────── */
applyLang();
load();
if (S.user && S.draft && !S.draft.done) Apply.open();
else if (S.user) enterApp();
else view('home');
