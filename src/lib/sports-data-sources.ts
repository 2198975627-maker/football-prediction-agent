export type OfficialSportsProviderId =
  | "api-football"
  | "sportmonks"
  | "statsbomb-open"
  | "statsbomb-paid"
  | "football-data-org"
  | "thesportsdb"
  | "fbref"
  | "understat"
  | "sofifa"
  | "soccerdata"
  | "anysport"
  | "nami-sports"
  | "juhe-football"
  | "feijing-sports"
  | "apiballs";

export type SportsAnalysisToolId =
  | "statsbombpy"
  | "matplotlib"
  | "mplsoccer"
  | "socceraction";

export type OfficialDataCapability =
  | "team-search"
  | "team-metadata"
  | "fixtures"
  | "standings"
  | "h2h"
  | "lineups"
  | "injuries"
  | "events"
  | "player-statistics"
  | "xg"
  | "shot-map"
  | "heatmap"
  | "keeper-actions"
  | "penalties"
  | "transfers"
  | "visual-assets"
  | "advanced-player-statistics"
  | "physical-profile"
  | "preferred-foot"
  | "positions"
  | "python-connector";

export type SportsAnalysisCapability =
  | "event-loading"
  | "pitch-visualization"
  | "shot-map"
  | "heatmap"
  | "passing-network"
  | "spadl"
  | "vaep"
  | "xt"
  | "report-charting";

export type OfficialSportsProvider = {
  id: OfficialSportsProviderId;
  name: string;
  role: "primary" | "advanced" | "event-specialist" | "metadata" | "connector" | "fallback";
  priority: number;
  baseUrl: string;
  docsUrl: string;
  authMode: "server-api-key" | "open-data" | "public-web" | "contract";
  requiredEnvKeys: string[];
  costModel: "free" | "free-demo" | "free-public" | "paid-api" | "contract-paid";
  capabilities: OfficialDataCapability[];
  bestFor: string[];
  limitations: string[];
};

export type OfficialSportsProviderStatus = OfficialSportsProvider & {
  configured: boolean;
  missingEnvKeys: string[];
  runtimeStatus: "ready" | "needs-key" | "open-data-ready" | "prepared" | "credentials-ready" | "contract-needed";
};

export type SportsAnalysisTool = {
  id: SportsAnalysisToolId;
  name: string;
  role: "event-loader" | "visualization" | "action-value-model";
  packageNames: string[];
  docsUrl: string;
  installCommand: string;
  capabilities: SportsAnalysisCapability[];
  bestFor: string[];
  limitations: string[];
};

export type SportsAnalysisToolStatus = SportsAnalysisTool & {
  configured: boolean;
  runtimeStatus: "prepared" | "enabled";
};

export type OfficialFusionStage = {
  id: string;
  name: string;
  description: string;
  providers: OfficialSportsProviderId[];
  requiredCapabilities: OfficialDataCapability[];
};

