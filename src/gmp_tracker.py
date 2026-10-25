"""Interpret user-supplied or source-attributed GMP observations; no GMP is fabricated."""
from datetime import datetime, timezone


def analyze_gmp(gmp_inr, issue_price, observed_at="", source_url=""):
    if gmp_inr in (None, "") or issue_price in (None, "") or float(issue_price) <= 0:
        return {"available": False, "warning": "GMP or issue price is missing; no GMP inference made."}
    gmp, price = float(gmp_inr), float(issue_price)
    implied = price + gmp
    return {"available": True, "gmp_inr": gmp, "issue_price_inr": price,
            "implied_listing_price_inr": round(implied, 2),
            "implied_premium_percent": round(gmp / price * 100, 2),
            "observed_at": observed_at or None, "source_url": source_url or None,
            "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "warning": "GMP is unofficial and indicative only; it is not an exchange price or guaranteed listing outcome."}
