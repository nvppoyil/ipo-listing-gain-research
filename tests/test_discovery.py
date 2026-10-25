from datetime import date
from src.discovery import normalize_issue_table_rows


def test_normalize_official_table_row():
    table = {
        "source_url": "https://example.test/official-ipo",
        "retrieved_at": "2026-10-25T10:00:00+00:00",
        "rows": [{"Company Name": "Example Limited", "Symbol": "EXAMPLE",
                  "Offer Start Date": "26-Oct-2026", "Offer End Date": "28-Oct-2026",
                  "Floor price / Offer price": "100 - 110", "Issue Type": "Book Building"}],
    }
    result = normalize_issue_table_rows([table], today=date(2026, 10, 25))
    assert len(result) == 1
    assert result[0]["issue_status"] == "upcoming"
    assert result[0]["price_low"] == 100
    assert result[0]["price_high"] == 110
    assert result[0]["data_quality"] == "OFFICIAL_PAGE_CANDIDATE"


def test_excludes_explicit_sme_rows():
    table = {"source_url": "https://example.test", "retrieved_at": "2026-10-25T10:00:00+00:00",
             "rows": [{"Company Name": "Example SME Limited", "Symbol": "SMEX",
                       "Issue Type": "SME IPO", "Offer Start Date": "26-Oct-2026"}]}
    assert normalize_issue_table_rows([table], today=date(2026, 10, 25)) == []
