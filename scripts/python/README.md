# Python Football Analytics Stack

Optional Python tools for deeper football analytics:

- `soccerdata`: connector for public football data sources such as FBref, Understat, and SoFIFA.
- `statsbombpy`: loader for StatsBomb Open Data or licensed StatsBomb data.
- `matplotlib`: general charting.
- `mplsoccer`: football pitch, shot map, heatmap, and passing-network visuals.
- `socceraction`: SPADL, VAEP, and xT action-value modeling.

Install:

```powershell
pip install -r requirements-football-analytics.txt
```

Check local package readiness:

```powershell
python .\scripts\python\football_analytics_sources.py --check
```

Generate a demo pitch visual after installing packages:

```powershell
python .\scripts\python\football_analytics_sources.py --plot-demo .\public\generated\football-analytics-demo.png
```

Safety rule: the check command does not scrape or call external data sources.
