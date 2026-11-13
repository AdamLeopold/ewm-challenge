'use strict';
/* The workspace shell: the sidebar, the threads and pages it opens, the top bar, and what the side panel shows for each. */
const App = (() => {
  const IC = {
    models: '<path d="M8 1.5 14 5v6l-6 3.5L2 11V5z"/><path d="M2 5l6 3.5L14 5M8 8.5v6"/>',
    exps: '<path d="M6 1.5h4M6.5 1.5v4.2L2.6 12.4a1.4 1.4 0 0 0 1.2 2.1h8.4a1.4 1.4 0 0 0 1.2-2.1L9.5 5.7V1.5"/><path d="M4.6 10h6.8"/>',
    insights: '<path d="M3 1.5h7l3 3v10H3z"/><path d="M5.5 11.5v-2M8 11.5V7M10.5 11.5v-3.2"/>',
    market: '<path d="M2 6.2 3.2 2h9.6L14 6.2M2 6.2h12M3 6.2v8h10v-8M6.5 14.2v-4h3v4"/>',
    plus: '<path d="M8 3v10M3 8h10"/>', bell: '<path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.6H2.8zM6.6 14.2a1.6 1.6 0 0 0 2.8 0"/>',
    panel: '<rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M10 2.5v11"/>', down: '<path d="m4 6 4 4 4-4"/>',
    chat: '<path d="M2.5 3.5h11v7.5H7l-3 2.5v-2.5H2.5z"/>',
  };
  const ic = (n, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
  const NAV = [['models', 'Models', '模型'], ['exps', 'Experiments', '实验'], ['insights', 'Insights', '洞见'], ['market', 'Marketplace', '市场']];
  const PANES = { acct: ['calendar', 'team'], t1: ['twin', 'agent', 'record'], t2: ['twin', 'agent', 'record'], model: ['canvas', 'params', 'runs'], exp: ['dash', 'table', 'history'] };
  const TABN = { twin: ['Twin', '孪生'], agent: ['Agent', 'Agent'], record: ['Record', '记录'], calendar: ['Calendar', '日历'], team: ['Team', '队伍'], canvas: ['Canvas', '画布'], params: ['Parameters', '参数'], runs: ['Runs', '运行'], dash: ['Dashboard', '仪表盘'], table: ['Tables', '数据表'], history: ['Run history', '运行记录'] };
  const chal = id => id === 'acct' || id === 't1' || id === 't2', isPage = id => !!id && id.slice(0, 2) === 'p:';
  const thread = id => S.threads.find(t => t.id === id);
  const title = t => Array.isArray(t.title) ? TA(t.title) : esc(t.title);
  const loaded = {}; let booted = false;

  /* ── thread bodies: kept as markup, one stored item each ── */
  function dom(id) {
    const C = UI.ctx(id); if (loaded[id]) return C; loaded[id] = 1;
    if (!C.el.children.length) {
      C.el.innerHTML = tget(id);
      $$('.card:not(.done)', C.el).forEach(c => { c.classList.add('done'); $$('input,select,textarea,button', c).forEach(x => { if (!x.hasAttribute('data-keep')) x.disabled = true; }); });
      $$('.typing', C.el).forEach(x => x.remove()); applyLang(C.el);
    }
    return C;
  }
  function keep(id) {
    const live = UI.ctx(id).el;                               // what was typed and ticked is part of the record
    live.querySelectorAll('input, textarea, select').forEach(x => {
      if (x.type === 'checkbox' || x.type === 'radio') x.toggleAttribute('checked', x.checked);
      else if (x.tagName === 'TEXTAREA') x.textContent = x.value;
      else if (x.tagName === 'SELECT') [...x.options].forEach(o => o.toggleAttribute('selected', o.selected));
      else if (x.type !== 'password' && x.type !== 'file') x.setAttribute('value', x.value);
    });
    const c = live.cloneNode(true);
    $$('.hero, .typing', c).forEach(x => x.remove()); $$('.in', c).forEach(x => x.classList.remove('in')); $$('.run', c).forEach(x => x.classList.remove('run'));
    if (!chal(id)) while (c.innerHTML.length > 150000 && c.children.length > 4) c.firstChild.remove();
    tset(id, c.innerHTML);
  }
  function make(kind, ttl, x) { const t = Object.assign({ id: 'c' + (++S.n), kind, title: ttl, at: Date.now() }, x); S.threads.unshift(t); if (S.threads.length > 30) { const old = S.threads.pop(); drop(old.id, true); } save(); return t; }
  function drop(id, quiet) {
    const t = thread(id); S.threads = S.threads.filter(x => x.id !== id); sdel(KEY + ':t:' + id); delete S.sugg[id];
    if (t && t.model && S.models[t.model]) { delete S.models[t.model]; Object.keys(S.exps).forEach(e => { if (S.exps[e].model === t.model) delete S.exps[e]; }); }
    const C = UI.ctx(id); C.run++; C.el.innerHTML = ''; save();
    if (!quiet) S.cur === id ? fresh() : rail();
  }
  function touch(id, s) { const t = thread(id); if (!t) return; t.at = Date.now(); if (s && t.kind === 'chat' && Array.isArray(t.title)) t.title = s.slice(0, 48); S.threads.sort((a, b) => b.at - a.at); save(); keep(id); rail(); if (S.cur === id) bar(); }
  /* a blank chat: reuse the empty one if there is one */
  function fresh(quiet) {
    const t = S.threads.find(x => x.kind === 'chat' && Array.isArray(x.title) && !tget(x.id) && !UI.ctx(x.id).el.querySelector('.msg')) || make('chat', ['New chat', '新对话']);
    open(t.id); return t.id;
  }
  function hero(el) {
    if (el.children.length) return;
    el.innerHTML = `<div class="hero"><h2 class="h-h2">${T('What do you want to simulate?', '想模拟什么？')}</h2>
      <div class="hero-g">${Models.TPL.map(m => `<button data-do="new:${m.id}"><small>${TA(m.tag)}</small><b>${TA(m.n)}</b><span>${TA(m.ask)}</span></button>`).join('')}</div>
      <button class="hero-c" data-act="challenge"><i></i><span>${T('Economic World Model Challenge', '经济世界模型挑战赛')}</span><em>${S.acct.app ? T('Open', '打开') : T('Join', '报名')} →</em></button></div>`;
  }

  /* ── open a thread or a page ── */
  function open(id) {
    if (id === 'acct' && !S.acct.app) return Flow.cmd('challenge');
    if (id === 't1' || id === 't2') { if (!S.acct.done) { UI.toast(T('Finish the challenge setup first.', '请先完成比赛准备。')); id = 'acct'; } else if (!S[id].on) return Flow.cmd('reapply'); }
    if (!chal(id) && !isPage(id) && !thread(id)) return fresh();
    S.cur = id; pop(); document.body.classList.remove('rail-open', 'world-open');
    const page = isPage(id);
    $('#page').hidden = !page; $('#thread').hidden = page;
    if (page) { UI.show(null); Library.page(id.slice(2)); $('#scroll').scrollTop = 0; }
    else {
      const C = dom(id); if (!chal(id)) hero(C.el);
      if (chal(id) && !C.twin) { const list = Flow.stages(id); C.twin = { idle: true, phase: Flow.over(id) && id !== 'acct' ? ['Complete', '完赛'] : list[Math.min(S[id].i, list.length - 1)].n, sub: '', stress: 0 }; }
      UI.show(id); if (id === 't1' || id === 't2') S.active = id;
      if (chal(id)) Flow.ensure(id);
    }
    const tk = id === 't2' ? 't2' : 't1'; document.body.dataset.track = tk; Field.track(tk);
    tabs(); bar(); rail(); save(); Sandbox.refresh();
  }

  /* ── side panel: which tabs this kind of thread has ── */
  function panes() { const id = S.cur, t = thread(id); return chal(id) ? PANES[id] : t && t.model ? PANES[t.mode === 'exp' && Models.hasExp(t.model) ? 'exp' : 'model'] : null; }
  function tabs() {
    const ps = panes(), id = S.cur, t = thread(id);
    document.body.classList.toggle('no-panel', !ps);
    if (!ps) { $('#w-tabs').innerHTML = ''; return; }
    const sw = t && t.model && Models.hasExp(t.model) ? `<div class="a-seg w-mode"><button data-mode="model" class="${t.mode !== 'exp' ? 'on' : ''}">${T('Model', '模型')}</button><button data-mode="exp" class="${t.mode === 'exp' ? 'on' : ''}">${T('Experiment', '实验')}</button></div>` : '';
    $('#w-mode').innerHTML = sw; $('#w-mode').hidden = !sw;
    $('#w-tabs').innerHTML = ps.map(p => `<button data-tab="${p}">${TA(TABN[p])}</button>`).join('') + `<button class="ib only-s w-x" data-act="world" aria-label="Close">×</button>` + (id === 't1' || id === 't2' ? `<button class="ib info-b" data-act="info" data-tip-en="Track details" data-tip-zh="赛道详情" aria-label="Track details"><svg width="20" height="20"><use href="#ic-info"/></svg></button>` : '');
    applyLang($('#w-tabs'));
    const C = UI.vis; UI.tab(C && ps.includes(C.tab) ? C.tab : ps[0]);
  }
  $('#w-mode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'), t = thread(S.cur); if (b && t) { t.mode = b.dataset.mode; save(); tabs(); } });
  function pane(name) {
    const id = S.cur, t = thread(id);
    if (name === 'agent') Agent.paint(id); else if (name === 'record') UI.record(); else if (name === 'team') UI.team(); else if (name === 'calendar') calendar();
    else if (t && t.model) Models.pane(name, t);
  }
  function calendar() {
    const a = S.acct, PH = [[['Registration', '报名'], () => a.app ? 'done' : 'cur', k => false], [['Build and practise', '构建与练习'], null, k => S[k].i <= 3], [['Warm-up', '热身轮'], null, k => S[k].i === 4], [['Freeze', '冻结'], null, k => S[k].i === 5], [['Evaluation', '评测'], null, k => S[k].i === 6], [['Finals', '决赛'], null, k => S[k].i === 7], [['Results and verification', '结果与核实'], null, k => S[k].i >= 8]];
    const on = ['t1', 't2'].filter(k => S[k].on && a.done);
    $('#w-cal').innerHTML = `<div class="w-phase"><h2>${T('Tracks 1–2', '赛道 1–2')}</h2><p>${T('Opens December 2026', '2026 年 12 月开放')}</p></div><ol class="cal">${PH.map((p, i) => { const here = on.filter(k => S[k].status === 'active' ? p[2](k) : i === PH.length - 1);
      return `<li class="${i === 0 && a.app ? 'done' : here.length ? 'cur' : ''}"><span>${TA(p[0])}</span>${here.map(k => `<button class="tg ${k}" data-open="${k}">${TRACK[k].tag}</button>`).join('')}</li>`; }).join('')}</ol>
      <p class="hint">${T('Dates for each phase are published on the challenge site.', '各阶段日期以比赛官网公布为准。')} <a href="../../holobit.html" target="_blank" rel="noopener">${T('Challenge site', '比赛官网')} ↗</a></p>`;
  }

  /* ── top bar ── */
  function bar() {
    const id = S.cur, t = thread(id);
    let h = '';
    if (chal(id)) {
      const list = Flow.stages(id), st = S[id], end = Flow.over(id), cur = list[Math.min(st.i, list.length - 1)];
      h = (id === 'acct' ? `<b>${T('EWM Challenge', 'EWM 挑战赛')}</b>` : `<b>${TA(TRACK[id].s)}</b><span>${TA(TRACK[id].n)}</span>`) + `<button class="stage-b ${end ? 'end' : ''}" data-act="stages"><i></i>${end ? (id === 'acct' ? T('Ready', '已就绪') : TA({ complete: ['Complete', '完赛'], withdrawn: ['Withdrawn', '已退赛'], unqualified: ['Closed', '已结束'], active: ['Complete', '完赛'] }[st.status])) : TA(cur.n)}${ic('down', 12)}</button>`;
    } else if (isPage(id)) { const n = NAV.find(x => x[0] === id.slice(2)); h = `<b class="ttl">${n ? T(n[1], n[2]) : ''}</b>`; }
    else if (t) h = `<b class="ttl">${title(t)}</b>`;
    $('#crumb').innerHTML = h;
    $('#bar .info-b').hidden = !(id === 't1' || id === 't2'); $('#bar [data-act=world]').hidden = !panes();
  }
  function stagePop() {
    const id = S.cur; if (!chal(id)) return '';
    const list = Flow.stages(id), st = S[id], end = Flow.over(id);
    return list.map((x, i) => `<button class="${i < st.i || end ? 'done' : i === st.i ? 'cur' : 'lock'}" data-sec="${i}" ${i > st.i && !end ? 'disabled' : ''}><i></i>${TA(x.n)}</button>`).join('');
  }

  /* ── sidebar ── */
  function rail() {
    if ($('#app').hidden) return;
    const a = S.acct, u = S.user || {}, cur = S.cur;
    $('#r-nav').innerHTML = NAV.map(n => `<button class="r-row ${cur === 'p:' + n[0] ? 'on' : ''}" data-open="p:${n[0]}">${ic(n[0])}<span>${T(n[1], n[2])}</span></button>`).join('');
    const dot = id => UI.ctx(id).unread ? '<u></u>' : '';
    $('#r-chal').innerHTML = !a.app ? `<button class="r-row join" data-act="challenge"><small>EWM</small><span>${T('Economic World Model Challenge', '经济世界模型挑战赛')}</span><em>${T('Join', '报名')}</em></button>`
      : `<button class="r-row ${cur === 'acct' ? 'on' : ''}" data-open="acct"><small>EWM</small><span>${T('Overview', '总览')}</span>${a.done ? dot('acct') : `<em>${TA(MAP.acct[Math.min(a.i, 2)].n)}</em>`}</button>` + ['t1', 't2'].map(k => { const t = S[k];
        return !t.on ? `<button class="r-row off ${k}" data-act="reapply"><small>+</small><span>${TA(TRACK[k].n)}</span></button>`
          : `<button class="r-row ${k} ${cur === k ? 'on' : ''}" data-open="${k}" ${a.done ? '' : 'disabled'}><small>${TRACK[k].tag}</small><span>${TA(TRACK[k].n)}</span>${dot(k) || `<em>${t.status !== 'active' ? TA({ complete: ['Complete', '完赛'], withdrawn: ['Withdrawn', '已退赛'], unqualified: ['Closed', '已结束'] }[t.status]) : !a.done ? '' : TA(MAP.track[Math.min(t.i, MAP.track.length - 1)].n)}</em>`}</button>`; }).join('');
    const rec = S.threads.filter(t => t.model || !Array.isArray(t.title) || t.id === cur);
    $('#r-recent').innerHTML = rec.map(t => `<div class="r-row ${cur === t.id ? 'on' : ''}"><button data-open="${t.id}">${ic(t.model ? 'models' : 'chat', 14)}<span>${title(t)}</span>${UI.ctx(t.id).unread ? '<u></u>' : ''}</button><button class="x" data-del="${t.id}" aria-label="Delete">×</button></div>`).join('');
    $('#r-rec-h').hidden = !rec.length;
    const nm = u.name || u.handle || u.email || '';
    $('#who').innerHTML = `<div class="ava">${esc((nm || '?')[0].toUpperCase())}</div><div><b>${esc(nm)}</b><span>${esc(u.plan || 'Free')}</span></div>`;
    $('#acct-who').innerHTML = `<b>${esc(nm)}</b><span>${esc(u.auth === 'github' ? '@' + u.handle : u.email || '')}</span>`;
    if (chal(cur)) bar();
  }
  $('#rail').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); drop(d.dataset.del); } });
  $('#stage-pop').addEventListener('click', e => {
    const b = e.target.closest('[data-sec]'); if (!b || b.disabled) return; pop();
    const el = $(`#sec-${S.cur}-${b.dataset.sec}`); el ? el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }) : UI.toEnd(true);
  });

  /* ── popovers: notifications, account, stages ── */
  function pop(name) {
    $$('.pop').forEach(p => { if (p.id !== name) p.hidden = true; });
    if (!name) return; const p = $('#' + name); p.hidden = !p.hidden;
    if (!p.hidden && name === 'bell') { UI.inbox(); p.style.right = Math.max(12, innerWidth - $('#bar .bell').getBoundingClientRect().right) + 'px'; }
    if (!p.hidden && name === 'stage-pop') { p.innerHTML = stagePop(); applyLang(p); const b = $('.stage-b').getBoundingClientRect(); p.style.left = Math.max(12, b.left) + 'px'; }
  }

  function start(id) {
    UI.auto = !!S.sbx.auto;
    if (!booted) {
      booted = true;
      ['acct', 't1', 't2'].forEach(sc => { dom(sc); if (S.acct.app && !Flow.over(sc) && SNAP[sc][S[sc].i]) Flow.restore(sc, S[sc].i); });
      UI.inbox();
    }
    const ok = x => x && (isPage(x) || thread(x) || (chal(x) && S.acct.app));
    open(ok(id) ? id : ok(S.cur) ? S.cur : S.acct.app && !S.acct.done ? 'acct' : null);
  }
  function relang() { if ($('#app').hidden) return; rail(); bar(); const id = S.cur; if (isPage(id)) Library.page(id.slice(2)); else { tabs(); UI.chips(); } }

  return { open, start, fresh, make, drop, keep, touch, thread, rail, bar, tabs, pane, pop, relang, hero, ic, get cur() { return S.cur; } };
})();
