"""Best-effort access to publicly reachable official IPO pages.

This module only makes normal HTTP GET requests. It does not bypass access
controls, CAPTCHAs, authentication, paywalls, or JavaScript protections.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
import requests
from bs4 import BeautifulSoup

OFFICIAL_ISSUE_SOURCES = [
    {"name": "NSE upcoming IPO issues", "url": "https://www.nseindia.com/market-data/all-upcoming-issues-ipo", "source_type": "official_exchange"},
    {"name": "BSE IPO public issues", "url": "https://www.bseindia.com/markets/PublicIssues/IPOIssues_new.aspx?id=1&Type=p", "source_type": "official_exchange"},
]


def fetch_public_page(url: str, timeout: int = 12, user_agent: str = "IPOListingGainResearch/0.1") -> dict[str, Any]:
    retrieved_at = datetime.now(timezone.utc).isoformat()
    try:
        response = requests.get(url, timeout=timeout, headers={"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml"})
        result: dict[str, Any] = {"url": url, "retrieved_at": retrieved_at, "http_status": response.status_code,
                                  "accessible": response.ok, "content_type": response.headers.get("content-type", "")}
        if response.ok and "html" in result["content_type"].lower():
            result["html"] = response.text
        elif response.ok:
            result["warning"] = "HTTP response was not recognized as HTML; not parsed."
        else:
            result["warning"] = "Source returned a non-success HTTP status; no data inferred."
        return result
    except requests.RequestException as exc:
        return {"url": url, "retrieved_at": retrieved_at, "accessible": False,
                "error": type(exc).__name__, "warning": "Source unavailable from this runner; use another permitted source or manual verification."}


def extract_html_tables(html: str, source_url: str, retrieved_at: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    tables = []
    for table_index, table in enumerate(soup.find_all("table")):
        rows = []
        for tr in table.find_all("tr"):
            cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["th", "td"])]
            if cells and any(cells):
                rows.append(cells)
        if len(rows) < 2:
            continue
        headers = [h.strip() for h in rows[0]]
        # Only accept tables with a likely issue/company column; avoid unrelated page tables.
        normalized = " ".join(headers).casefold()
        if not any(k in normalized for k in ("company", "symbol", "issue", "ipo")):
            continue
        width = len(headers)
        entries = []
        for row in rows[1:]:
            padded = row[:width] + [""] * max(0, width - len(row))
            entries.append({headers[i] or f"column_{i+1}": padded[i] for i in range(width)})
        tables.append({"source_url": source_url, "retrieved_at": retrieved_at,
                       "table_index": table_index, "headers": headers, "rows": entries})
    return tables


def collect_official_issue_tables(timeout: int = 12) -> dict[str, Any]:
    all_tables: list[dict[str, Any]] = []
    source_checks: list[dict[str, Any]] = []
    for source in OFFICIAL_ISSUE_SOURCES:
        result = fetch_public_page(source["url"], timeout=timeout)
        check = {k: v for k, v in result.items() if k != "html"}
        check["name"] = source["name"]
        source_checks.append(check)
        if result.get("html"):
            all_tables.extend(extract_html_tables(result["html"], source["url"], result["retrieved_at"]))
    return {"collected_at": datetime.now(timezone.utc).isoformat(), "sources": source_checks,
            "tables": all_tables, "note": "HTML table parsing is best-effort. Missing tables or blocked pages are reported, not guessed."}
