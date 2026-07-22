import {
  DEFAULT_STATSBOMB_MATCH_ID,
  getStatsBombOpenEventData,
  type PlayerEventCapability,
  type PlayerEventCoverageTier,
  type PlayerEventData,
  type PlayerEventProvider
} from "../player-event-data";
import { getApiFootballPlayerEventData, isApiFootballConfigured } from "./api-football";
import { isSportmonksConfigured } from "./sportmonks";

export type PlayerEventProviderRuntime = "ready" | "needs-key" | "adapter-required" | "contract-required";

export type PlayerEventProviderStatus = {
  id: PlayerEventProvider;
  name: string;
  coverageTier: PlayerEventCoverageTier;
  costTier: "free" | "free-key" | "paid" | "contract";
  live: boolean;
  configured: boolean;
  executable: boolean;
  runtimeStatus: PlayerEventProviderRuntime;
  capabilities: PlayerEventCapability[];
  limitations: string[];
};

type LoadInput = { matchId?: string; fixtureId?: string };

type ProviderDefinition = PlayerEventProviderStatus & {
  load?: (input: LoadInput) => Promise<PlayerEventData>;
};

function definitions(): ProviderDefinition[] {
  const apiFootballConfigured = isApiFootballConfigured();
  const sportmonksConfigured = isSportmonksConfigured();
  const statsBombPaidConfigured = Boolean(process.env.STATSBOMB_API_TOKEN?.trim());

  return [
    {
      id: "statsbomb-open",
      name: "StatsBomb Open Data",
      coverageTier: "free-historical",
      costTier: "free",
      live: false,
      configured: true,
      executable: true,
      runtimeStatus: "ready",
      capabilities: ["player-summary", "event-stream", "event-coordinates", "xg", "shot-map", "heatmap", "keeper-zones", "penalties", "duel-matchups"],
      limitations: ["只覆盖开放的历史比赛，不能代表用户当前选择的实时比赛。"],
      load: (input) => getStatsBombOpenEventData(input.matchId?.trim() || DEFAULT_STATSBOMB_MATCH_ID)
    },
    {
      id: "api-football",
      name: "API-Football",
      coverageTier: "free-live-summary",
      costTier: "free-key",
      live: true,
      configured: apiFootballConfigured,
      executable: apiFootballConfigured,
      runtimeStatus: apiFootballConfigured ? "ready" : "needs-key",
      capabilities: ["player-summary", "penalties"],
      limitations: ["免费层是比赛球员汇总，不含事件坐标、xG、射门图或真实热区。"],
      load: async (input) => {
        if (!input.fixtureId) throw new PlayerEventProviderError("API-Football 实时汇总需要 fixtureId。", 400, "FIXTURE_ID_REQUIRED");
        return getApiFootballPlayerEventData(input.fixtureId.trim());
      }
    },
    {
      id: "sportmonks",
      name: "Sportmonks Football API",
      coverageTier: "commercial-live-events",
      costTier: "paid",
      live: true,
      configured: sportmonksConfigured,
      executable: false,
      runtimeStatus: sportmonksConfigured ? "adapter-required" : "needs-key",
      capabilities: ["player-summary", "event-stream", "xg", "penalties"],
      limitations: ["套餐和赛事决定字段覆盖；事件坐标能力必须按合同与样例确认。", "当前已预留统一接口，尚未启用事件适配器。"]
    },
    {
      id: "statsbomb-paid",
      name: "StatsBomb Data API",
      coverageTier: "commercial-live-events",
      costTier: "contract",
      live: true,
      configured: statsBombPaidConfigured,
      executable: false,
      runtimeStatus: statsBombPaidConfigured ? "adapter-required" : "contract-required",
      capabilities: ["player-summary", "event-stream", "event-coordinates", "xg", "shot-map", "heatmap", "keeper-zones", "penalties", "duel-matchups"],
      limitations: ["需要商业授权、明确赛事覆盖和正式 API 凭据。", "当前已预留统一接口，取得数据样例后实现映射。"]
    }
  ];
}

export class PlayerEventProviderError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "PLAYER_EVENT_PROVIDER_ERROR") {
    super(message);
    this.name = "PlayerEventProviderError";
    this.status = status;
    this.code = code;
  }
}

export function getPlayerEventProviderStatuses(): PlayerEventProviderStatus[] {
  return definitions().map(({ load: _load, ...status }) => status);
}

export async function loadPlayerEventData(providerId: string, input: LoadInput) {
  const available = definitions();
  const chosenId = providerId === "auto"
    ? input.fixtureId && isApiFootballConfigured() ? "api-football" : "statsbomb-open"
    : providerId;
  const provider = available.find((candidate) => candidate.id === chosenId);
  if (!provider) throw new PlayerEventProviderError("不支持该球员事件数据源。", 400, "UNSUPPORTED_PROVIDER");
  if (!provider.configured) {
    const status = provider.runtimeStatus === "contract-required" ? 402 : 503;
    throw new PlayerEventProviderError(`${provider.name} 尚未配置。`, status, provider.runtimeStatus.toUpperCase().replace(/-/g, "_"));
  }
  if (!provider.executable || !provider.load) {
    throw new PlayerEventProviderError(`${provider.name} 已预留适配层，但当前数据合同或字段映射尚未完成。`, 501, "ADAPTER_REQUIRED");
  }
  return provider.load(input);
}
