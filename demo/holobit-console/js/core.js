'use strict';
/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wait = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

let store = null;
try { store = window.localStorage; store.getItem('x'); } catch (e) { store = null; }
const sget = k => { try { return store && store.getItem(k); } catch (e) { return null; } };
const sset = (k, v) => { try { store && store.setItem(k, v); } catch (e) {} };
const sdel = k => { try { store && store.removeItem(k); } catch (e) {} };

/* ───────── language ───────── */
let LANG = sget('hb-lang') || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
const L = (en, zh) => (LANG === 'zh' && zh != null ? zh : en);
const T = (en, zh) => `<span data-i data-en="${esc(en)}" data-zh="${esc(zh == null ? en : zh)}">${L(en, zh)}</span>`;
const TA = p => T(p[0], p[1]);
const LA = p => L(p[0], p[1]);
function applyLang(root = document) {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.body.dataset.lang = LANG;
  $$('[data-i]', root).forEach(e => { e.innerHTML = e.dataset[LANG] ?? e.dataset.en; });
  $$('[data-ph-en]', root).forEach(e => { e.placeholder = LANG === 'zh' ? e.dataset.phZh : e.dataset.phEn; });
  $$('[data-tip-en]', root).forEach(e => { e.dataset.tip = LANG === 'zh' ? e.dataset.tipZh : e.dataset.tipEn; });
}

