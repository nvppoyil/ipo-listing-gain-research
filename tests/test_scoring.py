from src.scoring import score_record

def test_incomplete_record_returns_insufficient_data():
    result = score_record({"ipo_name": "Example", "price_high": 100, "lot_size": 10})
    assert result["verdict"] == "INSUFFICIENT DATA"

def test_missing_source_is_warned():
    result = score_record({"ipo_name": "Example", "price_high": 100, "lot_size": 10,
                           "gmp_inr": 10, "qib_subscription": 2, "revenue_cr": 100, "profit_cr": 5})
    assert any("source URL" in w for w in result["warnings"])
