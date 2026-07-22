import { estimateCost } from "./billing";
import { collectFootballData, collectPublicSources } from "./mock-providers";
import { DISCLAIMER, baseWorkflowSteps, findSafetyIssue, markComplete } from "./safety";
import type { PredictionInput, PredictionResponse, WorkflowStep } from "./schemas";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function probabilityModel(input: PredictionInput) {
  const a = Array.from(input.teamA).reduce((total, char) => total + char.charCodeAt(0), 0);
  const b = Array.from(input.teamB).reduce((total, char) => total + char.charCodeAt(0), 0);
  const homeBoost =
    input.homeTeam === "team_a" ? 5 : input.homeTeam === "team_b" ? -5 : 0;
  const depthBoost = input.analysisDepth === "deep" ? 1 : 0;
  const rawDiff = ((a % 21) - (b % 21)) + homeBoost + depthBoost;

  const draw = clamp(27 - Math.abs(rawDiff) * 0.35, 20, 31);
  const teamA = clamp((100 - draw) / 2 + rawDiff * 0.8, 18, 62);
  const teamB = 100 - draw - teamA;

  return {
    teamA: Math.round(teamA),
    draw: Math.round(draw),
    teamB: Math.round(teamB)
  };
}

function likelyScore(probabilities: ReturnType<typeof probabilityModel>) {
  if (probabilities.teamA > probabilities.teamB + 8) {
    return "2-1 / 1-0";
  }
  if (probabilities.teamB > probabilities.teamA + 8) {
    return "1-2 / 0-1";
  }
  return "1-1 / 2-2";
}

function completeAll(steps: WorkflowStep[]) {
  return steps.map((step) => ({ ...step, status: "complete" as const }));
}

