(() => {
  "use strict";
  const model = window.LendingTeachingModel;
  const $ = id => document.getElementById(id);
  let agent = "early", finalPrice = 60, round = 0, reached = 0;
  let result = model.simulate(agent, finalPrice);
  const money = n => n.toFixed(2);
  const pct = n => `${(n * 100).toFixed(1)}%`;

  function drawChart() {
    const points = result.steps.slice(0, round + 1);
    const x = i => 48 + i * 260;
    const y = value => 123 - value / 80 * 100;
    const labels = ["初始", "第一轮", "第二轮"];
    const grids = [0, 40, 80].map(v => `<line x1="48" y1="${y(v)}" x2="585" y2="${y(v)}" stroke="#d4d9c8"/><text x="32" y="${y(v) + 4}" text-anchor="end" fill="#6b735e">${v}</text>`).join("");
    const path = points.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s.net)}`).join(" ");
    $("equity-chart").innerHTML = `${grids}<path d="${path}" fill="none" stroke="#587341" stroke-width="2.5"/>${points.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.net)}" r="4" fill="${s.liquidated ? "#bd4934" : "#587341"}"/><text x="${x(i)}" y="${y(s.net) - 10}" text-anchor="middle" fill="#35452a">${money(s.net)}</text>`).join("")}${labels.map((l, i) => `<text x="${x(i)}" y="150" text-anchor="middle" fill="#6b735e">${l}</text>`).join("")}`;
    $("equity-chart").setAttribute("aria-label", `${result.name}净值：${points.map(s => `${s.round === 0 ? "初始" : `第${s.round}轮`} ${money(s.net)}`).join("，")}`);
  }

  function renderTrace() {
    const steps = result.steps.slice(1, round + 1);
    $("decision-trace").innerHTML = steps.length ? steps.map(s => `<div class="trace-item${s.liquidated ? " danger" : ""}"><h3>第 ${s.round} 轮 · ${s.liquidated ? "发生清算" : s.repayment > 0 ? "主动还款" : "等待"}</h3><p>观察：抵押品 ${money(s.observation.collateral)}，债务 ${money(s.observation.debt)}，现金 ${money(s.observation.cash)}；债务比例 ${pct(s.observation.ratio)}。</p><p>${s.reason}</p>${s.previews ? `<div class="preview-detail">本地试算（自行假设再跌 25%，不是提前读取考题）：<br>不还款 → 比例 ${pct(s.previews.hold.ratio)}，${s.previews.hold.wouldLiquidate ? "可能清算" : "不清算"}；还款 ${s.repayment} → 比例 ${pct(s.previews.repay.ratio)}，${s.previews.repay.wouldLiquidate ? "可能清算" : "不清算"}。</div>` : ""}<p>动作：还款 ${money(s.repayment)}。${s.event}</p><p class="trace-result">结果：抵押品 ${money(s.collateral)}，债务 ${money(s.debt)}，现金 ${money(s.cash)}，净值 ${money(s.net)}。</p></div>`).join("") : '<p class="trace-empty">还没有决策记录。运行第一轮，看看 Agent 怎样读取状态并作出选择。</p>';
    const s = result.steps[round];
    $("io-preview").textContent = JSON.stringify({ round, observation: { collateral_value: s.observation.collateral, debt: s.observation.debt, cash: s.observation.cash, liquidation_threshold: model.RULES.threshold }, agent_output: round ? { repay_amount: s.repayment } : null }, null, 2);
  }

  function renderScore() {
    const complete = round === 2;
    const score = result.score;
    $("total-score").textContent = complete ? score.total.toFixed(1) : "—";
    $("score-safety").textContent = complete ? `${score.safety} / 50` : "— / 50";
    $("score-preservation").textContent = complete ? `${score.preservation.toFixed(1)} / 30` : "— / 30";
    $("score-operation").textContent = complete ? `${score.operation} / 20` : "— / 20";
    $("score-status").textContent = complete ? `最终净值 ${money(result.finalNet)}；保存净值分 = 30 × ${money(result.finalNet)} ÷ 70。教学评分，不是正式比赛成绩。` : "完成两轮模拟后计算。这里只考风险控制，不代表正式比赛评分。";
    $("comparison").hidden = !complete;
    if (complete) {
      $("comparison-rows").innerHTML = Object.keys(model.AGENTS).map(key => {
        const r = model.simulate(key, finalPrice);
        return `<div class="comparison-row"><b>${r.name}${key === agent ? " · 当前" : ""}</b><span>${r.liquidated ? "发生清算" : "未清算"} / 净值 ${money(r.finalNet)}</span><strong>${r.score.total.toFixed(1)}</strong></div>`;
      }).join("");
    }
  }

  function render() {
    const s = result.steps[round];
    document.querySelectorAll("[data-agent]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.agent === agent)));
    document.querySelectorAll("[data-round]").forEach(b => { const n = Number(b.dataset.round); b.disabled = n > reached; b.setAttribute("aria-pressed", String(n === round)); });
    $("price-output").textContent = finalPrice;
    $("path-end").textContent = finalPrice;
    $("round-final-label").textContent = `${finalPrice > 80 ? "回升至" : finalPrice === 80 ? "保持" : "跌至"} ${finalPrice}`;
    $("run-title").textContent = `${result.name} · ${round === 0 ? "初始账户" : `第 ${round} 轮`}`;
    $("run-state").textContent = s.liquidated ? "发生清算" : round === 2 ? "已完成 · 未清算" : round ? "运行中" : "等待运行";
    $("run-state").classList.toggle("danger", s.liquidated);
    for (const key of ["collateral", "debt", "cash", "net"]) $(`metric-${key}`).textContent = money(s[key]);
    $("risk-value").textContent = pct(s.afterAction.ratio);
    $("risk-fill").style.width = `${Math.min(100, s.afterAction.ratio * 100)}%`;
    $("risk-fill").style.background = s.liquidated ? "#bd4934" : "#627746";
    $("event-box").classList.toggle("danger", s.liquidated);
    $("event-box").querySelector(".event-icon").textContent = s.liquidated ? "!" : round ? "✓" : "○";
    $("event-title").textContent = s.liquidated ? `清算：偿还 ${money(s.afterAction.debt)}，额外成本 ${money(s.penalty)}` : round === 0 ? "准备好了" : s.repayment > 0 ? `Agent 偿还 ${money(s.repayment)}` : "Agent 选择等待 · 未触发清算";
    $("event-copy").textContent = round === 0 ? "点击“下一轮”，先看抵押品跌到 80 后 Agent 会怎么做。" : s.liquidated ? `清算前比例 ${pct(s.afterAction.ratio)} 超过 80%。抵押品消耗 ${money(s.afterAction.debt + s.penalty)}，剩余 ${money(s.collateral)}；债务归零。` : `${s.event} ${round === 2 ? "模拟完成，下方可查看成绩和对照结果。" : "再运行一轮，查看后续价格变化。"}`;
    $("next-round").disabled = round === 2;
    $("run-all").disabled = round === 2;
    drawChart(); renderTrace(); renderScore();
  }

  function reset() { round = 0; reached = 0; result = model.simulate(agent, finalPrice); render(); }
  document.querySelectorAll("[data-agent]").forEach(b => b.addEventListener("click", () => { if (agent !== b.dataset.agent) { agent = b.dataset.agent; reset(); } }));
  document.querySelectorAll("[data-round]").forEach(b => b.addEventListener("click", () => { round = Number(b.dataset.round); render(); }));
  $("final-price").addEventListener("input", e => { finalPrice = Number(e.target.value); reset(); });
  $("next-round").addEventListener("click", () => { round = Math.min(2, round + 1); reached = Math.max(reached, round); render(); });
  $("run-all").addEventListener("click", () => { round = 2; reached = 2; render(); });
  $("reset-run").addEventListener("click", reset);
  render();
})();
