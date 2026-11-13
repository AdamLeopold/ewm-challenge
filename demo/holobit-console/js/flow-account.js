'use strict';
/* Account stages in the console: the filed application → team key → model. Shared by both tracks. The application itself is filled in apply.js. */
const { say, me, chapter, note, choose, fork, card, term, kv, pill, receipt, mail, world, pace } = UI;
let _u = 0; const uid = () => 'f' + (++_u) + Date.now().toString(36).slice(-3);
const O = (id, en, zh, tone) => ({ id, t: [en, zh], tone });
const fld = (lab, inner, cls = '') => `<label class="fld ${cls}"><span>${lab}</span>${inner}</label>`;
const hasInvisible = s => /[​-‏‪-‮⁠-⁤﻿]/.test(s);
const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

/* Out-of-band confirmation: sign with the team key, then a 6-digit code sent to the registered email (15 min). */
async function confirmOOB(what) {
  const a = S.acct, code = String(100000 + Math.floor(Math.random() * 9e5)), id = uid();
  mail('OOB', ['Confirmation code', '确认码'], [`${code} · ${what[0]} · valid 15 minutes`, `${code} · ${what[1]} · 15 分钟内有效`]);
  return card(`<header><h4>${TA(what)}</h4>${pill('15:00', 'mono', )}</header>
    <ol class="steps"><li class="ok"><b>${T('Signed', '已签名')}</b><code>SHA256:${a.key ? a.key.fp.slice(0, 20) : '—'}…</code></li>
    <li><b>${T('Code from your inbox', '收件箱里的确认码')}</b><div class="otp">${Array.from({ length: 6 }, (_, i) => `<input id="${id}${i}" inputmode="numeric" maxlength="1" aria-label="digit ${i + 1}">`).join('')}</div></li></ol>
    <footer><button class="btn link" data-x="lapse">${T('Let it lapse', '让它过期')}</button></footer>`, (c, done) => {
    const ins = $$('.otp input', c), tm = $('.pill', c); let left = 900;
    const iv = setInterval(() => { if (!c.isConnected || c.classList.contains('done')) return clearInterval(iv); left--; tm.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); if (left <= 0) fin('expired'); }, 1000);
    const fin = v => { clearInterval(iv); UI.tab('twin'); tm.textContent = v === 'expired' ? '00:00' : '✓'; tm.classList.add(v === 'expired' ? 'bad' : 'ok'); done(v); };
    const check = () => { const v = ins.map(x => x.value).join(''); if (v.length < 6) return; v === code ? fin('confirmed') : (shake($('.otp', c)), ins.forEach(x => x.value = ''), ins[0].focus()); };
    ins.forEach((x, i) => {
      x.addEventListener('input', () => { x.value = x.value.replace(/\D/g, ''); if (x.value && ins[i + 1]) ins[i + 1].focus(); check(); });
      x.addEventListener('keydown', e => { if (e.key === 'Backspace' && !x.value && ins[i - 1]) ins[i - 1].focus(); });
      x.addEventListener('paste', e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (t.length === 6) { e.preventDefault(); ins.forEach((y, j) => y.value = t[j]); check(); } });
    });
    $('[data-x=lapse]', c).onclick = () => fin('expired');
    UI.tab('inbox');
    return () => { ins.forEach((y, j) => y.value = code[j]); fin('confirmed'); };
  });
}