export const officialSportsProviders: OfficialSportsProvider[] = [
  {
    id: "api-football",
    name: "API-Football",
    role: "primary",
    priority: 1,
    baseUrl: "https://v3.football.api-sports.io",
    docsUrl: "https://www.api-football.com/documentation-v3",
    authMode: "server-api-key",
    requiredEnvKeys: ["API_FOOTBALL_KEY", "RAPIDAPI_FOOTBALL_KEY"],
    costModel: "free-demo",
    capabilities: [
      "team-search",
      "team-metadata",
      "fixtures",
      "standings",
      "h2h",
      "lineups",
      "injuries",
      "events",
      "player-statistics",
      "transfers"
    ],
    bestFor: ["球队/比赛 ID 解析", "赛程赛果", "阵容、伤停、比赛事件、球员赛季统计"],
    limitations: ["支持直营 Key 或官方 RapidAPI 通道；免费计划有严格调用额度，RapidAPI 套餐还需关注超额计费。高级位置坐标、360 视野和部分 xG 字段通常不如专项事件数据商完整。"]
  },
  {
    id: "sportmonks",
    name: "Sportmonks Football API",
    role: "advanced",
    priority: 2,
    baseUrl: "https://api.sportmonks.com/v3/football",
    docsUrl: "https://docs.sportmonks.com/v3",
    authMode: "server-api-key",
    requiredEnvKeys: ["SPORTMONKS_API_KEY"],
    costModel: "paid-api",
    capabilities: [
      "team-search",
      "team-metadata",
      "fixtures",
      "standings",
      "h2h",
      "lineups",
      "injuries",
      "events",
      "player-statistics",
      "xg",
      "transfers"
    ],
    bestFor: ["多 include 请求融合", "补充 xG、伤停、阵容、球员统计", "与 API-Football 交叉校验"],
    limitations: ["不同套餐覆盖不同联赛和字段，上线前必须按目标赛事确认权限。"]
  },
  {
    id: "statsbomb-open",
    name: "StatsBomb Open Data",
    role: "event-specialist",
    priority: 3,
    baseUrl: "https://github.com/statsbomb/open-data",
    docsUrl: "https://github.com/statsbomb/open-data",
    authMode: "open-data",
    requiredEnvKeys: [],
    costModel: "free",
    capabilities: ["events", "player-statistics", "xg", "shot-map", "heatmap", "keeper-actions", "penalties"],
    bestFor: ["免费历史事件样本", "训练事件解析流程", "球员热区、射门图、xG、门将动作样例"],
    limitations: ["不是实时数据，不覆盖所有赛事；当前预测不能把它当作所选比赛的实时事实。"]
  },
  {
    id: "statsbomb-paid",
    name: "StatsBomb Data API",
    role: "event-specialist",
    priority: 4,
    baseUrl: "https://statsbomb.com",
    docsUrl: "https://statsbomb.com/what-we-do/sports-data/",
    authMode: "contract",
    requiredEnvKeys: ["STATSBOMB_API_TOKEN"],
    costModel: "contract-paid",
    capabilities: ["events", "player-statistics", "xg", "shot-map", "heatmap", "keeper-actions", "penalties"],
    bestFor: ["生产级事件坐标", "高质量 xG 和射门上下文", "对位、热区、门将扑救区域"],
    limitations: ["需要商务合同和具体凭证格式确认，当前仅做接入预留。"]
  },
  {
    id: "football-data-org",
    name: "football-data.org",
    role: "fallback",
    priority: 5,
    baseUrl: "https://api.football-data.org/v4",
    docsUrl: "https://www.football-data.org/documentation/quickstart",
    authMode: "server-api-key",
    requiredEnvKeys: ["FOOTBALL_DATA_API_KEY"],
    costModel: "free-demo",
    capabilities: ["team-metadata", "fixtures", "standings", "h2h"],
    bestFor: ["赛程、积分榜、基础球队数据备用校验"],
    limitations: ["不适合作为球员事件、热区、抢断/被过等细粒度数据主源。"]
  },
  {
    id: "thesportsdb",
    name: "TheSportsDB",
    role: "metadata",
    priority: 6,
    baseUrl: "https://www.thesportsdb.com/api.php",
    docsUrl: "https://www.thesportsdb.com/api.php",
    authMode: "server-api-key",
    requiredEnvKeys: ["THESPORTSDB_API_KEY"],
    costModel: "free-demo",
    capabilities: ["team-search", "team-metadata", "visual-assets"],
    bestFor: ["队徽、球场、球队基础资料、前端选择器增强"],
    limitations: ["不是球员事件数据主源，不能支撑赛前概率模型的核心判断。"]
  },
  {
    id: "fbref",
    name: "FBref",
    role: "advanced",
    priority: 7,
    baseUrl: "https://fbref.com",
    docsUrl: "https://fbref.com",
    authMode: "public-web",
    requiredEnvKeys: [],
    costModel: "free-public",
    capabilities: ["team-metadata", "fixtures", "player-statistics", "advanced-player-statistics", "xg"],
    bestFor: ["球员/球队赛季统计", "射门、传球、防守、xG、门将等长期指标", "与事件数据交叉校验"],
    limitations: ["公开网页数据，不是实时事件 API；抓取必须低频、缓存、遵守网站条款。"]
  },
  {
    id: "understat",
    name: "Understat",
    role: "advanced",
    priority: 8,
    baseUrl: "https://understat.com",
    docsUrl: "https://understat.com",
    authMode: "public-web",
    requiredEnvKeys: [],
    costModel: "free-public",
    capabilities: ["fixtures", "player-statistics", "xg", "shot-map"],
    bestFor: ["球队/球员 xG 趋势", "射门质量辅助判断", "与 FBref、StatsBomb 交叉校验"],
    limitations: ["xG 模型不是官方统一标准；覆盖赛事有限，不能单独作为最终概率依据。"]
  },
  {
    id: "sofifa",
    name: "SoFIFA",
    role: "metadata",
    priority: 9,
    baseUrl: "https://sofifa.com",
    docsUrl: "https://sofifa.com",
    authMode: "public-web",
    requiredEnvKeys: [],
    costModel: "free-public",
    capabilities: ["team-metadata", "player-statistics", "physical-profile", "preferred-foot", "positions"],
    bestFor: ["球员身高、惯用脚、位置倾向、身体属性参考", "补全对位模型的静态画像"],
    limitations: ["游戏数据库，不是官方比赛事实；只能做参考特征，不能覆盖真实伤停和临场状态。"]
  },
  {
    id: "soccerdata",
    name: "soccerdata Python",
    role: "connector",
    priority: 10,
    baseUrl: "https://soccerdata.readthedocs.io",
    docsUrl: "https://soccerdata.readthedocs.io",
    authMode: "public-web",
    requiredEnvKeys: [],
    costModel: "free-public",
    capabilities: ["python-connector", "fixtures", "team-metadata", "player-statistics", "advanced-player-statistics", "xg", "physical-profile"],
    bestFor: ["用 Python 统一读取 FBref、Understat、SoFIFA 等公开数据", "离线缓存和批量分析"],
    limitations: ["它是采集工具，不是数据所有者；每个下游网站的条款、频率和可用性仍需单独遵守。"]
  },
  {
    id: "anysport",
    name: "AnySport API",
    role: "primary",
    priority: 11,
    baseUrl: "https://api.anysport.io/v1",
    docsUrl: "https://docs.anysport.io/zh-Hans/",
    authMode: "server-api-key",
    requiredEnvKeys: ["ANYSPORT_API_KEY"],
    costModel: "free-demo",
    capabilities: ["fixtures", "standings", "h2h", "lineups", "injuries", "events", "team-metadata"],
    bestFor: ["大陆服务器可访问的中文足球赛程、赛果和实时比赛上下文", "免费试用层的赛程、H2H、比赛事件和球队统计"],
    limitations: ["免费套餐只有 7 天；球队、球员和独立阵容接口需要 Basic 以上套餐；不提供完整 xG 与事件坐标。"]
  },
  {
    id: "nami-sports",
    name: "纳米数据体育 API",
    role: "primary",
    priority: 12,
    baseUrl: "https://www.nami.com",
    docsUrl: "https://www.nami.com",
    authMode: "server-api-key",
    requiredEnvKeys: ["NAMI_SPORTS_USER", "NAMI_SPORTS_SECRET"],
    costModel: "paid-api",
    capabilities: [
      "team-search",
      "team-metadata",
      "fixtures",
      "standings",
      "h2h",
      "lineups",
      "injuries",
      "events",
      "player-statistics",
      "heatmap"
    ],
    bestFor: ["国内访问和中文赛事覆盖", "实时比分、赛程、阵容、技术统计、热图类数据"],
    limitations: ["具体字段和赛事覆盖依套餐而定；球员级事件粒度需要拿样例接口确认。"]
  },
  {
    id: "juhe-football",
    name: "聚合数据足球赛事 API",
    role: "fallback",
    priority: 13,
    baseUrl: "https://www.juhe.cn",
    docsUrl: "https://www.juhe.cn/docs",
    authMode: "server-api-key",
    requiredEnvKeys: ["JUHE_FOOTBALL_API_KEY"],
    costModel: "paid-api",
    capabilities: ["fixtures", "standings", "team-metadata", "h2h"],
    bestFor: ["国内云环境易接入", "赛程、赛果、积分、基础赛事数据备用"],
    limitations: ["通常不适合作为 xG、热区、抢断/被过等深度球员事件主源。"]
  },
  {
    id: "feijing-sports",
    name: "飞鲸体育数据",
    role: "advanced",
    priority: 14,
    baseUrl: "https://www.feijing88.com",
    docsUrl: "https://www.feijing88.com",
    authMode: "contract",
    requiredEnvKeys: ["FEIJING_SPORTS_API_KEY"],
    costModel: "contract-paid",
    capabilities: ["fixtures", "standings", "lineups", "events", "player-statistics", "team-metadata"],
    bestFor: ["国内体育数据商业接入候选", "中文产品本地化和赛事数据补充"],
    limitations: ["需要商务授权和接口样例确认；上线前必须确认足球事件粒度。"]
  },
  {
    id: "apiballs",
    name: "全速数据 / APIBalls",
    role: "advanced",
    priority: 15,
    baseUrl: "https://www.apiballs.com",
    docsUrl: "https://www.apiballs.com",
    authMode: "contract",
    requiredEnvKeys: ["APIBALLS_API_KEY"],
    costModel: "contract-paid",
    capabilities: ["fixtures", "standings", "lineups", "events", "player-statistics", "team-metadata"],
    bestFor: ["国内体育数据接口候选", "赛程、比分、阵容、统计等本地化补充"],
    limitations: ["需要确认正式 API 文档、计费方式、字段覆盖和商用授权。"]
  }
];

