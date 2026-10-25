"""Catalog of primary and contextual sources; access is tested at run time."""
from datetime import datetime, timezone
from typing import Any
import requests

SOURCES = [
    {"name": "NSE upcoming IPO issues", "url": "https://www.nseindia.com/market-data/all-upcoming-issues-ipo", "type": "official_exchange", "purpose": "Issue discovery and official issue detail where published"},
    {"name": "BSE IPO public issues", "url": "https://www.bseindia.com/markets/PublicIssues/IPOIssues_new.aspx?id=1&Type=p", "type": "official_exchange", "purpose": "Issue discovery and official issue detail where published"},
    {"name": "SEBI Public Issues", "url": "https://www.sebi.gov.in/filings/public-issues.html", "type": "regulatory", "purpose": "Prospectus and regulatory filing lookup"},
    {"name": "Zerodha Varsity", "url": "https://zerodha.com/varsity/", "type": "education", "purpose": "Investor education and context; not primary source for issue facts"},
]


def source_catalog() -> list[dict[str, Any]]:
    return [{**item, "catalog_checked_at": datetime.now(timezone.utc).isoformat(), "access_status": "not_checked_in_catalog"} for item in SOURCES]


def check_public_url(url: str, timeout: int = 10, user_agent: str = "IPOListingGainResearch/0.1") -> dict[str, Any]:
    """A polite availability probe only; never bypasses site protections."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        response = requests.get(url, timeout=timeout, headers={"User-Agent": user_agent})
        return {"url": url, "retrieved_at": now, "http_status": response.status_code,
                "accessible": response.ok, "content_type": response.headers.get("content-type", ""),
                "note": "HTTP accessibility does not prove the page contains current structured IPO data."}
    except requests.RequestException as exc:
        return {"url": url, "retrieved_at": now, "http_status": None, "accessible": False,
                "error": type(exc).__name__, "note": "Source unavailable from this run; no value was inferred."}
