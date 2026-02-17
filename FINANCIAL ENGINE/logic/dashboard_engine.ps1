param(
    [string] \C:\Dev\Rally Forge\FINANCIAL ENGINE   = 'C:\Dev\Rally Forge\FINANCIAL ENGINE',
    [string] \C:\Dev\Rally Forge\FINANCIAL ENGINE   = 'C:\Dev\Rally Forge\FINANCIAL ENGINE',
    [string] \   = 'C:\Dev\Rally Forge\FINANCIAL ENGINE'
)

# -----------------------------
# UTILITIES
# -----------------------------

function Load-Json {
    param([string] \C:\Dev\Rally Forge\FINANCIAL ENGINE\ui\react)
    if (-not (Test-Path \C:\Dev\Rally Forge\FINANCIAL ENGINE\ui\react)) { return \ }
    return Get-Content \C:\Dev\Rally Forge\FINANCIAL ENGINE\ui\react -Raw | ConvertFrom-Json
}

function Sum-Category {
    param(\)
    if (-not \) { return 0 }
    return (\.PSObject.Properties.Value | Measure-Object -Sum).Sum
}

# -----------------------------
# LOAD UPSTREAM DATA
# -----------------------------

# Budget data
\ = Join-Path \C:\Dev\Rally Forge\FINANCIAL ENGINE 'data\budget_data.json'
\ = Load-Json \

if (-not \) {
    throw \"Budget data not found at \\"
}

# Net worth data
\ = Join-Path \ 'data\networth_data.json'
\ = Load-Json \

# Savings goals
\ = Join-Path \ 'data\savings_goals.json'
\ = Load-Json \

# Scenarios
\ = Join-Path \ 'data\scenarios.json'
\ = Load-Json \

# Retirement summary (optional, user can generate separately)
\ = Join-Path \C:\Dev\Rally Forge\FINANCIAL ENGINE 'data\retirement_summary.json'
\ = Load-Json \

# -----------------------------
# BUDGET SUMMARY
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

    \    = if (\ -gt 0) { \ / \ } else { 0 }
    \ = if (\ -gt 0) { \ / \ } else { 0 }
    \  = if (\ -gt 0) { \ / \ } else { 0 }

    \ = \ + \
    \ = (\.Savings.EmergencyFund) ? [double]\.Savings.EmergencyFund : 0
    \ = if (\ -gt 0) { \ / \ } else { 0 }
    \ = (\.EmergencyFundTargetMonths) ? [double]\.EmergencyFundTargetMonths : 6

    # Budget Health Score
    \ = 100
    if (\ -lt 0.15) { \ -= 20 }
    if (\ -gt 0.5) { \ -= 15 }
    if (\ -lt 0) { \ -= 25 }
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
        BudgetHealthScore     = [math]::Round(\, 0)
    }
}

# -----------------------------
# NET WORTH SUMMARY
# -----------------------------

function Compute-NetWorth {
    param(\)

    if (-not \) {
        return [pscustomobject]@{
            TotalAssets     = 0
            TotalLiabilities= 0
            NetWorth        = 0
        }
    }

    \ = Sum-Category \.Assets
    \  = Sum-Category \.Liabilities
    \     = \ - \

    return [pscustomobject]@{
        TotalAssets      = [math]::Round(\, 2)
        TotalLiabilities = [math]::Round(\, 2)
        NetWorth         = [math]::Round(\, 2)
    }
}

# -----------------------------
# SAVINGS GOAL PROGRESS
# -----------------------------

function Compute-SavingsProgress {
    param(\)

    if (-not \ -or -not \.Goals) {
        return @()
    }

    \ = Get-Date

    \ = @()
    foreach (\ in \.Goals) {
        \ = [double]\.TargetAmount
        \ = [double]\.CurrentAmount
        \ = if (\ -gt 0) { \ / \ } else { 0 }
        if (\ -gt 1) { \ = 1 }

        \ = [datetime]\.TargetDate
        \ = ((\.Year - \.Year) * 12 + (\.Month - \.Month))
        if (\ -lt 1) { \ = 1 }

        \ = \ - \
        if (\ -lt 0) { \ = 0 }
        \ = \ / \

        \ += [pscustomobject]@{
            Name           = \.Name
            TargetAmount   = [math]::Round(\, 2)
            CurrentAmount  = [math]::Round(\, 2)
            ProgressPct    = [math]::Round(\ * 100, 1)
            TargetDate     = \.ToString('yyyy-MM-dd')
            MonthsLeft     = \
            NeededPerMonth = [math]::Round(\, 2)
        }
    }

    return \
}

