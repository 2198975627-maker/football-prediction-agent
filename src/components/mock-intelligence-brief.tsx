import { Activity, CalendarClock, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import type { MockMatchIntelligence, MockTeamIntelligence } from "@/src/lib/mock-match-intelligence";

function recentLabel(value: MockTeamIntelligence["recent"][number]) {
  if (value === "W") return "胜";
  if (value === "D") return "平";
  return "负";
}

function travelLabel(value: MockTeamIntelligence["travelLoad"]) {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  return "低";
}

export function MockIntelligenceBrief({ intelligence }: { intelligence: MockMatchIntelligence }) {
  const teams = [intelligence.teamA, intelligence.teamB];
  const edgeLabel = (edge: MockMatchIntelligence["keySignals"][number]["edge"]) => {
    if (edge === "team_a") return intelligence.teamA.name;
    if (edge === "team_b") return intelligence.teamB.name;
    return "均衡";
  };

  return (
    <section className="mock-intelligence-brief" aria-label="演示比赛情报 Mock match intelligence">
      <div className="mock-brief-head">
        <div>
          <span><Sparkles size={15} aria-hidden="true" /> MOCK INTELLIGENCE PACK</span>
          <strong className="ui-bilingual"><span>完整演示比赛情报</span><small>Full Demonstration Intelligence</small></strong>
          <p>{intelligence.disclaimer}</p>
        </div>
        <div className="mock-brief-coverage">
          <b>16</b><span>球员角色</span>
          <b>{intelligence.keySignals.length}</b><span>关键变量</span>
          <b>{intelligence.probability.confidence}%</b><span>演示置信度</span>
        </div>
      </div>

      <div className="mock-brief-grid">
        <div className="mock-brief-block">
          <div className="mock-brief-title"><Activity size={15} aria-hidden="true" /><span>近期走势<small>Recent Form</small></span></div>
          {teams.map((team) => (
            <div className="mock-team-row" key={`form-${team.name}`}>
              <strong>{team.name}</strong>
              <span className="mock-form-sequence">
                {team.recent.map((result, index) => <i className={result.toLowerCase()} key={`${result}-${index}`}>{recentLabel(result)}</i>)}
              </span>
              <small>{team.recentPoints}/15 分 · {team.recentGoalsFor}:{team.recentGoalsAgainst}</small>
            </div>
          ))}
        </div>

        <div className="mock-brief-block">
          <div className="mock-brief-title"><ShieldAlert size={15} aria-hidden="true" /><span>阵容可用性<small>Availability</small></span></div>
          {teams.map((team) => (
            <div className="mock-team-row" key={`availability-${team.name}`}>
              <strong>{team.name}</strong>
              <span>{team.unavailable} 缺阵 · {team.doubts} 待定</span>
              <small>阵容安全指数 {team.injurySafety}/100</small>
            </div>
          ))}
        </div>

        <div className="mock-brief-block">
          <div className="mock-brief-title"><Workflow size={15} aria-hidden="true" /><span>战术身份<small>Tactical Identity</small></span></div>
          {teams.map((team) => (
            <div className="mock-team-row" key={`tactics-${team.name}`}>
              <strong>{team.name} · {team.formation}</strong>
              <span>{team.buildStyle} / {team.defensiveBlock}</span>
              <small>定位球：{team.setPieceProfile}</small>
            </div>
          ))}
        </div>

        <div className="mock-brief-block">
          <div className="mock-brief-title"><CalendarClock size={15} aria-hidden="true" /><span>赛程背景<small>Match Context</small></span></div>
          {teams.map((team) => (
            <div className="mock-team-row" key={`context-${team.name}`}>
              <strong>{team.name}</strong>
              <span>休整 {team.restDays} 天 · 旅行负荷 {travelLabel(team.travelLoad)}</span>
              <small>{intelligence.venue}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="mock-h2h-band">
        <span>近 {intelligence.h2h.meetings} 次演示交锋</span>
        <strong>{intelligence.teamA.name} {intelligence.h2h.teamAWins} 胜</strong>
        <b>{intelligence.h2h.draws} 平</b>
        <strong>{intelligence.teamB.name} {intelligence.h2h.teamBWins} 胜</strong>
        <small>进球 {intelligence.h2h.goalsTeamA}:{intelligence.h2h.goalsTeamB}</small>
      </div>

      <div className="mock-signal-list">
        {intelligence.keySignals.map((signal) => (
          <div className={`mock-signal ${signal.edge}`} key={signal.id}>
            <span>{signal.importance === "high" ? "重点" : "观察"}</span>
            <strong>{signal.label}</strong>
            <p>{signal.detail}</p>
            <b>{edgeLabel(signal.edge)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
