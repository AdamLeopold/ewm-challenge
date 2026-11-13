'use strict';
/* Account settings: profile, plan, credentials, developer access. */
const Settings = (() => {
  const root = $('#settings'), body = $('#set-body');
  const TABS = [['profile', 'Profile', '资料'], ['plan', 'Plan', '套餐'], ['creds', 'Credentials', '凭据'], ['dev', 'Developer', '开发者']];
  const PLANS = [['Free', '$0', ['500', '100', '1']], ['Basic', '$39', ['1,000', '300', '1']], ['Plus', '$199', ['10,000', '∞', '2']], ['Pro', '$999', ['40,000', '∞', '4']]];
  let tab = 'profile', token = null;

  const VIEW = {
    profile: u => `<label class="fld"><span>${T('Name', '姓名')}</span><input data-u="name" value="${esc(u.name || '')}" maxlength="60" autocomplete="off"></label>
      <dl class="kv"><div><dt>${T('Signed in with', '登录方式')}</dt><dd>${u.auth === 'github' ? 'GitHub · @' + esc(u.handle) : T('Email link', '邮箱链接')}</dd></div><div><dt>${T('Email', '邮箱')}</dt><dd>${esc(u.email)}</dd></div><div><dt>${T('Language', '语言')}</dt><dd><button class="lang" data-act="lang" aria-label="Language"><b>EN</b><b>中</b></button></dd></div></dl>`,
    plan: u => `<div class="tiers">${PLANS.map(p => `<div class="tier ${u.plan === p[0] ? 'on' : ''}"><b>${p[0]}</b><strong>${p[1]}<small>${p[0] === 'Free' ? '' : ' / ' + L('mo', '月')}</small></strong><ul><li><span>${T('Components', '组件')}</span>${p[2][0]}</li><li><span>${T('Simulation steps', '仿真步数')}</span>${p[2][1]}</li><li><span>${T('Workspaces', '工作区')}</span>${p[2][2]}</li></ul>${u.plan === p[0] ? `<em>${T('Current', '当前')}</em>` : `<button class="btn sm" data-plan="${p[0]}">${T('Switch', '切换')}</button>`}</div>`).join('')}</div><p class="hint">${T('Paid plans are billed yearly. Runs in your browser are free on every plan.', '付费套餐按年计费。在浏览器里运行在任何套餐下都免费。')}</p>`,
    creds: () => { const a = S.acct;
      return `<dl class="kv"><div><dt>${T('Signing key', '签名钥匙')}</dt><dd>${a.key ? `<code>SHA256:${a.key.fp.slice(0, 20)}…</code>${a.keyLost ? ' ' + UI.pill(T('lost', '已报失'), 'bad') : ''} <button class="btn sm" data-set="keylost">${T('Report lost', '报失')}</button>` : '—'}</dd></div>
        <div><dt>${T('Model provider', '模型服务方')}</dt><dd>${a.llm && !a.llm.none ? `${esc(a.llm.prov)} · ${esc(a.llm.snap)} · ••••${esc(a.llm.last4)}` : '—'}</dd></div>
        <div><dt>GitHub</dt><dd>${S.gh ? '@' + esc(S.gh.user) + ` <button class="btn sm" data-set="ghx">${T('Disconnect', '断开连接')}</button>` : '—'}</dd></div></dl>
        ${a.app ? '' : `<p class="hint">${T('Credentials appear here as you set them up in the challenge.', '在比赛中登记的凭据会出现在这里。')}</p>`}`; },
    dev: () => `<dl class="kv"><div><dt>${T('CLI token', 'CLI 令牌')}</dt><dd>${token ? `<code>${token}</code> <button class="ib" data-copy="${token}" aria-label="Copy">⧉</button>` : S.cli ? `<code>hbt_••••${S.cli.last4}</code>` : '—'} <button class="btn sm" data-set="token">${S.cli ? T('Rotate', '轮换') : T('Create', '创建')}</button></dd></div></dl>
      ${token ? `<p class="hint">${T('Copy it now. It isn’t shown again.', '请现在复制，之后不再显示。')}</p>` : ''}
      <ul class="cli">${[['holobit login', ['Sign a machine in with the token', '用令牌登录一台机器']], ['holobit agent init --track 1', ['Start an agent from the kit', '从起步包创建 Agent']], ['holobit agent test --family F2', ['Run a public family locally', '在本地跑一个公开情景族']], ['holobit agent submit --track 1', ['Build, sign and submit a version', '构建、签名并提交一个版本']], ['holobit verify --track 1', ['Recompute a published score', '重算已公布的分数']]].map(c => `<li><code>${c[0]}</code><span>${TA(c[1])}</span><button class="ib" data-copy="${c[0]}" aria-label="Copy">⧉</button></li>`).join('')}</ul>
      <p class="hint">${T('The CLI ships with the starter kit when the tracks open.', 'CLI 随起步包在赛道开放时发布。')}</p>`,
  };
  function render() {
    const u = S.user || {};
    $('#set-tabs').innerHTML = TABS.map(t => `<button data-st="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${T(t[1], t[2])}</button>`).join('');
    body.innerHTML = VIEW[tab](u); applyLang(root);
  }
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-st]'), p = e.target.closest('[data-plan]'), s = e.target.closest('[data-set]'), c = e.target.closest('[data-copy]');
    if (t) { tab = t.dataset.st; token = null; render(); }
    else if (p) { S.user.plan = p.dataset.plan; save(); render(); App.rail(); }
    else if (c) navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).then(() => UI.toast(T('Copied.', '已复制。')), () => {});
    else if (s && s.dataset.set === 'token') { token = 'hbt_sandbox_' + hx(Math.random() + 't', 28); S.cli = { last4: token.slice(-4), at: Date.now() }; save(); render(); }
    else if (s && s.dataset.set === 'ghx') { Agent.disconnect(); render(); }
    else if (s && s.dataset.set === 'keylost') { close(); Flow.cmd('keylost'); }
    else if (e.target === root) close();
  });
  root.addEventListener('input', e => { const k = e.target.dataset.u; if (k) { S.user[k] = e.target.value.trim(); save(); App.rail(); } });
  function close() { root.hidden = true; token = null; }
  return { open(t) { App.pop(); tab = TABS.some(x => x[0] === t) ? t : 'profile'; root.hidden = false; render(); }, close, relang() { root.hidden || render(); }, get isOpen() { return !root.hidden; } };
})();
