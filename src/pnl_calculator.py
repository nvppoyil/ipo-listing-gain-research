"""Simple gross P&L simulator with user-configurable estimated costs."""
def simulate_pnl(shares: int, buy_price: float, sell_price: float,
                 estimated_costs_inr: float = 0.0) -> dict:
    if shares < 0 or buy_price < 0 or sell_price < 0 or estimated_costs_inr < 0:
        raise ValueError("Shares, prices, and costs cannot be negative")
    gross = (sell_price - buy_price) * shares
    net = gross - estimated_costs_inr
    break_even = (buy_price * shares + estimated_costs_inr) / shares if shares else None
    invested = buy_price * shares
    return {
        "shares": shares, "buy_price_inr": buy_price, "sell_price_inr": sell_price,
        "invested_inr": round(invested, 2), "gross_pnl_inr": round(gross, 2),
        "estimated_costs_inr": round(estimated_costs_inr, 2), "net_pnl_inr": round(net, 2),
        "return_percent": round(net / invested * 100, 2) if invested else None,
        "break_even_sell_price_inr": round(break_even, 4) if break_even is not None else None,
        "costs_are_estimates": True,
    }