export function runMockPrediction(input: PredictionInput): PredictionResponse {
  let workflow = baseWorkflowSteps();
  const safetyIssue = findSafetyIssue(input);

  if (safetyIssue) {
    workflow = workflow.map((step) =>
      step.id === "validate-input"
        ? { ...step, status: "blocked", detail: safetyIssue }
        : step
    );

    return {
      jobId: `mock-${Date.now()}`,
      providerMode: "mock",
      billingMode: input.billingMode,
      cost: estimateCost(input),
      workflow,
      report: `无法生成预测报告。\n\n原因：${safetyIssue}\n\n${DISCLAIMER}`,
      generatedAt: new Date().toISOString()
    };
  }

  workflow = markComplete(workflow, "validate-input", "输入已通过 schema 和安全词检查。");
  workflow = markComplete(
    workflow,
    "billing-authorized",
    input.billingMode === "platform"
      ? "mock 模式已通过费用上限检查；未发生真实扣费。"
      : "BYOK mock 模式不保存密钥；未发生真实 provider 调用。"
  );

  const footballData = collectFootballData(input);
  workflow = markComplete(
    workflow,
    "team-resolution",
    `已识别为 ${footballData.teamA.name} vs ${footballData.teamB.name}。`
  );
  workflow = markComplete(workflow, "football-data", "已生成模拟结构化足球数据。");
  workflow = markComplete(
    workflow,
    "player-matchups",
    "已生成模拟球员对位矩阵；真实模式必须使用事件级数据或标注缺口。"
  );
  workflow = markComplete(
    workflow,
    "tactical-coach",
    "已生成模拟打法克制链和教练影响摘要；真实模式需来源验证。"
  );

  const publicSources = collectPublicSources(input);
  workflow = markComplete(workflow, "public-research", "已生成模拟公开资料来源。");
  workflow = markComplete(workflow, "source-verification", "已按可信度标记模拟来源。");

  const probabilities = probabilityModel(input);
  workflow = markComplete(workflow, "prediction", "已完成 mock 概率综合。");
  workflow = markComplete(workflow, "settlement", "已生成 mock 成本记录，未进行真实结算。");
  workflow = completeAll(workflow);

  const cost = estimateCost(input);
  const score = likelyScore(probabilities);
  const updateTime = new Date().toLocaleString("zh-CN", { hour12: false });

  const report = `# 比赛预测报告

## 1. 比赛信息
- 对阵：${footballData.teamA.name} vs ${footballData.teamB.name}
- 比赛类型：${input.competition}
- 比赛时间：${input.matchDate}
- 主客场/中立场：${
    input.homeTeam === "team_a"
      ? footballData.teamA.name + " 主场"
      : input.homeTeam === "team_b"
        ? footballData.teamB.name + " 主场"
        : "中立场"
  }
- 数据更新时间：${updateTime}
- 数据模式：mock，本次未联网、未调用真实模型、未扣费

## 2. 综合预测
- ${footballData.teamA.name} 胜率：${probabilities.teamA}%
- 平局概率：${probabilities.draw}%
- ${footballData.teamB.name} 胜率：${probabilities.teamB}%
- 倾向比分：${score}
- 大小球倾向：中性偏谨慎
- 双方进球倾向：中等

## 3. 核心判断
1. ${footballData.form.teamA}
2. ${footballData.form.teamB}
3. ${footballData.h2h}
4. ${footballData.commonOpponent}
5. 当前版本为安全骨架，真实上线前需要接入 API-Football、搜索和来源验证。

## 4. 球队状态对比
- 近期战绩：当前为模拟状态指数，真实模式会接入最近 5-10 场数据。
- 进攻表现：会比较进球、射门、射正、关键传球和 xG。
- 防守表现：会比较失球、抢断、拦截、解围和门将状态。
- 主客场表现：会根据主客场或中立场单独加权。
- 赛程与体能：会检查连续作战、长途旅行、跨时区和加时赛影响。

## 5. 球员与阵容影响
- ${footballData.teamA.name}：${footballData.injuries.teamA.join("；")}
- ${footballData.teamB.name}：${footballData.injuries.teamB.join("；")}
- 预计首发变化：真实模式会以官方/可靠媒体首发预测为准。
- 替补深度：真实模式会结合近几场替补出场和轮换质量。

## 6. 球员对位详情
- 边路攻防：真实模式会比较边锋突破成功率、边后卫被过次数、抢断、封堵和回追能力。
- 中路压制：真实模式会比较中场抢断、拦截、被压迫丢球、关键传球和推进成功率。
- 中锋 vs 中卫：真实模式会比较身高、头球成功率、争顶次数、背身拿球和禁区触球。
- 门将 vs 射手：真实模式会比较射手射门区域、射正率、门将扑救热区和历史扑救样本。
- 点球模型：真实模式会比较点球手命中率、射门方向分布、门将点球扑救率和心理样本可信度。
- 数据缺口：当前为 mock，占位指标不能作为真实对位结论。

## 7. 打法克制链与教练因素
- 阵型与打法：真实模式会从近期阵容、事件统计和公开报道中提取。
- 战术相克点：例如传中砸头球 vs 对手中卫身高/争顶劣势，高位压迫 vs 对手后场出球失误，反击速度 vs 防线回追速度。
- 主教练变化：真实模式会检查换帅、新战术磨合、发布会信息和近几场调整。
- 临场调整：真实模式会分析教练换人时机、落后时阵型变化、领先时防守收缩倾向。
- 简化展示：用户端只显示核心对位、克制链和风险标签，完整证据留在内部 evidence pack。

## 8. 历史交锋与共同对手
- 历史交锋：${footballData.h2h}
- 最近交锋：真实模式会取最近 5 次交锋。
- 共同对手表现：${footballData.commonOpponent}

## 9. 主要不确定性
- 临场首发：首发公布前不确定性较高。
- 伤病更新：赛前 24 小时内的伤病消息可能显著改变判断。
- 天气/场地：当前为模拟数据，真实模式需接天气和场地信息。
- 数据缺口：若球员事件数据、身高/争顶、门将热区、点球样本或教练信息覆盖不足，报告必须降低置信度。

## 10. 模拟来源
${publicSources.sources
  .map(
    (source) =>
      `- [${source.confidence}] ${source.title}（${source.sourceType}）：${source.summary}`
  )
  .join("\n")}

## 11. 成本摘要
- 预估 API 成本：¥${(cost.estimatedApiCostCents / 100).toFixed(2)}
- 预估用户费用：¥${(cost.estimatedUserChargeCents / 100).toFixed(2)}
- 计费公式：max(实际 API 成本 x 2, 最低单次费用)

${DISCLAIMER}`;

  return {
    jobId: `mock-${Date.now()}`,
    providerMode: "mock",
    billingMode: input.billingMode,
    cost,
    workflow,
    report,
    generatedAt: new Date().toISOString()
  };
}
