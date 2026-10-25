"""Evaluate recorded IPO calls against outcomes, using only rows with supplied outcomes."""
from __future__ import annotations
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def evaluate_outcomes(path: Path | None = None) -> dict:
    path = path or ROOT / "data" / "listing_outcomes.csv"
    if not path.exists():
        return {"observations": 0, "warning": "No historical outcome file found."}
    rows = list(csv.DictReader(path.open(newline="", encoding="utf-8-sig")))
    observed = [r for r in rows if r.get("verdict") and r.get("actual_net_pnl_inr") not in (None, "")]
    by_verdict = {}
    for row in observed:
        entry = by_verdict.setdefault(row["verdict"], {"count": 0, "profitable": 0, "net_pnl_sum_inr": 0.0})
        pnl = float(row["actual_net_pnl_inr"])
        entry["count"] += 1
        entry["profitable"] += int(pnl > 0)
        entry["net_pnl_sum_inr"] += pnl
    for entry in by_verdict.values():
        entry["profit_rate_percent"] = round(100 * entry["profitable"] / entry["count"], 2) if entry["count"] else None
        entry["net_pnl_sum_inr"] = round(entry["net_pnl_sum_inr"], 2)
    return {"observations": len(observed), "by_verdict": by_verdict,
            "warning": "Descriptive historical outcomes only. Small samples are not predictive; avoid look-ahead bias."}
