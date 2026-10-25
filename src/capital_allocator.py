"""Whole-lot capital allocation."""
from dataclasses import dataclass

@dataclass
class Allocation:
    capital_inr: float
    reserve_percent: float
    investable_inr: float
    lot_cost_inr: float
    affordable_lots: int
    shares: int
    invested_inr: float
    unused_investable_inr: float

def calculate_allocation(capital_inr: float, price_per_share: float, lot_size: int,
                         reserve_percent: float = 10, one_lot_max: bool = False) -> Allocation:
    if capital_inr < 0:
        raise ValueError("Capital cannot be negative")
    if price_per_share <= 0 or lot_size <= 0:
        raise ValueError("Price and lot size must be positive")
    if not 0 <= reserve_percent < 100:
        raise ValueError("Reserve percent must be from 0 to less than 100")
    investable = capital_inr * (1 - reserve_percent / 100)
    lot_cost = price_per_share * lot_size
    lots = int(investable // lot_cost)
    if one_lot_max:
        lots = min(lots, 1)
    invested = lots * lot_cost
    return Allocation(capital_inr, reserve_percent, investable, lot_cost, lots,
                      lots * lot_size, invested, investable - invested)
