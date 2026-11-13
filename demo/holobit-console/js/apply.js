'use strict';
/* The application channel. Individual or team → sign in → entrant → team → tracks → terms → review. Filing it opens the console. */
const Apply = (() => {
  const root = $('#apply'), pane = $('#a-pane'), list = $('#a-steps');
  const COUNTRIES = [['SG', 'Singapore', '新加坡'], ['HK', 'Hong Kong SAR', '中国香港'], ['CN', 'Mainland China', '中国内地'], ['US', 'United States', '美国'], ['GB', 'United Kingdom', '英国'], ['DE', 'Germany', '德国'], ['JP', 'Japan', '日本'], ['IN', 'India', '印度'], ['ZZ', 'Elsewhere', '其他地区'], ['XX', 'A restricted jurisdiction', '受限地区']];
  const DOCS = [['Participation terms', '参赛条款', 'v1.0'], ['Prize terms', '奖金条款', 'v1.0'], ['Code of conduct', '行为准则', 'v1.0'], ['Privacy notice', '隐私说明', 'v1.1']];
  const MAILRX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const gh = z => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="currentColor"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0"/></svg>`, GH = gh(18);
  const FORK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="4" cy="3" r="1.6"/><circle cx="4" cy="13" r="1.6"/><circle cx="12" cy="6" r="1.6"/><path d="M4 4.6v6.8M4 9c0-2 8-.5 8-1.4"/></svg>';
  const fig = (x, g, s = 1) => `<g transform="translate(${x} ${72 - 60 * s}) scale(${s})" stroke="url(#${g})"><circle cx="0" cy="11" r="8"/><path d="M-14 60V40a14 14 0 0 1 28 0v20"/></g>`;
  const ART = { solo: `<svg class="art" viewBox="0 0 96 72">${fig(18, 'lg-a')}</svg>`, team: `<svg class="art" viewBox="0 0 96 72">${fig(14, 'lg-b', .8)}${fig(82, 'lg-c', .8)}${fig(48, 'lg-a')}</svg>` };
  const FACTS = {
    t1: [['$100,000 across Uniswap V3 and Aave v3', '10 万美元 · Uniswap V3 与 Aave v3'], ['One decision every simulated hour', '每个模拟小时决策一次'], ['S = r − 0.5 × MDD', 'S = r − 0.5 × MDD']],
    t2: [['Aave v3 · the WETH and USDC reserves', 'Aave v3 · WETH 与 USDC 储备'], ['One decision every 6 simulated hours', '每 6 个模拟小时决策一次'], ['Scored against the unchanged baseline', '与“参数不变”的基线比较计分']],
  };
  const STEPS = [
    { id: 'entry', n: ['Entry', '参赛方式'], h: ['Who is entering?', '谁来参赛？'] },
    { id: 'signin', n: ['Sign in', '登录'], h: ['Sign in', '登录'] },
    { id: 'entrant', n: ['Entrant', '参赛者'], h: ['About you', '关于你'] },
    { id: 'team', n: ['Team', '队伍'], h: ['Your team', '你的队伍'], on: d => d.entry === 'team' },
    { id: 'tracks', n: ['Tracks', '赛道'], h: ['Pick your tracks', '选择赛道'] },
    { id: 'terms', n: ['Terms', '条款'], h: ['The terms', '参赛条款'] },
    { id: 'review', n: ['Review', '确认'], h: ['Check and file', '确认并提交'] },
  ];
  const blank = () => ({ step: 'entry', passed: [], entry: null, seat: 'create', auth: null, handle: '', email: '', verified: false, link: null, resend: 0, name: '', org: '', country: 'SG', adult: true, group: false, staff: false, team: '', members: [], code: '', inv: null, tracks: ['t1'], docs: [false, false, false, false], research: true, declined: false, done: null });
  let D = null, revise = false, ghOpen = false, filing = 0;

  const steps = () => STEPS.filter(s => !s.on || s.on(D));
  const joined = () => D.entry === 'team' && D.seat === 'join' && D.inv === 'joined';
  const tracksOf = () => joined() ? ['t1', 't2'] : D.tracks;
  const teamName = () => D.entry === 'solo' ? D.name : joined() ? 'Basis Points' : D.team;
  const termsHash = () => hx(DOCS.join('|') + D.email);
  const who = () => esc(D.auth === 'github' ? '@' + D.handle : D.email);
  const persist = () => { S.draft = D; save(); };
  const forkHTML = (br, q, ids) => { const def = MAP.acct[0].br.find(b => b.id === br); return `<div class="fork in" data-br="${br}">${FORK}<p>${TA(q)}</p><div class="opts">${ids.map(id => `<button data-o="${id}">${TA(def.o[id])}</button>`).join('')}</div></div>`; };
  const seg = () => `<button data-seat="create" class="${D.seat === 'create' ? 'on' : ''}">${T('Create a team', '创建队伍')}</button><button data-seat="join" class="${D.seat === 'join' ? 'on' : ''}">${T('I have an invite code', '我有邀请码')}</button>`;
  const ck = (key, en, zh) => `<label class="ck"><input type="checkbox" data-d="${key}" ${D[key] ? 'checked' : ''}><i></i><span>${T(en, zh)}</span></label>`;
  const val = id => ({
    entry: () => D.entry === 'solo' ? T('Individual', '个人') : T('Team', '团队'),
    signin: () => who(), entrant: () => esc(D.name), team: () => esc(teamName()),
    tracks: () => tracksOf().map(k => TA(TRACK[k].s)).join(' + '),
    terms: () => T('Accepted', '已接受'), review: () => '',
  }[id]());

  /* ── each step: what it shows, how it listens, what lets you through, how the demo fills it ── */
  const VIEW = {}, BIND = {}, CHECK = {}, DEMO = {};

  VIEW.entry = () => `<div class="a-opts two">
      <button class="a-opt ${D.entry === 'solo' ? 'on' : ''}" data-entry="solo">${ART.solo}<b>${T('Individual', '个人')}</b><span>${T('One person, one agent per track.', '一个人，每条赛道一个 Agent。')}</span></button>
      <button class="a-opt ${D.entry === 'team' ? 'on' : ''}" data-entry="team">${ART.team}<b>${T('Team', '团队')}</b><span>${T('Two to five people, one agent per track.', '2 到 5 人，每条赛道一个 Agent。')}</span></button></div>
    <div class="a-seg" id="a-seat" ${D.entry === 'team' ? '' : 'hidden'}>${seg()}</div>`;
  BIND.entry = m => { m.onclick = e => {
    const o = e.target.closest('[data-entry]'), s = e.target.closest('[data-seat]');
    if (o) { D.entry = o.dataset.entry; $$('[data-entry]', m).forEach(b => b.classList.toggle('on', b === o)); $('#a-seat', m).hidden = D.entry !== 'team'; }
    else if (s) { D.seat = s.dataset.seat; D.inv = null; $$('[data-seat]', m).forEach(b => b.classList.toggle('on', b === s)); }
    else return;
    drawSteps(); persist(); fail(null);
  }; };
  CHECK.entry = () => D.entry ? true : ['Pick one to continue.', '请先选一种参赛方式。'];
  DEMO.entry = () => { D.entry = D.entry || 'team'; };

  VIEW.signin = () => {
    if (D.verified) return `<div class="a-id"><div class="ava">${esc((D.handle || D.email)[0].toUpperCase())}</div><div><b>${who()}</b><span>${D.auth === 'github' ? esc(D.email) + ' · ' + T('verified by GitHub', 'GitHub 已验证') : T('verified', '已验证')}</span></div><button class="btn link" data-s="out">${T('Use another', '换一个')}</button></div>`;
    if (D.link) return `<p class="a-p">${T(`A link is on its way to <b>${esc(D.email)}</b>. It lasts 24 hours.`, `验证链接已发往 <b>${esc(D.email)}</b>，24 小时内有效。`)}</p>` + (D.link === 'wait'
      ? forkHTML('mail', ['What happens to the link?', '这封链接怎么样了？'], D.resend >= 3 ? ['capped'] : ['opened', 'spam', 'expired', 'capped'])
      : `<div class="a-msg"><span>${{ spam: T('Check the spam folder, or send it again.', '看看垃圾邮件箱，或者重发一次。'), expired: T('That link expired. Send a fresh one.', '链接过期了。重发一封。'), capped: T('Three resends an hour is the limit. Try again in an hour, or sign in with GitHub instead.', '每小时最多重发 3 次。请一小时后再试，或改用 GitHub 登录。') }[D.link]}</span>
          <div class="row"><button class="btn sm" data-s="${D.link === 'capped' ? 'later' : 'resend'}">${D.link === 'capped' ? T('An hour later', '一小时以后') : T('Resend the link', '重发链接')}</button><button class="btn sm link" data-s="out">${T('Use another sign-in', '换一种登录方式')}</button></div></div>`);
    if (ghOpen) return `<div class="oauth"><header>${gh(22)}<i></i><svg width="22" height="23" style="color:var(--t1)"><use href="#hb-mark"/></svg></header>
      <h3>${T('HoloBit wants to', 'HoloBit 请求')}</h3><ul><li>${T('read your public profile', '读取你的公开资料')}</li><li>${T('read your verified email', '读取你已验证的邮箱')}</li></ul>
      ${fld(T('Demo handle', '演示用户名'), '<input id="g-handle" value="ada-lin" maxlength="39" spellcheck="false" autocomplete="off">')}
      <footer><button class="btn link" data-s="gh-no">${T('Cancel', '取消')}</button><button class="btn solid" data-s="gh-ok">${T('Authorize', '授权')}</button></footer></div>`;
    return `<div class="a-auth"><button class="hb w" data-s="gh">${GH}<span>${T('Continue with GitHub', '用 GitHub 继续')}</span></button>
      <form class="a-mail" id="a-mailf" novalidate><input id="a-email" type="email" autocomplete="off" spellcheck="false" value="${esc(D.email)}" data-ph-en="or email · get a magic link" data-ph-zh="或用邮箱 · 收取登录链接"><button class="hb o" type="submit" aria-label="Send link">→</button></form></div>`;
  };
  const signOut = () => Object.assign(D, { auth: null, handle: '', verified: false, link: null, resend: 0 });
  BIND.signin = m => {
    const github = h => { Object.assign(D, { auth: 'github', handle: h, email: h + '@example.dev', verified: true, link: null }); ghOpen = false; mark('acct', 'auth', 'github'); mark('acct', 'mail', 'github'); };
    m.onclick = e => {
      const s = e.target.closest('[data-s]'), o = e.target.closest('.fork [data-o]');
      if (o) { const r = o.dataset.o; mark('acct', 'mail', r); if (r === 'opened') D.verified = true; else D.link = r; }
      else if (!s) return;
      else if (s.dataset.s === 'gh') ghOpen = true;
      else if (s.dataset.s === 'gh-no') ghOpen = false;
      else if (s.dataset.s === 'gh-ok') github($('#g-handle', m).value.trim().replace(/[^A-Za-z0-9-]/g, '') || 'ada-lin');
      else if (s.dataset.s === 'out') { signOut(); ghOpen = false; }
      else if (s.dataset.s === 'later') { D.resend = 0; D.link = 'wait'; }
      else if (s.dataset.s === 'resend') { D.resend++; D.link = 'wait'; UI.mail('E1', ['Verify your email', '验证邮箱'], [`Resent · ${D.resend} of 3 this hour.`, `已重发 · 本小时第 ${D.resend} / 3 次。`]); }
      redraw(); const h = $('#g-handle', m); h && h.select();
    };
    m.onsubmit = e => {
      e.preventDefault(); const v = $('#a-email', m).value.trim();
      if (!MAILRX.test(v)) { shake($('#a-mailf', m)); return $('#a-email', m).focus(); }
      Object.assign(D, { auth: 'email', email: v, handle: v.split('@')[0], link: 'wait', resend: 0 }); mark('acct', 'auth', 'email');
      UI.mail('E1', ['Verify your email', '验证邮箱'], ['Open the link within 24 hours.', '请在 24 小时内打开链接。']); redraw();
    };
    m.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'g-handle') { e.preventDefault(); $('[data-s=gh-ok]', m).click(); } };
  };
  CHECK.signin = () => D.verified ? true : ['Sign in to continue.', '请先登录。'];
  DEMO.signin = () => { if (D.verified) return; Object.assign(D, { auth: 'github', handle: 'ada-lin', email: 'ada-lin@example.dev', verified: true, link: null }); ghOpen = false; mark('acct', 'auth', 'github'); mark('acct', 'mail', 'github'); };

  VIEW.entrant = () => `<div class="grid2">
      ${fld(T('Name', '姓名'), `<input id="a-name" data-d="name" value="${esc(D.name || (D.auth === 'github' ? D.handle : ''))}" maxlength="60" autocomplete="off">`)}
      ${fld(T('Organisation', '所属机构'), `<input data-d="org" value="${esc(D.org)}" maxlength="60" autocomplete="off" data-ph-en="optional" data-ph-zh="选填">`)}
      ${fld(T('Country of residence', '居住国家或地区'), `<select data-d="country">${COUNTRIES.map(c => `<option value="${c[0]}" ${D.country === c[0] ? 'selected' : ''}>${L(c[1], c[2])}</option>`).join('')}</select>`)}
      ${fld(T('Email', '邮箱'), `<input value="${esc(D.email)}" readonly tabindex="-1">`)}</div>
    <div class="checks">${ck('adult', 'I am 18 or older', '我已年满 18 岁')}${ck('group', 'Another entrant and I are controlled by the same person or entity', '我与另一参赛者受同一人或同一实体控制')}${ck('staff', 'I work with the organisers, judges or scenario designers', '我与主办方、评委或出题人有工作关系')}</div>`;
  CHECK.entrant = () => {
    D.name = $('#a-name', pane).value.trim();
    if (!D.name) return ['Add your name.', '请填写姓名。'];
    if (hasInvisible(D.name)) return ['That name contains invisible characters.', '姓名里有不可见字符。'];
    const why = D.country === 'XX' ? 'restricted' : !D.adult ? 'minor' : D.staff ? 'staff' : 'clear';
    mark('acct', 'elig', why);
    return why === 'clear' ? true : {
      restricted: ['Residents of that jurisdiction can’t enter this edition. If you think this is wrong, the competition lead reviews it by email.', '该地区的居民本届不能参赛。若认为有误，可发邮件请赛务负责人复核。'],
      minor: ['Entrants must be 18 or older.', '参赛者须年满 18 岁。'],
      staff: ['Organisers, judges and scenario designers can’t join a team or advise one.', '主办方、评委与出题人不得加入任何参赛队，也不得当顾问。'],
    }[why];
  };
  DEMO.entrant = () => { if (!D.name) D.name = 'Ada Lin'; if (!D.org) D.org = 'Basis Research'; D.adult = true; D.staff = false; if (D.country === 'XX') D.country = 'SG'; };

  VIEW.team = () => `<div class="a-seg">${seg()}</div>` + (D.seat === 'create'
    ? fld(T('Team name', '队名'), `<input id="a-team" data-d="team" value="${esc(D.team)}" maxlength="32" placeholder="Basis Points" autocomplete="off">`)
      + fld(T('Invite teammates', '邀请队友'), `<div class="tags" id="a-tags">${D.members.map((x, i) => `<b data-rm="${i}">${esc(x)} ×</b>`).join('')}<input type="email" placeholder="name@team.xyz" autocomplete="off"></div>`)
    : D.inv === 'joined' ? `<div class="a-joined"><b>Basis Points</b><span>mira@basis.pt · tomas@basis.pt<br>${T('Entered in both tracks.', '两条赛道都已报名。')}</span></div><button class="btn link" data-t="leave" style="justify-self:start">${T('Use another code', '换一个邀请码')}</button>`
    : `<form class="a-mail" id="a-codef" novalidate style="max-width:340px"><input id="a-code" class="mono up" value="${esc(D.code)}" placeholder="HOLO-7K2M" maxlength="9" autocomplete="off" spellcheck="false" ${D.inv ? 'disabled' : ''}><button class="hb o" type="submit" aria-label="Check" ${D.inv ? 'disabled' : ''}>→</button></form>`
      + (D.inv === 'ask' ? forkHTML('team', ['What does the invite lead to?', '这张邀请通向哪里？'], ['joined', 'taken', 'full'])
        : D.inv ? `<div class="a-msg"><span>${D.inv === 'taken' ? T('You’re already on another team. One person, one team.', '你已经在另一支队伍里。一人只能在一支队伍。') : T('That team already has five members.', '这支队伍已有 5 人。')}</span><div class="row"><button class="btn sm" data-t="leave">${D.inv === 'taken' ? T('Leave it and try again', '退出原队再试') : T('Try another code', '换一个邀请码')}</button><button class="btn sm link" data-t="own">${T('Create my own', '自己建队')}</button></div></div>` : ''));
  BIND.team = m => {
    const addTag = () => {
      const inp = $('#a-tags input', m); if (!inp) return true; const v = inp.value.trim(); if (!v) return true;
      if (!MAILRX.test(v) || D.members.includes(v)) { shake($('#a-tags', m)); return false; }
      if (D.members.length >= 4) { fail(['Five people at most, you included.', '连你在内最多 5 人。']); shake($('#a-tags', m)); return false; }
      D.members.push(v); redraw(); $('#a-tags input', m).focus(); return true;
    };
    m._flush = addTag;
    m.onclick = e => {
      const s = e.target.closest('[data-seat]'), o = e.target.closest('.fork [data-o]'), t = e.target.closest('[data-t]'), rm = e.target.closest('[data-rm]');
      if (s) { D.seat = s.dataset.seat; D.inv = null; }
      else if (o) { D.inv = o.dataset.o; mark('acct', 'team', D.inv); }
      else if (t) { D.inv = null; D.code = ''; if (t.dataset.t === 'own') D.seat = 'create'; }
      else if (rm) D.members.splice(+rm.dataset.rm, 1);
      else return;
      redraw();
    };
    m.onsubmit = e => { e.preventDefault(); const v = $('#a-code', m).value.trim().toUpperCase(); if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v)) return shake($('#a-codef', m)); D.code = v; D.inv = 'ask'; redraw(); };
    m.onkeydown = e => { if (e.target.closest('#a-tags') && (e.key === 'Enter' || e.key === ',' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); addTag(); } };
  };
  CHECK.team = () => {
    if (D.seat === 'join') return D.inv === 'joined' ? true : ['Check your invite first.', '请先查验邀请码。'];
    const m = $('.a-main', pane); if (m._flush && !m._flush()) return false;
    D.team = D.team.trim();
    return D.team.length >= 2 && !hasInvisible(D.team) ? true : ['Give the team a name.', '请给队伍起个名字。'];
  };
  DEMO.team = () => { if (D.seat === 'join') { D.code = D.code || 'HOLO-7K2M'; if (D.inv !== 'joined') { D.inv = 'joined'; mark('acct', 'team', 'joined'); } } else if (D.team.trim().length < 2) D.team = 'Basis Points'; };

  VIEW.tracks = () => { const tk = tracksOf(); return `<div class="a-opts two ${joined() ? 'lock' : ''}">${['t1', 't2'].map(k => `<div class="a-opt ${k} ${tk.includes(k) ? 'on' : ''}" data-trk="${k}" role="checkbox" aria-checked="${tk.includes(k)}" tabindex="0"><small>${TA(TRACK[k].s)}</small><b>${TA(TRACK[k].n)}</b><ul>${FACTS[k].map(f => `<li>${TA(f)}</li>`).join('')}</ul><button class="ib" data-info="${k}" aria-label="Track details"><svg width="20" height="20"><use href="#ic-info"/></svg></button></div>`).join('')}</div>${joined() ? `<p class="hint">${T('Set by your captain.', '由队长选定。')}</p>` : ''}`; };
  BIND.tracks = m => {
    const flip = k => { if (joined()) return; const i = D.tracks.indexOf(k); i < 0 ? D.tracks.push(k) : D.tracks.length > 1 && D.tracks.splice(i, 1); D.tracks.sort(); redraw(); };
    m.onclick = e => { const i = e.target.closest('[data-info]'), t = e.target.closest('[data-trk]'); if (i) Info.open(i.dataset.info); else if (t) flip(t.dataset.trk); };
    m.onkeydown = e => { const t = e.target.closest('[data-trk]'); if (t && e.target === t && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); flip(t.dataset.trk); const n = $(`[data-trk=${t.dataset.trk}]`, m); n && n.focus(); } };
  };
  CHECK.tracks = () => tracksOf().length ? true : ['Pick at least one track.', '至少选一条赛道。'];
  DEMO.tracks = () => { if (!joined()) D.tracks = ['t1', 't2']; };

  VIEW.terms = () => `<div class="docs">${DOCS.map((d, i) => `<label class="ck doc"><input type="checkbox" data-doc="${i}" ${D.docs[i] ? 'checked' : ''}><i></i><span>${T(d[0], d[1])}</span><code>${d[2]} · ${hx(d[0] + d[2], 8)}</code></label>`).join('')}</div>
    <div class="row" style="display:flex;gap:8px;align-items:center"><button class="btn" data-t="all">${T('Accept all four', '全部接受')}</button><button class="btn link" data-t="no">${T('Decline', '拒绝')}</button></div>
    ${D.declined ? `<div class="a-msg"><span>${T('Without the terms there is no entry. Nothing beyond your sign-in has been stored.', '不接受条款就不能参赛。除登录信息外，没有保存任何内容。')}</span></div>` : ''}
    <div class="sep"></div>
    <label class="sw"><input type="checkbox" data-d="research" ${D.research ? 'checked' : ''}><i></i><span>${T('Also let research use my agent program, image and model materials', '同时授权把我的 Agent 程序、镜像与模型材料用于研究')}</span></label>`;
  BIND.terms = m => {
    m.onchange = e => { const d = e.target.dataset.doc; if (d == null) return; D.docs[+d] = e.target.checked; if (D.declined) { D.declined = false; redraw(); } else persist(); };
    m.onclick = e => { const t = e.target.closest('[data-t]'); if (!t) return; const yes = t.dataset.t === 'all'; D.docs = [yes, yes, yes, yes]; D.declined = !yes; if (!yes) mark('acct', 'terms', 'decline'); redraw(); };
  };
  CHECK.terms = () => D.docs.every(Boolean) ? true : ['All four need your acceptance.', '四份文件都需要接受。'];
  DEMO.terms = () => { D.docs = [true, true, true, true]; D.declined = false; };

  VIEW.review = () => {
    const solo = D.entry === 'solo', c = COUNTRIES.find(x => x[0] === D.country), row = (k, v, go) => `<div><dt>${k}</dt><dd><span>${v}</span><button data-go="${go}">${T('Edit', '修改')}</button></dd></div>`;
    return `<dl class="kv a-rev">
      ${row(T('Entry', '参赛方式'), solo ? T('Individual', '个人') : `${T('Team', '团队')} · ${esc(teamName())}${!joined() && D.members.length ? ` +${D.members.length}` : ''}`, solo ? 'entry' : 'team')}
      ${row(T('Signed in', '登录'), who(), 'signin')}
      ${row(T('Entrant', '参赛者'), esc(D.name) + (D.org ? ' · ' + esc(D.org) : '') + ' · ' + T(c[1], c[2]), 'entrant')}
      ${row(T('Tracks', '赛道'), tracksOf().map(k => TA(TRACK[k].s)).join(' + '), 'tracks')}
      ${row(T('Terms', '条款'), `<code>${short(termsHash())}</code> · ${D.research ? T('research use on', '研究用途 开') : T('research use off', '研究用途 关')}`, 'terms')}</dl>`;
  };
  BIND.review = m => { m.onclick = e => { const g = e.target.closest('[data-go]'); if (g) { D.step = g.dataset.go; render(); } }; };
  DEMO.review = () => {};

  /* ── frame ── */
  function fail(msg) { const el = $('.err', pane); if (!el) return; el.hidden = !msg; if (msg) { el.innerHTML = TA(msg); shake(el); } }
  function drawSteps() {
    const ss = steps(), frontier = ss.find(s => !D.passed.includes(s.id));
    list.innerHTML = ss.map((s, j) => { const done = D.done || (D.passed.includes(s.id) && s.id !== D.step), cur = !D.done && s.id === D.step, open = !D.done && (D.passed.includes(s.id) || s === frontier);
      return `<li class="${cur ? 'cur' : done ? 'done' : ''}"><button data-go="${s.id}" ${open ? '' : 'disabled'} aria-label="${LA(s.n)}"><b>${p2(j + 1)}</b><span>${TA(s.n)}</span><em>${done ? val(s.id) : ''}</em></button></li>`; }).join('');
  }
  function redraw() { const m = $('.a-main', pane); m.innerHTML = VIEW[D.step](); BIND[D.step] && BIND[D.step](m); applyLang(m); drawSteps(); fail(null); persist(); }
  function render() {
    if (D.done) return renderDone();
    const ss = steps(); let i = ss.findIndex(s => s.id === D.step); if (i < 0) { i = 0; D.step = ss[0].id; }
    const s = ss[i];
    pane.innerHTML = `<div class="a-step" data-step="${s.id}"><h2 class="h-h2 a-h">${TA(s.h)}</h2><div class="a-main">${VIEW[s.id]()}</div><p class="err" hidden></p>
      <footer class="a-foot">${i ? '<button class="hb o" data-x="back" aria-label="Back">←</button>' : ''}<button class="hb g" data-x="next">${s.id === 'review' ? T('File the application', '提交申请') : T('Continue', '继续')}</button><span class="sp"></span><button class="btn link" data-x="demo">${T('Fill it in for me', '替我填好')}</button></footer></div>`;
    BIND[s.id] && BIND[s.id]($('.a-main', pane));
    drawSteps(); applyLang(root); pane.scrollTop = 0; persist();
  }
  function next() {
    const r = CHECK[D.step] ? CHECK[D.step]() : true;
    if (r !== true) { if (r) fail(r); return; }
    if (D.step === 'review') return file();
    D.passed.includes(D.step) || D.passed.push(D.step);
    const ss = steps(); D.step = ss[ss.findIndex(s => s.id === D.step) + 1].id; render();
  }
  function back() { const ss = steps(), i = ss.findIndex(s => s.id === D.step); if (i > 0) { D.step = ss[i - 1].id; render(); } }

  async function file() {
    const tok = ++filing, tk = tracksOf(), solo = D.entry === 'solo', team = teamName();
    const id = 'EWM-' + hx(D.email + team + Date.now(), 8).toUpperCase().replace(/^(.{4})/, '$1-'), hash = hx([D.email, D.name, team, tk, D.research, id].join('|'));
    pane.innerHTML = `<div class="a-step"><h2 class="h-h2 a-h">${T('Filing', '正在提交')}</h2><pre class="term a-term"></pre></div>`; applyLang(pane);
    const pre = $('.a-term', pane);
    for (const [txt, tone] of [['POST /v1/applications', 'dim'], ['eligibility · clear', 'dim'], [`identity · ${D.auth} · ${D.auth === 'github' ? '@' + esc(D.handle) : esc(D.email)}`, 'dim'], [solo ? 'seat · individual' : `seat · ${esc(team)} · ${joined() ? 'member' : 'captain'}`, 'dim'], [`tracks · ${tk.map(k => TRACK[k].tag).join(' + ')}`, 'dim'], [`terms · ${short(termsHash())} · research use ${D.research ? 'on' : 'off'}`, 'dim'], [`201 Created · ${id}`, 'acc']]) {
      const s = document.createElement('span'); s.className = 'ln ' + tone; s.innerHTML = txt + '\n'; pre.appendChild(s);
      await wait(REDUCED ? 0 : 230); if (tok !== filing || root.hidden) return;
    }
    commit(id, hash, team, tk); D.done = { id, hash }; persist(); renderDone();
  }
  function commit(id, hash, team, tk) {
    const keep = { seen: S.seen, inbox: S.inbox }, solo = D.entry === 'solo', j = joined();
    RUN++; UI.reset(); S = fresh(); Object.assign(S, keep); SNAP = { acct: [], t1: [], t2: [] };
    ['acct', 't1', 't2'].forEach(k => { UI.th[k].innerHTML = ''; });
    Object.assign(S.acct, { app: { id, hash }, entry: D.entry, auth: D.auth, handle: D.handle || D.email.split('@')[0], email: D.email, verified: true, name: D.name, org: D.org, country: D.country, group: D.group, role: j ? 'member' : 'captain', team, members: solo ? [] : j ? ['mira@basis.pt', 'tomas@basis.pt'] : D.members.slice(), tracks: tk.slice(), terms: termsHash(), research: D.research });
    S.t1.on = tk.includes('t1'); S.t2.on = tk.includes('t2'); S.active = S.t1.on ? 't1' : 't2';
    mark('acct', 'entry', D.entry); if (!solo && !j) mark('acct', 'team', 'create');
    mark('acct', 'tracks', tk.length === 2 ? 'both' : tk[0]); mark('acct', 'terms', 'accept'); mark('acct', 'research', D.research ? 'share' : 'withhold');
    if (!solo && !j) D.members.forEach(x => UI.mail('E3', ['Invite sent', '邀请已发出'], [`${x} · link valid 7 days.`, `${x} · 链接 7 天内有效。`]));
    if (j) UI.mail('E4', ['Team change', '队伍变动'], [`${D.name} joined Basis Points.`, `${D.name} 加入了 Basis Points。`]);
    UI.mail('E5', ['Terms accepted', '已接受条款'], [`Version hash ${short(termsHash())}.`, `版本哈希 ${short(termsHash())}。`]);
    UI.mail('E2', ['You’re in. What happens next', '报名成功 · 接下来'], ['Docs, starter kits and historical data are open. Build first, then practise.', '文档、起步包与历史数据已开放。先写代码，再练习。']);
  }
  function renderDone() {
    const solo = D.entry === 'solo';
    drawSteps();
    pane.innerHTML = `<div class="a-step a-done"><p class="a-id-no">${D.done.id}</p><h2 class="h-h2 a-h">${T('You’re in.', '报名成功。')}</h2>
      ${UI.receipt(T('Application received', '申请已受理'), [[T('Entry', '参赛方式'), solo ? T('Individual', '个人') : `${T('Team', '团队')} · ${esc(teamName())}`], [T('Entrant', '参赛者'), esc(D.name)], [T('Tracks', '赛道'), tracksOf().map(k => TA(TRACK[k].s)).join(' + ')]], D.done.hash)}
      <p class="a-p">${T('This is a demo. No application was sent. To enter for real, use the <a href="../../register.html">registration page</a>.', '这是演示，没有提交任何申请。正式报名请到<a href="../../register.html">报名页</a>。')}</p>
      <footer class="a-foot"><button class="hb g" data-x="enter">${T('Enter the console', '进入控制台')} →</button></footer></div>`;
    applyLang(root); pane.scrollTop = 0;
  }

  pane.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; const a = x.dataset.x; if (a === 'next') next(); else if (a === 'back') back(); else if (a === 'enter') enterConsole(); else if (a === 'demo') { DEMO[D.step](); redraw(); next(); } });
  pane.addEventListener('input', e => { const k = e.target.dataset.d; if (!k || !D) return; D[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; fail(null); persist(); });
  pane.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input[data-d]:not([type=checkbox])')) { e.preventDefault(); next(); } });
  list.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b && !b.disabled && b.dataset.go !== D.step) { D.step = b.dataset.go; render(); } });

  function open(o = {}) {
    revise = !!o.revise; ghOpen = false; filing++;
    if (revise) {
      const a = S.acct, member = a.role === 'member';
      D = Object.assign(blank(), { step: 'review', passed: ['entry', 'signin', 'entrant', 'team', 'tracks', 'terms'], entry: a.entry, seat: member ? 'join' : 'create', inv: member ? 'joined' : null, code: member ? 'HOLO-7K2M' : '', auth: a.auth, handle: a.handle, email: a.email, verified: true, name: a.name, org: a.org, country: a.country, group: a.group, team: a.entry === 'team' && !member ? a.team : '', members: member ? [] : a.members.slice(), tracks: a.tracks.slice(), docs: [true, true, true, true], research: a.research });
    } else D = S.draft && !S.draft.done ? S.draft : blank();
    view('apply'); render();
  }
  function close() {
    filing++;
    if (D && D.done) return enterConsole();
    if (revise || S.acct.app) { S.draft = null; save(); return view('app'); }
    view('home');
  }
  return { open, close, relang() { if (!root.hidden && D) render(); }, demo() { for (let n = 0; n < 9 && !D.done && D.step !== 'review'; n++) { DEMO[D.step](); redraw(); next(); } } };
})();
