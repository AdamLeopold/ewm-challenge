/* Teaching model only. No HoloBit, blockchain, market feed, or LLM connection. */
(function (root) {
  "use strict";
  const RULES = Object.freeze({ collateral: 100, debt: 50, cash: 20, threshold: 0.8, penaltyRate: 0.1 });
  const AGENTS = Object.freeze({ early: "提前还款", wait: "一直等待" });
  const net = s => s.collateral + s.cash - s.debt;
  const ratio = s => s.debt === 0 ? 0 : s.debt / s.collateral;
  const snapshot = s => ({ ...s, ratio: ratio(s), net: net(s) });

  function settle(s) {
    if (s.debt > 0 && ratio(s) > RULES.threshold) {
      const penalty = s.debt * RULES.penaltyRate;
      // The supported teaching price range always covers debt plus penalty.
      if (s.collateral + 1e-9 < s.debt + penalty) throw new Error("抵押品不足；超出教学模型范围。");
      return { state: { collateral: s.collateral - s.debt - penalty, cash: s.cash, debt: 0 }, penalty, liquidated: true };
    }
    return { state: { ...s }, penalty: 0, liquidated: false };
  }

  function preview(observation, repayment) {
    const projected = {
      collateral: observation.collateral * 0.75,
      cash: observation.cash - repayment,
      debt: observation.debt - repayment
    };
    return { ...snapshot(projected), wouldLiquidate: ratio(projected) > RULES.threshold };
  }

  function simulate(agent, finalPrice = 60) {
    if (!Object.hasOwn(AGENTS, agent)) throw new Error("未知 Agent。");
    if (!Number.isFinite(finalPrice) || finalPrice < 55 || finalPrice > 100) throw new Error("最终价值须在 55 至 100 之间。");
    let state = { collateral: RULES.collateral, cash: RULES.cash, debt: RULES.debt };
    const initial = snapshot(state);
    const steps = [{ round: 0, marketValue: 100, observation: initial, afterAction: initial, ...initial,
      repayment: 0, penalty: 0, liquidated: false, previews: null,
      reason: "初始账户已建立。Agent 尚未行动。", event: "抵押品 100，现金 20，债务 50，净值 70。" }];

    for (const [i, price] of [80, finalPrice].entries()) {
      state.collateral = price; // One unit of collateral; no earlier liquidation in round 1.
      const observation = snapshot(state);
      const shouldRepay = agent === "early" && ratio(state) > 0.6 && state.cash > 0;
      const repayment = shouldRepay ? Math.min(20, state.cash, state.debt) : 0;
      const previews = shouldRepay ? { hold: preview(state, 0), repay: preview(state, repayment) } : null;
      const reason = shouldRepay
        ? "风险比例超过自设的 60% 防守线。用本地工具试算再跌 25% 的情况后，偿还可用现金。"
        : agent === "wait" ? "这个对照 Agent 的规则是始终不还款。" : "比例未超过防守线，或已无可用现金，不再还款。";
      state.cash -= repayment;
      state.debt -= repayment;
      const afterAction = snapshot(state);
      const settlement = settle(state);
      state = settlement.state;
      steps.push({ round: i + 1, marketValue: price, observation, afterAction, ...snapshot(state),
        repayment, penalty: settlement.penalty, liquidated: settlement.liquidated, previews, reason,
        event: settlement.liquidated
          ? `债务比例超过 80%，触发教学版全额清算；额外成本 ${settlement.penalty}。`
          : repayment > 0 ? `还款 ${repayment}，现金和债务同时减少；这一动作本身不增加净值。` : "未触发清算，账户进入下一阶段。" });
    }
    const liquidated = steps.some(s => s.liquidated);
    const final = steps[steps.length - 1];
    const safety = liquidated ? 0 : 50;
    const preservation = 30 * Math.min(1, Math.max(0, final.net / initial.net));
    const operation = 20; // Both built-in baselines complete all rounds with valid actions and logs.
    return { agent, name: AGENTS[agent], steps, liquidated,
      score: { safety, preservation, operation, total: safety + preservation + operation },
      finalNet: final.net, initialNet: initial.net };
  }
  const api = Object.freeze({ RULES, AGENTS, simulate });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LendingTeachingModel = api;
})(globalThis);
