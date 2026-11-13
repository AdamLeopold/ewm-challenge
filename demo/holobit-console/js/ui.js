'use strict';
/* Conversation engine. Every thread has its own context: a container, a reply stack, a run token.
   Stage scripts call the bare say / card / choose. Each call notes which thread it belongs to and
   restores that after every wait, so scripts in different threads never write into one another.
   A thread that is off screen keeps running until it needs the user, then waits there. */
const CANCEL = Symbol('cancel');

const UI = (() => {
  const host = $('#thread'), scroller = $('#scroll'), th = {}, ctxs = {};
  let cur = null, vis = null, auto = false, pinned = true, idleTimer = 0;
  const chal = id => id === 'acct' || id === 't1' || id === 't2';

  function ctx(id) {
    if (ctxs[id]) return ctxs[id];
    let el = $('#th-' + id);
    if (!el) { el = document.createElement('div'); el.id = 'th-' + id; el.className = 'th'; el.hidden = true; host.appendChild(el); }
    const C = ctxs[id] = { id, el, stack: [], pend: [], run: 0, fast: false, side: false, live: false, target: null, twin: null, unread: false, tab: null };
    th[id] = el;
    ['pointerdown', 'keydown', 'input', 'change'].forEach(t => el.addEventListener(t, () => { cur = C; }, true));
    return C;
  }
  cur = ctx('acct');
  const flag = C => { if (C !== vis && !C.unread) { C.unread = true; typeof App !== 'undefined' && App.rail(); } };
  const quick = C => C.fast || (auto && chal(C.id));

  /* ── thread ── */
  function add(html) {
    const C = cur, d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstChild;
    const hero = $('.hero', C.el); hero && hero.remove();
    C.el.appendChild(el); C === vis ? toEnd() : flag(C); return el;
  }
  function toEnd(force) {
    if (!vis) return;                                          // a page is showing, not a thread
    const f = vis.fast;
    if (pinned || force || f) { scroller.scrollTo({ top: scroller.scrollHeight, behavior: f || REDUCED ? 'auto' : 'smooth' }); $('#newpill').hidden = true; }
    else $('#newpill').hidden = false;
  }
  scroller.addEventListener('scroll', () => { pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140; if (pinned) $('#newpill').hidden = true; }, { passive: true });
  $('#newpill').onclick = () => toEnd(true);
  new ResizeObserver(() => pinned && toEnd()).observe(host);

  /* every wait ends here: stale scripts stop, live ones take their thread back */
  async function hold(C, tok, ms) { if (ms > 0) await wait(ms); if (tok !== C.run) throw CANCEL; cur = C; }
  async function pace(ms) { const C = cur; await hold(C, C.run, C.fast ? 0 : auto && chal(C.id) ? ms * .7 : ms); }
  async function say(html, o = {}) {
    const C = cur, tok = C.run, el = add(`<div class="msg sys ${o.cls || ''}"><i class="gl"></i><div class="bd">${html}</div></div>`);
    if (!C.fast && !REDUCED) {
      el.classList.add('typing');
      try { await hold(C, tok, o.delay ?? clamp(240 + el.textContent.length * 5, 320, 820)); } catch (e) { el.remove(); throw e; }
      el.classList.remove('typing');
    }
    el.classList.add('in'); cur = C; if (C === vis) toEnd(); return el;
  }
  function me(html) { const C = cur, el = add(`<div class="msg me in"><div class="bd">${html}</div></div>`); if (C === vis) { pinned = true; toEnd(true); } return el; }
  function chapter(i, name) { return add(`<div class="sec in" id="sec-${cur.id}-${i}"><span>${TA(name)}</span></div>`); }
  function note(html, tone = '') { return add(`<div class="note in ${tone}">${html}</div>`); }

  /* ── replies: a pending question's answers, else the thread's standing suggestions ── */
  function chips() {
    const box = $('#chips'), top = vis && vis.stack[vis.stack.length - 1], sg = !top && vis ? S.sugg[vis.id] || [] : [];
    box.innerHTML = top ? top.opts.map((o, i) => `<button class="chip ${o.tone || ''}" data-n="${i}">${TA(o.t)}</button>`).join('') : sg.map(s => `<button class="chip sg" data-do="${s.do}">${TA(s.t)}</button>`).join('');
    box.classList.toggle('on', !!(top || sg.length));
  }
  $('#chips').addEventListener('click', e => { const b = e.target.closest('.chip[data-n]'); if (b) pick(+b.dataset.n); });
  function pick(i, C = vis) { const top = C && C.stack.pop(); if (!top) return; cur = C; if (C === vis) chips(); const o = top.opts[i]; if (!top.quiet) me(TA(o.t)); top.resolve(o.id); }
  const defIx = ent => window.__pick ? window.__pick(ent.opts.length) : Math.max(0, ent.opts.findIndex(o => o.id === ent.def));
  function choose(opts, cfg = {}) {
    const C = cur, tok = C.run;
    return new Promise((resolve, reject) => {
      const ent = { opts, quiet: cfg.quiet, def: cfg.def, resolve: v => { if (tok !== C.run) return reject(CANCEL); cur = C; resolve(v); } };
      C.stack.push(ent); C === vis ? chips() : flag(C);
      if (quick(C)) (async () => { await wait(C.fast ? 0 : 950); if (tok !== C.run) return; const k = C.stack.indexOf(ent); if (k < 0) return; C.stack.splice(k + 1); pick(defIx(ent), C); })();
    });
  }

  /* ── the outside world answers: the happy path, unless the sandbox has armed something else ── */
  function fork(br, q, cfg = {}) {
    const C = cur, tok = C.run, sc = C.id, def = branch(sc, br);
    const ids = (cfg.only || def.w || Object.keys(def.o)).filter(id => !(sc === 't2' && def.t1only && def.t1only.includes(id)));
    const id = Sandbox.take(sc, br, ids) ?? (window.__pick ? ids[window.__pick(ids.length)] : cfg.def && ids.includes(cfg.def) ? cfg.def : ids[0]);
    mark(sc, br, id);
    return hold(C, tok, C.fast ? 0 : 240).then(() => id);
  }

  /* ── card: a rich, interactive message ── */
  async function card(html, bind, o = {}) {
    const C = cur, tok = C.run, el = await say(`<div class="card ${o.cls || ''}">${html}</div>`, { delay: 380, cls: 'wide' }), c = $('.card', el);
    if (!bind) return c;
    return new Promise((resolve, reject) => {
      const ent = { c, auto: null };
      const done = v => { if (c.classList.contains('done')) return; c.classList.add('done'); $$('input,select,textarea,button', c).forEach(x => { if (!x.hasAttribute('data-keep')) x.disabled = true; }); C.pend = C.pend.filter(x => x !== ent); if (tok !== C.run) return reject(CANCEL); cur = C; resolve(v); };
      cur = C; ent.auto = bind(c, done);
      if (c.classList.contains('done')) return;
      C.pend.push(ent); flag(C);
      if (quick(C) && ent.auto) (async () => { await wait(C.fast ? 0 : 1200); if (tok === C.run && !c.classList.contains('done')) { cur = C; ent.auto(); } })();
    });
  }
  /* answer whatever this thread is waiting on with its default */
  function kick(id) {
    const C = ctxs[id]; if (!C) return false;
    const p = C.pend[C.pend.length - 1], top = C.stack[C.stack.length - 1];
    if (p && p.auto && !p.c.classList.contains('done')) { cur = C; p.auto(); return true; }
    if (top) { pick(defIx(top), C); return true; }
    return false;
  }

  /* what the platform did, step by step */
  async function term(lines, o = {}) {
    const C = cur, tok = C.run, el = await say('<ul class="act"></ul>', { delay: 200, cls: 'wide' }), ul = $('.act', el);
    for (const ln of lines) {
      const [txt, tone, ms] = Array.isArray(ln) ? ln : [ln];
      const li = document.createElement('li'); li.className = 'run ' + (tone || ''); li.innerHTML = `<i></i><span>${txt}</span>`; ul.appendChild(li); if (C === vis) toEnd();
      try { await hold(C, tok, C.fast ? 0 : ms ?? (o.ms || 260)); } finally { li.classList.remove('run'); }
    }
    return ul;
  }
  const kv = rows => `<dl class="kv">${rows.map(r => `<div><dt>${r[0]}</dt><dd class="${r[2] || ''}">${r[1]}</dd></div>`).join('')}</dl>`;
  const pill = (t, tone = '') => `<span class="pill ${tone}">${t}</span>`;
  function receipt(title, rows, hash) {
    const stripes = hash.slice(0, 44).split('').map(c => `<i style="--w:${1 + parseInt(c, 16) % 4}"></i>`).join('');
    return `<div class="receipt"><header><b>${title}</b><span>${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</span></header>${kv(rows)}<div class="stripes">${stripes}</div><code>${hash}</code></div>`;
  }

  /* ── notifications ── */
  function toast(html, tone = '', act) {
    const t = document.createElement('div'); t.className = 'toast ' + tone; t.innerHTML = html; if (act) { t.dataset.act = act; t.classList.add('go'); }
    $('#toasts').appendChild(t); while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4200);
  }
  function mail(code, subj, body, x) {
    if (S.inbox.slice(0, 12).some(m => m.code === code && m.b[0] === body[0] && !x)) return;      // a replayed stage sends nothing twice
    S.inbox.unshift(Object.assign({ code, s: subj, b: body, unread: true, at: new Date().toISOString().slice(11, 16) }, x));
    if (S.inbox.length > 60) S.inbox.pop();
    inbox(); if (!(cur && cur.fast)) toast(`<small>✉</small>${TA(subj)}`, 'mail', 'bell');
  }
  const mailHTML = (m, i) => `<article class="mailrow ${m.unread ? 'unread' : ''}" data-m="${i}"><header><b>${TA(m.s)}</b><time>${m.at}</time></header><p>${TA(m.b)}${m.link ? ` <button class="btn sm" data-act="maillink">${T('Open the link', '打开链接')}</button>` : ''}</p></article>`;
  function inbox() {
    const n = S.inbox.filter(m => m.unread).length; $('#n-bell').textContent = n || '';
    $('#bell-list').innerHTML = S.inbox.length ? S.inbox.map(mailHTML).join('') : `<p class="empty">${T('Nothing yet.', '暂无通知。')}</p>`;
    typeof Sandbox !== 'undefined' && Sandbox.refresh();
  }
  $('#bell-list').addEventListener('click', e => { const r = e.target.closest('.mailrow'); if (!r || e.target.closest('button')) return; S.inbox[+r.dataset.m].unread = false; r.classList.toggle('open'); r.classList.remove('unread'); $('#n-bell').textContent = S.inbox.filter(m => m.unread).length || ''; save(); });

  /* ── side panel ── */
  function tab(name) {
    if (!$(`#w-tabs [data-tab="${name}"]`)) return;
    $$('#w-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); $$('.w-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === name));
    if (vis) vis.tab = name; typeof App !== 'undefined' && App.pane(name);
  }
  $('#w-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); });
  const vits = v => v.map(x => `<div class="vit ${x[2] || ''}"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
  function world(o) {                                          // each track keeps its own twin; only the one on screen is painted
    const C = cur, t = C.twin && !(C.twin.idle && o.viz != null) ? C.twin : (C.twin = { phase: C.twin && C.twin.phase, sub: C.twin && C.twin.sub });
    if (o.viz != null) t.idle = false; Object.assign(t, o);
    if (C !== vis) return;
    if (o.phase) $('#w-phase').innerHTML = TA(o.phase);
    if (o.sub != null) $('#w-sub').innerHTML = o.sub;
    if (o.viz != null) { clearInterval(idleTimer); idleTimer = 0; $('#w-viz').innerHTML = o.viz; }
    if (o.vitals) $('#w-vitals').innerHTML = vits(o.vitals);
    if (o.stress != null) Field.stress(o.stress);
  }
  function idle(phase, sub = '') { const C = cur; C.twin = { idle: true, phase, sub, stress: 0 }; if (C === vis) twin(); }
  function twin() {                                            // repaint the visible thread's twin; an idle one shows the ambient market
    clearInterval(idleTimer); idleTimer = 0;
    const t = vis && vis.twin; if (!t) { Field.stress(0); return; }
    $('#w-phase').innerHTML = t.phase ? TA(t.phase) : ''; $('#w-sub').innerHTML = t.sub || ''; Field.stress(t.stress || 0);
    if (!t.idle) { $('#w-viz').innerHTML = t.viz || ''; $('#w-vitals').innerHTML = vits(t.vitals || []); return; }
    const r = rng(Date.now() & 0xffff); let px = [3000], u = .782; for (let i = 1; i < 60; i++) px.push(px[i - 1] * (1 + r.g() * .0011));
    const draw = () => {
      px.push(px[px.length - 1] * (1 + r.g() * .0011)); px.shift(); u = clamp(u + r.g() * .0016, .7, .86);
      $('#w-viz').innerHTML = `<div class="cap"><span>WETH / USDC</span><b>${nf(px[59], 2)}</b></div>` + chart({ series: [{ d: px, c: 'var(--acc)', fill: 1 }], xmax: 59, H: 120, fmt: x => nf(x, 0) }).replace(/<text[^>]*>\d+h<\/text>/g, '');
      $('#w-vitals').innerHTML = vits([['Uniswap V3 · 0.05%', usdc(184e6 + (px[59] - 3000) * 9e4)], ['Aave v3 · USDC', pct(u)], ['Gas', nf(11 + (px[59] % 7), 1) + ' gwei'], [L('Block', '区块'), '+' + nf(Math.floor(performance.now() / 12000))]]);
    };
    draw(); if (!REDUCED) idleTimer = setInterval(() => document.hidden || $('#world').offsetParent === null || draw(), 1400);
  }
  function record() {
    const k = vis && S[vis.id] && vis.id !== 'acct' ? vis.id : S.active, rec = S[k].record;
    $('#w-record').innerHTML = rec.length ? `<div class="chain">${rec.slice().reverse().map(r => `<div class="rec ${r.st || ''}"><b>#${String(r.n).padStart(2, '0')}</b><span>t+${r.h}h · ${r.type}${r.st ? ' · ' + r.st : ''}</span><code>${r.hash.slice(0, 10)}</code><small>← ${r.prev.slice(0, 10)}</small></div>`).join('')}</div>` : `<p class="empty">${T('The decision record starts with your first decision.', '第一次决定之后，这里开始出现决策记录。')}</p>`;
  }
  function logRecord(tr, type, st, h) {
    const rec = S[tr].record, prev = rec.length ? rec[rec.length - 1].hash : '0'.repeat(64);
    rec.push({ n: rec.length + 1, h, type, st, prev, hash: hx(prev + type + st + h + rec.length) }); if (rec.length > 80) rec.shift();
    if (vis && vis.id === tr) record();
  }
  function team() {
    const a = S.acct, row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
    const trk = k => { const t = S[k]; if (!t.on) return ''; const v = t.versions[t.versions.length - 1];
      return `<h4>${TA(TRACK[k].s)} · ${TA(TRACK[k].n)}</h4><dl class="kv">${row(T('Status', '状态'), pill(TA({ active: ['active', '进行中'], complete: ['complete', '完赛'], withdrawn: ['withdrawn', '已退赛'], unqualified: ['not qualified', '未取得资格'] }[t.status]), t.status === 'active' || t.status === 'complete' ? 'ok' : 'bad'))}${row(T('Image', '镜像'), v && `<code>${short(v.digest)}</code>`)}${row(T('Frozen', '冻结'), t.freeze && `<code>${short(t.freeze.hash)}</code>`)}</dl>${t.status === 'active' ? `<div class="acts"><button class="btn sm" data-act="withdraw" data-k="${k}">${T('Withdraw', '退赛')}</button></div>` : ''}`; };
    $('#w-team').innerHTML = !a.app ? '' : `
      <div class="idc"><div class="ava">${esc((a.team || a.name || '?')[0].toUpperCase())}</div><div><b>${esc(a.team || a.name || '—')}</b><span>${a.entry === 'team' ? (a.role === 'captain' ? T('Captain', '队长') : T('Member', '成员')) + ' · ' + esc(a.name) : T('Individual', '个人')}</span></div></div>
      <dl class="kv">${row(T('Application', '申请编号'), `<code>${a.app.id}</code>`)}
      ${row(T('Members', '成员'), a.entry === 'team' && [esc(a.email)].concat(a.members.map(esc)).join('<br>'))}
      ${row(T('Terms', '条款'), a.terms && `<code>${short(a.terms)}</code>`)}
      ${row(T('Signing key', '签名钥匙'), a.key && `<code>SHA256:${a.key.fp.slice(0, 16)}…</code>` + (a.keyLost ? ' ' + pill(T('lost', '已报失'), 'bad') : ''))}
      ${row(T('Model', '模型'), a.llm && (a.llm.none ? T('none', '不使用') : `${esc(a.llm.snap)} <small>••••${esc(a.llm.last4)}</small>`))}</dl>
      <div class="acts">${a.key ? `<button class="btn sm" data-act="keylost">${T('Report key lost', '钥匙报失')}</button>` : ''}<button class="btn sm" data-act="reapply">${T('Revise application', '修改申请')}</button></div>
      ${trk('t1')}${trk('t2')}`;
  }

  /* put a thread on screen (or none, when a page is showing) */
  function show(id) {
    const C = id ? ctx(id) : null; vis = C;
    Object.values(ctxs).forEach(x => { x.el.hidden = x !== C; });
    if (C) { C.unread = false; cur = C; }
    document.body.classList.toggle('fast', !!(C && C.fast));
    chips(); twin(); pinned = true; requestAnimationFrame(() => toEnd(true));
  }
  const on = id => Object.fromEntries(Object.entries({ say, me, card, choose, term, pace, note }).map(([k, f]) => [k, (...a) => { cur = ctx(id); return f(...a); }]));

  return {
    say, me, chapter, note, choose, fork, card, term, kv, pill, receipt, toast, mail, inbox, mailHTML, tab, world, idle, twin, record, logRecord, team, pace, toEnd, th, ctx, show, kick, on, chips, pick,
    rail() { typeof App !== 'undefined' && App.rail(); },
    run(id, fn) { cur = ctx(id); return fn(); },
    suggest(id, list) { S.sugg[id] = list; if (vis && vis.id === id) chips(); },
    reset(id) { const C = ctx(id); C.stack = []; C.pend = []; if (C === vis) chips(); },
    top() { return vis && vis.stack[vis.stack.length - 1]; },
    get vis() { return vis; }, get cur() { return cur; },
    get scope() { return cur.id; }, set scope(v) { cur = ctx(v); },
    get auto() { return auto; }, set auto(v) { auto = v; },
    get fast() { return cur.fast; }, set fast(v) { cur.fast = v; if (cur === vis) document.body.classList.toggle('fast', v); },
  };
})();
