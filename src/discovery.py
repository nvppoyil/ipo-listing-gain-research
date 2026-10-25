"""Discover IPO candidates from official public pages and user-provided research CSV."""
from __future__ import annotations
from datetime import date, datetime
from zoneinfo import ZoneInfo
import re
from typing import Any
from .official_issue_data import collect_official_issue_tables


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s).casefold()).strip()


def _find(row: dict[str, Any], *needles: str) -> str:
    for key, value in row.items():
        nk = _norm(key)
        if any(n in nk for n in needles) and str(value).strip():
            return str(value).strip()
    return ""


def _parse_price(value: str) -> tuple[float | None, float | None]:
    nums = re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", value.replace(",", ""))
    if not nums:
        return None, None
    vals = [float(x) for x in nums]
    return (min(vals), max(vals)) if len(vals) > 1 else (vals[0], vals[0])


def _parse_date(value: str) -> date | None:
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            pass
    return None


def normalize_issue_table_rows(tables: list[dict[str, Any]], today: date | None = None) -> list[dict[str, Any]]:
    today = today or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for table in tables:
        for row in table.get("rows", []):
            name = _find(row, "company name", "issuer name", "name of company", "company")
            symbol = _find(row, "symbol", "scrip")
            if not name and not symbol:
                continue
            if _norm(name) in {"company name", "symbol", "total", "no records found"}:
                continue
            board = _find(row, "board", "market segment", "platform")
            issue_type = _find(row, "issue type", "ipo type", "category")
            # Do not include rows clearly marked SME. Unlabelled records stay candidates, not verified mainboard IPOs.
            if "sme" in _norm(board) or "sme" in _norm(issue_type) or "sme ipo" in _norm(name):
                continue
            open_raw = _find(row, "offer start date", "issue start date", "open date", "start date")
            close_raw = _find(row, "offer end date", "issue end date", "close date", "end date")
            open_dt, close_dt = _parse_date(open_raw), _parse_date(close_raw)
            if open_dt and close_dt:
                status = "upcoming" if today < open_dt else ("open" if open_dt <= today <= close_dt else "closed")
            else:
                status = "unknown"
            price_raw = _find(row, "price band", "price range", "floor price", "offer price", "price")
            low, high = _parse_price(price_raw)
            lot_raw = _find(row, "market lot", "lot size", "lot")
            lot_nums = re.findall(r"\d+", lot_raw.replace(",", ""))
            lot = int(lot_nums[0]) if lot_nums else None
            issue_size = _find(row, "issue size", "issue amount")
            key = (_norm(symbol) or _norm(name))
            if not key or key in seen:
                continue
            seen.add(key)
            items.append({"ipo_name": name or symbol, "symbol": symbol, "source_url": table.get("source_url", ""),
                "observed_at": table.get("retrieved_at", ""), "issue_status": status,
                "open_date": open_raw, "close_date": close_raw, "price_low": low, "price_high": high,
                "lot_size": lot, "issue_size_cr": None, "board_status": "mainboard_unverified" if not board else board,
                "gmp_inr": None, "qib_subscription": None, "nii_subscription": None, "retail_subscription": None,
                "total_subscription": None, "revenue_cr": None, "profit_cr": None, "net_debt_cr": None,
                "valuation_pe": None, "data_quality": "OFFICIAL_PAGE_CANDIDATE", "notes": "Auto-discovered candidate. Confirm mainboard eligibility and missing fields before relying on it."})
    return items


def discover_ipo_candidates(timeout: int = 12) -> dict[str, Any]:
    fetched = collect_official_issue_tables(timeout=timeout)
    candidates = normalize_issue_table_rows(fetched["tables"])
    return {"collected_at": fetched["collected_at"], "candidates": candidates,
            "sources": fetched["sources"], "warnings": [fetched["note"]] +
            (["No IPO rows could be extracted from official HTML pages in this run."] if not candidates else [])}