export const sportsAnalysisTools: SportsAnalysisTool[] = [
  {
    id: "statsbombpy",
    name: "statsbombpy",
    role: "event-loader",
    packageNames: ["statsbombpy"],
    docsUrl: "https://github.com/statsbomb/statsbombpy",
    installCommand: "pip install statsbombpy",
    capabilities: ["event-loading", "shot-map", "heatmap"],
    bestFor: ["读取 StatsBomb Open Data 或授权数据", "把事件 JSON 转成 Python DataFrame"],
    limitations: ["免费 Open Data 是历史样本；生产实时数据仍需要 StatsBomb 商业授权。"]
  },
  {
    id: "matplotlib",
    name: "matplotlib",
    role: "visualization",
    packageNames: ["matplotlib"],
    docsUrl: "https://matplotlib.org",
    installCommand: "pip install matplotlib",
    capabilities: ["report-charting", "shot-map", "heatmap"],
    bestFor: ["生成报告图表", "输出 PNG/SVG 可视化资产", "与 mplsoccer 配合画足球图"],
    limitations: ["只是绘图库，不提供足球数据。"]
  },
  {
    id: "mplsoccer",
    name: "mplsoccer",
    role: "visualization",
    packageNames: ["mplsoccer"],
    docsUrl: "https://mplsoccer.readthedocs.io",
    installCommand: "pip install mplsoccer",
    capabilities: ["pitch-visualization", "shot-map", "heatmap", "passing-network"],
    bestFor: ["球场图、射门图、传球图、热区图", "把球员对位和事件位置转成图文并茂展示"],
    limitations: ["只负责可视化；输入数据质量取决于 StatsBomb/FBref/API 等来源。"]
  },
  {
    id: "socceraction",
    name: "SoccerAction",
    role: "action-value-model",
    packageNames: ["socceraction"],
    docsUrl: "https://socceraction.readthedocs.io",
    installCommand: "pip install socceraction",
    capabilities: ["spadl", "vaep", "xt"],
    bestFor: ["SPADL 事件标准化", "VAEP/xT 行为价值评估", "把球员每次触球贡献纳入预测特征"],
    limitations: ["需要高质量事件数据输入；不是即装即有的实时数据源。"]
  }
];

