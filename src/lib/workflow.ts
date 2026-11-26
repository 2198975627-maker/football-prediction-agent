import { estimateCost } from "./billing.ts";
import { buildMockMatchIntelligence, type MockMatchIntelligence } from "./mock-match-intelligence.ts";
import { collectFootballData } from "./mock-providers.ts";
import { DISCLAIMER, baseWorkflowSteps, findSafetyIssue, markComplete, markWorkflowStep } from "./safety.ts";
import type { PredictionInput, PredictionProvenance, PredictionResponse, StructuredPrediction, WorkflowStep } from "./schemas";

function mockProvenance(input: PredictionInput): PredictionProvenance {
  return {
    fixture: input.fixtureProvider === "mock-offline" ? "mock" : input.fixtureId ? "live" : "manual",
    analysis: "mock-engine",
    rosters: "mock",
    billing: "free-mock"
  };
}

function signalDirection(edge: "team_a" | "team_b" | "balanced") {
  return edge === "team_a" ? "team_a" : edge === "team_b" ? "team_b" : "neutral";
}

function matchupFinding(attacker: { name: string; form: number; heightCm: number; eventMetrics: { shots: number; xg: number } }, defender: { name: string; defense: number; heightCm: number; eventMetrics: { tackles: number; interceptions: number; dribbledPast: number } }) {
  const edge = attacker.form + attacker.eventMetrics.xg * 8 - defender.defense - defender.eventMetrics.tackles * 0.8;
  const aerial = attacker.heightCm - defender.heightCm;
  const verdict = edge > 5 ? "进攻方在演示指标中占优" : edge < -5 ? "防守方在演示指标中占优" : "演示指标接近";
  return `${verdict}；身高差 ${aerial >= 0 ? "+" : ""}${aerial}cm，射门 ${attacker.eventMetrics.shots} 次，对位防守样本含 ${defender.eventMetrics.tackles} 次抢断、${defender.eventMetrics.interceptions} 次拦截和 ${defender.eventMetrics.dribbledPast} 次被过。`;
}

export function buildMockStructuredPrediction(input: PredictionInput, intelligence: MockMatchIntelligence): StructuredPrediction {
  const aForward = intelligence.teamA.players.find((player) => player.role === "Centre Forward") ?? intelligence.teamA.players[7];
  const bForward = intelligence.teamB.players.find((player) => player.role === "Centre Forward") ?? intelligence.teamB.players[7];
  const aCentreBack = intelligence.teamA.players.find((player) => player.role === "Centre Back") ?? intelligence.teamA.players[2];
  const bCentreBack = intelligence.teamB.players.find((player) => player.role === "Centre Back") ?? intelligence.teamB.players[2];
  const leading = intelligence.probability.teamA > intelligence.probability.teamB
    ? input.teamA
    : intelligence.probability.teamB > intelligence.probability.teamA
      ? input.teamB
      : "双方";

  return {
    probabilities: {
      teamA: intelligence.probability.teamA,
      draw: intelligence.probability.draw,
      teamB: intelligence.probability.teamB
    },
    likelyScores: intelligence.probability.score.split("/").map((score) => score.trim()).filter(Boolean),
    confidence: intelligence.probability.confidence,
    summary: `${leading}在当前演示指标组合中略占优势。结果由攻防、近期状态、体能、阵容可用性、压迫和主客场共同计算，不使用球队名称字符值直接生成概率。`,
    factors: intelligence.keySignals.map((signal) => ({
      title: signal.label,
      direction: signalDirection(signal.edge),
      evidence: [`mock:${signal.id}`, signal.detail]
    })),
    playerMatchups: [
      {
        matchup: `${aForward.name} vs ${bCentreBack.name}`,
        finding: matchupFinding(aForward, bCentreBack),
        evidence: ["mock:player-event-metrics", "mock:height-and-role"]
      },
      {
        matchup: `${bForward.name} vs ${aCentreBack.name}`,
        finding: matchupFinding(bForward, aCentreBack),
        evidence: ["mock:player-event-metrics", "mock:height-and-role"]
      }
    ],
    tacticalChains: [
      {
        pattern: `${intelligence.teamA.buildStyle} vs ${intelligence.teamB.defensiveBlock}`,
        effect: `${input.teamA} 的推进方式与 ${input.teamB} 防守落位形成第一条演示克制链。`,
        evidence: ["mock:tactical-profile", "mock:press-possession"]
      },
      {
        pattern: `${intelligence.teamB.setPieceProfile} vs ${input.teamA} 高空防守`,
        effect: `结合中锋与中卫身高、定位球风格生成第二条演示克制链。`,
        evidence: ["mock:set-piece-profile", "mock:height-and-role"]
      }
    ],
    uncertainties: [
      "全部球员、伤停、事件、热区和教练指标均为离线演示数据，不代表真实个人或球队近况。",
      "未执行联网搜索、官方来源核验或真实 AI 推理。",
      "临场首发、天气和突发伤病未纳入演示计算。"
    ]
  };
}