async function keyCard() {
  const a = S.acct;
  const id = uid();
  const v = await card(`<header><h4>${T('Team key', '队伍钥匙')}</h4></header>
    ${fld(T('Public key', '公钥'), `<textarea id="${id}" rows="2" class="mono" spellcheck="false" placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI…"></textarea>`)}
    <p class="err" hidden></p>
    <footer><button class="btn" data-x="gen">${T('Generate a demo key', '生成演示钥匙')}</button><button class="btn solid" data-x="go">${T('Register', '登记')}</button></footer>`, (c, done) => {
    const ta = $(`#${id}`, c), err = $('.err', c); let how = 'pasted';
    $('[data-x=gen]', c).onclick = () => { ta.value = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI' + btoa(hx(Math.random() + a.email, 32)).slice(0, 43) + ' ' + (a.team || 'team').toLowerCase().replace(/\W+/g, '-') + '@holobit'; how = 'generated'; err.hidden = true; };
    const go = () => {
      const k = ta.value.trim();
      if (!/^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/=]{20,}/.test(k)) { mark('acct', 'key', 'invalid'); err.hidden = false; err.innerHTML = /^ssh-(rsa|dss)|^ecdsa-/.test(k) ? T('Only OpenSSH ed25519 keys are accepted. That one is a different type.', '只接受 OpenSSH ed25519 钥匙。这把是别的类型。') : T('That isn’t an OpenSSH ed25519 public key.', '这不是 OpenSSH ed25519 公钥。'); return shake(c); }
      done({ k, how });
    };
    $('[data-x=go]', c).onclick = go;
    return () => { $('[data-x=gen]', c).onclick(); go(); };
  });
  a.key = { pub: v.k.slice(0, 80), fp: btoa(hx(v.k, 32)).replace(/=/g, '') }; a.keyLost = false;
  mark('acct', 'key', v.how); UI.team();
  await say(T(`Registered. Fingerprint <code>SHA256:${a.key.fp.slice(0, 20)}…</code>`, `已登记。指纹 <code>SHA256:${a.key.fp.slice(0, 20)}…</code>`));
}

