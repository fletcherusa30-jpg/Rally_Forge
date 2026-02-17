# Financial Engine Specification

## Inputs

### From Budget Tab
- budget_data.json
  - Income
  - FixedExpenses
  - VariableExpenses
  - AnnualExpenses
  - Savings
  - Debts
  - EmergencyFundTargetMonths

### From Retirement Tab
- retirement_summary.json (if present)
  - TotalInvestmentAssets
  - OtherAssets
  - Liabilities
  - ProbabilityOfSuccess
  - LifetimeSpending
  - RetirementHealthScore (optional)

### Local Data
- networth_data.json
- savings_goals.json
- scenarios.json

## Outputs

- Unified summary:
  - Monthly surplus/deficit
  - Net worth
  - Debt load
  - Savings progress
  - Retirement probability
  - Global Financial Health Score (0–100)
- 12-month cash-flow timeline
- Scenario evaluation (what-if hooks)
