"""Indicative exchange-exit charges for an IPO allottee's listing-day sale.

Rates are configurable assumptions. Brokerage and depository charges vary by
broker; exchange charges vary by venue and may change. Income tax is excluded.
"""
from __future__ import annotations

DEFAULTS = {
    "stt_sell_percent": 0.10,
    "exchange_transaction_percent": 0.003,
    "sebi_turnover_percent": 0.0001,
    "gst_percent": 18.0,
    "brokerage_percent": 0.0,
    "brokerage_cap_inr": 20.0,
    "depository_charge_inr": 15.93,
}

SOURCE_URL = "https://www.nseindia.com/static/invest/first-time-investor-sebi-turnover-fees-stt-other-levies"


def estimate_exit_costs(shares: int, sell_price_inr: float,
                        assumptions: dict | None = None) -> dict:
    if shares < 0 or sell_price_inr < 0:
        raise ValueError("Shares and sell price cannot be negative")
    supplied = assumptions or {}
    rates = {**DEFAULTS, **{k: supplied[k] for k in DEFAULTS if k in supplied}}
    if any(float(v) < 0 for v in rates.values()):
        raise ValueError("Cost assumptions cannot be negative")
    turnover = shares * sell_price_inr
    stt = turnover * rates["stt_sell_percent"] / 100
    exchange = turnover * rates["exchange_transaction_percent"] / 100
    sebi = turnover * rates["sebi_turnover_percent"] / 100
    brokerage = min(turnover * rates["brokerage_percent"] / 100,
                    rates["brokerage_cap_inr"])
    gst = (exchange + sebi + brokerage) * rates["gst_percent"] / 100
    dp = rates["depository_charge_inr"] if shares else 0.0
    parts = {"stt_inr": stt, "exchange_transaction_inr": exchange,
             "sebi_turnover_inr": sebi, "brokerage_inr": brokerage,
             "gst_inr": gst, "depository_inr": dp}
    return {**{k: round(v, 2) for k, v in parts.items()},
            "total_inr": round(sum(parts.values()), 2),
            "sell_turnover_inr": round(turnover, 2),
            "assumptions": rates,
            "source_url": SOURCE_URL,
            "warning": "Indicative exit-only estimate. STT, SEBI fee, and GST assumptions are based on the cited schedule; exchange, brokerage, and depository estimates may differ by broker/venue. Verify your tariff. Excludes income tax and slippage."}
