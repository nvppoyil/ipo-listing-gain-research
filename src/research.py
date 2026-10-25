"""Load permitted manual research CSV, analyze it, and prepare safe reports."""
from __future__ import annotations
import csv, json, os
import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from .capital_allocator import calculate_allocation
from .pnl_calculator import simulate_pnl
from .risk_manager import downside_scenarios
from .scoring import score_record
from .sources import source_catalog
from .discovery import discover_ipo_candidates
from .gmp_tracker import analyze_gmp
from .subscription import summarize_subscription
from .fundamentals import analyze_fundamentals
from .market_conditions import analyze_market_context
from .listing_plan import build_listing_plan
from .ranking import rank_results
from .transaction_costs import estimate_exit_costs
from .performance_evaluator import evaluate_outcomes

ROOT = Path(__file__).resolve().parents[1]

def _cost_assumptions() -> dict[str, float]:
    settings = yaml.safe_load((ROOT / "config" / "settings.yaml").read_text(encoding="utf-8"))
    return settings.get("transaction_costs", {})

def _num(value: str | None) -> float | None:
    if value is None or not str(value).strip(): return None
    try: return float(value)
    except (TypeError, ValueError): return None

def load_manual_records(path: Path | None = None) -> list[dict[str, Any]]:
    path = path or ROOT / "data" / "manual_research.csv"
    if not path.exists(): return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    numeric = {"price_low", "price_high", "lot_size", "issue_size_cr", "gmp_inr", "qib_subscription", "nii_subscription", "retail_subscription", "total_subscription", "revenue_cr", "profit_cr", "net_debt_cr", "valuation_pe", "market_conditions_score", "index_change_percent", "sector_change_percent", "recent_listing_score"}
    for row in rows:
        for key in numeric:
            row[key] = _num(row.get(key))
        row["lot_size"] = int(row["lot_size"]) if row.get("lot_size") is not None else None
    return [row for row in rows if row.get("ipo_name")]

