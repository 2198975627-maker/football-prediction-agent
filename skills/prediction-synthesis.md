# Skill: Prediction Synthesis

## Purpose

Generate a reasoned football match probability estimate from verified evidence.

## Inputs

- `structured_football_pack`
- `verified_public_sources`
- `match_context`
- `missing_data`
- `cost_budget_remaining`

## Analysis Dimensions

- Team form
- Attack and defense
- Player availability
- Player matchup matrix
- Goalkeeper vs shooter matrix
- Penalty model
- Expected lineup
- Tactical counter-chain
- Schedule fatigue
- Home/away or neutral venue
- Coaching and tactics
- H2H
- Common opponents
- Transfers and squad changes
- Weather and pitch
- Motivation and competition stakes

## Mandatory Reasoning Gates

Before generating probabilities:

1. Confirm what player-level data was available.
2. Compare key attacker-vs-defender and midfielder-vs-midfielder matchups.
3. Compare goalkeeper profile against likely shooters.
4. Compare penalty taker conversion profile against goalkeeper penalty-save profile when penalty scenarios matter.
5. Build at least three tactical counter-chain hypotheses.
6. Check coach profile: formation changes, substitutions, recent appointment, and response to game states.
7. List missing data and reduce confidence when missing data is material.

If exact event data is unavailable, state that the section is a simplified role-based preview. Do not invent exact counts.

## Output

- Win/draw/loss probabilities
- Likely score range
- Player matchup summary
- Tactical counter-chain summary
- Coach impact summary
- Key factors
- Uncertainty factors
- Short conclusion

## Safety

No betting instructions. No certainty language.
