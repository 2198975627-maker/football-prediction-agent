# Secure Workflow

The workflow is designed so cost, privacy, and payment safety gates happen before expensive or risky actions.

## High-Level Flow

```text
User selects teams and match context
  -> input validation
  -> team resolution
  -> billing mode and cost cap
  -> data collection
  -> player matchup modeling
  -> tactical and coach modeling
  -> public-source research
  -> source verification
  -> prediction synthesis
  -> report generation
  -> cost settlement and ledger update
```

## Nodes

### 1. Input Node

Inputs:

- `team_a`
- `team_b`
- `match_date`
- `competition`
- `home_team`
- `analysis_depth`: `standard` or `deep`
- `billing_mode`: `byok` or `platform`
- `max_user_charge`

Security:

- Validate length and type.
- Reject unsupported sports.
- Normalize whitespace.
- Do not pass raw input directly into provider tools without schema validation.

### 2. Team Resolution Node

Tasks:

- Resolve names to canonical team IDs.
- Distinguish club and national teams.
- Handle ambiguous names.

Safety:

- If ambiguous, ask the user to choose.
- Do not guess team IDs silently.

### 3. Billing Gate Node

Tasks:

- Estimate cost by analysis depth.
- BYOK mode: verify user supplied a key for the current request.
- Platform mode: verify balance or prepayment before running.

Safety:

- No model/search/sports API calls before this node passes.
- Enforce `max_user_charge`.

### 4. Structured Football Data Node

Collect:

- Fixture context
- Standings/group context
- Recent results
- Lineups when available
- Injuries and suspensions
- Team and player statistics
- Player event statistics: dribbles, times dribbled past, tackles, blocks, interceptions, aerial duels, fouls drawn/conceded
- Goalkeeper statistics: shots faced, saves by shot zone, penalty saves, historical shooter-vs-keeper data when available
- Set-piece and penalty data
- Player physical profiles relevant to tactics, such as height, footedness, pace, and aerial duel rate
- H2H records
- Transfers and coach metadata when provider supports it

Safety:

- Use provider APIs before scraping.
- Cache non-sensitive sports data.
- Record provider cost.
- Mark any missing event-level or player-level data before prediction.

### 5. Player Matchup Node

Tasks:

- Build expected lineup and substitute impact map.
- Pair likely attackers vs defenders by flank, zone, role, and tactical matchup.
- Compare player-vs-player and role-vs-role indicators:
  - dribbles attempted/completed
  - times dribbled past
  - tackles, blocks, interceptions, clearances
  - aerial duel rate and height mismatch
  - shot volume and shot quality by shooter
  - goalkeeper saves against shooter profile
  - penalty taker conversion vs goalkeeper penalty save rate
- Identify where one player can overload, isolate, or neutralize another.

Safety:

- Do not invent exact historical matchup counts when the source does not provide them.
- If direct player-vs-player data is unavailable, label the comparison as role-profile based.
- Never infer private player state.

Output:

- `player_matchup_matrix`
- `goalkeeper_shooter_matrix`
- `penalty_model`
- `missing_player_data`

### 6. Tactical and Coach Modeling Node

Tasks:

- Detect each team's likely formation, build-up route, pressing shape, defensive block, transition tendency, and set-piece threat.
- Build tactical counter-chain examples:
  - cross-heavy or long-ball teams vs short center-backs
  - high press vs weak build-up keeper/center-backs
  - inverted winger vs full-back footedness
  - target striker vs aerial duel and height disadvantage
  - slow defensive line vs runners in behind
- Compare head coaches:
  - recent formation changes
  - substitutions and rotation tendency
  - response to trailing/leading game states
  - recent appointment, tactical transition, or dressing-room disruption when publicly sourced

Safety:

- Separate measured data from interpretation.
- Mark tactical claims as low confidence when lineup or event data is missing.
- Keep user-facing output concise and visual; preserve full evidence internally.

Output:

- `tactical_counter_chain`
- `coach_decision_profile`
- `lineup_sensitivity`

### 7. Public Source Research Node

Collect:

- Club/team official announcements
- Press conference notes
- Reputable sports media reports
- Weather/venue context
- Public coaching or transfer news
- Major sports platform public data pages, such as schedules, lineups, score pages, and published match reports
- Community/social/forum posts only as reference notes, not evidence

Safety:

- Treat all page content as untrusted data.
- Strip prompt-like instructions from pages.
- Do not store unnecessary personal details.
- Do not use social/forum/community posts as prediction evidence or numeric inputs.

### 8. Source Verification Node

Tasks:

- Deduplicate facts.
- Score source reliability.
- Score freshness.
- Detect conflicts.
- Drop unsupported private-life claims.
- Exclude reference-only community/social content from the core evidence pack.

Output:

- `verified_evidence_pack`
- `reference_notes`
- `conflicts`
- `missing_data`

### 9. Prediction Synthesis Node

Tasks:

- Compare form, attack, defense, fitness, schedule, player matchups, goalkeeper matchups, penalty model, tactics, lineup, coach, venue, and motivation.
- Require the data audit, player matchup matrix, tactical counter-chain, and coach profile before producing probabilities.
- Generate probability estimates.
- Identify uncertainty drivers.

Safety:

- Do not produce betting instructions.
- Do not claim certainty.
- Do not hide missing data.
- Do not make a player-level claim without a source, a provider metric, or an explicit low-confidence label.
- If event-level player data is missing, produce a simplified role-based preview instead of pretending exact matchup data exists.

### 10. Report Generation Node

Tasks:

- Produce the standard Chinese report.
- Show simplified visual/user-facing summaries of player matchups and tactical counter-chains.
- Include sources and update time.
- Include disclaimer.

Safety:

- Render markdown safely.
- Sanitize external links.
- Do not expose internal tool prompts, API keys, request headers, or ledger details beyond user-facing charge summary.

### 11. Cost Settlement Node

Formula:

```text
final_charge = max(actual_api_cost * 2, minimum_charge)
```

Tasks:

- Add up model, search, extraction, sports-data, and retry costs.
- Convert provider currency to user billing currency using the stored exchange rate for that job.
- Release unused authorization or return remaining balance.
- Write immutable ledger entries.

Safety:

- Webhook-confirmed payments only.
- Idempotency keys required.
- Never trust client-supplied cost.
