"""Data quality and validation safeguards."""
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

REQUIRED_FOR_BASIC_REVIEW = ("ipo_name", "price_high", "lot_size")

def validate_record(record: dict[str, Any], max_age_hours: float = 36) -> list[str]:
    warnings: list[str] = []
    for key in REQUIRED_FOR_BASIC_REVIEW:
        if record.get(key) in (None, ""):
            warnings.append(f"Missing critical field: {key}")
    if record.get("price_low") is not None and record.get("price_high") is not None:
        if float(record["price_low"]) > float(record["price_high"]):
            warnings.append("Price band is invalid: low exceeds high")
    if record.get("lot_size") is not None and int(record["lot_size"]) <= 0:
        warnings.append("Lot size must be a positive integer")
    for key in ("gmp_inr", "qib_subscription", "nii_subscription", "retail_subscription", "total_subscription"):
        value = record.get(key)
        if value not in (None, ""):
            try:
                float(value)
            except (TypeError, ValueError):
                warnings.append(f"Invalid numeric value for {key}")
    if not record.get("source_url"):
        warnings.append("No source URL recorded")
    for field in ("source_url", "gmp_source_url", "subscription_source_url", "fundamentals_source_url", "market_source_url", "recent_listing_source_url"):
        value = record.get(field)
        if value and (urlparse(str(value)).scheme not in ("http", "https") or not urlparse(str(value)).netloc):
            warnings.append(f"{field} must be an absolute HTTP(S) source URL")
    if not record.get("observed_at"):
        warnings.append("No observation timestamp recorded")
    else:
        observed = parse_iso_datetime(str(record.get("observed_at")))
        if observed is None:
            warnings.append("Observation timestamp is not parseable ISO 8601")
        elif (datetime.now(timezone.utc) - observed.astimezone(timezone.utc)).total_seconds() > max_age_hours * 3600:
            warnings.append(f"Source observation is stale (older than {max_age_hours:g} hours)")
        elif observed.astimezone(timezone.utc) > datetime.now(timezone.utc):
            warnings.append("Source observation timestamp is in the future")
    if any(record.get(k) not in (None, "") for k in ("qib_subscription", "nii_subscription", "retail_subscription", "total_subscription")):
        if not record.get("subscription_observed_at"):
            warnings.append("Subscription data has no separate observation timestamp")
        elif parse_iso_datetime(str(record.get("subscription_observed_at"))) is None:
            warnings.append("Subscription observation timestamp is not parseable ISO 8601")
        elif (datetime.now(timezone.utc) - parse_iso_datetime(str(record.get("subscription_observed_at"))).astimezone(timezone.utc)).total_seconds() > max_age_hours * 3600:
            warnings.append(f"Subscription observation is stale (older than {max_age_hours:g} hours)")
    if any(record.get(k) not in (None, "") for k in ("revenue_cr", "profit_cr", "net_debt_cr", "valuation_pe")):
        if not record.get("fundamentals_observed_at"):
            warnings.append("Fundamental data has no separate observation timestamp")
        elif parse_iso_datetime(str(record.get("fundamentals_observed_at"))) is None:
            warnings.append("Fundamentals observation timestamp is not parseable ISO 8601")
        elif (datetime.now(timezone.utc) - parse_iso_datetime(str(record.get("fundamentals_observed_at"))).astimezone(timezone.utc)).total_seconds() > max_age_hours * 3600:
            warnings.append(f"Fundamentals observation is stale (older than {max_age_hours:g} hours)")
    if any(record.get(k) not in (None, "") for k in ("market_conditions_score", "index_name", "index_change_percent", "sector_change_percent")):
        if not record.get("market_observed_at") or not record.get("market_source_url"):
            warnings.append("Market context needs its own source URL and observation timestamp")
    if record.get("recent_listing_score") not in (None, ""):
        if not record.get("recent_listing_observed_at") or not record.get("recent_listing_source_url"):
            warnings.append("Recent listing comparisons need their own source URL and observation timestamp")
    if record.get("gmp_inr") not in (None, ""):
        if not record.get("gmp_source_url"):
            warnings.append("GMP has no field-specific source URL")
        if not record.get("gmp_observed_at"):
            warnings.append("GMP has no separate observation timestamp")
        else:
            gmp_time = parse_iso_datetime(str(record.get("gmp_observed_at")))
            if gmp_time is None:
                warnings.append("GMP observation timestamp is not parseable ISO 8601")
            elif (datetime.now(timezone.utc) - gmp_time.astimezone(timezone.utc)).total_seconds() > max_age_hours * 3600:
                warnings.append(f"GMP observation is stale (older than {max_age_hours:g} hours)")
    if any(record.get(k) not in (None, "") for k in ("qib_subscription", "nii_subscription", "retail_subscription", "total_subscription")) and not record.get("subscription_source_url"):
        warnings.append("Subscription data has no field-specific source URL")
    if any(record.get(k) not in (None, "") for k in ("revenue_cr", "profit_cr", "net_debt_cr", "valuation_pe")) and not record.get("fundamentals_source_url"):
        warnings.append("Fundamentals have no field-specific source URL")
    return warnings

def parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None
