"""Market context adapter. No live index values are inferred when unavailable."""

def analyze_market_context(context: dict | None = None) -> dict:
    context = context or {}
    score = context.get("market_conditions_score")
    try:
        score = float(score) if score not in (None, "") else None
    except (ValueError, TypeError):
        score = None
    return {"score": score, "index_name": context.get("index_name"),
            "index_change_percent": context.get("index_change_percent"),
            "sector": context.get("sector"), "sector_change_percent": context.get("sector_change_percent"),
            "observed_at": context.get("observed_at"), "source_url": context.get("source_url"),
            "warning": "Market context is unknown unless a recent source-attributed record is supplied. This version does not claim a live index feed."}
