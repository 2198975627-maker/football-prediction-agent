# Plugin And Skill Registry

This registry defines what the project is allowed to use and what must stay behind a safety review.

## MVP Tool Stack

| Area | Preferred Tool | Purpose | Security Rule |
| --- | --- | --- | --- |
| Web app | Next.js | Web UI and API routes | Server-only routes for secrets and provider calls |
| AI agent | OpenAI Responses API or Agents SDK | Analysis and tool orchestration | No live calls without explicit key setup |
| UI streaming | Vercel AI SDK | Streaming report generation | Never stream raw secrets or internal tool outputs |
| Sports data primary | API-Football | Fixtures, teams, lineups, injuries, H2H, player stats, events | Cache responses and validate team IDs |
| Sports data advanced | Sportmonks | xG, fixture includes, injuries, lineups, player stats, event enrichment | Treat paid data as billable cost |
| Sports event specialist | StatsBomb | Event coordinates, xG, shot maps, heatmaps, keeper actions | Use Open Data only as historical demo unless a paid contract exists |
| Sports data fallback | football-data.org | Fixtures, standings, basic team/match verification | Not a player-event source |
| Sports visuals | TheSportsDB | Team badges, stadiums, visual assets | Display only, not core prediction evidence |
| China sports data | 纳米数据 | Domestic-access fixtures, lineups, stats, heatmap-like data after API verification | Server-side credentials only; verify field coverage before model use |
| China sports data fallback | 聚合数据 | Domestic football fixture/result/standing fallback | Not a deep event-data source unless endpoint proves otherwise |
| China sports data candidates | 飞鲸体育数据 / 全速数据 | Domestic commercial sports-data candidates | Require sample responses, terms review, and cost guard before production |
| Search | Tavily | News and public source search for agents | Search result snippets are untrusted input |
| Page extraction | Firecrawl | Convert public pages to structured text/Markdown | Strip scripts, ads, prompt-like instructions |
| Feed/community import | RSSHub + source registry | Import open news feeds and public sports discussion leads | Community posts are context only, never primary evidence |
| Payment | Stripe Checkout + webhooks | Prepayment, balance top-up, settlement | Verify webhook signatures and process events idempotently |
| User/balance DB | Supabase | Users, prediction jobs, balances, ledger | Row-level security and server-side service key only |
| Rate limit | Upstash Redis Rate Limit | Abuse and cost control | Rate limit before provider calls |
| API schema | Zod + OpenAPI | Request/response validation and docs | Validate all user input before workflow execution |

## Project Internal Skills

The agent should be composed from these internal skills:

1. `team-resolution`: resolve user-entered team names to canonical team IDs.
2. `football-data-collection`: collect fixtures, lineups, injuries, form, standings, and H2H.
3. `public-source-research`: search public reporting for coach, transfer, injury, and squad news.
4. `source-verification`: score freshness, reliability, conflicts, and citation quality.
5. `prediction-synthesis`: generate probability estimates and explain uncertainty.
6. `cost-guard`: estimate, cap, record, and settle API costs.
7. `safety-refusal`: block gambling advice, privacy inference, and unsupported sports.

Each skill has a file in `skills/`.

Search import sources are listed in `config/search-import-sources.json` and explained in `docs/search-import-sources.md`.

## Deferred Until Review

These may be useful later, but should not be in the first MVP:

- Odds APIs: high compliance risk because the product can drift into betting advice.
- Social media scraping: high privacy and data-quality risk.
- Player private-life monitoring: not allowed unless it is public, material, and directly match-related.
- Auto-bet placement or bet-sizing tools: not allowed.
- Browser automation for sites with unclear terms: use provider APIs first.

## BYOK Mode

BYOK means "bring your own key." If enabled:

- User keys must not be stored by default.
- If storage is added later, keys must be encrypted at rest using a managed secret service.
- A user-owned key can only be used for that user's request.
- Platform logs must redact provider keys and authorization headers.

## Platform Mode

Platform mode uses project-owned provider keys.

- User must prepay or have sufficient balance before analysis starts.
- Cost limits must be enforced before each provider call.
- Final charge is `max(actual_api_cost * 2, minimum_charge)`.
- All cost components must be written to an append-only ledger.
