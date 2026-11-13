'use strict';
/* One account for HoloBit and the challenge. Passwordless: GitHub, or a link sent by email. */
const Auth = (() => {
  const root = $('#auth'), pane = $('#au-pane');
  const MAILRX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let st = null, next = 'app';
  const blank = () => ({ gh: false, email: '', link: null, resend: 0 });

  function render() {
    let h;
    if (st.link) h = `<h2 class="h-h2 a-h">${T('Check your email', '查收邮件')}</h2><p class="a-p">${T(`A link is on its way to <b>${esc(st.email)}</b>. It lasts 24 hours.`, `登录链接已发往 <b>${esc(st.email)}</b>，24 小时内有效。`)}</p>`
      + (st.link === 'wait' ? `<div class="row"><button class="btn sm" data-s="resend">${T('Resend the link', '重发链接')}</button><button class="btn sm link" data-s="out">${T('Use another sign-in', '换一种登录方式')}</button></div>`
        : `<div class="a-msg"><span>${{ spam: T('Nothing yet? Check the spam folder, or send it again.', '还没收到？看看垃圾邮件箱，或者重发一次。'), expired: T('That link expired. Send a fresh one.', '链接过期了。重发一封。'), capped: T('Three resends an hour is the limit. Try again in an hour, or sign in with GitHub instead.', '每小时最多重发 3 次。请一小时后再试，或改用 GitHub 登录。') }[st.link]}</span>
          <div class="row"><button class="btn sm" data-s="${st.link === 'capped' ? 'later' : 'resend'}">${st.link === 'capped' ? T('An hour later', '一小时以后') : T('Resend the link', '重发链接')}</button><button class="btn sm link" data-s="out">${T('Use another sign-in', '换一种登录方式')}</button></div></div>`);
    else if (st.gh) h = `<div class="oauth"><header>${Agent.GHI(22)}<i></i><svg width="22" height="23" style="color:var(--t1)"><use href="#hb-mark"/></svg></header>
      <h3>${T('HoloBit wants to', 'HoloBit 请求')}</h3><ul><li>${T('read your public profile', '读取你的公开资料')}</li><li>${T('read your verified email', '读取你已验证的邮箱')}</li></ul>
      <label class="fld"><span>${T('GitHub username', 'GitHub 用户名')}</span><input id="g-handle" value="" placeholder="octocat" maxlength="39" spellcheck="false" autocomplete="off"></label>
      <footer><button class="btn link" data-s="gh-no">${T('Cancel', '取消')}</button><button class="btn solid" data-s="gh-ok">${T('Authorize', '授权')}</button></footer></div>`;
    else h = `<h2 class="h-h2 a-h">${next === 'apply' ? T('Sign in to enter', '登录后报名') : T('Sign in', '登录')}</h2>
      <div class="a-auth"><button class="hb w" data-s="gh">${Agent.GHI(18)}<span>${T('Continue with GitHub', '用 GitHub 继续')}</span></button>
      <form class="a-mail" id="au-mailf" novalidate><input id="au-email" type="email" autocomplete="off" spellcheck="false" value="${esc(st.email)}" data-ph-en="or email · get a sign-in link" data-ph-zh="或用邮箱 · 收取登录链接"><button class="hb o" type="submit" aria-label="Send link">→</button></form></div>
      <p class="hint">${T('New here? Signing in creates your account.', '第一次来？登录即创建账户。')}</p>`;
    pane.innerHTML = `<div class="a-step">${h}</div>`; applyLang(pane);
    const g = $('#g-handle', pane); g && g.focus();
  }
  function done(u) {
    const other = S.owner && S.owner !== u.email;                // someone else on this browser: they start clean
    if (other) wipe();
    S.user = Object.assign({ name: '', plan: 'Free', at: Date.now() }, u); S.owner = u.email; save();
    if (other) return location.reload();
    next === 'apply' ? (S.acct.app ? enterApp('acct') : Apply.open()) : enterApp();
  }
  function send(email, again) {
    const o = st.resend >= 3 ? 'capped' : Sandbox.take('acct', 'mail', ['spam', 'capped']);
    if (o) mark('acct', 'mail', o);
    if (o !== 'capped') UI.mail('E1', ['Sign in to HoloBit', '登录 HoloBit'], again ? [`Resent · ${st.resend} of 3 this hour.`, `已重发 · 本小时第 ${st.resend} / 3 次。`] : ['Open the link within 24 hours.', '请在 24 小时内打开链接。'], { link: true, n: Date.now() });
    st.link = o || 'wait'; render();
  }
  /* the link in the email: opens the workspace, unless the sandbox has it expire first */
  function openLink() {
    const m = S.inbox.find(x => x.link); if (m) { m.link = false; m.unread = false; }
    if (!st || !st.link || S.user) return UI.inbox();
    if (Sandbox.take('acct', 'mail', ['expired'])) { mark('acct', 'mail', 'expired'); st.link = 'expired'; UI.inbox(); return render(); }
    mark('acct', 'mail', 'opened'); Sandbox.close(); UI.inbox();
    done({ auth: 'email', handle: st.email.split('@')[0], email: st.email });
  }
  const github = h => { mark('acct', 'mail', 'github'); done({ auth: 'github', handle: h, email: h + '@users.noreply.github.com' }); };

  pane.addEventListener('click', e => {
    const s = e.target.closest('[data-s]'); if (!s) return; const a = s.dataset.s;
    if (a === 'gh') st.gh = true;
    else if (a === 'gh-no') st.gh = false;
    else if (a === 'gh-ok') { const h = $('#g-handle', pane).value.trim().replace(/[^A-Za-z0-9-]/g, ''); if (!h) return shake($('.oauth', pane)); return github(h); }
    else if (a === 'out') st = blank();
    else if (a === 'later') { st.resend = 0; return send(st.email, true); }
    else if (a === 'resend') { st.resend++; return send(st.email, true); }
    render();
  });
  pane.addEventListener('submit', e => {
    e.preventDefault(); const v = $('#au-email', pane).value.trim();
    if (!MAILRX.test(v)) { shake($('#au-mailf', pane)); return $('#au-email', pane).focus(); }
    st.email = v; st.resend = 0; send(v);
  });
  pane.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'g-handle') { e.preventDefault(); $('[data-s=gh-ok]', pane).click(); } });

  return {
    open(n) { next = n || 'app'; st = blank(); view('auth'); render(); },
    openLink, relang() { if (!root.hidden && st) render(); },
    fill() { if (!st) return; if (st.link === 'wait') return openLink(); if (st.link) { st.resend = 0; return send(st.email, true); } github('ada-lin'); },
  };
})();