function mockWorkflow(input: PredictionInput, teamAType: string, teamBType: string) {
  let workflow = baseWorkflowSteps();
  workflow = markComplete(workflow, "validate-input", "输入已通过 schema 和安全规则检查。");
  workflow = markWorkflowStep(workflow, "billing-authorized", "simulated", "Mock 模式固定 ¥0.00，无支付授权、无扣费。正式模式价格仅作参考。");
  workflow = markWorkflowStep(workflow, "team-resolution", "simulated", `已分别识别两队类型：${input.teamA}（${teamAType}）、${input.teamB}（${teamBType}）。`);
  workflow = markWorkflowStep(workflow, "football-data", "simulated", "已载入离线场景的阵容、伤停、状态、事件、热区和交锋演示数据。");
  workflow = markWorkflowStep(workflow, "player-matchups", "simulated", "已基于演示球员事件指标生成逐人对位、门将和点球样本。");
  workflow = markWorkflowStep(workflow, "tactical-coach", "simulated", "已基于演示阵型、压迫、控球、身高和教练指标生成克制链。");
  workflow = markWorkflowStep(workflow, "public-research", "skipped", "Mock 离线模式未执行网络搜索，也未读取社交媒体内容。");
  workflow = markWorkflowStep(workflow, "source-verification", "skipped", "没有外部来源可核验；所有演示字段均已标记为 mock。");
  workflow = markWorkflowStep(workflow, "prediction", "simulated", "已用指标驱动的本地概率引擎完成模拟预测。");
  workflow = markWorkflowStep(workflow, "settlement", "skipped", "Mock 模式无真实成本记录和资金结算。");
  return workflow;
}

function mockReport(input: PredictionInput, intelligence: MockMatchIntelligence, prediction: StructuredPrediction, cost: PredictionResponse["cost"], provenance: PredictionProvenance) {
  const direction = (value: "team_a" | "team_b" | "neutral") => value === "team_a" ? input.teamA : value === "team_b" ? input.teamB : "均衡";
  const formal = cost.formalModeEstimate;
  return `# ${input.teamA} vs ${input.teamB} 演示预测报告

> 赛程来源：${provenance.fixture === "live" ? "真实赛程" : provenance.fixture === "mock" ? "离线演示赛程" : "手动设置"}；分析来源：模拟引擎。真实赛程不等于真实分析。

## 结构化预测
- ${input.teamA}：${prediction.probabilities.teamA}%
- 平局：${prediction.probabilities.draw}%
- ${input.teamB}：${prediction.probabilities.teamB}%
- 倾向比分：${prediction.likelyScores.join("、")}
- 演示置信度：${prediction.confidence}%

${prediction.summary}

## 核心因素
${prediction.factors.map((factor) => `- **${factor.title}**（${direction(factor.direction)}）：${factor.evidence[1] ?? factor.evidence[0]}`).join("\n")}

## 球员对位
${prediction.playerMatchups.map((matchup) => `- **${matchup.matchup}**：${matchup.finding}`).join("\n")}

## 战术克制
${prediction.tacticalChains.map((chain) => `- **${chain.pattern}**：${chain.effect}`).join("\n")}

## 不确定性
${prediction.uncertainties.map((item) => `- ${item}`).join("\n")}

## 演示数据包
- 场景：${intelligence.scenarioId ?? "自定义对阵"}
- 每队球员角色：${intelligence.teamA.players.length} / ${intelligence.teamB.players.length}
- 历史交锋演示样本：${intelligence.h2h.meetings} 场
- 球员字段：头像、中文辅助名、身高、惯用脚、阵容状态、伤停、事件指标、热区、点球与门将样本

## 费用
- 本次 Mock 实际费用：¥0.00
- 正式模式参考 API 成本：¥${((formal?.estimatedApiCostCents ?? 0) / 100).toFixed(2)}
- 正式模式参考用户价格：¥${((formal?.estimatedUserChargeCents ?? 0) / 100).toFixed(2)}
- 上述参考价不是付款记录，也不会在 Mock 模式扣费。

${DISCLAIMER}`;
}

export function runMockPrediction(input: PredictionInput): PredictionResponse {
  const cost = estimateCost(input);
  const provenance = mockProvenance(input);
  let workflow: WorkflowStep[] = baseWorkflowSteps();
  const safetyIssue = findSafetyIssue(input);

  if (safetyIssue) {
    workflow = markWorkflowStep(workflow, "validate-input", "blocked", safetyIssue);
    return {
      jobId: `mock-${Date.now()}`,
      providerMode: "mock",
      billingMode: input.billingMode,
      cost,
      workflow,
      prediction: null,
      provenance,
      report: `无法生成预测报告。\n\n原因：${safetyIssue}\n\n${DISCLAIMER}`,
      generatedAt: new Date().toISOString()
    };
  }

  const footballData = collectFootballData(input);
  const intelligence = buildMockMatchIntelligence({
    teamA: input.teamA,
    teamB: input.teamB,
    competition: input.competition,
    homeTeam: input.homeTeam
  });
  const prediction = buildMockStructuredPrediction(input, intelligence);
  workflow = mockWorkflow(input, footballData.teamA.type === "national" ? "国家队" : "俱乐部", footballData.teamB.type === "national" ? "国家队" : "俱乐部");

  return {
    jobId: `mock-${Date.now()}`,
    providerMode: "mock",
    billingMode: input.billingMode,
    cost,
    workflow,
    prediction,
    provenance,
    report: mockReport(input, intelligence, prediction, cost, provenance),
    generatedAt: new Date().toISOString(),
    model: "local-mock-indicator-engine"
  };
}
