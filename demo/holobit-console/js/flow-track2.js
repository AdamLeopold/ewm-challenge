'use strict';
/* Track stages, part 2: submit → hosted run → warm-up → freeze → evaluation → finals → result → close. */
const HALT = Symbol('halt');
const ord = n => LANG === 'zh' ? `第 ${n} 名` : n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
const ordT = n => T(n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th'), `第 ${n} 名`);
const rankT = (r, lo, hi) => `${ordT(r)} <small>(${ordT(lo)} – ${ordT(hi)})</small>`;
const EFAM = FAM.map(f => ({ id: f.id, n: f.n })).concat([{ id: 'H1', n: ['Held-out family', '留出族'] }, { id: 'H2', n: ['Held-out family', '留出族'] }]);
const slug = s => (s || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team';

function cellsFor(k, profile, half) {
  const r = rng(seedOf(S.acct.team + k + profile + half)), mu = { contender: .55, midfield: .04, gate: .22, insufficient: .3, cancelled: 0 }[profile];
  const g = EFAM.map(f => [0, 1, 2].map(() => ({ s: clamp(mu + r.g() * .55 - (f.id === 'F5' || f.id === 'F2' ? .2 : 0), -1.6, 1.8), st: 'ok' })));
  if (profile === 'gate') { g[5][0].st = g[5][2].st = 'gate'; g[5][0].s = g[5][2].s = -1.5; }
  if (profile === 'insufficient') g[8][1].st = 'plat';
  return g;
}
const gridHTML = (cells, held) => `<div class="g13">${EFAM.map((f, i) => `<div class="gr"><small>${held && f.id[0] === 'H' ? '??' : f.id}</small>${cells[i].map((c, j) => `<i data-c="${i}-${j}"></i>`).join('')}</div>`).join('')}</div>`;
async function fillGrid(root, cells, onTick) {
  const tok = RUN, order = cells.flatMap((row, i) => row.map((c, j) => [i, j])), r = rng(9); order.sort(() => r() - .5);
  let n = 0;
  for (const [i, j] of order) {
    const c = cells[i][j], el = $(`[data-c="${i}-${j}"]`, root);
    el.className = c.st === 'ok' ? (c.s >= 0 ? 'up' : 'dn') : c.st; el.style.setProperty('--a', clamp(.25 + Math.abs(c.s) * .5, .25, 1));
    n++; onTick && onTick(n, order.length);
    if (!UI.fast) { await wait(UI.auto ? 28 : 55); guard(tok); }
  }
}
const hScore = cells => cells.reduce((s, row) => s + row.reduce((a, c) => a + c.s, 0) / row.length, 0) / cells.length;

Object.assign(TRK, {
  /* 09 ─────────────────────────────────────────── */
  async submit(k) {
    const t = S[k], a = S.acct, one = k === 't1';
    UI.idle(['Practise', '练习'], T('Submission', '提交'));
    await say(T('Package the agent as an OCI image for <code>linux/amd64</code>, 4 GB at most. Send its digest in a manifest, signed with the team key.', '把 Agent 打包成 <code>linux/amd64</code> 的 OCI 镜像，不超过 4 GB。把镜像摘要写进清单，用队伍钥匙签名。'));
    const ver = t.versions.length + 1, digest = 'sha256:' + hx(a.team + k + ver + Math.random(), 64);
    const f = t.form || {
      ref: `ghcr.io/${slug(a.team)}/${one ? 'strategy' : 'steward'}:0.${ver}.0`, size: 1.8, signer: 'team',
      manifest: JSON.stringify({ team_id: slug(a.team), track: one ? 1 : 2, image_digest: digest, model: a.llm && !a.llm.none ? { snapshot: a.llm.snap, temperature: 0 } : null, events: one ? ['price_move', 'health_low', 'out_of_range', 'message'] : ['utilisation_high', 'oracle_move', 'liquidations', 'bad_debt', 'message'], resources: one ? { cpu: 2, memory_gib: 4, disk_gib: 10 } : { cpu: 4, memory_gib: 8, disk_gib: 20 } }, null, 2),
    };
    for (;;) {
      const id = uid();
      const v = await card(`<header><h4>${T('Submission', '提交')}<small>v${ver}</small></h4></header>
        <div class="grid2">${fld(T('Image', '镜像'), `<input id="${id}i" class="mono" value="${esc(f.ref)}">`)}
        ${fld(T('Size', '大小'), `<div class="unit"><input id="${id}s" type="number" min="0.1" max="12" step="0.1" value="${f.size}"><em>GB</em></div>`)}</div>
        ${fld('manifest.json', `<textarea id="${id}m" class="mono code" rows="11" spellcheck="false">${esc(f.manifest)}</textarea>`)}
        ${fld(T('Sign with', '签名钥匙'), `<select id="${id}k"><option value="team">${L('Team key', '队伍钥匙')} · SHA256:${a.key.fp.slice(0, 12)}…</option><option value="other">${L('A different key', '另一把钥匙')} · SHA256:${btoa(hx('other', 12))}…</option></select>`)}
        <footer><button class="btn solid" data-x="go">${T('Sign and submit', '签名并提交')}</button></footer>`, (c, done) => {
        const go = () => done({ ref: $(`#${id}i`, c).value.trim(), size: +$(`#${id}s`, c).value, manifest: $(`#${id}m`, c).value, signer: $(`#${id}k`, c).value });
        $('[data-x=go]', c).onclick = go;
        return () => { $(`#${id}s`, c).value = Math.min(+$(`#${id}s`, c).value || 1.8, 3.9); $(`#${id}k`, c).value = 'team'; try { JSON.parse($(`#${id}m`, c).value); } catch (e) { $(`#${id}m`, c).value = f.manifest; } go(); };
      });
      Object.assign(f, v); t.form = f;
      let m = null, bad = null, lim = one ? [2, 4, 10] : [4, 8, 20];
      try { m = JSON.parse(v.manifest); } catch (e) { bad = ['M-01 · the manifest is not valid JSON', 'M-01 · 清单不是合法的 JSON']; }
      if (m) bad = !m.team_id || !m.image_digest || !m.resources || !Array.isArray(m.events) ? ['M-02 · team_id, track, image_digest, events and resources are required', 'M-02 · 必须有 team_id、track、image_digest、events 与 resources']
        : m.track !== (one ? 1 : 2) ? [`M-03 · this is Track ${one ? 1 : 2}; the manifest says track ${esc(m.track)}`, `M-03 · 这里是赛道 ${one ? 1 : 2}，清单写的是 ${esc(m.track)}`]
          : !/^sha256:[0-9a-f]{64}$/.test(m.image_digest) ? ['M-04 · image_digest must be an immutable sha256 digest, not a tag', 'M-04 · image_digest 必须是不可变的 sha256 摘要，不能是标签']
            : m.resources.cpu > lim[0] || m.resources.memory_gib > lim[1] || m.resources.disk_gib > lim[2] ? [`M-05 · resources exceed ${lim[0]} vCPU · ${lim[1]} GiB · ${lim[2]} GiB`, `M-05 · 资源请求超过 ${lim[0]} vCPU · ${lim[1]} GiB · ${lim[2]} GiB`] : null;
      let why = bad ? 'manifest' : v.size > 4 ? 'large' : v.signer !== 'team' ? 'signature' : null;
      if (!why) { await term([['verifying signature …  ok', 'dim'], ['pulling image by digest …  ok', 'dim', 300], ['scanning layers for credentials …', 'dim', 420]]); why = await fork('check', ['What does the scan find?', '扫描发现了什么？'], { only: ['accepted', 'secret'], def: 'accepted' }); }
      else mark(k, 'check', why);
      if (why === 'accepted') { t.versions.push({ digest: m.image_digest, ref: v.ref, v: ver }); t.form = null; break; }
      const msg = { manifest: bad, large: [`I-01 · image is ${v.size} GB; the limit is 4 GB`, `I-01 · 镜像 ${v.size} GB，上限 4 GB`], signature: ['S-01 · the signature doesn’t verify against the registered team key', 'S-01 · 签名与登记的队伍钥匙对不上'], secret: ['I-03 · a layer contains what looks like an API key (/app/.env)', 'I-03 · 某一层里有疑似 API 密钥（/app/.env）'] }[why];
      await say(`${pill(T('rejected', '被拒'), 'warn')} ${TA(msg)}`, { cls: 'warn' });
      if (why === 'secret') await say(T('Keys never go in the image. The gateway injects yours at run time. Rebuild without the file, and rotate that key.', '密钥不能进镜像，网关在运行时注入。去掉那个文件重新构建，并更换那把密钥。'));
      mail('E10', ['Submission rejected', '提交未通过'], msg);
      await choose([O('fix', 'Fix and resubmit', '改好重交')]);
    }
    const v = t.versions[t.versions.length - 1];
    await say(receipt(T('Submission accepted', '提交通过'), [[T('Image', '镜像'), `<code>${esc(v.ref)}</code>`], [T('Signed by', '签名'), `<code>SHA256:${a.key.fp.slice(0, 16)}…</code>`]], v.digest.slice(7)), { cls: 'wide' });
    UI.team();
  },

  /* 10 ─────────────────────────────────────────── */
  async trial(k) {
    const t = S[k], a = S.acct, one = k === 't1', N = one ? 168 : 28, lim = one ? 90 : 180;
    UI.idle(['Practise', '练习'], T('Hosted run', '托管试跑'));
    await say(T('A hosted run is the real thing in miniature: your container, a fixed clock, no internet. It can reach two addresses only, the context API and the model gateway.', '托管试跑就是正式评测的缩小版：你的容器、固定的时钟、没有外网，只通两个地址：上下文 API 与大模型网关。'));
    for (;;) {
      await choose([O('go', 'Start a hosted run', '开始托管试跑')]);
      await term([['sandbox up · read-only root · egress: context-api, llm-gateway', 'dim'], [`unit ${one ? 'F3' : 'F4'}/practice-07 · 7 simulated days · ${N} decisions`, 'dim', 300], ['running ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮', 'acc', 700]]);
      const r = await fork('run', ['How does the run go?', '这次运行怎么样？'], { only: a.llm && !a.llm.none ? ['completed', 'timeout', 'crash', 'refused'] : ['completed', 'timeout', 'crash'], def: 'completed' });
      if (r === 'completed') break;
      const miss = Math.ceil(N * .07);
      await say({
        timeout: T(`<b>${miss} of ${N}</b> decisions ran past ${lim} s. Each was treated as a hold and counted. That is ${pct(miss / N)}; more than 5% fails the survival gate.`, `${N} 次决定里有 <b>${miss} 次</b>超过 ${lim} 秒。每次都按保持处理并计数，占 ${pct(miss / N)}；超过 5% 就过不了生存门。`),
        crash: T('The container exited with <code>137</code> at decision 41: out of memory. A fresh container replayed the run up to that point. After 3 restarts the remaining decisions are held.', '容器在第 41 次决定时以 <code>137</code> 退出：内存用尽。平台开新容器续跑回放。重启超过 3 次以后，剩下的决定一律按保持计。'),
        refused: T('Your provider answered <code>429</code>. The virtual clock paused while the gateway retried for 10 minutes, then the run was closed as an agent failure. Rate limits don’t trigger a fallback for you.', '你的服务方返回 <code>429</code>。网关暂停虚拟时钟重试了 10 分钟，之后这条运行按 Agent 造成的失败结束。限流不会替你触发后备动作。'),
      }[r], { cls: 'warn' });
      if (r === 'refused') mail('E9', ['Provider refused your calls', '服务方拒绝了调用'], ['429 · paused 10 min · raise your quota before the warm-up.', '429 · 暂停 10 分钟 · 请在热身轮前提高额度。']);
      await say(T('Fix it and run again.', '改好再跑一次。'));
    }
    const mine = t.loop ? t.loop.best : 40, rows = [['A', 'Team ▒▒▒▒▒▒'], ['A', 'Team ▒▒▒▒'], ['B', a.team, mine], ['B', 'Team ▒▒▒▒▒▒▒'], ['B', one ? 'Baseline · wide-range LP' : 'Baseline · rule-based steward', 0, 1], ['C', 'Team ▒▒▒'], ['C', one ? 'Baseline · Aave only' : 'Baseline · unchanged', 0, 1], ['D', 'Team ▒▒▒▒▒']];
    t.trial = { ok: true };
    await say(T(`Completed. ${N} of ${N} decisions valid and on time${a.llm && !a.llm.none ? `, $${nf(N * .0019, 2)} of model spend` : ''}.`, `跑完了。${N} 次决定全部有效且按时${a.llm && !a.llm.none ? `，模型花费 $${nf(N * .0019, 2)}` : ''}。`));
    await card(`<header><h4>${T('Practice leaderboard', '练习排行榜')}</h4></header>
      <ol class="lb">${rows.map(r => `<li class="${r[1] === a.team ? 'me' : ''} ${r[3] ? 'base' : ''}"><i>${r[0]}</i><span>${r[3] ? T(r[1], r[1].replace('Baseline', '基准').replace('wide-range LP', '宽区间 LP').replace('rule-based steward', '规则蓝队').replace('Aave only', '只存 Aave').replace('unchanged', '参数不变')) : esc(r[1])}</span><b>${r[1] === a.team ? bps(r[2]) : ''}</b></li>`).join('')}</ol>`, null, { cls: 'lbc' });
    await say(T('You see your exact score. Other teams appear only as a band, a day late, so nobody can tune against the board.', '你看得到自己的精确分。别的队只显示所在的档，并延迟一天，这样谁也没法对着榜单调参。'));
    mail('E11', ['Yesterday’s hosted runs', '昨日托管试跑'], ['1 run · completed · band B.', '1 次运行 · 已完成 · B 档。']);
  },

  /* 11 ─────────────────────────────────────────── */
  async warmup(k) {
    const t = S[k], a = S.acct;
    UI.idle(['Warm-up', '热身'], '');
    mail('E12', ['Rules update R1', '规则新版 R1'], ['Unit counts, family scales and gate thresholds are now fixed. The captain must accept.', '单元数、族尺度与生存门的数值已定。需要队长接受。']);
    await say(T('Rules update <b>R1</b> is out. It fills in the numbers the first version left open: unit counts, family scales, gate thresholds.', '规则新版 <b>R1</b> 已公布，填上了第一版留空的数：单元数、族尺度、生存门的数值。'));
    while (await choose([O('accepted', 'Accept R1', '接受 R1'), O('declined', 'Not yet', '先不接受')], { def: 'accepted' }) === 'declined') {
      mark(k, 'rules', 'declined');
      await say(T('Until R1 is accepted, new submissions are locked.', '接受 R1 之前，不能再提交。'), { cls: 'warn' });
    }
    mark(k, 'rules', 'accepted');
    mail('E14', ['Warm-up locks in 24 hours', '热身轮 24 小时后锁定'], ['Your latest validated submission will be used.', '将使用你最近一次校验通过的提交。']);
    await say(T('The warm-up is one fresh unit from each of the 11 public families, run hosted, for every team at once. It isn’t scored. It is your <b>qualification</b>.', '热身轮从 11 个公开族各取 1 个新单元，全员同时托管运行。它不计分，它是你的<b>参赛资格</b>。'));
    const day = await fork('warm', ['How does warm-up day go?', '热身轮这天怎么样？'], { def: 'clean' });
    let ok = day !== 'missed', why = null;
    if (day === 'missed') why = ['no validated submission at the lock', '锁定时没有校验通过的提交'];
    else {
      const v = t.versions[t.versions.length - 1], r = rng(seedOf(a.team + k + 'warm'));
      mail('E15', ['Warm-up locked', '热身轮已锁定'], [`Using ${short(v.digest)}.`, `使用 ${short(v.digest)}。`]);
      const rows = FAM.map((f, i) => ({ f, s: Math.round(r.g() * 60 + 20), st: day === 'platform' && (i === 3 || i === 7) ? 'plat' : day === 'agent' && (i === 2 || i === 5) ? 'crash' : 'ok' }));
      const table = () => `<header><h4>${T('Warm-up', '热身轮')}</h4><code>${short(v.digest)}</code></header><table class="wt">${rows.map(x => `<tr class="${x.st}"><th>${x.f.id}</th><td>${TA(x.f.n)}</td><td>${x.st === 'ok' ? bps(x.s) : x.st === 'plat' ? T('incomplete · platform', '未完成 · 平台') : T('crashed', '崩溃')}</td><td>${x.st === 'ok' ? pill(T('gate ok', '过门'), 'ok') : pill('—')}</td></tr>`).join('')}</table>`;
      await card(table(), null, { cls: 'wtc' });
      if (day === 'platform') {
        await say(T('Two units didn’t finish, and the fault is ours. They are rerun tomorrow at no cost to you.', '有两个单元没跑完，是平台的问题。明天补跑，不用你承担。'));
        await choose([O('n', 'Next day', '第二天')]); rows.forEach(x => x.st = 'ok');
        await card(table(), null, { cls: 'wtc' });
      }
      if (day === 'agent') {
        await say(T('Your container crashed in two units. An agent fault gets one rerun.', '你的容器在两个单元里崩溃了。Agent 的错可以补跑一次。'), { cls: 'warn' });
        await choose([O('r', 'Use the rerun', '使用补跑')]);
        ok = await fork('elig', ['And the rerun?', '补跑的结果？']) === 'eligible';
        if (ok) { rows.forEach(x => x.st = 'ok'); await card(table(), null, { cls: 'wtc' }); } else why = ['the rerun didn’t complete either', '补跑仍然没有完成'];
      }
      mail('E16', ['Warm-up results', '热身轮结果'], ['Per-family scores, gate readings and failure reasons are in your console.', '每族分、生存门读数与失败原因已在后台。']);
    }
    if (day !== 'agent') mark(k, 'elig', ok ? 'eligible' : 'ineligible');
    if (!ok) {
      mail('E17', ['Qualification: not qualified', '资格结论：未取得'], ['Appeal window: 6 hours.', '申诉窗口：6 小时。']);
      await say(T(`<b>Not qualified</b>: ${why[0]}. You have six hours to appeal.`, `<b>未取得资格</b>：${why[1]}。申诉窗口 6 小时。`), { cls: 'bad' });
      if (await choose([O('appeal', 'Appeal', '申诉'), O('accept', 'Accept it', '接受结论')], { def: 'appeal' }) === 'appeal') {
        const id = uid();
        await card(`<header><h4>${T('Appeal', '申诉')}</h4></header>${fld(T('What should we look at?', '希望我们复核什么？'), `<textarea id="${id}" rows="3"></textarea>`)}<footer><button class="btn solid" data-x="go">${T('Send', '发送')}</button></footer>`, (c, done) => { $('[data-x=go]', c).onclick = () => done(); return () => { $(`#${id}`, c).value = 'The crash follows a gateway timeout at 03:12 UTC.'; done(); }; });
        ok = await fork('wappeal', ['The review comes back.', '复核的结论。']) === 'overturned';
        await say(ok ? T('The review found a platform cause. Decision <b>overturned</b>.', '复核认定是平台原因。<b>改判</b>。') : T('The review stands by the decision. This is final.', '复核维持原结论。这是最终结论。'), { cls: ok ? '' : 'bad' });
      }
      if (!ok) { t.status = 'unqualified'; return HALT; }
    }
    mail('E17', ['Qualification: qualified', '资格结论：已取得'], ['Next: sign and freeze.', '下一步：签名并冻结。']);
    await say(T('<b>Qualified.</b>', '<b>已取得资格。</b>'));
    t.warm = { ok: true };
  },

  /* 12 ─────────────────────────────────────────── */
  async freeze(k) {
    const t = S[k], a = S.acct, name = [`Freeze ${TRACK[k].s[0]}`, `冻结${TRACK[k].s[1]}`];
    UI.idle(['Freeze', '冻结'], '');
    mail('E18', ['Freeze in 24 hours', '24 小时后冻结'], ['Pick your official version and sign it.', '选定正式版本并签名。']);
    await say(T('The freeze fixes the one version that gets evaluated. After it nothing moves: not the image, not the model, not a prompt.', '冻结锁定唯一受评测的版本。之后什么都不能动：镜像、模型、提示词都不行。'));
    const id = uid();
    const pickV = await card(`<header><h4>${T('Official version', '正式版本')}</h4></header><div class="vers">${t.versions.slice().reverse().map((v, i) => `<label class="ver"><input type="radio" name="${id}" value="${v.v}" ${i ? '' : 'checked'}><i></i><b>v${v.v}</b><code>${esc(v.ref)}</code><code>${short(v.digest)}</code></label>`).join('')}</div><footer><button class="btn solid" data-x="go">${T('Sign and freeze', '签名并冻结')}</button></footer>`, (c, done) => { const go = () => done(+$('input:checked', c).value); $('[data-x=go]', c).onclick = go; return go; });
    const v = t.versions.find(x => x.v === pickV);
    if (await fork('fkey', ['Is the team key at hand?', '队伍钥匙在手边吗？'], { def: 'held' }) === 'lost') await keyLost(k, true);
    for (;;) {
      const r = await confirmOOB(name); mark(k, 'oob', r);
      if (r === 'confirmed') break;
      await say(T('The code lapsed. Nothing was frozen.', '确认码过期了。没有冻结任何东西。'), { cls: 'warn' });
      await choose([O('n', 'Send a new code', '重发确认码')]);
    }
    t.freeze = { hash: hx(v.digest + a.key.fp + 'freeze'), v: v.v, beacon: 5512884 + seedOf(a.team) % 900 };
    await say(receipt(T('Frozen', '已冻结'), [[T('Version', '版本'), `v${v.v} · <code>${short(v.digest)}</code>`], [T('Model', '模型'), a.llm && !a.llm.none ? esc(a.llm.snap) : '—'], [T('Signature', '签名'), T('verified', '核对无误')], [T('Beacon round', '信标轮次'), '#' + nf(t.freeze.beacon)]], t.freeze.hash), { cls: 'wide' });
    mail('E19', ['Frozen', '已冻结'], [`Official version ${short(t.freeze.hash)}. Your model key must stay valid through the finals.`, `正式版本 ${short(t.freeze.hash)}。模型密钥须保持有效到决赛结束。`]);
    mail('E6', ['Witness: commitment published', '见证：承诺已公布'], [`Keep this hash: ${short(hx('commit' + t.freeze.beacon))}.`, `请留存这个哈希：${short(hx('commit' + t.freeze.beacon))}。`]);
    UI.team();
    await say(T('It is out of your hands now. Stress scenarios are drawn from a public randomness beacon that didn’t exist when you froze, and the forward window is the real week that starts today.', '现在不归你管了。压力情景由一个冻结时还不存在的公开随机信标抽出；前向窗口是从今天开始的真实一周。'));
  },

  /* 13 ─────────────────────────────────────────── */
  async evaluate(k) {
    const t = S[k], a = S.acct, one = k === 't1', N = one ? 42 : 27;
    world({ phase: ['Evaluate', '评测'], sub: T('First half · hidden stress tests', '上半场 · 隐藏压力题'), viz: '', vitals: [], stress: .7 });
    await term([[`beacon round #${nf(t.freeze.beacon)} → 0x${hx('b' + t.freeze.beacon, 24)}…`, 'dim'], ['seed = H(beacon ‖ commitment)', 'dim', 260], [`13 families × 3 units sealed · set ${short(hx('set' + t.freeze.beacon))}`, 'dim', 260], [`${N} agents · same units · same random numbers`, 'acc', 320]]);
    const profile = await fork('profile', ['How does your agent hold up?', '你的 Agent 表现如何？'], { def: 'contender' });
    if (profile === 'cancelled') {
      await say(T('<b>Cancelled.</b> At decision 212 the container tried to open a connection outside its two allowed addresses (rule C-03). Its runs stay on the record without a rank.', '<b>取消。</b>在第 212 次决定时，容器试图连接两个允许地址以外的地址（规则 C-03）。它的运行照记，不列名次。'), { cls: 'bad' });
      t.ev = { profile, N }; return;
    }
    const cells = cellsFor(k, profile, 1);
    const c = await card(`<header><h4>${T('First half', '上半场')}</h4><span class="cnt">0 / 39</span></header>${gridHTML(cells, true)}<div class="legend"><span class="up">${T('ahead', '领先')}</span><span class="dn">${T('behind', '落后')}</span><span class="gate">${T('gate failure', '门失败')}</span><span class="plat">${T('platform', '平台原因')}</span></div>`, null, { cls: 'evalc' });
    await fillGrid(c, cells, (n, of) => { $('.cnt', c).textContent = `${n} / ${of}`; if (n % 6 === 0 || n === of) world({ viz: `<div class="ring" style="--p:${n / of}"><b>${n}</b><span>/ ${of}</span></div>`, vitals: [[L('Agents', 'Agent 数'), N], [L('Gate failures', '门失败'), cells.flat().slice(0, 1).length && profile === 'gate' ? Math.min(2, Math.floor(n / 14)) : 0, profile === 'gate' ? 'bad' : '']] }); });
    world({ sub: T('Forward window · one real week', '前向窗口 · 真实的一周'), stress: .25 });
    const fr = rng(seedOf(a.team + k + 'fwd')), fw = [0], hd = [0]; for (let i = 1; i <= 42; i++) { hd.push(hd[i - 1] + fr.g() * 38); fw.push(fw[i - 1] + fr.g() * 26 + (profile === 'contender' ? 5 : 1)); }
    await say(T('Meanwhile the forward window records a real week of markets and replays it at speed.', '同时，前向窗口录下真实一周的行情，再高速重放。'));
    await card(`<header><h4>${T('Forward window', '前向窗口')}</h4></header>${chart({ series: [{ d: hd, c: 'var(--mut)', dash: 1, w: 1 }, { d: fw, c: 'var(--acc)', fill: 1, w: 1.8 }], xmax: 42, zero: 0, fmt: x => sgn(x, 0), H: 120 }).replace(/(\d+)h</g, (m, h) => 'D' + (h / 6) + '<')}`, null, { cls: 'fwd' });
    const H = hScore(cells), rk = { contender: [3, 1, 6], midfield: one ? [17, 11, 24] : [11, 7, 16], gate: [9, 5, 14], insufficient: null }[profile];
    t.ev = { profile, N, H, F: fw[42] / 400, rk };
    if (profile === 'insufficient') await say(T('One of your 39 cells is <b>incomplete for a platform reason</b>, which is over the 1% line. Your status is <b>insufficient evidence</b>. It isn’t held against you, and the model spend for the rerun is reimbursed.', '你的 39 格里有 1 格<b>因平台原因未完成</b>，超过了 1% 的线。你的状态是<b>证据不足</b>。这不算你的错，重跑的模型费用由主办方报销。'), { cls: 'warn' });
    else if (profile === 'gate') await say(T(`${rankT(...rk)} of ${N} on the first half, but <b>not past the survival gate</b>: in F5 ${one ? 'your position was liquidated' : 'new bad debt ran past the unchanged baseline'} in 2 of 3 units. You keep a rank and a score. You can’t take a prize or enter the finals.`, `上半场 ${N} 个里排 ${rankT(...rk)}，但<b>未过生存门</b>：在 F5 的 3 个单元里有 2 个${one ? '被清算' : '新增坏账超过了“参数不变”的基线'}。名次与分数照列，但不能获奖，也不进决赛。`), { cls: 'bad' });
    else await say(T(`First half: ${rankT(...rk)} of ${N}. Past the survival gate.`, `上半场：${N} 个里排 ${rankT(...rk)}。已过生存门。`));
    Field.stress(0);
  },

  /* 14 ─────────────────────────────────────────── */
  async finals(k) {
    const t = S[k], e = t.ev, fin = e.profile === 'contender';
    UI.idle(['Finals', '决赛'], '');
    mark(k, 'list', fin ? 'finalist' : 'watch');
    if (!fin) {
      mail('E21', ['First-half result', '上半场结果'], ['You are not in the finals. Your forward window still scores.', '你未进入决赛。前向段照样计分。']);
      await say(T('Eight agents go to the finals. Yours isn’t one of them. The forward window still counts toward your final score.', '8 个 Agent 进入决赛，你的不在其中。前向段照样计入你的总分。'));
      const f = await choose([O('none', 'Understood', '知道了'), O('filed', 'File a fast appeal', '提出快速申诉')], { def: 'none' });
      mark(k, 'fast', f);
      if (f === 'filed') {
        const no = 'EWM-F-' + (1000 + seedOf(S.acct.team + k) % 9000);
        mail('E24', ['Fast appeal received', '已受理快速申诉'], [`Case ${no}.`, `编号 ${no}。`]);
        await say(T(`Case <code>${no}</code>. Answered before the finals begin: the list was recomputed from the sealed records and is unchanged.`, `编号 <code>${no}</code>。决赛开始前已答复：按封存的记录重算，名单不变。`));
      }
      t.fin = { finalist: false }; return;
    }
    mail('E20', ['You’re in the finals', '你进入了决赛'], ['The second half is generated and run live. Watch on site or remotely.', '下半场现场生成、现场运行。可到场或远程观看。']);
    await say(T('You are one of <b>eight finalists</b>. The second half is generated on stage from a fresh beacon draw and run live, cell by cell.', '你是 <b>8 个决赛 Agent</b> 之一。下半场在台上用新取的信标现场生成、现场运行，结果逐格出来。'));
    await choose([O('go', 'Watch it run', '看它运行')]);
    world({ phase: ['Finals', '决赛'], sub: T('Second half · live', '下半场 · 现场'), viz: '', vitals: [], stress: .8 });
    const cells = cellsFor(k, 'contender', 2);
    const c = await card(`<header><h4>${T('Second half', '下半场')}</h4><span class="cnt">0 / 39</span></header>${gridHTML(cells, true)}`, null, { cls: 'evalc' });
    await fillGrid(c, cells, (n, of) => { $('.cnt', c).textContent = `${n} / ${of}`; if (n % 6 === 0 || n === of) world({ viz: `<div class="ring" style="--p:${n / of}"><b>${n}</b><span>/ ${of}</span></div>`, vitals: [[L('Finalists', '决赛 Agent'), 8], [L('Units per agent', '每个 Agent 的单元'), 78]] }); });
    const place = await fork('place', ['Where do you land?', '最后落在哪里？'], { def: 'podium' });
    t.fin = { finalist: true, place, H2: hScore(cells) }; Field.stress(0);
    await say(T('All cells are in. Ranks stay sealed until the announcement, so nobody can work them out the night before.', '所有格都跑完了。名次封存到公布那一刻，这样没有人能提前一晚算出来。'));
  },

  /* 15 ─────────────────────────────────────────── */
  async result(k) {
    const t = S[k], a = S.acct, e = t.ev, one = k === 't1', f = t.fin || {};
    UI.idle(['Result', '结果'], '');
    const status = e.profile === 'cancelled' ? 'cancelled' : e.profile === 'insufficient' ? 'insufficient' : e.profile === 'gate' ? 'gate' : 'ranked';
    const rk = f.finalist ? (f.place === 'podium' ? [2, 1, 4] : [6, 4, 8]) : e.rk, N = f.finalist ? 8 : e.N;
    const Hh = f.finalist ? (e.H + f.H2) / 2 : e.H || 0, Tt = .8 * Hh + .2 * (e.F || 0), ci = f.finalist ? .14 : .21;
    const ST = { ranked: [T('ranked', '进入名次'), 'ok'], gate: [T('not past the survival gate · F5', '未过生存门 · F5'), 'bad'], insufficient: [T('insufficient evidence', '证据不足'), 'warn'], cancelled: [T('cancelled · C-03', '取消 · C-03'), 'bad'] }[status];
    mail('E23', ['Results are out', '结果已公布'], ['Your row, the verification guide and the appeal deadline.', '本队结果、核实指南与申诉截止时间。']);
    if (status === 'ranked' && f.place === 'podium') await say(T(`<b>${ord(2)}</b> of 8 finalists, somewhere between 1st and 4th. On this evidence you <b>can’t be separated</b> from 1st or 3rd.`, `8 个决赛 Agent 里排<b>第 2 名</b>，区间是第 1 到第 4 名。按现有证据，你与第 1、第 3 名<b>分不开</b>。`));
    else if (status === 'ranked') await say(T(`Final: ${rankT(...rk)} of ${N}.`, `最终：${N} 个里排 ${rankT(...rk)}。`));
    else await say(T('Your row is published with its status.', '你的这一行已随状态一起公布。'));
    const parts = one ? [['Fees', '手续费', 61], ['LVR', 'LVR', -38], ['Friction', '摩擦', -9], ['Interest', '利息', 12], ['Gas', 'Gas', -6], ['Liquidation', '清算罚金', status === 'gate' ? -41 : 0], ['Direction', '方向收益', 22]] : [['Bad debt', '坏账', 34], ['Penalties', '清算罚金', 11], ['Revenue', '协议收入', -7], ['Withdrawals', '取款', 4]];
    const mx = Math.max(...parts.map(p => Math.abs(p[2])));
    const row = { agent: hx(t.freeze.hash, 16), status, rank: rk, of: N, total: +Tt.toFixed(3), hidden: +Hh.toFixed(3), forward: +(e.F || 0).toFixed(3), simulator: hx('sim', 12), scenarios: hx('set' + t.freeze.beacon, 12), scorer: hx('scorer', 12) };
    await card(`<header><h4>${esc(a.team)}<small>${TA(TRACK[k].n)}</small></h4>${pill(ST[0], ST[1])}</header>
      ${status === 'cancelled' ? '' : `<div class="rk">${rk ? `<b>${rk[0]}</b><span>${T('of', '/')} ${N}<br>${T('90% interval', '90% 区间')} ${rk[1]}–${rk[2]}</span>` : `<b>—</b><span>${T('no rank', '不列名次')}</span>`}<div class="tt"><small>${T('Total', '总分')}</small>${sgn(Tt, 2)} <em>± ${nf(ci, 2)}</em></div></div>
      ${kv([[T('Hidden stress · 80%', '隐藏压力题 · 80%'), `${sgn(Hh, 2)} <small>${T('worst', '最差')} F5</small>`], [T('Forward window · 20%', '前向段 · 20%'), sgn(e.F, 2)], one ? [T('Skill dᴇ · vs hold dʜ', '本事 dᴇ · 相对持有 dʜ'), `${bps(Hh * 40)} · ${bps(Hh * 40 + 22)}`] : [T('Worst family', '最差一族'), 'F5 · ' + sgn(Hh - .6, 2)], [T('Cells', '格'), `${f.finalist ? 78 : status === 'insufficient' ? 38 : 39} / ${f.finalist ? 78 : 39}`], [T('Gate failures · forced exits', '门失败 · 强制退出'), `${status === 'gate' ? 2 : 0} · ${one ? 1 : '—'}`], [T('Model', '模型'), a.llm && !a.llm.none ? `${esc(a.llm.snap)} · ${T('decisions agree', '决定一致率')} 94%` : '—']])}
      ${f.finalist ? `<div class="split">${parts.map(p => `<div><span>${T(p[0], p[1])}</span><i class="${p[2] < 0 ? 'neg' : ''}" style="--v:${Math.abs(p[2]) / mx * 100}%"></i><b>${sgn(p[2])}</b></div>`).join('')}</div>` : ''}`}
      <p class="fine">${T('This ranking holds only under this edition’s registered scenario families, forward window and budgets. It is not a prediction of real-money performance.', '这个名次只在本届登记的情景族、前向段与预算下成立；它不是对真钱表现的预测。')}${one && status !== 'cancelled' ? ' ' + T('S includes directional return; for skill, read dᴇ.', 'S 含方向收益；本事看 dᴇ。') : ''}</p>
      <footer><code>${short(t.freeze.hash)}</code><span class="sp"></span><button class="btn" data-x="dl" data-keep>${T('Download result.json', '下载 result.json')}</button></footer>`, (c, done) => {
      $('[data-x=dl]', c).onclick = () => { const u = URL.createObjectURL(new Blob([JSON.stringify(row, null, 2)], { type: 'application/json' })), l = document.createElement('a'); l.href = u; l.download = `result-${k}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); };
      done(); return null;
    }, { cls: 'resultc' });
    t.res = { status, rk, N };
    await say(T('The secret seeds, salts and scenario parameters are public now. Anyone can regenerate the units and recompute every score.', '秘密种子、盐与情景参数现在都公开了。任何人都能重新生成题目、重算每一个分数。'));
    const vr = await choose([O('v', 'Recompute my score', '重算我的分数'), O('s', 'Skip', '跳过')], { def: 'v' });
    let mismatch = false;
    if (vr === 'v') {
      await term([['$ holobit-verify --team ' + slug(a.team) + ' --track ' + (one ? 1 : 2), 'cmd'], [`beacon  #${nf(t.freeze.beacon)}  ✓`, 'dim'], [`seed    ${short(hx('seed' + t.freeze.beacon), 10, 6)}  ✓ matches the commitment`, 'dim'], [`units   ${f.finalist ? 78 : 39} regenerated  ✓ set ${hx('set' + t.freeze.beacon, 12)}`, 'dim', 420], ['replay  decision records → state hashes  ✓', 'dim', 520], ['score   recomputing …', 'dim', 520]]);
      mismatch = await fork('recompute', ['Does it match the published score?', '与公布的分数一致吗？'], { def: 'match' }) === 'mismatch';
      await say(mismatch ? T(`Your recomputation gives <b>${sgn(Tt + .04, 2)}</b>. Published: <b>${sgn(Tt, 2)}</b>. That is grounds for an appeal.`, `你重算得到 <b>${sgn(Tt + .04, 2)}</b>，公布的是 <b>${sgn(Tt, 2)}</b>。这可以作为申诉的依据。`) : T('Identical, integer for integer.', '完全一致，逐个整数相同。'), { cls: mismatch ? 'warn' : '' });
    }
    const ap = await choose([O('file', 'File an appeal', '提出申诉'), O('none', 'No appeal', '不申诉')], { def: mismatch || status === 'cancelled' ? 'file' : 'none' });
    if (ap === 'none') { mark(k, 'appeal', 'none'); return; }
    const id = uid(), G = [['Score recomputation', '分数重算'], ['Platform fault', '平台故障'], ['Survival gate ruling', '生存门判定'], ['Cancellation', '取消资格']];
    await card(`<header><h4>${T('Appeal', '申诉')}</h4></header>${fld(T('Ground', '理由'), `<select id="${id}g">${G.map((g, i) => `<option ${i === (mismatch ? 0 : status === 'cancelled' ? 3 : status === 'gate' ? 2 : 1) ? 'selected' : ''}>${LA(g)}</option>`).join('')}</select>`)}${fld(T('Evidence', '依据'), `<textarea id="${id}t" rows="3">${mismatch ? L('Verification script output attached; total differs by 0.04.', '附核实脚本输出；总分相差 0.04。') : ''}</textarea>`)}<footer><button class="btn solid" data-x="go">${T('Send', '发送')}</button></footer>`, (c, done) => { $('[data-x=go]', c).onclick = () => done(); return () => done(); });
    const no = 'EWM-A-' + (1000 + seedOf(a.team + k + 'a') % 9000);
    mail('E24', ['Appeal received', '已受理申诉'], [`Case ${no}. A written answer follows.`, `编号 ${no}。将书面答复。`]);
    await say(T(`Case <code>${no}</code>. You’ll get a written answer with reasons.`, `编号 <code>${no}</code>。你会收到附理由的书面答复。`));
    const out = await fork('appeal', ['The answer arrives.', '答复来了。'], { only: ['upheld', 'dismissed'] });
    await say(out === 'upheld' ? T('<b>Upheld.</b> The affected cells were recomputed for every agent, not only yours, and the table was republished.', '<b>成立。</b>受影响的格对全部 Agent 重算，不只是你的；名次表已重新公布。') : T('<b>Dismissed</b>, with written reasons. The result stands.', '<b>驳回</b>，附书面理由。结果不变。'));
  },

  /* 16 ─────────────────────────────────────────── */
  async close(k) {
    const t = S[k], a = S.acct, win = t.fin && t.fin.place === 'podium' && t.res.status === 'ranked';
    UI.idle(['Close', '收尾'], '');
    if (win) {
      mail('E25', ['Award · pending confirmation', '获奖 · 待确认'], ['Confirmed after the appeal window. Identity documents are due through the restricted channel.', '申诉期结束后确认。身份材料请经受限通道提交。']);
      await say(T('You’re in the <b>leading group</b>. The award is confirmed once the appeal window closes and your identity is verified. Documents go through a separate restricted channel, never through this console.', '你在<b>领先组</b>里。申诉期结束、身份核验通过后，奖项才最终确认。材料经另一条受限通道提交，不经过这个后台。'));
      for (;;) {
        await card(`<header><h4>${T('Verification', '身份核验')}</h4></header><div class="checks">${[['Government ID for each member', '每位成员的身份证件'], ['Sanctions screening consent', '制裁筛查同意书'], ['Payout details', '收款信息']].map(x => `<label class="ck"><input type="checkbox"><i></i><span>${T(x[0], x[1])}</span></label>`).join('')}</div><footer><button class="btn solid" data-x="go">${T('Sent through the restricted channel', '已经受限通道提交')}</button></footer>`, (c, done) => { const go = () => { $$('input', c).forEach(x => x.checked = true); done(); }; $('[data-x=go]', c).onclick = go; return go; });
        if (await fork('prize', ['The check comes back.', '核验的结论。'], { only: ['verified', 'mismatch'] }) === 'verified') break;
        await say(T('The name on one document doesn’t match the registered entrant. Send it again.', '有一份证件上的姓名与报名的参赛者不符。请重新提交。'), { cls: 'warn' });
      }
      mail('E26', ['Payment sent', '已付款'], ['Amount, method and time are in the confirmation.', '金额、方式与时间见确认函。']);
      await say(T('Verified. Payment confirmation is in your inbox.', '核验通过。付款确认已发到收件箱。'));
    } else mark(k, 'prize', 'none');
    await say(T('One more choice that is yours alone: publish your agent’s half of the decision record?', '还有一件只能由你决定的事：公开 Agent 写的那一半决策记录吗？'));
    if (await choose([O('y', 'Publish it', '公开'), O('n', 'Keep it private', '不公开')], { def: 'n' }) === 'y') {
      const r = await confirmOOB(['Publish agent notes', '公开 Agent 记录']);
      await say(r === 'confirmed' ? T('Published as plain text, marked “written by the agent”.', '已按纯文本公布，并标注“Agent 写的”。') : T('The code lapsed. It stays private.', '确认码过期。保持不公开。'));
    }
    if (a.llm && !a.llm.none) mail('E27', ['Model key deleted', '模型密钥已删除'], ['Removed from the gateway. Revoke it with your provider too.', '已从网关删除。请同时到服务方作废。']);
    mail('E29', ['Thank you', '谢谢参赛'], ['A short survey, and how to have your personal data deleted.', '一份简短问卷，以及如何要求删除个人数据。']);
    mark(k, 'exit', 'complete'); t.status = 'complete';
    return HALT;
  },
});

/* ───────── endings + side flows ───────── */
async function ending(k) {
  const t = S[k], o = k === 't1' ? 't2' : 't1', c = coverage();
  UI.scope = k; UI.auto = false; UI.idle(t.status === 'complete' ? ['Complete', '完赛'] : t.status === 'withdrawn' ? ['Withdrawn', '已退赛'] : ['Stopped', '止步'], '');
  await say(`<div class="end"><h3>${t.status === 'complete' ? T('That’s the whole track.', '这条赛道走完了。') : t.status === 'withdrawn' ? T('Withdrawn.', '已退赛。') : T('This path ends here.', '这条路到此为止。')}</h3><p>${t.status === 'withdrawn' ? T('Runs already made stay on the record.', '已经跑过的运行照记。') + ' ' : ''}${T(`You’ve seen <b>${c.n}</b> of <b>${c.of}</b> ways it can go.`, `全部 <b>${c.of}</b> 种走向里，你走过了 <b>${c.n}</b> 种。`)}</p></div>`, { cls: 'wide' });
  for (;;) {
    const r = await choose([O('map', 'Open the branch map', '打开分支地图'), O('other', S[o].on ? `Switch to ${TRACK[o].s[0]}` : `Enter ${TRACK[o].s[0]}`, S[o].on ? `切换到${TRACK[o].s[1]}` : `参加${TRACK[o].s[1]}`), O('again', t.status === 'complete' ? 'Replay this track' : 'Rewind one stage', t.status === 'complete' ? '重走这条赛道' : '回到这一步重来')], { quiet: true });
    if (r === 'map') { Flow.cmd('map'); continue; }
    if (r === 'other') Flow.track(o); else Flow.jump(k, t.status === 'complete' ? 0 : t.i);
    throw CANCEL;
  }
}
async function keyLost(k, inline) {
  const a = S.acct; a.keyLost = true; UI.team();
  await say(T('Reported. From this moment the old key’s signatures are refused. Anything it signed in the last 7 days goes to review, and practice tokens pause until a new key is registered.', '已报失。从现在起，旧钥匙的签名一律不受理。它在过去 7 天里签过的事转入复核；练习令牌暂停，登记新钥匙后恢复。'), { cls: 'warn' });
  mail('E28', ['Team key reported lost', '队伍钥匙已报失'], ['If this wasn’t you, write to the competition desk now.', '若不是本人操作，请立即联系赛务。']);
  await keyCard();
  if (!inline && S[k] && S[k].freeze) {
    await say(T('Your freeze was signed inside that 7-day window, so it is marked <b>pending review</b>. Confirm it with the new key.', '你的冻结签名落在这 7 天窗口里，所以记为<b>待复核</b>。请用新钥匙确认它。'));
    const r = await confirmOOB(['Confirm the freeze', '确认冻结']);
    await say(r === 'confirmed' ? T('Freeze confirmed under the new key.', '已用新钥匙确认冻结。') : T('Still pending. Report again from the Team tab to retry.', '仍在待复核。可在“队伍”页重新发起。'));
  }
  if (k) mark(k, 'fkey', 'lost');
}
async function withdraw(k) {
  const t = S[k];
  await say(T(`Withdrawing from ${TRACK[k].s[0]} is final. Runs already made stay on the record.`, `从${TRACK[k].s[1]} 退赛不可撤销。已经跑过的运行照记。`), { cls: 'warn' });
  if (await choose([O('y', 'Withdraw', '退赛'), O('n', 'Stay in', '继续参赛')], { def: 'n' }) === 'n') return false;
  if (await confirmOOB([`Withdraw from ${TRACK[k].s[0]}`, `从${TRACK[k].s[1]} 退赛`]) !== 'confirmed') { await say(T('The code lapsed. You’re still in.', '确认码过期。你仍在比赛中。')); return false; }
  mark(k, 'exit', 'withdrawn'); t.status = 'withdrawn';
  mail('E4', ['Team change', '队伍变动'], [`${S.acct.team} withdrew from ${TRACK[k].s[0]}.`, `${S.acct.team} 已从${TRACK[k].s[1]} 退赛。`]);
  return true;
}
