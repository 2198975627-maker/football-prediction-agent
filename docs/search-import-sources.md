# Search Import Sources

This document defines sources the search/data Agent may import before prediction.

## Source Priority

1. Official club, national-team, league, and federation sources.
2. Structured sports APIs.
3. Reputable sports media.
4. Open datasets for historical/event-model reference.
5. Public community posts as reference-only context.

Core prediction evidence must come from official sources, major sports platforms, or structured sports-data providers. Community posts, fan forums, comments, and social media must never become factual evidence or numeric model inputs.

## Recommended MVP Stack

- `TheSportsDB`: already connected for team metadata, badges, venues, and basic players.
- `football-data.org`: competitions, matches, teams, standings, H2H.
- `API-Football`: production candidate for fixtures, lineups, injuries, events, player stats.
- `StatsBomb Open Data`: historical event-data reference for player matchup modeling.
- `纳米数据`: China-access candidate for live scores, fixtures, lineups, technical stats, and heatmap-like data after commercial/API verification.
- `聚合数据`: China-access fallback for football fixtures, results, standings, and basic match data.
- `飞鲸体育数据` and `全速数据 / APIBalls`: domestic commercial sports-data candidates pending API sample and authorization review.
- `Tavily`: search provider for official/news discovery.
- `Firecrawl`: page extraction to clean Markdown or JSON.
- `RSSHub`: low-cost feed ingestion for news/community pages.

## Reference-Only Community/Post Sources

- Reddit `r/soccer`, `r/football`, `r/worldcup`, and club subreddits.
- 虎扑足球话题区/球队专区.
- 懂球帝/懂球号 user commentary.
- 直播吧评论/讨论区.

These are reference-only. They can help discover what people are discussing, but they cannot support final claims, injury status, lineup status, player metrics, or probabilities.

## Chinese Sports Apps And Web Platforms

These can be useful as search/import objects when their public pages are accessible:

- 咪咕体育：赛事资讯、公开赛程、转播信息、公开新闻。
- 爱奇艺体育：足球新闻、公开赛程、赛前内容、转播信息。
- 懂球帝：足球新闻、比赛页、积分/射手等公开数据、用户讨论线索。
- 腾讯体育：体育新闻、赛程、公开比赛页面。
- 直播吧：足球新闻、赛程、比赛讨论线索。
- 新浪体育：新闻、采访、转会和教练动态线索。

Use them for:

- Chinese-language context and media coverage;
- public schedules, match pages, data tables, and platform-published news;
- discovering lineup, injury, tactical, coach, and transfer leads that must be verified;
- finding official-source links or media-source corroboration;
- user-facing source diversity when Western sources are thin.

Do not use them for:

- bypassing app-only access, login, WAF, CAPTCHA, paywalls, VIP pages, DRM, or video protections;
- copying protected video, live commentary, or long copyrighted text;
- treating fan comments as verified facts;
- using social/forum posts as prediction evidence or numeric inputs;
- private-life inference.

Reference-only posts can be used for:

- discovering possible topics to verify;
- finding links to primary sources;
- detecting unusual public discussion before a match, marked as sentiment only.

Reference-only posts cannot be used for:

- private-life monitoring;
- unverified rumors as facts;
- betting advice;
- exact player availability;
- event statistics;
- probabilities;
- player or coach conclusions unless confirmed by official, structured, or major-platform sources.

## Automation Rules

- Use API/RSS first.
- Use crawling only when allowed and necessary.
- Do not bypass login, WAF, CAPTCHA, paywalls, robots restrictions, or app-only access.
- Store source URL, retrieval time, confidence, and extracted claim.
- Mark exact data vs inferred/role-based data separately.
- Keep `reference-only` material out of the core evidence pack.

The machine-readable registry is `config/search-import-sources.json`.
