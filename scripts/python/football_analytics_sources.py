#!/usr/bin/env python
"""Inspect the optional Python football analytics stack.

This script is intentionally non-invasive by default: it checks local package
availability and prints the planned data/tool capabilities without scraping any
public website.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any


STACK = [
    {
        "id": "soccerdata",
        "package": "soccerdata",
        "kind": "connector",
        "uses": ["FBref", "Understat", "SoFIFA"],
        "default_enabled": False,
        "note": "Connector only. Respect each target site's terms and rate limits.",
    },
    {
        "id": "statsbombpy",
        "package": "statsbombpy",
        "kind": "event-loader",
        "uses": ["StatsBomb Open Data", "StatsBomb licensed data"],
        "default_enabled": False,
        "note": "Open Data is historical demo data; licensed production coverage needs credentials.",
    },
    {
        "id": "matplotlib",
        "package": "matplotlib",
        "kind": "visualization",
        "uses": ["charts", "report images"],
        "default_enabled": True,
        "note": "Visualization library only.",
    },
    {
        "id": "mplsoccer",
        "package": "mplsoccer",
        "kind": "football-visualization",
        "uses": ["pitches", "shot maps", "heatmaps", "passing networks"],
        "default_enabled": True,
        "note": "Requires event/location data from another source.",
    },
    {
        "id": "socceraction",
        "package": "socceraction",
        "kind": "action-value-model",
        "uses": ["SPADL", "VAEP", "xT"],
        "default_enabled": False,
        "note": "Requires high-quality event data input.",
    },
]


def package_available(package: str) -> bool:
    return importlib.util.find_spec(package) is not None


def check_stack() -> dict[str, Any]:
    items = []
    for item in STACK:
        available = package_available(item["package"])
        items.append(
            {
                **item,
                "installed": available,
                "status": "ready" if available else "missing-package",
            }
        )

    return {
        "ok": True,
        "stack": items,
        "install": "pip install -r requirements-football-analytics.txt",
        "safe_default": "No website scraping or provider calls are made by --check.",
    }


def plot_demo(output: Path) -> dict[str, Any]:
    if not package_available("matplotlib") or not package_available("mplsoccer"):
        return {
            "ok": False,
            "error": "matplotlib and mplsoccer are required for --plot-demo.",
            "install": "pip install -r requirements-football-analytics.txt",
        }

    import matplotlib.pyplot as plt
    from mplsoccer import Pitch

    output.parent.mkdir(parents=True, exist_ok=True)
    pitch = Pitch(pitch_type="statsbomb", pitch_color="#f7faf6", line_color="#1f3a2f")
    fig, ax = pitch.draw(figsize=(10, 6))
    pitch.scatter([102, 95, 78], [38, 44, 30], s=[260, 180, 120], c=["#148458", "#2266a8", "#ca821e"], ax=ax)
    pitch.lines([78, 95], [30, 44], [95, 102], [44, 38], lw=3, color="#2266a8", ax=ax)
    ax.set_title("Football analytics visualization stack demo", fontsize=14)
    fig.savefig(output, dpi=160, bbox_inches="tight")
    plt.close(fig)

    return {
        "ok": True,
        "output": str(output),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Print package availability and planned capabilities.")
    parser.add_argument("--plot-demo", type=Path, help="Create a simple mplsoccer pitch demo image.")
    args = parser.parse_args()

    if args.plot_demo:
        print(json.dumps(plot_demo(args.plot_demo), ensure_ascii=False, indent=2))
        return

    print(json.dumps(check_stack(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
