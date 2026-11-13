'use strict';
/* Conversation engine + chrome. Stages are plain async functions that call say / me / choose / fork / card. */
const CANCEL = Symbol('cancel');
let RUN = 0;
const guard = tok => { if (tok !== RUN) throw CANCEL; };

const UI = (() => {
  const th = { acct: $('#th-acct'), t1: $('#th-t1'), t2: $('#th-t2') }, scroller = $('#scroll');
  let scope = 'acct', auto = false, fast = false, stack = [], pinned = true, idleTimer = 0;

  /* ── thread ── */
  function add(html) {
    const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstChild;
    th[scope].appendChild(el); toEnd(); return el;
  }
  function toEnd(force) {
    if (pinned || force || fast) { scroller.scrollTo({ top: scroller.scrollHeight, behavior: fast || REDUCED ? 'auto' : 'smooth' }); $('#newpill').hidden = true; }
    else $('#newpill').hidden = false;
  }
  scroller.addEventListener('scroll', () => { pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140; if (pinned) $('#newpill').hidden = true; }, { passive: true });
  $('#newpill').onclick = () => toEnd(true);
  new ResizeObserver(() => pinned && toEnd()).observe($('#thread'));

  async function pace(ms) { const tok = RUN; if (!fast) await wait(auto ? ms * .7 : ms); guard(tok); }
  async function say(html, o = {}) {
    const tok = RUN, el = add(`<div class="msg sys ${o.cls || ''}"><i class="gl"></i><div class="bd">${html}</div></div>`);
    if (!fast && !REDUCED) { el.classList.add('typing'); await wait(o.delay ?? clamp(240 + el.textContent.length * 5, 320, 820)); guard(tok); el.classList.remove('typing'); }
    el.classList.add('in'); toEnd(); return el;
  }
  function me(html) { const el = add(`<div class="msg me in"><div class="bd">${html}</div></div>`); pinned = true; toEnd(true); return el; }
  function chapter(n, name) { return add(`<div class="chap in"><b>${String(n).padStart(2, '0')}</b><h3>${TA(name)}</h3></div>`); }
  function note(html, tone = '') { return add(`<div class="note in ${tone}">${html}</div>`); }

  /* ── quick replies ── */
  function chips() {
    const top = stack[stack.length - 1], box = $('#chips');
    box.innerHTML = top ? top.opts.map((o, i) => `<button class="chip ${o.tone || ''}" data-n="${i}">${TA(o.t)}</button>`).join('') : '';
    box.classList.toggle('on', !!top);
  }
  $('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) pick(+b.dataset.n); });
  function pick(i) { const top = stack.pop(); if (!top) return; chips(); const o = top.opts[i]; if (!top.quiet) me(TA(o.t)); top.resolve(o.id); }
  function choose(opts, cfg = {}) {
    const tok = RUN;
    return new Promise((resolve, reject) => {
      const ent = { opts, quiet: cfg.quiet, resolve: v => tok === RUN ? resolve(v) : reject(CANCEL) };
      stack.push(ent); chips();
      if (auto || fast) (async () => { await wait(fast ? 0 : 950); if (tok !== RUN) return; const k = stack.indexOf(ent); if (k < 0) return; stack.splice(k + 1); pick(window.__pick ? window.__pick(opts.length) : Math.max(0, opts.findIndex(o => o.id === cfg.def))); })();
    });
  }

  /* ── fork: the demo decides which way the world goes ── */
  function fork(br, q, cfg = {}) {
    const tok = RUN, sc = scope, def = MAP[sc === 'acct' ? 'acct' : 'track'].flatMap(s => s.br).find(b => b.id === br);
    const ids = (cfg.only || Object.keys(def.o)).filter(id => !(sc === 't2' && def.t1only && def.t1only.includes(id)));
    const el = add(`<div class="fork in"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="4" cy="3" r="1.6"/><circle cx="4" cy="13" r="1.6"/><circle cx="12" cy="6" r="1.6"/><path d="M4 4.6v6.8M4 9c0-2 8-.5 8-1.4"/></svg><p>${TA(q)}</p><div class="opts">${ids.map(id => `<button data-o="${id}">${TA(def.o[id])}</button>`).join('')}</div></div>`);
    return new Promise((resolve, reject) => {
      const go = id => { if (el.classList.contains('done')) return; el.classList.add('done'); $$('button', el).forEach(b => { b.disabled = true; b.classList.toggle('on', b.dataset.o === id); }); mark(sc, br, id); tok === RUN ? resolve(id) : reject(CANCEL); };
      el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.o); });
      if (auto || fast) (async () => { await wait(fast ? 0 : 1000); if (tok === RUN) go(window.__pick ? ids[window.__pick(ids.length)] : cfg.def && ids.includes(cfg.def) ? cfg.def : ids[0]); })();
    });
  }

  /* ── card: a rich, interactive system message ── */
  async function card(html, bind, o = {}) {
    const tok = RUN, el = await say(`<div class="card ${o.cls || ''}">${html}</div>`, { delay: 380, cls: 'wide' }), c = $('.card', el);
    if (!bind) return c;
    return new Promise((resolve, reject) => {
      const done = v => { if (c.classList.contains('done')) return; c.classList.add('done'); $$('input,select,textarea,button', c).forEach(x => { if (!x.hasAttribute('data-keep')) x.disabled = true; }); tok === RUN ? resolve(v) : reject(CANCEL); };
      const autofn = bind(c, done);
      if ((auto || fast) && autofn) (async () => { await wait(fast ? 0 : 1200); if (tok === RUN && !c.classList.contains('done')) autofn(); })();
    });
  }
  /* terminal that prints line by line */
  async function term(lines, o = {}) {
    const tok = RUN, el = await say(`<pre class="term"></pre>`, { delay: 200, cls: 'wide' }), pre = $('.term', el);
    for (const ln of lines) {
      const [txt, tone, ms] = Array.isArray(ln) ? ln : [ln];
      const s = document.createElement('span'); s.className = 'ln ' + (tone || ''); s.innerHTML = txt + '\n'; pre.appendChild(s); toEnd();
      if (!fast) await wait(ms ?? (o.ms || 170)); guard(tok);
    }
    return pre;
  }
  const kv = rows => `<dl class="kv">${rows.map(r => `<div><dt>${r[0]}</dt><dd class="${r[2] || ''}">${r[1]}</dd></div>`).join('')}</dl>`;
  const pill = (t, tone = '') => `<span class="pill ${tone}">${t}</span>`;
  function receipt(title, rows, hash) {
    const stripes = hash.slice(0, 44).split('').map(c => `<i style="--w:${1 + parseInt(c, 16) % 4}"></i>`).join('');
    return `<div class="receipt"><header><b>${title}</b><span>${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</span></header>${kv(rows)}<div class="stripes">${stripes}</div><code>${hash}</code></div>`;
  }

  /* ── inbox + toasts ── */
  function toast(html, tone = '') {
    const t = document.createElement('div'); t.className = 'toast ' + tone; t.innerHTML = html; $('#toasts').appendChild(t); while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, fast ? 600 : 4200);
  }
  function mail(code, subj, body) {
    S.inbox.unshift({ code, s: subj, b: body, unread: true, at: new Date().toISOString().slice(11, 16) });
    if (S.inbox.length > 60) S.inbox.pop();
    inbox(); if (!fast) toast(`<small>${code}</small>${TA(subj)}`, 'mail');
  }
  function inbox() {
    const n = S.inbox.filter(m => m.unread).length; $('#n-inbox').textContent = n || '';
    $('#w-inbox').innerHTML = S.inbox.length ? S.inbox.map((m, i) => `<article class="mailrow ${m.unread ? 'unread' : ''}" data-m="${i}"><header><small>${m.code}</small><b>${TA(m.s)}</b><time>${m.at}</time></header><p>${TA(m.b)}</p></article>`).join('') : `<p class="empty">${T('Nothing yet.', '暂无邮件。')}</p>`;
  }
  $('#w-inbox').addEventListener('click', e => { const r = e.target.closest('.mailrow'); if (!r) return; S.inbox[+r.dataset.m].unread = false; r.classList.toggle('open'); r.classList.remove('unread'); $('#n-inbox').textContent = S.inbox.filter(m => m.unread).length || ''; });

  /* ── world panel ── */
  function tab(name) { $$('#w-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); $$('.w-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === name)); if (name === 'inbox') S.inbox.length && inbox(); }
  $('#w-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); });
  function world(o) {
    if (o.phase) $('#w-phase').innerHTML = TA(o.phase);
    if (o.sub != null) $('#w-sub').innerHTML = o.sub;
    if (o.viz != null) { clearInterval(idleTimer); idleTimer = 0; $('#w-viz').innerHTML = o.viz; }
    if (o.vitals) $('#w-vitals').innerHTML = o.vitals.map(v => `<div class="vit ${v[2] || ''}"><span>${v[0]}</span><b>${v[1]}</b></div>`).join('');
    if (o.stress != null) Field.stress(o.stress);
  }
  function idle(phase, sub = '') {                           // ambient market ticker while nothing is running
    const r = rng(Date.now() & 0xffff); let px = [3000], u = .782; for (let i = 1; i < 60; i++) px.push(px[i - 1] * (1 + r.g() * .0011));
    const draw = () => {
      px.push(px[px.length - 1] * (1 + r.g() * .0011)); px.shift(); u = clamp(u + r.g() * .0016, .7, .86);
      $('#w-viz').innerHTML = `<div class="cap"><span>WETH / USDC</span><b>${nf(px[59], 2)}</b></div>` + chart({ series: [{ d: px, c: 'var(--acc)', fill: 1 }], xmax: 59, H: 120, fmt: x => nf(x, 0) }).replace(/<text[^>]*>\d+h<\/text>/g, '');
      $('#w-vitals').innerHTML = [['Uniswap V3 · 0.05%', usdc(184e6 + (px[59] - 3000) * 9e4)], ['Aave v3 · USDC', pct(u)], ['Gas', nf(11 + (px[59] % 7), 1) + ' gwei'], [L('Block', '区块'), '+' + nf(Math.floor(performance.now() / 12000))]].map(v => `<div class="vit"><span>${v[0]}</span><b>${v[1]}</b></div>`).join('');
    };
    clearInterval(idleTimer); draw(); if (!REDUCED) idleTimer = setInterval(() => document.hidden || draw(), 1400);
    $('#w-phase').innerHTML = TA(phase); $('#w-sub').innerHTML = sub; Field.stress(0);
  }
  function record() {
    const rec = S[S.active].record;
    $('#w-record').innerHTML = rec.length ? `<div class="chain">${rec.slice().reverse().map(r => `<div class="rec ${r.st || ''}"><b>#${String(r.n).padStart(2, '0')}</b><span>t+${r.h}h · ${r.type}${r.st ? ' · ' + r.st : ''}</span><code>${r.hash.slice(0, 10)}</code><small>← ${r.prev.slice(0, 10)}</small></div>`).join('')}</div>` : `<p class="empty">${T('The decision record starts with your first decision.', '第一次决定之后，这里开始出现决策记录。')}</p>`;
  }
  function logRecord(tr, type, st, h) {
    const rec = S[tr].record, prev = rec.length ? rec[rec.length - 1].hash : '0'.repeat(64);
    rec.push({ n: rec.length + 1, h, type, st, prev, hash: hx(prev + type + st + h + rec.length) }); if (rec.length > 80) rec.shift(); record();
  }
  function team() {
    const a = S.acct, row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
    const trk = k => { const t = S[k]; if (!t.on) return ''; const v = t.versions[t.versions.length - 1];
      return `<h4>${TA(TRACK[k].s)} · ${TA(TRACK[k].n)}</h4><dl class="kv">${row(T('Status', '状态'), pill(TA({ active: ['active', '进行中'], complete: ['complete', '完赛'], withdrawn: ['withdrawn', '已退赛'], unqualified: ['not qualified', '未取得资格'] }[t.status]), t.status === 'active' || t.status === 'complete' ? 'ok' : 'bad'))}${row(T('Image', '镜像'), v && `<code>${short(v.digest)}</code>`)}${row(T('Frozen', '冻结'), t.freeze && `<code>${short(t.freeze.hash)}</code>`)}</dl>`; };
    $('#w-team').innerHTML = `
      <div class="idc"><div class="ava">${esc((a.handle || a.email || '?')[0].toUpperCase())}</div><div><b>${esc(a.name || a.handle || '—')}</b><span>${esc(a.auth === 'github' ? '@' + a.handle : a.email)}</span></div></div>
      <dl class="kv">${row(T('Application', '申请编号'), a.app && `<code>${a.app.id}</code>`)}
      ${row(T('Email', '邮箱'), a.email && esc(a.email) + ' ' + (a.verified ? pill(T('verified', '已验证'), 'ok') : pill(T('unverified', '未验证'), 'warn')))}
      ${row(T('Entry', '参赛方式'), a.entry && (a.entry === 'solo' ? T('Individual', '个人') : esc(a.team) + (a.members.length ? ` <small>+${a.members.length}</small>` : '')))}
      ${row(T('Role', '角色'), a.entry === 'team' && (a.role === 'captain' ? T('Captain', '队长') : T('Member', '成员')))}
      ${row(T('Terms', '条款'), a.terms && `<code>${short(a.terms)}</code>`)}
      ${row(T('Team key', '队伍钥匙'), a.key && `<code>SHA256:${a.key.fp.slice(0, 16)}…</code>` + (a.keyLost ? ' ' + pill(T('lost', '已报失'), 'bad') : ''))}
      ${row(T('Model', '模型'), a.llm && (a.llm.none ? T('none', '不使用') : `${esc(a.llm.snap)} <small>••••${esc(a.llm.last4)}</small>`))}</dl>
      ${trk('t1')}${trk('t2')}
      <div class="acts">${a.key ? `<button class="btn sm" data-cmd="keylost">${T('Report key lost', '钥匙报失')}</button>` : ''}${S[S.active].on ? `<button class="btn sm" data-cmd="withdraw">${T('Withdraw', '退赛')}</button>` : ''}<button class="btn sm" data-cmd="reapply">${T('Revise application', '修改申请')}</button><button class="btn sm" data-cmd="restart">${T('Restart demo', '重新开始')}</button></div>`;
    $('#who').innerHTML = `<div class="ava">${esc((a.handle || a.email || '?')[0].toUpperCase())}</div><div><b>${esc(a.team || a.name || a.handle || a.email)}</b><span>${esc(a.auth === 'github' ? '@' + a.handle : a.email)}</span></div>`;
  }

  /* ── rail ── */
  function rail() {
    const a = S.acct, k = S.active, t = S[k];
    document.body.dataset.track = k; Field.track(k);
    $('#tracks').innerHTML = ['t1', 't2'].map(x => `<button class="${x === k && a.done ? 'on' : ''} ${S[x].on ? '' : 'off'}" data-track="${x}"><small>${S[x].on ? TRACK[x].tag : '+'}</small><span>${TA(TRACK[x].n)}</span></button>`).join('');
    let o = '', act = -1, n = 0;
    const item = (sc, st, i, cur, state) => { n++; if (st.act !== act) { act = st.act; o += `<h5>${TA(ACTS[act])}</h5>`; } o += `<button class="st ${state}" data-sc="${sc}" data-ix="${i}"><i></i><b>${String(n).padStart(2, '0')}</b><span>${TA(st.n)}</span></button>`; };
    MAP.acct.forEach((st, i) => item('acct', st, i, a.i, a.done || i < a.i ? 'done' : i === a.i ? 'cur' : ''));
    MAP.track.forEach((st, i) => item(k, st, i, t.i, !a.done ? '' : i < t.i ? 'done' : i === t.i ? (t.status === 'active' ? 'cur' : 'cur halt') : ''));
    $('#spine').innerHTML = o;
    const cur = $('#spine .cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
    const st = a.done ? MAP.track[Math.min(t.i, MAP.track.length - 1)] : MAP.acct[a.i];
    $('#crumb').innerHTML = a.done ? `<b>${TA(TRACK[k].s)}</b><span>${TA(TRACK[k].n)}</span><i>/</i><span>${TA(st.n)}</span>` : `<b>${TA(ACTS[0])}</b><i>/</i><span>${TA(st.n)}</span>`;
    th.t1.hidden = k !== 't1'; th.t2.hidden = k !== 't2';
    team(); record();
  }
  function cov() { const c = coverage(); $('#cov').textContent = c.n; $('#m-n').textContent = c.n; $('#m-of').textContent = ' / ' + c.of; }

  /* ── branch map ── */
  function map() {
    const col = (sc, st, i, n) => {
      const pre = sc === 'acct' ? 'a' : sc, s = S[sc], state = sc !== 'acct' && !s.on ? 'off' : (sc === 'acct' ? s.done || i < s.i : i < s.i) ? 'done' : i === s.i && (sc === 'acct' || S.acct.done) ? 'cur' : '';
      return `<section class="m-st ${state} ${sc}" data-sc="${sc}" data-ix="${i}" style="grid-column:${n}"><button class="m-go"><b>${String(n).padStart(2, '0')}</b><span>${TA(st.n)}</span></button>${st.br.map(b => `<div class="m-br"><small>${TA(b.n)}</small>${Object.entries(b.o).filter(([o]) => !(sc === 't2' && b.t1only && b.t1only.includes(o))).map(([o, lab]) => `<span class="${(S.seen[pre + '.' + b.id] || []).includes(o) ? 'seen' : ''}">${TA(lab)}</span>`).join('')}</div>`).join('')}</section>`;
    };
    const A = MAP.acct.length;
    $('#m-body').innerHTML = `<div class="m-grid" style="--cols:${A + MAP.track.length}">
      <div class="m-lane acct" style="grid-column:1/${A + 1}"><em>${TA(ACTS[0])}</em></div>
      <div class="m-lane t1" style="grid-column:${A + 1}/-1;grid-row:1"><em>${TA(TRACK.t1.s)} · ${TA(TRACK.t1.n)}</em></div>
      <div class="m-lane t2" style="grid-column:${A + 1}/-1;grid-row:2"><em>${TA(TRACK.t2.s)} · ${TA(TRACK.t2.n)}</em></div>
      ${MAP.acct.map((st, i) => col('acct', st, i, i + 1)).join('')}${MAP.track.map((st, i) => col('t1', st, i, A + i + 1)).join('')}${MAP.track.map((st, i) => col('t2', st, i, A + i + 1)).join('')}</div>`;
    cov();
  }
  $('#m-body').addEventListener('wheel', e => { const m = $('#m-body'); if (m.scrollHeight <= m.clientHeight + 2 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('#m-body').scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });

  return {
    say, me, chapter, note, choose, fork, card, term, kv, pill, receipt, toast, mail, inbox, tab, world, idle, record, logRecord, team, rail, map, pace, toEnd, th,
    coverage: cov, chips,
    get scope() { return scope; }, set scope(v) { scope = v; },
    get auto() { return auto; }, set auto(v) { auto = v; $('#auto').classList.toggle('on', v); },
    get fast() { return fast; }, set fast(v) { fast = v; document.body.classList.toggle('fast', v); },
    reset() { stack = []; chips(); },
    top() { return stack[stack.length - 1]; }, pick,
  };
})();