def _merge_records(manual: list[dict[str, Any]], discovered: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Prefer manually verified fields, using official-page discovery as a candidate source."""
    merged: dict[str, dict[str, Any]] = {}
    def record_key(row: dict[str, Any]) -> str:
        return str(row.get("symbol") or row.get("ipo_name") or "").casefold().strip()
    for row in discovered + manual:
        key = record_key(row)
        if not key:
            continue
        if key not in merged:
            merged[key] = dict(row)
        else:
            # Later (manual) record values win when present; discovery fills absent fields.
            existing = merged[key]
            for field, value in row.items():
                if value not in (None, ""):
                    existing[field] = value
    return list(merged.values())

def analyze_record(record: dict[str, Any], capital: float, reserve: float, downside: float, lot_mode: str) -> dict[str, Any]:
    scored = score_record(record)
    price = record.get("price_high")
    lot = record.get("lot_size")
    if price and lot:
        allocation = calculate_allocation(capital, float(price), int(lot), reserve, lot_mode == "ONE_LOT_MAX")
        alloc_dict = allocation.__dict__
        assumptions = _cost_assumptions()
        costs = estimate_exit_costs(allocation.shares, float(price), assumptions)
        pnl = simulate_pnl(allocation.shares, float(price), float(price), costs["total_inr"])
        risks = []
        for scenario in downside_scenarios(allocation.invested_inr):
            exit_price = float(price) * (1 + scenario["move_percent"] / 100)
            scenario_costs = estimate_exit_costs(allocation.shares, exit_price, assumptions)
            risks.append({**scenario, "estimated_exit_costs_inr": scenario_costs["total_inr"],
                          "net_pnl_inr": round(scenario["gross_pnl_inr"] - scenario_costs["total_inr"], 2)})
        plan = build_listing_plan(record, allocation.shares, costs["total_inr"], assumptions)
    else:
        alloc_dict, pnl, risks, plan = None, None, [], {"available": False, "warning": "Issue price or lot size is missing."}
        scored["warnings"].append("Capital and P&L calculations unavailable until valid price and lot size are supplied.")
        if scored["verdict"] != "AVOID":
            scored["verdict"] = "INSUFFICIENT DATA"
    return {
        "ipo": record, "analysis": scored, "allocation": alloc_dict, "flat_price_pnl": pnl,
        "transaction_cost_estimate": costs if price and lot else None,
        "downside_scenarios": risks, "highlighted_downside_percent": downside,
        "gmp_analysis": analyze_gmp(record.get("gmp_inr"), price, record.get("gmp_observed_at"), record.get("gmp_source_url") or record.get("source_url")),
        "subscription_analysis": summarize_subscription(record),
        "fundamentals_analysis": analyze_fundamentals(record),
        "market_analysis": analyze_market_context({**record, "observed_at": record.get("market_observed_at"), "source_url": record.get("market_source_url")}),
        "listing_day_plan": plan,
    }

def _filter_records(records: list[dict[str, Any]], mode: str, selected: str) -> list[dict[str, Any]]:
    if mode in ("SELECTED_IPO", "LISTING_DAY_REVIEW"):
        if not selected:
            return []
        records = [r for r in records if selected.casefold() in str(r.get("ipo_name", "")).casefold()
                   or selected.casefold() == str(r.get("symbol", "")).casefold()]
    elif mode == "OPEN_IPOS":
        records = [r for r in records if str(r.get("issue_status", "")).casefold() == "open"]
    elif mode == "FINAL_DAY_REVIEW":
        records = [r for r in records if str(r.get("issue_status", "")).casefold() in ("final day", "final_day", "closing today")]
    return records

def build_report() -> dict[str, Any]:
    mode = os.getenv("RESEARCH_MODE", "ALL_MAINBOARD_IPOS")
    selected = os.getenv("SELECTED_IPO", "").strip()
    capital = float(os.getenv("CAPITAL_INR", "20000"))
    reserve = float(os.getenv("RESERVE_PERCENT", "10"))
    downside = float(os.getenv("MAX_DOWNSIDE_PERCENT", "20"))
    lot_mode = os.getenv("LOT_MODE", "AUTO_WHOLE_LOTS")
    run_at = datetime.now(timezone.utc).isoformat()
    discovery = discover_ipo_candidates()
    manual = load_manual_records()
    records = _merge_records(manual, discovery.get("candidates", []))
    records = _filter_records(records, mode, selected)
    results = [analyze_record(r, capital, reserve, downside, lot_mode) for r in records]
    results = rank_results(results)
    for result in results:
        result["data_sources"] = sorted({result["ipo"].get(key) for key in
            ("source_url", "gmp_source_url", "subscription_source_url", "fundamentals_source_url",
             "market_source_url", "recent_listing_source_url") if result["ipo"].get(key)})
    counts = {v: sum(1 for r in results if r["analysis"]["verdict"] == v) for v in ("CONSIDER", "MONITOR", "AVOID", "INSUFFICIENT DATA")}
    return {
        "app": "IPO Listing-Gain Research", "run_at_utc": run_at, "research_mode": mode,
        "selected_ipo": selected or None, "capital_inr": capital, "reserve_percent": reserve,
        "highlighted_downside_percent": downside, "lot_mode": lot_mode,
        "input_source": "Official public-page candidates plus data/manual_research.csv",
        "discovery_summary": {"candidate_count": len(discovery.get("candidates", [])),
                              "source_checks": discovery.get("sources", []), "warnings": discovery.get("warnings", [])},
        "source_catalog": source_catalog(), "ipo_count": len(results), "verdict_counts": counts,
        "historical_accuracy": evaluate_outcomes(),
        "results": results,
        "limitations": [
            "Official NSE/BSE discovery uses best-effort parsing of permitted public HTML pages; access or page-layout changes may yield no candidates.",
            "Automatic GMP history, detailed subscription category extraction, prospectus financial extraction, and live listing prices are not yet verified collectors; those fields require cited records in data/manual_research.csv when unavailable.",
            "Every automatically discovered row is only a candidate until mainboard eligibility and required fields are verified.",
            "No live listing price is used in this version; listing-day scenarios are hypothetical.",
            "GMP is unofficial and may be inaccurate or stale.",
            "Heuristic scores are not statistically validated probabilities of profit.",
            "Downside scenarios are not maximum-loss guarantees.",
            "No trades are placed and no broker is connected."
        ]
    }

def write_reports(report: dict[str, Any]) -> None:
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "data" / "snapshots").mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = ROOT / "reports" / f"ipo-report-{stamp}.json"
    md_path = ROOT / "reports" / f"ipo-report-{stamp}.md"
    csv_path = ROOT / "reports" / f"ipo-report-{stamp}.csv"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = ["# IPO Listing-Gain Research Report", "", f"- Run time (UTC): {report['run_at_utc']}",
             f"- Mode: {report['research_mode']}", f"- IPO records assessed: {report['ipo_count']}",
             f"- Capital input: ₹{report['capital_inr']:,.2f}", f"- Reserve: {report['reserve_percent']}%", "",
             "> **Important:** Official-page discovery is best-effort; missing or unverified fields remain flagged. This is research support, not a guarantee of gains.", ""]
    if not report["results"]: lines += ["## No eligible records found", "The official pages yielded no matching candidates or the selected filter returned none. Add source-attributed rows to `data/manual_research.csv` and manually re-run the workflow.", ""]
    for item in report["results"]:
        ipo, analysis = item["ipo"], item["analysis"]
        lines += [f"## {ipo.get('ipo_name', 'Unknown IPO')} ({ipo.get('symbol') or 'symbol unavailable'})", "",
                  f"**Verdict:** {analysis['verdict']}  ", f"**Score:** {analysis['score'] if analysis['score'] is not None else 'N/A'} / 100", "",
                  f"**Source:** {ipo.get('source_url') or 'Not supplied'}", "",
                  "### Warnings", *([f"- {w}" for w in analysis["warnings"]] or ["- None from basic checks"]), "",
                  "### Capital and downside", f"- Allocation: {item['allocation'] or 'Unavailable'}",
                  f"- Indicative exit charges: {item.get('transaction_cost_estimate') or 'Unavailable'}",
                  f"- Downside scenarios: {item['downside_scenarios']}", "",
                  "### GMP and demand", f"- GMP analysis: {item['gmp_analysis']}", f"- Subscription analysis: {item['subscription_analysis']}", "",
                  "### Fundamentals and market", f"- Fundamentals: {item['fundamentals_analysis']}", f"- Market: {item['market_analysis']}", "",
                  "### Listing-day scenarios", f"- Plan: {item['listing_day_plan']}", ""]
    lines += ["## Official source discovery", ""]
    discovery = report.get("discovery_summary", {})
    for source in discovery.get("source_checks", []):
        lines.append(f"- {source.get('name', 'Source')}: HTTP {source.get('http_status', 'unavailable')} — {source.get('url', '')} (retrieved {source.get('retrieved_at', 'time unavailable')})")
    for warning in discovery.get("warnings", []):
        lines.append(f"- Warning: {warning}")
    accuracy = report.get("historical_accuracy", {})
    lines += ["", "## Historical outcomes", f"- Recorded outcomes evaluated: {accuracy.get('observations', 0)}",
              f"- Summary by verdict: {accuracy.get('by_verdict', {})}",
              f"- Note: {accuracy.get('warning', 'No outcome data available.')}"]
    lines += ["", "## System limitations", *[f"- {x}" for x in report["limitations"]], ""]
    md_path.write_text("\n".join(lines), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        fields = ["ipo_name", "symbol", "issue_status", "open_date", "close_date", "listing_date",
                  "verdict", "score", "price_low", "price_high", "lot_size", "capital_inr", "invested_inr",
                  "estimated_exit_costs_inr", "gmp_inr", "gmp_observed_at", "qib_subscription", "nii_subscription",
                  "retail_subscription", "total_subscription", "subscription_observed_at", "revenue_cr", "profit_cr",
                  "net_debt_cr", "valuation_pe", "fundamentals_observed_at", "market_conditions_score",
                  "market_observed_at", "recent_listing_score", "recent_listing_observed_at", "warnings",
                  "source_url", "gmp_source_url", "subscription_source_url", "fundamentals_source_url",
                  "market_source_url", "recent_listing_source_url"]
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader()
        for item in report["results"]:
            writer.writerow({"ipo_name": item["ipo"].get("ipo_name"), "symbol": item["ipo"].get("symbol"),
                "verdict": item["analysis"].get("verdict"), "score": item["analysis"].get("score"),
                **{field: item["ipo"].get(field) for field in fields if field in item["ipo"]},
                "capital_inr": report["capital_inr"], "invested_inr": (item["allocation"] or {}).get("invested_inr"),
                "estimated_exit_costs_inr": (item.get("transaction_cost_estimate") or {}).get("total_inr"),
                "warnings": " | ".join(item["analysis"].get("warnings", [])), "source_url": item["ipo"].get("source_url"),
                "gmp_source_url": item["ipo"].get("gmp_source_url"), "subscription_source_url": item["ipo"].get("subscription_source_url"),
                "fundamentals_source_url": item["ipo"].get("fundamentals_source_url")})
    (ROOT / "data" / "snapshots" / f"snapshot-{stamp}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
