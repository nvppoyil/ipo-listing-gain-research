"""Conditional scenario planner using issue price and disclosed GMP as optional input."""
from .pnl_calculator import simulate_pnl
from .transaction_costs import estimate_exit_costs


def build_listing_plan(record: dict, shares: int, estimated_costs_inr: float = 0.0,
                       cost_assumptions: dict | None = None) -> dict:
    base = record.get("price_high")
    if base in (None, "") or shares <= 0:
        return {"available": False, "warning": "A valid issue price and allocated share count are needed."}
    base = float(base)
    scenarios = []
    for move in (-20, -15, -10, -5, 0, 5, 10, 15, 20, 25):
        price = round(base * (1 + move / 100), 2)
        costs = estimate_exit_costs(shares, price, cost_assumptions)["total_inr"]
        scenarios.append({"move_percent": move, "scenario_sell_price_inr": price,
                          "estimated_exit_costs_inr": costs,
                          **simulate_pnl(shares, base, price, costs)})
    gmp = record.get("gmp_inr")
    if gmp not in (None, ""):
        price = base + float(gmp)
        costs = estimate_exit_costs(shares, price, cost_assumptions)["total_inr"]
        scenarios.append({"scenario": "unofficial_gmp_implied", "move_percent": round(float(gmp) / base * 100, 2),
                          "scenario_sell_price_inr": round(price, 2),
                          "estimated_exit_costs_inr": costs,
                          **simulate_pnl(shares, base, price, costs)})
    return {"available": True, "base_issue_price_inr": base, "scenarios": scenarios,
            "estimated_costs_inr": estimate_exit_costs(shares, base, cost_assumptions)["total_inr"],
            "plan": {"strong": "Recheck live price, spreads, liquidity and the market; do not chase an unsupported gap.",
                     "flat": "Reassess actual demand and liquidity; the issue price is not guaranteed support.",
                     "weak": "Prioritize capital protection and consider no trade. Loss can exceed the modeled downside.",
                     "no_trade_conditions": ["unreliable live price", "stale/conflicting source data", "wide spreads or poor liquidity", "market dislocation"]},
            "warning": "Scenarios are hypothetical, costs are estimates, and no order is placed."}
