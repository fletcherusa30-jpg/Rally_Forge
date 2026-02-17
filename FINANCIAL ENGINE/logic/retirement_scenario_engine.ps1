. \\retirement_math.ps1

function Get-RetirementScenarios {
    param(
        [double] \,
        [double] \,
        [int] \,
        [double] \ = 0.03
    )

    \ = \ - \
    \ = \
    \ = \ + \

    [pscustomobject]@{
        WorstRate   = \
        WorstValue  = Get-FutureValue -Contribution \ -Rate \ -Years \
        MedianRate  = \
        MedianValue = Get-FutureValue -Contribution \ -Rate \ -Years \
        BestRate    = \
        BestValue   = Get-FutureValue -Contribution \ -Rate \ -Years \
    }
}
