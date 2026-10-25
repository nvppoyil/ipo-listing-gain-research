"""Subscription category summary using values supplied from a cited source."""

def summarize_subscription(record: dict) -> dict:
    categories = {}
    for key, label in (("qib_subscription", "QIB"), ("nii_subscription", "NII"), ("retail_subscription", "Retail")):
        value = record.get(key)
        if value not in (None, ""):
            categories[label] = float(value)
    total = record.get("total_subscription")
    return {"categories_times_subscribed": categories, "reported_total_times": float(total) if total not in (None, "") else None,
            "source_url": record.get("subscription_source_url") or record.get("source_url") or None,
            "observed_at": record.get("subscription_observed_at") or record.get("observed_at") or None,
            "warning": "Subscription multiples depend on source and timestamp. Category demand is not a listing-gain guarantee."}
