# IPO Listing-Gain Research Automation

A **manual-trigger-only** GitHub Actions starter for researching Indian mainboard IPOs for listing-day scenarios. It contains no HTML dashboard, no scheduled workflow, no broker connection, and no order placement.

## Status of this version

This is a manual-run research pipeline. Official exchange IPO pages are collected best-effort; fields not available from accessible public pages must be entered with their own URLs and observation times. It does not claim a complete live data feed.

Implemented in this package:

- Manual `workflow_dispatch` inputs for research mode, selected IPO, capital, reserve, downside scenario, and lot sizing.
- Best-effort table discovery from public NSE and BSE IPO pages where normal HTTP access and page structure permit it.
- Explicit source URLs, retrieval timestamps, source-access status, basic freshness checks, missing-data warnings, and SME exclusion when the source explicitly identifies an SME issue.
- CSV fields for source-attributed GMP, subscription, fundamentals, and market context. Unavailable values are not invented.
- Starter heuristic score and the four verdict labels: `CONSIDER`, `MONITOR`, `AVOID`, and `INSUFFICIENT DATA`.
- Flexible capital and whole-lot calculation, reserve option, -5/-10/-15/-20 percent price-loss scenarios, and hypothetical listing price scenarios.
- Markdown, JSON, and CSV reports, plus a snapshot artifact.
- Comparison against the most recent prior workflow artifact when the GitHub Actions token can read artifacts.
- Historical outcome summary from `data/listing_outcomes.csv` (the outcome rows are not automatically populated yet).
- Automated unit tests covering calculations, source parsing, data quality, and manual-run comparison.

Not yet completed or verified end-to-end:

- Reliable automatic discovery of all eligible issues from all exchanges on every run.
- Automatic GMP history across multiple independent sources.
- Automatic category-level subscription collection and reconciliation.
- Automatic extraction and validation of prospectus financials and valuations.
- A reliable live NIFTY/sector data collector and actual listing-day price feed.
- A fully broker-specific transaction charge calculation. Current exit estimates use editable assumptions; brokerage and depository charges vary by broker.
- Automatic collection of actual listing outcomes and statistically meaningful backtesting.

The NSE/BSE collectors parse permitted public HTML on a best-effort basis. A page can be blocked, changed, or rendered dynamically; those cases will appear as source warnings. This code intentionally does not bypass CAPTCHAs, authentication, paywalls, or access controls. It must report missing data rather than inventing a recommendation.

## Run from GitHub

1. In GitHub, open **Actions** > **IPO Listing-Gain Research** > **Run workflow**.
2. In GitHub, open **Actions** → **IPO Listing-Gain Research** → **Run workflow**.
3. Wait for the run to complete; download the `ipo-research-<run number>` artifact.

The YAML has only `workflow_dispatch`; there is no `schedule` trigger. The workflow does not push changes to the repository. Prior-run comparisons use artifacts where accessible, with a 90-day retention period.

## Modes

- `ALL_MAINBOARD_IPOS` — collect candidates and assess available data.
- `OPEN_IPOS` — filter records whose issue status is open.
- `FINAL_DAY_REVIEW` — filter records marked as final day/closing today.
- `SELECTED_IPO` — search collected records by company name or symbol.
- `LISTING_DAY_REVIEW` — review a selected IPO using available data.

Selected/listing-day modes require an IPO name or symbol. The filter can only return IPOs found by discovery or recorded in the CSV.

## Source-attributed input

The `data/manual_research.csv` header documents supported fields. Use it for fields the public sources did not supply automatically. Provide ISO 8601 timestamps for each observation and field-specific source URLs for GMP, subscription, fundamentals, market context, and recent-listing comparisons. A general source URL is not a substitute.

Initial reference sources include:

- NSE upcoming IPO issues: https://www.nseindia.com/market-data/all-upcoming-issues-ipo
- BSE IPO public issues: https://www.bseindia.com/markets/PublicIssues/IPOIssues_new.aspx?id=1&Type=p
- SEBI Public Issues filings: https://www.sebi.gov.in/filings/public-issues.html
- Zerodha Varsity for background education: https://zerodha.com/varsity/

Source accessibility is checked at runtime; the presence of a URL in the catalog does not mean the source is currently available or provides a particular data field.

## Risk and scoring rules

- A `CONSIDER` verdict is not a promise or probability of profit. Heuristic weights in `config/scoring_weights.yaml` are starting assumptions, not validated coefficients.
- Critical missing or stale information can force `INSUFFICIENT DATA` regardless of score.
- GMP is unofficial. Its implied listing price is only a scenario.
- -20% is a modeled downside scenario, **not a maximum-loss limit**. Actual losses can be larger.
- Net P&L uses an indicative exit-only estimate configured in `config/settings.yaml`. STT, SEBI fee and GST assumptions are referenced to the [NSE levy schedule](https://www.nseindia.com/static/invest/first-time-investor-sebi-turnover-fees-stt-other-levies); exchange, brokerage and depository estimates may differ by broker or venue. Income tax and slippage are excluded. Verify the live tariff before use.
- Historical accuracy uses only outcomes manually recorded in `data/listing_outcomes.csv`; no listing prices or outcomes are fabricated or auto-imported.
- This tool is research support, not personalized financial advice.

## Local tests

```bash
pip install -r requirements.txt
python -m pytest -q
python -m src.main
```

Historical accuracy uses only outcomes manually recorded in `data/listing_outcomes.csv`. Add realized listing and first-day close/net P&L with decision time and source attribution; reports summarize supplied outcomes and show the sample size.

## Repository privacy warning

Workflow inputs, logs, and artifacts may be visible to people with repository read access. Check the repository visibility and artifact access policy before running with personal capital or sensitive research data.

## Folder structure

```text
.github/workflows/ipo-research.yml   Manual-only workflow
config/settings.yaml                 Data freshness and run defaults
config/scoring_weights.yaml          Starter scoring weights
data/manual_research.csv             Source-attributed input rows
data/listing_outcomes.csv            Historical outcome tracker input
src/discovery.py                     Official-page IPO candidate discovery
src/official_issue_data.py           Public official-page collection and table parsing
src/data_validation.py               Freshness, completeness, and type checks
src/sources.py                       Source catalog and availability probe
src/gmp_tracker.py                   GMP interpretation
src/subscription.py                  Subscription category summary
src/fundamentals.py                  Fundamental risk flags
src/market_conditions.py              Market context adapter
src/scoring.py                       Score and verdict safeguards
src/ranking.py                       Candidate ranking
src/capital_allocator.py             Flexible whole-lot allocation
src/risk_manager.py                  Downside scenarios
src/pnl_calculator.py                P&L scenario calculations
src/transaction_costs.py             Configurable indicative listing-sale charges
src/listing_plan.py                  Conditional listing-day scenarios
src/monitoring.py                    Prior-artifact change detection
src/report_generator.py              Report generator facade
src/research.py                      Pipeline orchestration and exports
src/performance_evaluator.py          Historical outcome summary
tests/                               Unit tests
```
