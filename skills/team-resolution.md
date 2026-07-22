# Skill: Team Resolution

## Purpose

Resolve user-selected or user-entered football team names into canonical provider IDs.

## Inputs

- `team_a`
- `team_b`
- `competition`
- `country`
- `team_type`: club, national, or unknown

## Process

1. Normalize names and aliases.
2. Query structured sports provider by name.
3. Rank exact matches above aliases.
4. Use competition/country context to disambiguate.
5. If multiple likely matches remain, ask the user to choose.

## Output

- `team_a_id`
- `team_b_id`
- canonical names
- confidence score
- ambiguity list if needed

## Safety

Do not silently choose between ambiguous teams.