export const officialFusionPlan: OfficialFusionStage[] = [
  {
    id: "identity-resolution",
    name: "球队与比赛 ID 解析",
    description: "先把用户输入的队名、赛事和时间映射到各平台的 team id、season id、fixture id。",
    providers: ["api-football", "sportmonks", "anysport", "nami-sports", "football-data-org", "juhe-football", "feijing-sports", "apiballs", "thesportsdb", "fbref", "soccerdata"],
    requiredCapabilities: ["team-search", "team-metadata", "fixtures"]
  },
  {
    id: "match-context",
    name: "赛程、积分、历史交锋",
    description: "从多个正式 API 拉取赛程、积分、近期赛果、H2H，并记录冲突来源。",
    providers: ["api-football", "sportmonks", "anysport", "nami-sports", "football-data-org", "juhe-football", "feijing-sports", "apiballs", "fbref", "understat", "soccerdata"],
    requiredCapabilities: ["fixtures", "standings", "h2h"]
  },
  {
    id: "squad-availability",
    name: "阵容、伤停、转会",
    description: "合并预计/官方阵容、伤停、停赛、转入转出，生成球员可用性表。",
    providers: ["sportmonks", "api-football", "anysport", "nami-sports", "feijing-sports", "apiballs", "sofifa", "fbref", "soccerdata"],
    requiredCapabilities: ["lineups", "injuries", "transfers", "physical-profile", "preferred-foot", "positions"]
  },
  {
    id: "player-events",
    name: "球员事件与对位",
    description: "聚合射门、xG、抢断、封堵、拦截、被过、门将动作、点球和热区。",
    providers: ["statsbomb-paid", "nami-sports", "sportmonks", "api-football", "feijing-sports", "apiballs", "statsbomb-open", "fbref", "understat", "soccerdata"],
    requiredCapabilities: ["events", "player-statistics", "advanced-player-statistics", "xg", "shot-map", "heatmap", "keeper-actions", "penalties"]
  },
  {
    id: "visual-metadata",
    name: "展示资产",
    description: "为前端补充队徽、球场、球队图像等非预测核心素材。",
    providers: ["thesportsdb", "sofifa"],
    requiredCapabilities: ["visual-assets"]
  }
];