# -----------------------------
# CASH-FLOW TIMELINE (12-MONTH)
# -----------------------------

function Compute-CashflowTimeline {
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
# GLOBAL FINANCIAL HEALTH SCORE
# -----------------------------

function Compute-GlobalHealth {
    param(
        \,
        \,
        \
    )

    \ = 100

    # Budget health
    \ += (\.BudgetHealthScore - 70) * 0.5

    # Net worth vs liabilities
    if (\.NetWorth -lt 0) { \ -= 25 }
    elseif (\.NetWorth -lt 100000) { \ -= 10 }

    # Retirement probability if available
    if (\ -and \.ProbabilityOfSuccess) {
        \ = [double]\.ProbabilityOfSuccess
        if (\ -lt 0.7) { \ -= 25 }
        elseif (\ -lt 0.9) { \ -= 10 }
        else { \ += 5 }
    }

    if (\ -lt 0) { \ = 0 }
    if (\ -gt 100) { \ = 100 }

    return [math]::Round(\, 0)
}

# -----------------------------
# SCENARIO EVALUATION (WHAT-IF)
# -----------------------------

function Evaluate-Scenario {
    param(
        \,
        \
    )

    \ = \ | ConvertTo-Json -Depth 10 | ConvertFrom-Json

    \ = [double](\.IncomeMultiplier)
    \ = [double](\.ExpenseMultiplier)

    foreach (\ in \.Income.PSObject.Properties) {
        \.Value = [double]\.Value * \
    }

    foreach (\ in 'FixedExpenses','VariableExpenses','AnnualExpenses','Savings') {
        \ = \.\
        if (-not \) { continue }
        foreach (\ in \.PSObject.Properties) {
            \.Value = [double]\.Value * \
        }
    }

    return Compute-BudgetSummary -budget \
}

# -----------------------------
# MAIN ORCHESTRATION
# -----------------------------

\   = Compute-BudgetSummary -budget \
\ = Compute-NetWorth -networth \
\ = Compute-SavingsProgress -savingsGoals \
\        = Compute-CashflowTimeline -budgetSummary \

# Retirement summary defaults if missing
if (-not \) {
    \ = [pscustomobject]@{
        ProbabilityOfSuccess = \
        LifetimeSpending     = \
        RetirementHealthScore= \
    }
}

\ = Compute-GlobalHealth -budgetSummary \ -networthSummary \ -retireSummary \

# Scenario evaluations
\ = @()
if (\ -and \.Scenarios) {
    foreach (\ in \.Scenarios) {
        \ = Evaluate-Scenario -budget \ -scenario \
        \ += [pscustomobject]@{
            Name    = \.Name
            Surplus = \.Surplus
            Health  = \.BudgetHealthScore
        }
    }
}

# Unified object
\ = [pscustomobject]@{
    BudgetSummary    = \
    NetWorthSummary  = \
    RetirementSummary= \
    GlobalHealth     = \
    CashflowTimeline = \
    SavingsProgress  = \
    Scenarios        = \
}

Write-Host '=== FINANCIAL DASHBOARD SUMMARY ===' -ForegroundColor Cyan
\.BudgetSummary | Format-List

Write-Host "
=== NET WORTH SUMMARY ===" -ForegroundColor Cyan
\.NetWorthSummary | Format-List

Write-Host "
=== GLOBAL HEALTH SCORE ===" -ForegroundColor Cyan
Write-Host \"Global Financial Health Score: \\" -ForegroundColor Yellow

Write-Host "
=== SAVINGS GOALS ===" -ForegroundColor Cyan
if (\.SavingsProgress.Count -gt 0) {
    \.SavingsProgress | Format-Table -AutoSize
} else {
    Write-Host 'No savings goals configured.'
}

Write-Host "
=== CASH-FLOW TIMELINE (12 MONTHS) ===" -ForegroundColor Cyan
\.CashflowTimeline | Format-Table -AutoSize

Write-Host "
=== SCENARIO SNAPSHOT ===" -ForegroundColor Cyan
if (\.Scenarios.Count -gt 0) {
    \.Scenarios | Format-Table -AutoSize
} else {
    Write-Host 'No scenarios configured.'
}

# Export dashboard snapshot to JSON for UI consumption
\ = Join-Path \ 'data\dashboard_snapshot.json'
\ | ConvertTo-Json -Depth 10 | Set-Content -Path \

Write-Host "
Dashboard snapshot written to: \" -ForegroundColor Green

