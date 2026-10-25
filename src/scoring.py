"""Transparent starter score. Not a statistically validated prediction model."""
from typing import Any
from .data_validation import validate_record

DEFAULT_WEIGHTS = {
    "gmp_sentiment": 25, "subscription_demand": 20, "fundamentals_valuation": 20,
    "market_conditions": 15, "recent_listing_comparisons": 10, "data_quality": 10,
}

def _score_gmp(record: dict[str, Any]) -> float | None:
    gmp, price = record.get("gmp_inr"), record.get("price_high")
    if gmp in (None, "") or price in (None, "") or float(price) <= 0:
        return None
    premium_pct = float(gmp) / float(price) * 100
    # Bounded heuristic scale; GMP is unofficial and receives only its configured weight.
    return max(0.0, min(100.0, 50.0 + premium_pct * 2))

def _score_subscription(record: dict[str, Any]) -> float | None:
    values = [record.get(k) for k in ("qib_subscription", "nii_subscription", "retail_subscription")]
    values = [float(x) for x in values if x not in (None, "")]
    if not values:
        return None
    # Convert log-scale demand into a bounded, modest signal.
    import math
    mean = sum(values) / len(values)
    return max(0.0, min(100.0, 35 + 18 * math.log10(max(mean, 0.01))))

def _score_fundamentals(record: dict[str, Any]) -> float | None:
    vals = [record.get("revenue_cr"), record.get("profit_cr"), record.get("valuation_pe")]
    if all(x in (None, "") for x in vals):
        return None
    score = 50.0
    revenue, profit, pe = record.get("revenue_cr"), record.get("profit_cr"), record.get("valuation_pe")
    if revenue not in (None, "") and float(revenue) > 0:
        score += 10
    if profit not in (None, ""):
        score += 15 if float(profit) > 0 else -20
    if pe not in (None, ""):
        score += 10 if 0 < float(pe) <= 25 else (-10 if float(pe) > 60 else 0)
    debt = record.get("net_debt_cr")
    if debt not in (None, "") and float(debt) > 0:
        score -= 5
    return max(0.0, min(100.0, score))

def score_record(record: dict[str, Any], weights: dict[str, float] | None = None) -> dict[str, Any]:
    weights = weights or DEFAULT_WEIGHTS
    warnings = validate_record(record)
    evidence = {
        "gmp_sentiment": _score_gmp(record),
        "subscription_demand": _score_subscription(record),
        "fundamentals_valuation": _score_fundamentals(record),
        # These should be populated by dedicated, timestamped collectors in later stages.
        "market_conditions": record.get("market_conditions_score"),
        "recent_listing_comparisons": record.get("recent_listing_score"),
        "data_quality": max(0.0, 100.0 - 20.0 * len(warnings)),
    }
    available = [(key, float(val), float(weights.get(key, 0)))
                 for key, val in evidence.items() if val is not None and float(weights.get(key, 0)) > 0]
    total_weight = sum(w for _, _, w in available)
    score = sum(v * w for _, v, w in available) / total_weight if total_weight else None
    known_fundamentals = any(record.get(k) not in (None, "") for k in ("revenue_cr", "profit_cr", "valuation_pe"))
    known_gmp = record.get("gmp_inr") not in (None, "")
    known_subscription = any(record.get(k) not in (None, "") for k in ("qib_subscription", "nii_subscription", "retail_subscription", "total_subscription"))
    if warnings and (any(x.startswith("Missing critical field") for x in warnings)
                     or any("stale" in x.casefold() for x in warnings)
                     or any("timestamp" in x.casefold() for x in warnings)
                     or any("source URL" in x for x in warnings)
                     or any(x.startswith("No source URL") or x.startswith("No observation timestamp")
                            or x.startswith("Observation timestamp") for x in warnings)):
        verdict = "INSUFFICIENT DATA"
    elif not (known_gmp and known_subscription and known_fundamentals):
        verdict = "INSUFFICIENT DATA"
    elif score is None:
        verdict = "INSUFFICIENT DATA"
    elif len(warnings) >= 3:
        verdict = "INSUFFICIENT DATA"
    elif score >= 70 and total_weight >= 85 and len(warnings) <= 1:
        verdict = "CONSIDER"
    elif score >= 70:
        verdict = "MONITOR"
    elif score >= 50:
        verdict = "MONITOR"
    else:
        verdict = "AVOID"
    return {"score": round(score, 2) if score is not None else None,
            "verdict": verdict, "component_scores": evidence, "warnings": warnings,
            "available_weight_percent": round(total_weight, 2),
            "important_note": "Heuristic screening only; not probability of profit or investment advice."}
