# Official Sports Data Strategy

The production data stack uses multiple licensed or official API paths. Social posts, forums, and news pages can only support context review; they must not be the primary source for player event facts.

## Chosen Provider Stack

| Provider | Role | Main Use | Key |
| --- | --- | --- | --- |
| API-Football | Primary live provider | Team resolution, fixtures, standings, H2H, lineups, injuries, events, player stats | `API_FOOTBALL_KEY` or `RAPIDAPI_FOOTBALL_KEY` |
| Sportmonks Football API | Advanced cross-check provider | Fixture includes, xG, injuries, lineups, player stats, event enrichment | `SPORTMONKS_API_KEY` |
| StatsBomb Open Data | Free event-data demo | Historical event logs, xG, shot maps, heatmaps, keeper events | none |
| StatsBomb paid/Data API | Production event specialist | High-quality event coordinates, xG, shot context, keeper zones | `STATSBOMB_API_TOKEN` |
| FBref | Public advanced stats | Player/team season stats, xG, shooting, passing, defending, keeper tables | none |
| Understat | Public xG reference | xG trend and shot-quality enrichment | none |
| SoFIFA | Static player-profile reference | Height, preferred foot, positions, body/ability profile reference | none |
| soccerdata | Python connector | Server-side collection from FBref, Understat, SoFIFA and similar public sources | none |
| football-data.org | Fixture/standing fallback | Fixtures, standings, basic team and match verification | `FOOTBALL_DATA_API_KEY` |
| TheSportsDB | Metadata and visuals | Team search, badges, stadiums, visual assets | `THESPORTSDB_API_KEY` |
| 纳米数据体育 API | China-access primary candidate | Chinese coverage, live scores, fixtures, lineups, technical stats, heatmap-like data | `NAMI_SPORTS_USER`, `NAMI_SPORTS_SECRET` |
| 聚合数据足球赛事 API | China fallback candidate | Domestic API access for fixtures, results, standings, basic match data | `JUHE_FOOTBALL_API_KEY` |
| 飞鲸体育数据 | China commercial candidate | Domestic sports-data API candidate for fixtures, lineups, stats, events | `FEIJING_SPORTS_API_KEY` |
| 全速数据 / APIBalls | China commercial candidate | Domestic sports-data API candidate for fixtures, lineups, stats, events | `APIBALLS_API_KEY` |

## Fusion Order

The active match-intelligence endpoint currently tries configured providers in this order: API-Football, Sportmonks, then football-data.org. A successful response is normalized into one shared schema and passed through the same cache and quality gate.

1. Resolve teams and fixtures across API-Football, Sportmonks, 纳米数据, football-data.org, 聚合数据, 飞鲸, 全速数据, and TheSportsDB.
2. Pull match context from API-Football, Sportmonks, 纳米数据, football-data.org, 聚合数据, 飞鲸, and 全速数据.
3. Pull squad availability from Sportmonks, API-Football, 纳米数据, 飞鲸, and 全速数据.
4. Enrich player static profiles with SoFIFA, but keep it labeled as reference metadata because it is game-derived.
5. Pull season-long player/team tables from FBref and xG trends from Understat through a server-side Python/soccerdata cache when terms and rate limits are acceptable.
6. Pull player-level events from StatsBomb paid when licensed, then 纳米数据/Sportmonks/API-Football/飞鲸/全速数据, with StatsBomb Open Data only for historical demo mode.
7. Run matplotlib/mplsoccer visual rendering and SoccerAction SPADL/VAEP/xT modeling only on server-side cached data.
8. Attach TheSportsDB badges and stadium assets for display only.

## China Platform Handling

- 国内 API 数据商可以进入核心结构化数据管线，但必须有正式 API、商务授权、计费规则和字段样例。
- 懂球帝、咪咕体育、爱奇艺体育、腾讯体育、雷速体育、新浪体育、直播吧等平台适合做中文资讯、赛程页面、赛前报道和来源交叉验证。
- 这些内容平台的评论区、社区帖、视频、会员内容、DRM 内容和 app-only 内容不能被绕过，也不能作为球员事件统计或概率输入。
- 如果某个平台提供正式数据 API 或商务授权接口，再把它升级为结构化数据源。

## Safety Rules

- Provider keys stay server-side only.
- Every imported record must keep `provider`, `providerId`, `fetchedAt`, and confidence metadata.
- If providers disagree, keep both values and mark the conflict instead of overwriting silently.
- Do not make a prediction from incomplete event data without showing the missing fields to the user.
- Do not infer private family or relationship status unless it is public, material, source-cited, and directly match-related.
- Treat SoFIFA as reference-only metadata, not match truth.
- Treat soccerdata as a connector; the downstream site terms still control usage.

## Free-first runtime

- `API_FOOTBALL_KEY`: preferred free-plan source for fixture identity, lineups, injuries, events, match statistics, recent form, and H2H. Free quotas are protected by server cache and slower pre-match polling.
- `FOOTBALL_DATA_API_KEY`: lightweight fallback for fixtures, participants, recent results, and H2H. It never claims to provide player event data.
- `SPORTMONKS_API_KEY`: optional richer fallback and cross-check source.
- Provider failures are isolated. The route tries the next configured provider and returns only provider IDs/error classes, never credentials.
- Every result records its provider and evidence fields. Low-detail free results remain below the official-prediction quality threshold.