const ACCT = {
  /* 01 ─────────────────────────────────────────── */
  async apply() {
    const a = S.acct, solo = a.entry === 'solo';
    UI.idle(['Register', '报名'], '');
    await say(T(`Application <b>${a.app.id}</b> is in. Welcome, ${esc(a.name)}.`, `申请 <b>${a.app.id}</b> 已受理。欢迎，${esc(a.name)}。`));
    await say(receipt(T('Application received', '申请已受理'), [
      [T('Entry', '参赛方式'), solo ? T('Individual', '个人') : `${T('Team', '团队')} · ${esc(a.team)}${a.members.length ? ` <small>+${a.members.length}</small>` : ''}`],
      [T('Entrant', '参赛者'), esc(a.name) + (a.org ? ` <small>${esc(a.org)}</small>` : '')],
      [T('Tracks', '赛道'), a.tracks.map(k => TA(TRACK[k].s)).join(' + ')],
      [T('Research use', '研究用途'), a.research ? T('submissions, run data, agent materials', '提交物、运行数据、Agent 材料') : T('submissions and run data only', '仅提交物与运行数据')],
    ], a.app.hash), { cls: 'wide' });
    if (a.role === 'member') await say(T('You’re on <b>Basis Points</b>. The captain has delegated signing to you for this demo.', '你已加入 <b>Basis Points</b>。本演示中队长已把签名权委托给你。'));
    if (a.group) await say(T('Noted. One control group submits one official version per track.', '已记录。同一控制关系组在每条赛道只交一个正式版本。'));
    UI.team(); UI.rail();
  },

  /* 02 ─────────────────────────────────────────── */
  async key() {
    const a = S.acct;
    await say(T('Five things only you can do: freeze a submission, register a model key, change a declaration, withdraw, publish your agent’s notes. Each is signed with your team’s <b>ed25519</b> key and confirmed by a code.', '有五件事只能本人做：冻结提交、登记模型密钥、改申报、退赛、公开 Agent 的记录。每一件都要用队伍的 <b>ed25519</b> 钥匙签名，再用确认码确认。'));
    await keyCard();
  },

  /* 03 ─────────────────────────────────────────── */
  async model() {
    const a = S.acct;
    const SNAPS = { Anthropic: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-sonnet-latest'], OpenAI: ['gpt-5-mini-2025-08-07', 'gpt-5-2025-08-07', 'gpt-5-latest'], Google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'] };
    await say(T('Does your agent call a language model? Calls go through the competition gateway, on your own provider key, under the same budget for every team.', '你的 Agent 调用大模型吗？调用一律经比赛网关，用你自己的服务方密钥，各队预算上限相同。'));
    const use = await choose([O('y', 'Yes, register a provider', '用，登记服务方'), O('n', 'No, it’s rule-based', '不用，纯规则')], { def: 'y' });
    if (use === 'n') { mark('acct', 'llm', 'none'); a.llm = { none: true }; await say(T('No model declared. You can add one until the freeze.', '没有登记模型。冻结之前随时可以加。')); }
    else for (;;) {
      const id = uid();
      const v = await card(`<header><h4>${T('Model access', '模型接入')}</h4>${pill('$0.30 / ' + L('sim-day', '模拟日'), 'mono')}</header>
        <div class="grid2">${fld(T('Provider', '服务方'), `<select id="${id}p">${Object.keys(SNAPS).map(p => `<option>${p}</option>`).join('')}</select>`)}
        ${fld(T('Snapshot', '模型快照'), `<select id="${id}s"></select>`)}
        ${fld(T('API key', 'API 密钥'), `<input id="${id}k" type="password" class="mono" autocomplete="off" placeholder="sk-demo-…">`, 'span2')}</div>
        <p class="hint">${T('This is a demo. Don’t paste a real key.', '这是演示页面，请不要粘贴真实密钥。')}</p>
        <p class="err" hidden></p>
        <footer><button class="btn" data-x="demo">${T('Use a demo key', '使用演示密钥')}</button><button class="btn solid" data-x="go">${T('Test call', '试调')}</button></footer>`, (c, done) => {
        const p = $(`#${id}p`, c), s = $(`#${id}s`, c), k = $(`#${id}k`, c), err = $('.err', c);
        const fill = () => { s.innerHTML = SNAPS[p.value].map(x => `<option>${x}</option>`).join(''); }; p.onchange = fill; fill();
        $('[data-x=demo]', c).onclick = () => { k.value = 'sk-demo-' + hx(Math.random(), 24); };
        const go = () => {
          if (/latest/.test(s.value)) { mark('acct', 'llm', 'snapshot'); err.hidden = false; err.innerHTML = T('Aliases can move. Only dated snapshots on the whitelist are accepted.', '别名会变。只接受白名单里带日期的快照。'); return shake(c); }
          if (k.value.trim().length < 12) { err.hidden = false; err.innerHTML = T('Add a key, or use the demo key.', '请填密钥，或使用演示密钥。'); return shake(c); }
          const key = k.value.trim(); k.value = '•'.repeat(24); done({ prov: p.value, snap: s.value, last4: key.slice(-4) });
        };
        $('[data-x=go]', c).onclick = go;
        return () => { $('[data-x=demo]', c).onclick(); s.selectedIndex = 0; go(); };
      });
      await term([[`POST gateway/v1/probe  ${v.prov.toLowerCase()}/${v.snap}`, 'dim'], ['stateless endpoint · server-side tools off · no stored objects', 'dim', 420]]);
      const r = await fork('llm', ['How does the provider answer?', '服务方怎样回应？'], { only: ['ok', 'auth'] });
      if (r === 'auth') {
        await say(T('The provider answered <code>401</code>. The key was refused and nothing was stored.', '服务方返回 <code>401</code>。密钥被拒，没有保存任何内容。'), { cls: 'bad' });
        mail('E8', ['Model key · test call failed', '模型密钥 · 试调失败'], [`${v.prov} · 401 · ••••${v.last4}`, `${v.prov} · 401 · ••••${v.last4}`]);
        await choose([O('r', 'Try another key', '换一个密钥')]); continue;
      }
      a.llm = v;
      await say(T(`<code>200</code> · reported model matches <b>${v.snap}</b>. The key now lives in the gateway’s secret store and won’t be shown again: ••••${esc(v.last4)}.`, `<code>200</code> · 服务方报告的模型与 <b>${v.snap}</b> 相符。密钥已存入网关的秘密存储，以后不再显示：••••${esc(v.last4)}。`));
      mail('E8', ['Model key registered', '模型密钥已登记'], [`${v.prov} · ${v.snap} · ••••${v.last4}`, `${v.prov} · ${v.snap} · ••••${v.last4}`]);
      break;
    }
    UI.team();
    mail('E7', ['The practice platform is open', '练习平台已开放'], ['Remote interface, public scenario families, hosted runs and the practice leaderboard.', '远程接口、公开情景族、托管试跑与练习排行榜。']);
    await say(T('Registration is complete.', '报名完成。'));
  },
};
