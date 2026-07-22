import type { PredictionInput, WorkflowStep } from "./schemas";

export const DISCLAIMER = "本报告仅供赛前情报分析和娱乐参考，不构成投注建议。";

const blockedTerms = [
  "下注",
  "投注金额",
  "稳赚",
  "稳赢",
  "必胜",
  "套利",
  "盘口",
  "操盘"
];

export function findSafetyIssue(input: PredictionInput) {
  const joined = `${input.teamA} ${input.teamB} ${input.competition}`;
  const term = blockedTerms.find((item) => joined.includes(item));

  if (term) {
    return `输入中包含高风险投注表达：“${term}”。本产品只提供赛前情报分析。`;
  }

  if (input.teamA.toLowerCase() === input.teamB.toLowerCase()) {
    return "两支球队不能相同。";
  }

  return null;
}

export function baseWorkflowSteps(): WorkflowStep[] {
  return [
    {
      id: "validate-input",
      name: "输入校验",
      status: "pending",
      detail: "检查球队、赛事、日期、计费模式和费用上限。"
    },
    {
      id: "billing-authorized",
      name: "计费安全门",
      status: "pending",
      detail: "平台托管先授权费用，自带 Key 模式不保存密钥。"
    },
    {
      id: "team-resolution",
      name: "球队识别",
      status: "pending",
      detail: "把用户输入转换成标准球队名称和数据源 ID。"
    },
    {
      id: "football-data",
      name: "结构化数据",
      status: "pending",
      detail: "收集赛程、近期状态、伤病、阵容、事件统计、历史交锋。"
    },
    {
      id: "player-matchups",
      name: "球员对位",
      status: "pending",
      detail: "逐一生成球员攻防对位、门将扑救、点球和定位球风险矩阵。"
    },
    {
      id: "tactical-coach",
      name: "战术教练",
      status: "pending",
      detail: "分析打法克制链、教练变化、临场调整和阵型匹配。"
    },
    {
      id: "public-research",
      name: "公开资料搜索",
      status: "pending",
      detail: "检索公开报道、主帅变动、转会、天气和舆论信息。"
    },
    {
      id: "source-verification",
      name: "来源验证",
      status: "pending",
      detail: "去重、标记可信度、剔除隐私和低可信传闻。"
    },
    {
      id: "prediction",
      name: "综合预测",
      status: "pending",
      detail: "生成胜平负概率、比分倾向和不确定性。"
    },
    {
      id: "settlement",
      name: "成本结算",
      status: "pending",
      detail: "记录 provider 成本并按 API 成本 x 2 结算。"
    }
  ];
}

export function markComplete(steps: WorkflowStep[], id: string, detail?: string) {
  return steps.map((step) =>
    step.id === id
      ? {
          ...step,
          status: "complete" as const,
          detail: detail ?? step.detail
        }
      : step
  );
}
