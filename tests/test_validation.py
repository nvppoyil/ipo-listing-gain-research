from datetime import datetime, timedelta, timezone
from src.data_validation import validate_record


def test_stale_source_is_flagged():
    old = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    warnings = validate_record({"ipo_name": "Example", "price_high": 100, "lot_size": 10,
                                "source_url": "https://example.test", "observed_at": old})
    assert any("stale" in warning.lower() for warning in warnings)


def test_missing_gmp_timestamp_is_flagged():
    warnings = validate_record({"ipo_name": "Example", "price_high": 100, "lot_size": 10,
                                "source_url": "https://example.test", "observed_at": datetime.now(timezone.utc).isoformat(),
                                "gmp_inr": 12})
    assert any("GMP has no separate observation timestamp" in warning for warning in warnings)

def test_unattributed_gmp_is_flagged():
    warnings = validate_record({"ipo_name": "Example", "price_high": 100, "lot_size": 10,
                                "source_url": "https://example.test", "observed_at": datetime.now(timezone.utc).isoformat(),
                                "gmp_inr": 12, "gmp_observed_at": datetime.now(timezone.utc).isoformat()})
    assert "GMP has no field-specific source URL" in warnings

def test_malformed_field_source_url_is_flagged():
    warnings = validate_record({"ipo_name": "Example", "price_high": 100, "lot_size": 10,
                                "source_url": "https://example.test", "observed_at": datetime.now(timezone.utc).isoformat(),
                                "gmp_inr": 12, "gmp_source_url": "not-a-url", "gmp_observed_at": datetime.now(timezone.utc).isoformat()})
    assert "gmp_source_url must be an absolute HTTP(S) source URL" in warnings
