# Skill: Football Data Collection

## Purpose

Collect structured match data from approved sports providers.

## Data Categories

- Fixtures
- Recent results
- Standings
- Lineups
- Injuries
- Suspensions
- Player statistics
- Player event statistics
- Player-vs-player or role-vs-role matchup statistics
- Team statistics
- Goalkeeper shot-stopping and penalty statistics
- Set-piece statistics
- Tactical profile indicators: crossing rate, long-ball rate, press intensity, build-up errors, aerial duel rate
- H2H
- Transfers
- Coach metadata
- Venue and weather if available

## Rules

- Prefer provider APIs over scraping.
- Use the official multi-source order from `docs/official-sports-data-strategy.md`.
- Use API-Football as the primary live provider when `API_FOOTBALL_KEY` is configured.
- Use Sportmonks as the advanced cross-check/enrichment provider when `SPORTMONKS_API_KEY` is configured.
- Use StatsBomb Open Data only for historical demo mode; use paid StatsBomb only after contract credentials exist.
- Use football-data.org for fixtures/standings fallback, not player-event facts.
- Use TheSportsDB for badges and metadata, not core prediction evidence.
- Use 纳米数据, 聚合数据, 飞鲸体育数据, and 全速数据 as China-access candidates after API key, sample response, commercial authorization, and field coverage are confirmed.
- Use 懂球帝, 咪咕体育, 爱奇艺体育, 腾讯体育, 雷速体育, 新浪体育, and 直播吧 as Chinese context/reference sources only unless a formal API contract exists.
- Record provider, endpoint, timestamp, and cost.
- Cache non-sensitive responses where terms allow.
- Mark missing data explicitly.
- Preserve conflicting provider values instead of silently overwriting them.
- Distinguish exact player-vs-player data from role-profile approximations.
- Do not collect or infer private-life information unless it is credible, public, and directly relevant to availability or match performance.

## Output

`structured_football_pack`

Required subpacks:

- `team_data`
- `player_availability`
- `player_event_data`
- `player_matchup_inputs`
- `goalkeeper_shooter_inputs`
- `penalty_inputs`
- `tactical_profile_inputs`
- `coach_profile_inputs`
- `missing_data`
