import pytest
from src.capital_allocator import calculate_allocation
from src.risk_manager import downside_scenarios
from src.pnl_calculator import simulate_pnl
from src.transaction_costs import estimate_exit_costs
from src.listing_plan import build_listing_plan

def test_allocation_with_reserve():
    result = calculate_allocation(20000, 1000, 10, reserve_percent=10)
    assert result.affordable_lots == 1
    assert result.invested_inr == 10000
    assert result.unused_investable_inr == 8000

def test_one_lot_max():
    result = calculate_allocation(100000, 1000, 10, reserve_percent=0, one_lot_max=True)
    assert result.affordable_lots == 1

def test_bad_lot_raises():
    with pytest.raises(ValueError):
        calculate_allocation(10000, 100, 0)

def test_downside_scenarios():
    result = downside_scenarios(10000)
    assert [x['gross_pnl_inr'] for x in result] == [-500, -1000, -1500, -2000]

def test_pnl_and_break_even():
    result = simulate_pnl(10, 100, 120, estimated_costs_inr=20)
    assert result['gross_pnl_inr'] == 200
    assert result['net_pnl_inr'] == 180
    assert result['break_even_sell_price_inr'] == 102

def test_exit_cost_estimate_includes_delivery_stt_and_fixed_dp_charge():
    result = estimate_exit_costs(10, 100, {"depository_charge_inr": 10})
    assert result["stt_inr"] == 1.0
    assert result["depository_inr"] == 10
    assert result["total_inr"] > result["stt_inr"]
    assert result["source_url"].startswith("https://")

def test_downside_listing_plan_prices_costs_at_scenario_sell_price():
    result = build_listing_plan({"price_high": 100}, 10)
    down20 = next(s for s in result["scenarios"] if s["move_percent"] == -20)
    assert down20["scenario_sell_price_inr"] == 80
    assert down20["net_pnl_inr"] < down20["gross_pnl_inr"]
