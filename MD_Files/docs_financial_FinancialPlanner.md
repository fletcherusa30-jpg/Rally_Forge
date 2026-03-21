# FINANCIAL PLANNER – STRATEGIC DESIGN
Rally Forge – Financial Intelligence Module  
Version 1.0

## Purpose
A unified financial intelligence system combining:
- Budget Planner (short-term cash flow)
- Retirement Planner (long-term wealth)
- Strategic Engine (connects monthly behavior to lifetime outcomes)

## Budget Planner
Tracks:
- Income
- Fixed expenses
- Variable expenses
- Debt payments
- Savings contributions
- Emergency fund

Outputs:
- Surplus/deficit
- Savings rate
- Debt-to-income ratio
- Emergency fund months
- Budget health score
- Recommendations

## Retirement Planner
Tracks:
- TSP (employee + agency)
- Brokerage/Edward Jones
- Existing balances
- Growth rate
- FERS pension
- VA disability
- CRSC
- Retirement age scenarios

Outputs:
- Total investments at retirement
- FERS monthly pension
- Total monthly income
- Withdrawal need
- Millionaire milestones
- Net-worth projections

## Data Models

### Budget Model
{
  "monthly_income": 0,
  "fixed_expenses": [],
  "variable_expenses": [],
  "debt_payments": [],
  "savings_contributions": [],
  "emergency_fund_balance": 0
}

### Retirement Model
{
  "current_age": 0,
  "retirement_age": 0,
  "service_years": 0,
  "high3_salary": 0,
  "tsp_civilian": 0,
  "tsp_military": 0,
  "tsp_employee_percent": 0,
  "tsp_auto_percent": 0,
  "tsp_match_percent": 0,
  "brokerage_balance": 0,
  "brokerage_monthly": 0,
  "va_monthly": 0,
  "crsc_monthly": 0,
  "return_rate": 0,
  "estimated_monthly_expenses": 0
}

## Calculations

### Budget
surplus = income - expenses  
savings_rate = savings / income  
dti = debt / income  
ef_months = emergency_fund / core_expenses  
score = weighted composite

### Retirement
FV_lump = PV * (1+r)^n  
FV_annuity = C * ((1+r)^n - 1) / r  
FERS = high3 * years * multiplier  
income = FERS + VA + CRSC  
withdrawals_needed = income < expenses

## UI/UX
Two-panel layout:
- Left: Budget Planner
- Right: Retirement Planner
- Top: Summary
- Bottom: Strategic recommendations

END OF DOCUMENT
