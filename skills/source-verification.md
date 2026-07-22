# Skill: Source Verification

## Purpose

Convert raw sports data and public reporting into a verified evidence pack.

## Checks

- Freshness
- Source reliability
- Provider agreement or conflict
- Direct match relevance
- Privacy risk
- Citation availability
- Whether the source is official, structured provider, major platform, media, or reference-only community/social material

## Output Labels

- `high_confidence`
- `medium_confidence`
- `low_confidence`
- `conflicting`
- `missing`
- `excluded_privacy_risk`
- `reference_only`

## Safety

Unsupported claims must not be used as prediction reasons.
Community posts, forum comments, social media, and fan discussion must be labeled `reference_only` and kept out of the core evidence pack. They can only point to topics that need verification from official, structured, or major-platform sources.