export function getOfficialSportsProviderStatuses(): OfficialSportsProviderStatus[] {
  const pythonAnalyticsEnabled = process.env.PYTHON_ANALYTICS_ENABLED === "true";
  const runtimeIntegrated = new Set<OfficialSportsProviderId>(["api-football", "sportmonks", "football-data-org", "anysport", "statsbomb-open", "statsbomb-paid", "thesportsdb"]);

  return officialSportsProviders.map((provider) => {
    const apiFootballConfigured = provider.id === "api-football"
      && Boolean(process.env.API_FOOTBALL_KEY?.trim() || process.env.RAPIDAPI_FOOTBALL_KEY?.trim());
    const missingEnvKeys = apiFootballConfigured
      ? []
      : provider.requiredEnvKeys.filter((key) => !process.env[key]);
    const configured =
      provider.authMode === "public-web"
        ? pythonAnalyticsEnabled
        : apiFootballConfigured || provider.requiredEnvKeys.length === 0 || missingEnvKeys.length === 0;
    const runtimeStatus = provider.authMode === "public-web"
      ? pythonAnalyticsEnabled
        ? "ready"
        : "prepared"
      : provider.authMode === "open-data"
      ? "open-data-ready"
      : provider.authMode === "contract" && !configured
        ? "contract-needed"
        : configured
          ? runtimeIntegrated.has(provider.id) ? "ready" : "credentials-ready"
          : "needs-key";

    return {
      ...provider,
      configured,
      missingEnvKeys,
      runtimeStatus
    };
  });
}

export function getSportsAnalysisToolStatuses(): SportsAnalysisToolStatus[] {
  const pythonAnalyticsEnabled = process.env.PYTHON_ANALYTICS_ENABLED === "true";

  return sportsAnalysisTools.map((tool) => ({
    ...tool,
    configured: pythonAnalyticsEnabled,
    runtimeStatus: pythonAnalyticsEnabled ? "enabled" : "prepared"
  }));
}

export function getOfficialCoverageSummary(statuses = getOfficialSportsProviderStatuses()) {
  const capabilityMap = new Map<OfficialDataCapability, OfficialSportsProviderStatus[]>();

  statuses.forEach((provider) => {
    provider.capabilities.forEach((capability) => {
      const list = capabilityMap.get(capability) ?? [];
      list.push(provider);
      capabilityMap.set(capability, list);
    });
  });

  return Array.from(capabilityMap.entries())
    .map(([capability, providers]) => ({
      capability,
      providers: providers.map((provider) => provider.id),
      readyProviders: providers
        .filter((provider) => provider.runtimeStatus === "ready" || provider.runtimeStatus === "open-data-ready")
        .map((provider) => provider.id)
    }))
    .sort((left, right) => left.capability.localeCompare(right.capability));
}
