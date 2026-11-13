'use strict';
/* The sandbox: the one place that says this build runs on preset data, and the controls that stand in for a backend:
   the challenge clock, what the outside world answers next, the mail the product "sent", and a reset. */
const Sandbox = (() => {
  const root = $('#sbx'), body = $('#sbx-body');
  const key = (sc, br) => (sc === 'acct' ? 'a' : sc) + '.' + br;
  let armedReset = 0;

  /* a one-shot answer for the next time this branch point comes up; anything else falls through to the default */
  function take(sc, br, ids) {
    const k = key(sc, br), v = S.sbx.next[k];
    if (v == null || !ids.includes(v)) return undefined;
    delete S.sbx.next[k]; save(); refresh(); return v;
  }

  /* what the panel is about depends on what is on screen */
  function scope() {
    const v = document.body.dataset.view, t = UI.vis;
    if (v === 'auth') return { sc: 'acct', only: ['mail'] };
    if (v === 'apply') return { sc: 'acct', only: ['team'] };
    if (v === 'app' && t && S[t.id] && S.acct.app) return { sc: t.id, only: t.id === 'acct' ? ['llm'] : null, clock: true };
    return null;
  }
  function render() {
    const sp = scope(), cv = coverage(), view = document.body.dataset.view;
    let h = '';
    if (sp && sp.clock) {
      const list = Flow.stages(sp.sc), st = S[sp.sc], end = Flow.over(sp.sc);
      h += `<section><h5>${T('Clock', '时钟')} · ${sp.sc === 'acct' ? T('Setup', '准备') : TA(TRACK[sp.sc].s)}</h5><ol class="sbx-clock">${list.map((x, i) => `<li class="${i < st.i || end ? 'done' : i === st.i ? 'cur' : ''}"><button data-j="${i}" ${sp.sc !== 'acct' && !S.acct.done ? 'disabled' : ''}>${TA(x.n)}</button></li>`).join('')}</ol>${sp.sc === 'acct' ? `<p class="hint">${T('Rewinding the setup also resets both tracks.', '回退准备阶段会同时重置两条赛道。')}</p>` : ''}</section>`;
    }
    if (sp) {
      const rows = Flow.stages(sp.sc).flatMap((x, i) => x.br.filter(b => b.w && (!sp.only || sp.only.includes(b.id))).map(b => ({ b, x, i })));
      const cur = sp.clock ? S[sp.sc].i : -1;
      h += `<section><h5>${T('Next outcome', '下一次结果')}</h5>${rows.map(({ b, x, i }) => { const armed = S.sbx.next[key(sp.sc, b.id)], seen = S.seen[key(sp.sc, b.id)] || [];
        return `<div class="sbx-br ${i === cur ? 'cur' : ''}"><span>${TA(b.n)}${sp.only ? '' : `<small>${TA(x.n)}</small>`}</span><div>${b.w.filter(o => !(sp.sc === 't2' && b.t1only && b.t1only.includes(o))).map((o, n) => `<button data-b="${b.id}" data-o="${o}" class="${armed === o ? 'on' : ''} ${!armed && !n ? 'def' : ''} ${seen.includes(o) ? 'seen' : ''}">${TA(b.o[o])}</button>`).join('')}</div></div>`; }).join('')}</section>`;
    }
    if (S.inbox.length) h += `<section><h5>${T('Mailbox', '邮箱')}</h5><div class="sbx-mail">${S.inbox.slice(0, 3).map(UI.mailHTML).join('')}</div></section>`;
    h += `<section class="sbx-foot"><button class="btn sm" data-s="fill">${T('Fill this step', '填好当前步骤')}</button><label class="sw"><input type="checkbox" data-s="auto" ${S.sbx.auto ? 'checked' : ''}><i></i><span>${T('Auto-run', '自动运行')}</span></label><button class="btn sm link" data-s="reset">${armedReset ? T('Erase everything?', '确定全部清除？') : T('Reset', '重置')}</button></section>
      <p class="sbx-cov">${view === 'app' || view === 'apply' ? `${cv.n} / ${cv.of} ${L('challenge paths seen', '条比赛路径已走过')}` : ''}</p>`;
    body.innerHTML = h;
  }
  function refresh() {
    const wait = document.body.dataset.view === 'auth' && S.inbox[0] && S.inbox[0].link && S.inbox[0].unread;
    $$('.sbx-chip').forEach(c => c.classList.toggle('ping', !!wait));
    if (!root.hidden) render();
  }
  function open() { armedReset = 0; root.hidden = false; render(); }
  function close() { root.hidden = true; }

  root.addEventListener('click', e => {
    const j = e.target.closest('[data-j]'), b = e.target.closest('[data-b]'), s = e.target.closest('[data-s]'), sp = scope();
    if (j && sp) { Flow.jump(sp.sc, +j.dataset.j); setTimeout(render, 60); }
    else if (b && sp) { const k = key(sp.sc, b.dataset.b), first = branch(sp.sc, b.dataset.b).w[0]; if (S.sbx.next[k] === b.dataset.o || b.dataset.o === first) delete S.sbx.next[k]; else S.sbx.next[k] = b.dataset.o; save(); render(); }
    else if (s && s.dataset.s === 'fill') fill();
    else if (s && s.dataset.s === 'reset') { if (armedReset) { wipe(); location.reload(); } else { armedReset = 1; render(); } }
  });
  root.addEventListener('change', e => { if (e.target.dataset.s === 'auto') { S.sbx.auto = UI.auto = e.target.checked; save(); if (UI.auto) fill(true); } });

  function fill(quiet) {
    const v = document.body.dataset.view, t = UI.vis;
    if (v === 'auth') return Auth.fill();
    if (v === 'apply') return Apply.fill();
    if (v === 'app' && t && UI.kick(t.id)) return;
    quiet || UI.toast(T('Nothing here is waiting for an answer.', '这里没有等待回答的步骤。'));
  }

  /* Console helper: walk both tracks start to finish several times with random answers, to exercise every branch a click can reach.
     await Sandbox.sweep() → { n, of } */
  async function sweep(rounds = 8) {
    if (!S.acct.done) return 'finish the challenge setup first';
    const was = window.__pick; window.__pick = n => Math.floor(Math.random() * n);
    for (let r = 0; r < rounds; r++) for (const k of ['t1', 't2'].filter(x => S[x].on)) {
      Flow.jump(k, 0);
      const C = UI.ctx(k); C.target = MAP.track.length + 1; UI.run(k, () => { UI.fast = true; });
      for (let n = 0; n < 4000 && C.live; n++) await wait(5);
    }
    window.__pick = was; ['t1', 't2'].forEach(k => { const C = UI.ctx(k); C.target = null; UI.run(k, () => { UI.fast = false; }); });
    return coverage();
  }

  return { take, refresh, open, close, fill, sweep, toggle() { root.hidden ? open() : close(); }, get isOpen() { return !root.hidden; } };
})();
