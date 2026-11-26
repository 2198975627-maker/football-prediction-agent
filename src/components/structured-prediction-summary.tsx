import type { PredictionProvenance, StructuredPrediction } from "@/src/lib/schemas";

type Props = {
  prediction: StructuredPrediction;
  provenance: PredictionProvenance;
  teamA: string;
  teamB: string;
};

function provenanceLabel(provenance: PredictionProvenance) {
  const fixture = provenance.fixture === "live" ? "真实赛程" : provenance.fixture === "mock" ? "演示赛程" : "手动对阵";
  const analysis = provenance.analysis === "live-ai" ? "真实 AI 分析" : "模拟指标分析";
  return `${fixture} / ${analysis}`;
}

function directionLabel(direction: StructuredPrediction["factors"][number]["direction"], teamA: string, teamB: string) {
  if (direction === "team_a") return teamA;
  if (direction === "team_b") return teamB;
  return "均衡";
}

export function StructuredPredictionSummary({ prediction, provenance, teamA, teamB }: Props) {
  return (
    <section className="structured-result" aria-label="结构化预测结果">
      <header>
        <div>
          <span>STRUCTURED RESULT</span>
          <strong>结构化预测摘要</strong>
        </div>
        <mark className={provenance.analysis === "mock-engine" ? "mock" : "live"}>{provenanceLabel(provenance)}</mark>
      </header>

      <div className="structured-prob-grid">
        <div><span>{teamA}</span><strong>{prediction.probabilities.teamA}%</strong></div>
        <div><span>平局</span><strong>{prediction.probabilities.draw}%</strong></div>
        <div><span>{teamB}</span><strong>{prediction.probabilities.teamB}%</strong></div>
        <div><span>置信度</span><strong>{prediction.confidence}%</strong></div>
      </div>

      <div className="structured-scoreline">
        <span>倾向比分</span>
        <strong>{prediction.likelyScores.join(" / ")}</strong>
        <p>{prediction.summary}</p>
      </div>

      <div className="structured-factor-list">
        {prediction.factors.slice(0, 4).map((factor) => (
          <div key={`${factor.title}:${factor.direction}`}>
            <span>{directionLabel(factor.direction, teamA, teamB)}</span>
            <strong>{factor.title}</strong>
            <p>{factor.evidence.at(-1) || "暂无补充证据"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
