"""Price-move loss scenarios. These are scenarios, never loss guarantees."""
def downside_scenarios(invested_inr: float, percentages=(5, 10, 15, 20)) -> list[dict]:
    if invested_inr < 0:
        raise ValueError("Investment cannot be negative")
    output = []
    for pct in percentages:
        if not 0 < float(pct) < 100:
            raise ValueError("Downside percentages must be between 0 and 100")
        output.append({"move_percent": -float(pct), "gross_pnl_inr": round(-invested_inr * float(pct) / 100, 2)})
    return output
