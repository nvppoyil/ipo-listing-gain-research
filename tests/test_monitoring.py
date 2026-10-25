from src.monitoring import compare_reports


def test_no_prior_report_is_reported():
    result = compare_reports(None, {"results": []})
    assert result["available"] is False


def test_verdict_changes_are_detected():
    previous = {"run_at_utc": "before", "results": [{"ipo": {"symbol": "ABC"}, "analysis": {"verdict": "MONITOR", "score": 61}, "allocation": None}]}
    current = {"run_at_utc": "after", "results": [{"ipo": {"symbol": "ABC"}, "analysis": {"verdict": "CONSIDER", "score": 72}, "allocation": None}]}
    result = compare_reports(previous, current)
    assert result["available"] is True
    assert result["changes"][0]["fields"][0] == {"field": "verdict", "old": "MONITOR", "new": "CONSIDER"}
