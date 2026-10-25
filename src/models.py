"""Typed lightweight models and decision labels for IPO research."""
from dataclasses import dataclass, asdict
from typing import Any

VERDICTS = ("CONSIDER", "MONITOR", "AVOID", "INSUFFICIENT DATA")

@dataclass
class IPORecord:
    ipo_name: str
    symbol: str = ""
    source_url: str = ""
    observed_at: str = ""
    issue_status: str = "unknown"
    open_date: str = ""
    close_date: str = ""
    listing_date: str = ""
    price_low: float | None = None
    price_high: float | None = None
    lot_size: int | None = None
    issue_size_cr: float | None = None
    gmp_inr: float | None = None
    gmp_observed_at: str = ""
    qib_subscription: float | None = None
    nii_subscription: float | None = None
    retail_subscription: float | None = None
    total_subscription: float | None = None
    revenue_cr: float | None = None
    profit_cr: float | None = None
    net_debt_cr: float | None = None
    valuation_pe: float | None = None
    sector: str = ""
    notes: str = ""
    data_quality: str = "MANUAL/UNVERIFIED"
    warnings: list[str] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
