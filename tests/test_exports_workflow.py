from pathlib import Path

from src import research


def test_workflow_is_manual_only_and_has_no_trading_steps():
    root = Path(__file__).resolve().parents[1]
    workflow = (root / ".github" / "workflows" / "ipo-research.yml").read_text(encoding="utf-8")
    assert "workflow_dispatch:" in workflow
    assert "schedule:" not in workflow
    assert "push:" not in workflow
    assert "broker" not in workflow.casefold()
    assert "place_order" not in workflow.casefold()


def test_report_export_writes_json_markdown_csv_and_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(research, "ROOT", tmp_path)
    report = {
        "run_at_utc": "2026-10-25T00:00:00+00:00", "research_mode": "ALL_MAINBOARD_IPOS",
        "ipo_count": 0, "capital_inr": 20000, "reserve_percent": 10,
        "results": [], "limitations": [], "discovery_summary": {"source_checks": [], "warnings": []},
        "historical_accuracy": {"observations": 0, "by_verdict": {}, "warning": "No outcomes."},
    }
    research.write_reports(report)
    assert len(list((tmp_path / "reports").glob("ipo-report-*.json"))) == 1
    assert len(list((tmp_path / "reports").glob("ipo-report-*.md"))) == 1
    assert len(list((tmp_path / "reports").glob("ipo-report-*.csv"))) == 1
    assert len(list((tmp_path / "data" / "snapshots").glob("snapshot-*.json"))) == 1
