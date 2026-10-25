"""Basic risk flags from manually extracted prospectus or financial data."""

def analyze_fundamentals(record: dict) -> dict:
    flags, known = [], 0
    revenue, profit, debt, pe = (record.get(k) for k in ("revenue_cr", "profit_cr", "net_debt_cr", "valuation_pe"))
    if revenue not in (None, ""):
        known += 1
        if float(revenue) <= 0: flags.append("Revenue is non-positive; verify the reported period and units.")
    if profit not in (None, ""):
        known += 1
        if float(profit) < 0: flags.append("Reported profit is negative; investigate loss drivers and path to profitability.")
    if debt not in (None, ""):
        known += 1
        if float(debt) > 0: flags.append("Net debt is positive; examine leverage and cash-flow cover.")
    if pe not in (None, ""):
        known += 1
        if float(pe) > 60: flags.append("Reported P/E is above the starter screening threshold; compare peers and profitability quality.")
        elif float(pe) <= 0: flags.append("P/E is not positive or not directly meaningful; verify metric and source.")
    if known == 0: flags.append("No fundamental fields supplied; prospectus-level review is incomplete.")
    return {"fields_available": known, "risk_flags": flags,
            "source_url": record.get("fundamentals_source_url") or record.get("source_url") or None,
            "observed_at": record.get("fundamentals_observed_at") or record.get("observed_at") or None,
            "warning": "This is a preliminary screen, not a full prospectus or valuation opinion."}
