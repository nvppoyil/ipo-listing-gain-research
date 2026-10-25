"""Manual-run entrypoint. No schedule or trading execution is defined."""
from .research import build_report, write_reports
from .monitoring import compare_reports, fetch_previous_workflow_snapshot


def main() -> None:
    report = build_report()
    previous = fetch_previous_workflow_snapshot()
    report["changes_vs_previous_manual_run"] = compare_reports(previous, report)
    write_reports(report)
    print(f"IPO research run completed: {report['ipo_count']} record(s).")
    print(f"Verdicts: {report['verdict_counts']}")
    print(f"Previous snapshot comparison available: {report['changes_vs_previous_manual_run']['available']}")
    for item in report["results"]:
        print(f"- {item['ipo'].get('ipo_name')}: {item['analysis']['verdict']} (score={item['analysis']['score']})")


if __name__ == "__main__":
    main()
