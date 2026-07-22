# Python Football Analytics Stack

The project now tracks these optional Python football data and analytics tools:

| Item | Layer | Use |
| --- | --- | --- |
| soccerdata | Connector | Server-side collection from FBref, Understat, SoFIFA and similar public football sources |
| FBref | Public stats source | Season-level player/team stats, xG, shooting, passing, defense, keeper tables |
| Understat | Public xG source | xG trends and shot-quality enrichment |
| SoFIFA | Reference metadata | Height, preferred foot, positions, body profile and game-derived attributes |
| StatsBomb / statsbombpy | Event data | Historical open event samples and licensed event-data loading |
| matplotlib | Charting | Report charts and static images |
| mplsoccer | Football visualization | Pitches, shot maps, heatmaps, passing networks |
| SoccerAction | Modeling | SPADL, VAEP and xT action-value modeling |

## Install

```powershell
pip install -r requirements-football-analytics.txt
```

## Check

```powershell
pnpm analytics:check
```

## Safety

- Run soccerdata only server-side.
- Cache results and use conservative rate limits.
- Do not bypass login, CAPTCHA, paywalls, DRM, app-only restrictions, or robots restrictions.
- Keep SoFIFA as static/reference metadata.
- Keep Understat as an xG reference source, not a single source of truth.
- Use StatsBomb Open Data as a historical demo until a licensed production source exists.