/* ───────── deterministic randomness + digests (demo-grade, not cryptographic) ───────── */
function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.g = () => { let u = 0, v = 0; while (!u) u = f(); v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.int = (a2, b) => a2 + Math.floor(f() * (b - a2 + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  return f;
}
function hx(s, n = 64) {
  s = String(s); let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length, o = '';
  for (let k = 0; o.length < n; k++) {
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i) + k * 131; h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    o += (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }
  return o.slice(0, n);
}
const seedOf = s => parseInt(hx(s, 8), 16);
const short = (h, a = 8, b = 6) => h.slice(0, a) + '…' + h.slice(-b);

/* ───────── number formats ───────── */
const nf = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (x, d = 0) => (x < 0 ? '−' : '') + '$' + nf(Math.abs(x), d);
const usdc = x => { const a = Math.abs(x), s = x < 0 ? '−' : ''; return a >= 1e9 ? s + '$' + nf(a / 1e9, 2) + 'b' : a >= 1e6 ? s + '$' + nf(a / 1e6, 1) + 'm' : a >= 1e4 ? s + '$' + nf(a / 1e3, 1) + 'k' : s + '$' + nf(a, 0); };
const pct = (x, d = 1) => (x < 0 ? '−' : '') + nf(Math.abs(x) * 100, d) + '%';
const sgn = (x, d = 0) => { const r = +Number(x).toFixed(d); return (r > 0 ? '+' : r < 0 ? '−' : '') + nf(Math.abs(r), d); };
const bps = x => sgn(x, 0) + ' bps';

/* ───────── journey map: stages and every branch they can take ───────── */
const ACTS = [['Register', '报名'], ['Build', '构建'], ['Practise', '练习'], ['Warm-up', '热身'], ['Freeze', '冻结'], ['Evaluate & verify', '评测与核实']];
const MAP = {
  acct: [
    { id: 'apply', act: 0, n: ['Application', '报名申请'], br: [
      { id: 'entry', n: ['Entry', '参赛方式'], o: { solo: ['Individual', '个人'], team: ['Team', '团队'] } },
      { id: 'auth', n: ['Sign-in', '登录'], o: { github: ['GitHub', 'GitHub'], email: ['Magic link', '邮箱链接'] } },
      { id: 'mail', n: ['Verification', '验证'], o: { github: ['Verified by GitHub', 'GitHub 已验证'], opened: ['Link opened', '链接打开'], spam: ['Landed in spam', '进了垃圾箱'], expired: ['Link expired', '链接过期'], capped: ['Resend cap', '重发上限'] } },
      { id: 'elig', n: ['Declaration', '申报'], o: { clear: ['Clear', '通过'], restricted: ['Restricted residence', '受限地区'], minor: ['Under 18', '未满 18 岁'], staff: ['Organiser tie', '主办方关联'] } },
      { id: 'team', n: ['Seat', '席位'], o: { create: ['Created', '建队'], joined: ['Joined by invite', '受邀入队'], taken: ['Already on a team', '已在别队'], full: ['Team full', '队伍已满'] } },
      { id: 'tracks', n: ['Tracks', '赛道'], o: { t1: ['Track 1', '赛道 1'], t2: ['Track 2', '赛道 2'], both: ['Both', '两条'] } },
      { id: 'terms', n: ['Terms', '条款'], o: { accept: ['Accepted', '接受'], decline: ['Declined', '拒绝'] } },
      { id: 'research', n: ['Research use', '研究用途'], o: { share: ['Authorised', '授权'], withhold: ['Withheld', '不授权'] } }] },
    { id: 'key', act: 0, n: ['Team key', '队伍钥匙'], br: [
      { id: 'key', n: ['Key', '钥匙'], o: { generated: ['Generated', '生成'], pasted: ['Pasted', '粘贴'], invalid: ['Wrong key type', '钥匙类型不对'] } }] },
    { id: 'model', act: 0, n: ['Model', '大模型'], br: [
      { id: 'llm', n: ['Model access', '模型接入'], o: { none: ['No LLM', '不用大模型'], ok: ['Test call passed', '试调通过'], auth: ['Provider refused key', '服务方拒绝密钥'], snapshot: ['Snapshot not whitelisted', '快照不在白名单'] } }] },
  ],
  track: [
    { id: 'brief', act: 1, n: ['Brief', '任务书'], br: [
      { id: 'kit', n: ['Starter kit', '起步包'], o: { python: ['Python', 'Python'], typescript: ['TypeScript', 'TypeScript'] } },
      { id: 'sum', n: ['Checksum', '校验和'], o: { match: ['Match', '相符'], mismatch: ['Mismatch', '不符'] } }] },
    { id: 'loop', act: 2, n: ['Decision loop', '决策循环'], br: [
      { id: 'decision', n: ['Decision', '决定'], o: { hold: ['Hold', '保持'], abstain: ['Abstain', '弃权'], plan: ['Plan', '计划'], error: ['Decision error', '决策错误'], timeout: ['Timeout', '超时'] } },
      { id: 'outcome', n: ['Execution', '执行'], o: { completed: ['Completed', '已完成'], failed: ['Failed', '失败'], rejected: ['Rejected', '被拒'] } },
      { id: 'unit', n: ['Unit end', '单元结局'], o: { survived: ['Survived', '存活'], gate: ['Gate failure', '门失败'], exit: ['Forced exit', '强制退出'] }, t1only: ['exit'] },
      { id: 'token', n: ['Practice token', '练习令牌'], o: { ok: ['Accepted', '可用'], limited: ['Rate limited', '限速'] } }] },
    { id: 'submit', act: 2, n: ['Submit', '提交'], br: [
      { id: 'check', n: ['Validation', '校验'], o: { accepted: ['Accepted', '通过'], large: ['Over 4 GB', '超过 4 GB'], signature: ['Bad signature', '签名不对'], secret: ['Secret in image', '镜像含密钥'], manifest: ['Bad manifest', '清单不合'] } }] },
    { id: 'trial', act: 2, n: ['Hosted run', '托管试跑'], br: [
      { id: 'run', n: ['Run', '运行'], o: { completed: ['Completed', '跑完'], timeout: ['Timeouts', '超时'], crash: ['Crash', '崩溃'], refused: ['Provider refused', '服务方拒绝'] } }] },
    { id: 'warmup', act: 3, n: ['Warm-up', '热身轮'], br: [
      { id: 'rules', n: ['Rules update', '规则新版'], o: { accepted: ['Accepted', '接受'], declined: ['Declined', '拒绝'] } },
      { id: 'warm', n: ['Warm-up run', '热身运行'], o: { clean: ['Clean', '顺利'], platform: ['Platform fault', '平台故障'], agent: ['Agent fault', 'Agent 出错'], missed: ['Nothing submitted', '没有提交'] } },
      { id: 'elig', n: ['Qualification', '资格'], o: { eligible: ['Qualified', '取得资格'], ineligible: ['Not qualified', '未取得'] } },
      { id: 'wappeal', n: ['Appeal', '申诉'], o: { overturned: ['Overturned', '改判'], upheld: ['Upheld', '维持'] } }] },
    { id: 'freeze', act: 4, n: ['Freeze', '冻结'], br: [
      { id: 'oob', n: ['Confirmation', '带外确认'], o: { confirmed: ['Confirmed', '已确认'], expired: ['Code expired', '验证码过期'] } },
      { id: 'fkey', n: ['Team key', '队伍钥匙'], o: { held: ['In hand', '在手'], lost: ['Reported lost', '报失'] } }] },
    { id: 'evaluate', act: 5, n: ['Evaluation', '评测'], br: [
      { id: 'profile', n: ['First half', '上半场'], o: { contender: ['Contender', '领先'], midfield: ['Mid-table', '中游'], gate: ['Survival gate failed', '未过生存门'], insufficient: ['Insufficient evidence', '证据不足'], cancelled: ['Cancelled', '取消'] } }] },
    { id: 'finals', act: 5, n: ['Finals', '决赛'], br: [
      { id: 'list', n: ['Finals list', '决赛名单'], o: { finalist: ['Finalist', '进决赛'], watch: ['Not in finals', '未进决赛'] } },
      { id: 'fast', n: ['Fast appeal', '快速申诉'], o: { none: ['None', '不申诉'], filed: ['Filed', '已申诉'] } },
      { id: 'place', n: ['Placing', '名次'], o: { podium: ['Leading group', '领先组'], ranked: ['Ranked', '列名次'] } }] },
    { id: 'result', act: 5, n: ['Result', '结果'], br: [
      { id: 'recompute', n: ['Recompute', '重算'], o: { match: ['Matches', '一致'], mismatch: ['Mismatch', '不一致'] } },
      { id: 'appeal', n: ['Appeal', '申诉'], o: { none: ['None', '不申诉'], upheld: ['Upheld', '成立'], dismissed: ['Dismissed', '驳回'] } }] },
    { id: 'close', act: 5, n: ['Close', '收尾'], br: [
      { id: 'prize', n: ['Prize', '奖项'], o: { verified: ['Identity verified', '核验通过'], mismatch: ['Identity mismatch', '身份不符'], none: ['No prize', '无奖项'] } },
      { id: 'exit', n: ['Exit', '离场'], o: { complete: ['Complete', '完赛'], withdrawn: ['Withdrawn', '退赛'] } }] },
  ],
};
const TRACK = {
  t1: { n: ['Strategy agent', '策略 Agent'], s: ['Track 1', '赛道 1'], tag: 'T1' },
  t2: { n: ['Protocol risk agent', '协议风险 Agent'], s: ['Track 2', '赛道 2'], tag: 'T2' },
};

/* ───────── state ───────── */
const freshTrack = () => ({ i: 0, on: false, status: 'active', kit: null, loop: null, sub: null, versions: [], trial: null, warm: null, freeze: null, ev: null, fin: null, res: null, record: [], clock: 0 });
const fresh = () => ({
  v: 4, active: 't1', draft: null,
  acct: { i: 0, done: false, app: null, entry: null, auth: null, handle: '', email: '', name: '', org: '', country: '', group: false, verified: false, role: 'captain', team: null, members: [], tracks: [], terms: null, research: null, key: null, keyLost: false, llm: null },
  t1: freshTrack(), t2: freshTrack(),
  inbox: [], seen: {},
});
let S = fresh();
let SNAP = { acct: [], t1: [], t2: [] };

function save() { sset('hb-console', JSON.stringify({ S, SNAP })); }
function load() {
  try { const d = JSON.parse(sget('hb-console') || 'null'); if (d && d.S && d.S.v === 4) { S = d.S; SNAP = d.SNAP || SNAP; return true; } } catch (e) {}
  return false;
}
function wipe() { sdel('hb-console'); S = fresh(); SNAP = { acct: [], t1: [], t2: [] }; }

function mark(scope, br, opt) {             // record a branch outcome as visited
  const k = (scope === 'acct' ? 'a' : scope) + '.' + br;
  (S.seen[k] = S.seen[k] || []).includes(opt) || S.seen[k].push(opt);
  if (typeof UI !== 'undefined') UI.coverage();
}
function coverage() {
  let n = 0, of = 0;
  const count = (list, pre, tr) => list.forEach(st => st.br.forEach(b => Object.keys(b.o).forEach(o => {
    if (tr === 't2' && b.t1only && b.t1only.includes(o)) return;
    of++; if ((S.seen[pre + '.' + b.id] || []).includes(o)) n++;
  })));
  count(MAP.acct, 'a'); count(MAP.track, 't1', 't1'); count(MAP.track, 't2', 't2');
  return { n, of };
}
