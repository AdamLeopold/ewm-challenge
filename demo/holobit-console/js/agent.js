'use strict';
/* The agent workspace behind a track's Agent tab. Four ways in: write it here, connect GitHub, upload an image, or the CLI.
   The code shown is the policy the practice and hosted runs really execute; its constants are the knobs. */
const Agent = (() => {
  const pc = v => Math.round(v * 100) + '%';
  const DEF = {
    t1: [
      { k: 'w', id: 'RANGE_WIDTH', n: ['Range width', '区间宽度'], opts: [.05, .1, .3], show: v => '±' + pc(v), lit: v => v.toFixed(2) },
      { k: 'x', id: 'LP_SHARE', n: ['Liquidity share', '流动性占比'], opts: [.2, .4, .6, .8, .9], show: pc, lit: v => v.toFixed(2) },
      { k: 'sev', id: 'ALARM_SEVERITY', n: ['Alarm severity', '警报严重度'], opts: [3, 4, 5], show: v => '≥ ' + v, lit: String },
      { k: 'cred', id: 'ALARM_CREDIBILITY', n: ['Alarm credibility', '警报可信度'], opts: [.3, .5, .7], show: v => '> ' + v.toFixed(1), lit: v => v.toFixed(2) },
      { k: 'cool', id: 'STAND_ASIDE_HOURS', n: ['Stand aside', '观望时长'], opts: [6, 12, 18, 24, 48], show: v => v + ' h', lit: String },
    ],
    t2: [
      { k: 'ltv', id: 'OPEN_LTV_CUT', n: ['Opening LTV cut', '开局下调 LTV'], opts: [0, .25, .5], show: v => v + ' pp', lit: v => v.toFixed(2) },
      { k: 's1', id: 'OPEN_SLOPE1_RAISE', n: ['Opening slope-1 raise', '开局上调斜率一'], opts: [0, .5, 1], show: v => v + ' pp', lit: v => v.toFixed(1) },
      { k: 'sev', id: 'ALARM_SEVERITY', n: ['Alarm severity', '警报严重度'], opts: [3, 4, 5], show: v => '≥ ' + v, lit: String },
      { k: 'cred', id: 'ALARM_CREDIBILITY', n: ['Alarm credibility', '警报可信度'], opts: [.3, .5, .7], show: v => '> ' + v.toFixed(1), lit: v => v.toFixed(2) },
      { k: 'bonus', id: 'ALARM_BONUS_STEP', n: ['Bonus step on alarm', '警报时奖励步长'], opts: [0, .25, .5], show: v => v + ' pp', lit: v => v.toFixed(2) },
      { k: 's2', id: 'ALARM_SLOPE2_STEP', n: ['Slope-2 step on alarm', '警报时斜率二步长'], opts: [0, 10, 20], show: v => v + ' pp', lit: String },
      { k: 'u', id: 'UTILISATION_TRIGGER', n: ['Utilisation trigger', '利用率触发线'], opts: [.85, .9, .95], show: pc, lit: v => v.toFixed(2) },
      { k: 'freeze', id: 'FREEZE_ON_BACKED_ALARM', n: ['Freeze on a backed-asset alarm', '背书资产警报时冻结借款'], opts: [true, false], show: v => v ? 'on' : 'off', lit: v => v ? 'True' : 'False' },
    ],
  };
  /* «id» marks a constant; everything else is the same rule the simulator runs */
  const CODE = {
    t1: { python: `from holobit import Agent, Plan, hold, lp, remove_lp

RANGE_WIDTH        = «w»   # ± around spot
LP_SHARE           = «x»   # of the wallet
ALARM_SEVERITY     = «sev»      # step aside at this severity …
ALARM_CREDIBILITY  = «cred»   # … and above this credibility
STAND_ASIDE_HOURS  = «cool»     # before going back in


class Strategy(Agent):
    def decide(self, obs):
        s = obs.signal
        alarm = s and s.severity >= ALARM_SEVERITY and s.credibility > ALARM_CREDIBILITY
        if alarm and obs.lp:
            return Plan([remove_lp()], why="credible alarm")
        waiting = alarm and obs.hour < s.hour + STAND_ASIDE_HOURS
        if not obs.lp and not waiting:
            return Plan([lp(width=RANGE_WIDTH, share=LP_SHARE)])
        if obs.lp and not obs.lp.in_range:
            return Plan([lp(width=RANGE_WIDTH, share=LP_SHARE)], why="out of range")
        return hold()
`, typescript: `import { Agent, Obs, plan, hold, lp, removeLp } from "holobit";

const RANGE_WIDTH        = «w»;   // ± around spot
const LP_SHARE           = «x»;   // of the wallet
const ALARM_SEVERITY     = «sev»;      // step aside at this severity …
const ALARM_CREDIBILITY  = «cred»;   // … and above this credibility
const STAND_ASIDE_HOURS  = «cool»;     // before going back in

export class Strategy extends Agent {
  decide(obs: Obs) {
    const s = obs.signal;
    const alarm = !!s && s.severity >= ALARM_SEVERITY && s.credibility > ALARM_CREDIBILITY;
    if (alarm && obs.lp) return plan([removeLp()], "credible alarm");
    const waiting = alarm && obs.hour < s!.hour + STAND_ASIDE_HOURS;
    if (!obs.lp && !waiting) return plan([lp({ width: RANGE_WIDTH, share: LP_SHARE })]);
    if (obs.lp && !obs.lp.inRange) return plan([lp({ width: RANGE_WIDTH, share: LP_SHARE })], "out of range");
    return hold();
  }
}
` },
    t2: { python: `from holobit import Steward, Proposal, hold

OPEN_LTV_CUT            = «ltv»   # pp, first decision
OPEN_SLOPE1_RAISE       = «s1»    # pp, first decision
ALARM_SEVERITY          = «sev»      # act at this severity …
ALARM_CREDIBILITY       = «cred»   # … and above this credibility
ALARM_BONUS_STEP        = «bonus»   # pp
ALARM_SLOPE2_STEP       = «s2»     # pp, when utilisation is above the trigger
UTILISATION_TRIGGER     = «u»
FREEZE_ON_BACKED_ALARM  = «freeze»


class RiskSteward(Steward):
    def decide(self, obs):
        p, change = obs.params, {}
        if obs.n == 1:
            if OPEN_LTV_CUT: change["ltv"] = p.ltv - OPEN_LTV_CUT
            if OPEN_SLOPE1_RAISE: change["slope1"] = p.slope1 + OPEN_SLOPE1_RAISE
            return Proposal(change) if change else hold()
        s = obs.signal
        if s and s.severity >= ALARM_SEVERITY and s.credibility > ALARM_CREDIBILITY:
            if FREEZE_ON_BACKED_ALARM and s.kind == "asset" and not obs.frozen:
                return Proposal(freeze=True)
            if ALARM_BONUS_STEP and obs.free("bonus"):
                change["bonus"] = p.bonus + ALARM_BONUS_STEP
            if ALARM_SLOPE2_STEP and obs.utilisation > UTILISATION_TRIGGER and obs.free("slope2"):
                change["slope2"] = p.slope2 + ALARM_SLOPE2_STEP
        return Proposal(change) if change else hold()
`, typescript: `import { Steward, Obs, propose, hold } from "holobit";

const OPEN_LTV_CUT            = «ltv»;   // pp, first decision
const OPEN_SLOPE1_RAISE       = «s1»;    // pp, first decision
const ALARM_SEVERITY          = «sev»;      // act at this severity …
const ALARM_CREDIBILITY       = «cred»;   // … and above this credibility
const ALARM_BONUS_STEP        = «bonus»;   // pp
const ALARM_SLOPE2_STEP       = «s2»;     // pp, when utilisation is above the trigger
const UTILISATION_TRIGGER     = «u»;
const FREEZE_ON_BACKED_ALARM  = «freeze»;

export class RiskSteward extends Steward {
  decide(obs: Obs) {
    const p = obs.params, change: Record<string, number> = {};
    if (obs.n === 1) {
      if (OPEN_LTV_CUT) change.ltv = p.ltv - OPEN_LTV_CUT;
      if (OPEN_SLOPE1_RAISE) change.slope1 = p.slope1 + OPEN_SLOPE1_RAISE;
      return Object.keys(change).length ? propose(change) : hold();
    }
    const s = obs.signal;
    if (s && s.severity >= ALARM_SEVERITY && s.credibility > ALARM_CREDIBILITY) {
      if (FREEZE_ON_BACKED_ALARM && s.kind === "asset" && !obs.frozen) return propose({}, { freeze: true });
      if (ALARM_BONUS_STEP && obs.free("bonus")) change.bonus = p.bonus + ALARM_BONUS_STEP;
      if (ALARM_SLOPE2_STEP && obs.utilisation > UTILISATION_TRIGGER && obs.free("slope2")) change.slope2 = p.slope2 + ALARM_SLOPE2_STEP;
    }
    return Object.keys(change).length ? propose(change) : hold();
  }
}
` },
  };
  const def = (k, key) => DEF[k].find(d => d.k === key);
  const litOf = (k, d, v, lang) => d.k === 'freeze' && lang === 'typescript' ? String(v) : d.lit(v);
  const tints = s => esc(s).replace(/(#[^\n«]*|\/\/[^\n«]*)/g, '<i>$1</i>').replace(/\b(from|import|class|def|return|if|and|not|const|export|extends|else)\b/g, '<b>$1</b>');

  function init(k, lang) { const t = S[k]; t.agent = Object.assign({ src: 'here', view: 'here', lang, knobs: { ...KNOB[k] }, bt: [], gh: null, up: null }, t.agent, { lang }); paint(k); }
  const get = k => S[k].agent;

  /* ── panel ── */
  function codeHTML(k, live) {
    const a = get(k), K = { ...KNOB[k], ...a.knobs };
    return tints(CODE[k][a.lang]).replace(/«(\w+)»/g, (m, key) => { const d = def(k, key);
      return live ? `<select class="kn" data-knob="${key}" aria-label="${LA(d.n)}">${d.opts.map(o => `<option value="${o}" ${String(o) === String(K[key]) ? 'selected' : ''}>${litOf(k, d, o, a.lang)}</option>`).join('')}</select>` : `<u>${litOf(k, d, K[key], a.lang)}</u>`; });
  }
  const CLI = k => [['holobit login', ['Sign this machine in with a token from Settings', '用设置里的令牌登录本机']], [`holobit agent init --track ${k === 't1' ? 1 : 2}`, ['Start from the kit', '从起步包开始']], ['holobit agent test --family F2', ['Run a public family locally', '在本地跑一个公开情景族']], [`holobit agent submit --track ${k === 't1' ? 1 : 2}`, ['Build, sign and submit', '构建、签名并提交']], [`holobit verify --track ${k === 't1' ? 1 : 2}`, ['Recompute a published score', '重算已公布的分数']]];
  function paint(k) {
    const box = $('#w-agent'), v = UI.vis; if (!box || !v || v.id !== k) return;
    const t = S[k], a = t.agent;
    if (!a) { box.innerHTML = `<p class="empty">${T('Your agent appears here once you pick a starter kit.', '选好起步包后，你的 Agent 会出现在这里。')}</p>`; return; }
    const seg = [['here', 'Workspace', '工作区'], ['github', 'GitHub', 'GitHub'], ['upload', 'Upload', '上传'], ['cli', 'CLI', 'CLI']];
    const last = a.bt[0], prev = a.bt[1];
    const body = {
      here: () => `<div class="code"><header><b>agent.${a.lang === 'typescript' ? 'ts' : 'py'}</b><span>${a.src === 'here' ? T('runs in practice and hosted runs', '用于练习与托管试跑') : T('not the submitted source', '不是当前提交的来源')}</span></header><pre>${codeHTML(k, true)}</pre></div>
        <div class="bt"><select id="bt-fam" aria-label="family">${FAM.map(f => `<option value="${f.id}" ${f.id === (last ? last.fam : k === 't1' ? 'F2' : 'F5') ? 'selected' : ''}>${f.id} · ${LA(f.n)}</option>`).join('')}</select><button class="btn sm solid" data-do="bt:${k}">${T('Backtest', '回测')}</button></div>
        ${last ? `<div class="bt-out"><div class="bigS ${last.S < 0 ? 'neg' : ''}"><b>${sgn(last.S, 0)}</b><span>bps${prev && prev.fam === last.fam ? ` · ${sgn(last.S - prev.S, 0)} ${L('vs last', '较上次')}` : ''}</span></div>${last.gate ? pill(T('gate failed', '门失败'), 'bad') : last.exit ? pill(T('forced exit', '强制退出'), 'warn') : pill(T('survived', '存活'), 'ok')}${last.svg}</div>` : ''}`,
      github: () => !S.gh ? `<div class="ag-empty"><p>${T('Connect a repository and every push builds a version.', '连接仓库后，每次推送都会构建一个版本。')}</p><button class="btn solid" data-do="gh:${k}">${T('Connect GitHub', '连接 GitHub')}</button></div>`
        : `<dl class="kv"><div><dt>${T('Account', '账户')}</dt><dd>@${esc(S.gh.user)}</dd></div><div><dt>${T('Repository', '仓库')}</dt><dd>${a.gh ? `<code>${esc(a.gh.repo)}</code>` : '—'}</dd></div><div><dt>${T('Branch', '分支')}</dt><dd>${a.gh ? esc(a.gh.branch) : '—'}</dd></div><div><dt>${T('Last build', '最近构建')}</dt><dd>${a.gh ? `<code>${a.gh.sha.slice(0, 7)}</code>` : '—'}</dd></div></dl><p class="hint">${T('Pick the repository when you submit a version.', '提交版本时选择仓库。')}</p><div class="acts"><button class="btn sm" data-do="ghx">${T('Disconnect', '断开连接')}</button></div>`,
      upload: () => `<dl class="kv"><div><dt>${T('Accepts', '接受')}</dt><dd>OCI · linux/amd64 · ≤ 4 GB</dd></div><div><dt>${T('Last upload', '最近上传')}</dt><dd>${a.up ? `${esc(a.up.name)} · ${bytes(a.up.size)}` : '—'}</dd></div>${a.up ? `<div><dt>SHA-256</dt><dd><code>${short(a.up.sha, 10, 8)}</code></dd></div>` : ''}</dl><p class="hint">${T('Choose the file when you submit a version.', '提交版本时选择文件。')}</p>`,
      cli: () => `<ul class="cli">${CLI(k).map(c => `<li><code>${c[0]}</code><span>${TA(c[1])}</span><button class="ib" data-copy="${c[0]}" aria-label="Copy">⧉</button></li>`).join('')}</ul><div class="acts"><button class="btn sm" data-act="settings" data-tab="dev">${T('Tokens', '令牌')}</button></div>`,
    }[a.view]();
    box.innerHTML = `<div class="a-seg ag-seg">${seg.map(s => `<button data-agv="${s[0]}" class="${a.view === s[0] ? 'on' : ''}">${T(s[1], s[2])}${a.src === s[0] ? '<i></i>' : ''}</button>`).join('')}</div>${body}
      <h4>${T('Versions', '版本')}</h4>${t.versions.length ? `<ol class="vl">${t.versions.slice().reverse().map(x => `<li><b>v${x.v}</b><span>${{ here: L('workspace', '工作区'), github: 'GitHub', upload: L('upload', '上传'), digest: L('digest', '摘要') }[x.src] || ''}</span><code>${short(x.digest.slice(7), 8, 6)}</code>${t.freeze && t.freeze.v === x.v ? pill(T('frozen', '已冻结'), 'ok') : ''}</li>`).join('')}</ol>` : `<p class="empty">${T('None yet.', '还没有版本。')}</p>`}`;
  }
  $('#w-agent').addEventListener('click', e => {
    const k = UI.vis && UI.vis.id, v = e.target.closest('[data-agv]'), c = e.target.closest('[data-copy]');
    if (v && S[k] && S[k].agent) { S[k].agent.view = v.dataset.agv; save(); paint(k); }
    else if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).then(() => UI.toast(T('Copied.', '已复制。')), () => {}); }
  });
  $('#w-agent').addEventListener('change', e => { const s = e.target.closest('[data-knob]'), k = UI.vis && UI.vis.id; if (s && S[k] && S[k].agent) set(k, { [s.dataset.knob]: parse(s.value) }); });
  const parse = v => v === 'true' ? true : v === 'false' ? false : +v;
  function set(k, ch) { const a = get(k); Object.assign(a.knobs, ch); save(); paint(k); }

  /* one unit under the current code; returns the row it adds to the backtest list */
  function backtest(k, fam) {
    const a = get(k), K = { ...KNOB[k], ...a.knobs }, { sim, sc } = runUnit(k, fam, seedOf(fam + k + 'bt'), K), one = k === 't1';
    const svg = one ? chart({ series: [{ d: sim.hist.map(x => x.hold), c: 'var(--mut)', dash: 1, w: 1 }, { d: sim.hist.map(x => x.nav), c: 'var(--acc)', fill: 1, w: 1.8 }], xmax: HOURS, fmt: x => nf(x / 1000, 1) + 'k', H: 110 })
      : chart({ series: [{ d: sim.b.hist.map(x => x.BD), c: 'var(--mut)', dash: 1, w: 1 }, { d: sim.a.hist.map(x => x.BD), c: 'var(--bad)', fill: 1, w: 1.8 }], xmax: HOURS, fmt: x => '$' + nf(x, 1) + 'm', H: 110 });
    const row = { fam, S: Math.round(sc.S), gate: sc.gate || null, exit: !!sc.exited, svg };
    a.bt.unshift(row); a.bt.length = Math.min(a.bt.length, 6); save(); paint(k); return row;
  }

  /* "widen the range to 30%" · "be more careful" · "backtest on F5": plain requests that edit the code */
  function ask(k, s) {
    const a = get(k); if (!a) return null;
    const near = (key, x) => def(k, key).opts.reduce((p, c) => Math.abs(c - x) < Math.abs(p - x) ? c : p), num = rx => { const m = s.match(rx); return m ? +m[1] : null; }, ch = {};
    const bt = s.match(/back ?test|回测/i), fam = (s.match(/\bF(10|\d)\b/i) || [])[0];
    if (k === 't1') {
      let v;
      if ((v = num(/(?:range|width|区间)[^\d]*(\d+(?:\.\d+)?)\s*%/i)) != null) ch.w = near('w', v / 100);
      if ((v = num(/(?:share|liquidity|占比|流动性)[^\d]*(\d+)\s*%/i)) != null) ch.x = near('x', v / 100);
      if ((v = num(/(?:stand aside|wait|cool|观望|等)[^\d]*(\d+)\s*(?:h|小时)/i)) != null) ch.cool = near('cool', v);
      if (/tight|narrow|收窄/i.test(s) && ch.w == null) ch.w = .05;
      if (/wide|widen|放宽/i.test(s) && ch.w == null) ch.w = .3;
    } else {
      if (/(no|don.?t|stop|关闭|不要).{0,12}(freeze|冻结)|freeze.{0,6}off/i.test(s)) ch.freeze = false; else if (/freeze|冻结/i.test(s) && /on|enable|turn|开启|打开/i.test(s)) ch.freeze = true;
      let v;
      if ((v = num(/(?:utilisation|utilization|利用率)[^\d]*(\d+)\s*%/i)) != null) ch.u = near('u', v / 100);
      if ((v = num(/bonus[^\d]*(\d+(?:\.\d+)?)/i)) != null) ch.bonus = near('bonus', v);
    }
    let v;
    if ((v = num(/(?:severity|严重度)[^\d]*(\d)/i)) != null) ch.sev = near('sev', v);
    if ((v = num(/(?:credibility|可信度)[^\d]*(\d?\.\d+)/i)) != null) ch.cred = near('cred', v);
    if (/careful|cautious|defensive|conservative|safer|保守|谨慎|稳/i.test(s)) Object.assign(ch, { sev: 3, cred: .3 }, k === 't1' ? { cool: 24 } : { u: .85 });
    if (/aggressive|bolder|risk|激进|大胆/i.test(s) && !/risk steward/i.test(s)) Object.assign(ch, { sev: 5, cred: .7 }, k === 't1' ? { w: .05, cool: 6 } : { u: .95 });
    const keys = Object.keys(ch).filter(key => String(a.knobs[key]) !== String(ch[key]));
    if (!keys.length && !bt) return null;
    const before = { ...a.knobs };
    if (keys.length) { a.src = 'here'; a.view = 'here'; set(k, Object.fromEntries(keys.map(key => [key, ch[key]]))); }
    let out = keys.length ? `<div class="diff">${keys.map(key => { const d = def(k, key); return `<div><code>${d.id}</code><del>${litOf(k, d, before[key], a.lang)}</del><ins>${litOf(k, d, ch[key], a.lang)}</ins></div>`; }).join('')}</div>` : '';
    if (bt || keys.length) { const f = fam ? fam.toUpperCase() : a.bt[0] ? a.bt[0].fam : k === 't1' ? 'F2' : 'F5', was = a.bt.find(r => r.fam === f), r = backtest(k, f);
      out += `<p>${T(`${f} · ${LA(FAMS[f].n)}: <b>${bps(r.S)}</b>`, `${f} · ${FAMS[f].n[1]}：<b>${bps(r.S)}</b>`)}${was ? ` <small>(${T('was', '此前')} ${bps(was.S)})</small>` : ''} ${r.gate ? pill(T('gate failed', '门失败'), 'bad') : r.exit ? pill(T('forced exit', '强制退出'), 'warn') : pill(T('survived', '存活'), 'ok')}</p>`; }
    UI.tab('agent'); return out;
  }

  /* ── GitHub: consent once, then pick what to build ── */
  async function github(k) {
    const t = S[k], a = t.agent || (init(k, t.kit || 'python'), t.agent), name = k === 't1' ? 'strategy' : 'steward';
    if (!S.gh) {
      const ok = await card(`<div class="oauth"><header>${GHI(22)}<i></i><svg width="22" height="23" style="color:var(--t1)"><use href="#hb-mark"/></svg></header><h3>${T('HoloBit wants to', 'HoloBit 请求')}</h3><ul><li>${T('read the repositories you choose', '读取你选定的仓库')}</li><li>${T('receive push events from them', '接收这些仓库的推送事件')}</li></ul><footer><button class="btn link" data-x="no">${T('Cancel', '取消')}</button><button class="btn solid" data-x="ok">${T('Authorize', '授权')}</button></footer></div>`, (c, done) => { $('[data-x=ok]', c).onclick = () => done(true); $('[data-x=no]', c).onclick = () => done(false); return () => done(true); }, { cls: 'bare' });
      if (!ok) return null;
      S.gh = { user: slug(S.user.handle) }; save();
    }
    const repos = [`${S.gh.user}/ewm-${name}`, `${S.gh.user}/holobit-agents`, `${slug(S.acct.team)}/${name}-agent`], id = uid();
    const r = await card(`<header><h4>GitHub</h4><small>@${esc(S.gh.user)}</small></header><div class="grid2">${fld(T('Repository', '仓库'), `<select id="${id}r">${repos.map(x => `<option ${a.gh && a.gh.repo === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}${fld(T('Branch', '分支'), `<select id="${id}b">${['main', 'dev', 'freeze-candidate'].map(x => `<option ${a.gh && a.gh.branch === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}</div><footer><button class="btn link" data-x="no">${T('Choose another way', '换一种方式')}</button><button class="btn solid" data-x="go">${T('Build this branch', '构建这个分支')}</button></footer>`, (c, done) => {
      const go = () => done({ repo: $(`#${id}r`, c).value, branch: $(`#${id}b`, c).value });
      $('[data-x=go]', c).onclick = go; $('[data-x=no]', c).onclick = () => done(null); return go;
    });
    if (!r) return null;
    a.gh = { ...r, sha: hx(r.repo + r.branch + t.versions.length + Date.now(), 40) }; save(); return a.gh;
  }
  const GHI = z => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="currentColor"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0"/></svg>`;

  /* ── upload: a real file, its real size, and its real SHA-256 when the browser can hold it ── */
  async function sha256(f) {
    if (f.size > 512e6 || !window.crypto || !crypto.subtle) return { sha: hx(f.name + f.size + f.lastModified, 64), real: false };
    const d = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
    return { sha: [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''), real: true };
  }
  async function upload(k) {
    const t = S[k], a = t.agent || (init(k, t.kit || 'python'), t.agent), id = uid();
    const f = await card(`<header><h4>${T('Upload an image', '上传镜像')}</h4></header>
      <label class="drop" for="${id}"><input type="file" id="${id}" accept=".tar,.gz,.tgz,.zip,.oci"><b>${T('Choose a file, or drop it here', '选择文件，或拖到这里')}</b><span>OCI · linux/amd64 · ≤ 4 GB</span></label>
      <dl class="kv" hidden></dl>
      <footer><button class="btn link" data-x="no">${T('Choose another way', '换一种方式')}</button><button class="btn solid" data-x="go" disabled>${T('Sign and submit', '签名并提交')}</button></footer>`, (c, done) => {
      const inp = $(`#${id}`, c), drop = $('.drop', c), info = $('.kv', c), go = $('[data-x=go]', c); let got = null;
      const take = async file => {
        if (!file) return; got = null; go.disabled = true; info.hidden = false;
        info.innerHTML = `<div><dt>${T('File', '文件')}</dt><dd>${esc(file.name)}</dd></div><div><dt>${T('Size', '大小')}</dt><dd>${bytes(file.size)}</dd></div><div><dt>SHA-256</dt><dd>${T('hashing…', '计算中…')}</dd></div>`;
        const h = await sha256(file); if (c.classList.contains('done')) return;
        info.lastElementChild.lastElementChild.innerHTML = `<code>${short(h.sha, 12, 8)}</code>${h.real ? '' : ` <small>${T('too large to hash here', '文件过大，未在此计算')}</small>`}`;
        got = { name: file.name, size: file.size, sha: h.sha }; go.disabled = false;
      };
      inp.onchange = () => take(inp.files[0]);
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files[0]); };
      go.onclick = () => got && done(got); $('[data-x=no]', c).onclick = () => done(null);
      return () => done({ name: `${k === 't1' ? 'strategy' : 'steward'}-image.tar`, size: 1.84e9, sha: hx(S.acct.team + k + 'up' + t.versions.length, 64) });
    });
    if (f) { a.up = f; save(); }
    return f;
  }

  return { init, paint, set, ask, backtest, github, upload, DEF, GHI,
    connect(k) { S.gh = { user: slug(S.user.handle) }; save(); paint(k); }, disconnect() { S.gh = null; save(); const v = UI.vis; v && paint(v.id); } };
})();
