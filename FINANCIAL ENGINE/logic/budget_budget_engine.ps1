param(
    [string] \ = '..\data\budget_data.json'
)

# -----------------------------
# LOAD & BASIC UTILITIES
# -----------------------------

function Load-Budget {
    param([string] \)

    \ = Join-Path \ \
    if (-not (Test-Path \)) {
        throw \"Budget file not found: \\"
    }

    return Get-Content \ -Raw | ConvertFrom-Json
}

function Sum-Category {
    param(\)
    if (-not \) { return 0 }
    return (\.PSObject.Properties.Value | Measure-Object -Sum).Sum
}

# -----------------------------
# VALIDATION
# -----------------------------

function Validate-Budget {
    param(\)

    \ = @()

    # Check for negative values
    foreach (\ in 'Income','FixedExpenses','VariableExpenses','AnnualExpenses','Savings') {
        \ = \.\
        if (-not \) { continue }
        foreach (\ in \.PSObject.Properties) {
            if ([double]\.Value -lt 0) {
                \ += \"\.\ cannot be negative.\"
            }
        }
    }

    # Debts
    if (\.Debts) {
        foreach (\ in \.Debts) {
            if (\.Balance -lt 0) { \ += \"Debt '\' has negative balance.\" }
            if (\.InterestRate -lt 0) { \ += \"Debt '\' has negative interest rate.\" }
            if (\.MinPayment -lt 0) { \ += \"Debt '\' has negative minimum payment.\" }
        }
    }

    # Income vs expenses sanity
    \   = Sum-Category \.Income
    \    = Sum-Category \.FixedExpenses
    \ = Sum-Category \.VariableExpenses
    \   = (Sum-Category \.AnnualExpenses) / 12
    \  = Sum-Category \.Savings

    \ = \ + \ + \ + \

    if (\ -le 0) {
        \ += 'Total income must be greater than zero.'
    }

    if (\ -gt (\ * 2)) {
        \ += 'Total expenses exceed 200% of income. Check for data entry errors.'
    }

    return \
}

# -----------------------------
# CORE CALCULATION
# -----------------------------

function Compute-BudgetSummary {
    param(\)

    \   = Sum-Category \.Income
    \    = Sum-Category \.FixedExpenses
    \ = Sum-Category \.VariableExpenses
    \   = (Sum-Category \.AnnualExpenses) / 12
    \  = Sum-Category \.Savings

    \ = \ + \ + \ + \
    \       = \ - \

    # Ratios
    \    = if (\ -gt 0) { \ / \ } else { 0 }
    \ = if (\ -gt 0) { \ / \ } else { 0 }
    \  = if (\ -gt 0) { \ / \ } else { 0 }

    # Emergency fund months
    \ = \ + \
    \ = (\.Savings.EmergencyFund) ? [double]\.Savings.EmergencyFund : 0
    \ = if (\ -gt 0) { \ / \ } else { 0 }
    \ = (\.EmergencyFundTargetMonths) ? [double]\.EmergencyFundTargetMonths : 6

    # Health Score (0–100)
    \ = 100

    # Penalty: savings rate < 15%
    if (\ -lt 0.15) { \ -= 20 }
    # Penalty: fixed > 50% of income
    if (\ -gt 0.5) { \ -= 15 }
    # Penalty: surplus < 0
    if (\ -lt 0) { \ -= 25 }
    # Penalty: emergency fund < target
    if (\ -lt \) { \ -= 20 }

    if (\ -lt 0) { \ = 0 }
    if (\ -gt 100) { \ = 100 }

    return [pscustomobject]@{
        Income                = [math]::Round(\, 2)
        FixedExpenses         = [math]::Round(\, 2)
        VariableExpenses      = [math]::Round(\, 2)
        AnnualExpensesMonthly = [math]::Round(\, 2)
        Savings               = [math]::Round(\, 2)
        TotalExpenses         = [math]::Round(\, 2)
        Surplus               = [math]::Round(\, 2)
        FixedRatio            = [math]::Round(\, 4)
        VariableRatio         = [math]::Round(\, 4)
        SavingsRatio          = [math]::Round(\, 4)
        EmergencyMonths       = [math]::Round(\, 2)
        EmergencyTargetMonths = [math]::Round(\, 2)
        HealthScore           = [math]::Round(\, 0)
    }
}

# -----------------------------
# PROJECTIONS (12-MONTH)
# -----------------------------

function Compute-Projection12 {
    param(\)

    \ = @()
    \ = 0.0

    for (\ = 1; \ -le 12; \++) {
        \ += \.Surplus
        \ += [pscustomobject]@{
            MonthIndex = \
            Surplus    = \.Surplus
            CumSurplus = [math]::Round(\, 2)
        }
    }

    return \
}

# -----------------------------
# DEBT PAYOFF (SNOWBALL)
# -----------------------------

function Compute-DebtSnowball {
    param(
        \,
        \
    )

    if (-not \.Debts -or \.Debts.Count -eq 0) {
        return @()
    }

    # Clone debts
    \ = @()
    foreach (\ in \.Debts) {
        \ += [pscustomobject]@{
            Name        = \.Name
            Balance     = [double]\.Balance
            InterestRate= [double]\.InterestRate
            MinPayment  = [double]\.MinPayment
        }
    }

    # Snowball: smallest balance first
    \ = \ | Sort-Object Balance

    \ = if (\.Surplus -gt 0) { \.Surplus } else { 0 }
    \ = @()
    \ = 0

    while ((\ | Where-Object { \.Balance -gt 0 }).Count -gt 0 -and \ -lt 600) {
        \++

        foreach (\ in \) {
            if (\.Balance -le 0) { continue }

            \ = \.Balance * (\.InterestRate / 12)
            \ = \.MinPayment

            # Apply extra to smallest active debt
            if (\ -eq (\ | Where-Object { \.Balance -gt 0 } | Sort-Object Balance | Select-Object -First 1)) {
                \ += \
            }

            if (\ -gt (\.Balance + \)) {
                \ = \.Balance + \
            }

            \ = \ - \
            \.Balance -= \

            \ += [pscustomobject]@{
                MonthIndex = \
                DebtName   = \.Name
                Payment    = [math]::Round(\, 2)
                Interest   = [math]::Round(\, 2)
                Principal  = [math]::Round(\, 2)
                Balance    = [math]::Round([math]::Max(\.Balance,0), 2)
            }
        }
    }

    return \
}

# -----------------------------
# MAIN EXECUTION
# -----------------------------

\ = Load-Budget -filePath \
\ = Validate-Budget -budget \

if (\.Count -gt 0) {
    Write-Host 'BUDGET VALIDATION ERRORS:' -ForegroundColor Red
    \ | ForEach-Object { Write-Host " - " -ForegroundColor Red }
    Write-Host 'Fix errors in budget_data.json and re-run.' -ForegroundColor Yellow
    exit 1
}

\    = Compute-BudgetSummary -budget \
\ = Compute-Projection12 -summary \
\      = Compute-DebtSnowball -budget \ -summary \

Write-Host '=== BUDGET SUMMARY ===' -ForegroundColor Cyan
\ | Format-List

Write-Host "
=== 12-MONTH PROJECTION (CUMULATIVE SURPLUS) ===" -ForegroundColor Cyan
\ | Format-Table -AutoSize

if (\.Count -gt 0) {
    Write-Host "
=== DEBT SNOWBALL SCHEDULE (FIRST 24 MONTHS) ===" -ForegroundColor Cyan
    \ | Select-Object -First 24 | Format-Table -AutoSize
} else {
    Write-Host "
No debts configured." -ForegroundColor Yellow
}
