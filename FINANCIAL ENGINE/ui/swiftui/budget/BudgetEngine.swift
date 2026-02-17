import Foundation

struct BudgetResult {
    let income: Double
    let total: Double
    let surplus: Double
    let healthScore: Double
}

struct BudgetEngine {
    func calculate() -> BudgetResult {
        let income = 6500 + 4400 + 1600
        let fixed = 1100 + 300 + 250 + 120 + 80
        let variable = 900 + 300 + 200 + 150
        let annual = (300 + 1500 + 1800) / 12
        let savings = 500 + 1500 + 300

        let total = fixed + variable + annual + savings
        let surplus = income - total

        let fixedRatio = income > 0 ? fixed / income : 0
        let savingsRatio = income > 0 ? savings / income : 0

        let monthlyCore = fixed + variable
        let emergencyFund = 500.0
        let emergencyMonths = monthlyCore > 0 ? emergencyFund / monthlyCore : 0
        let targetMonths = 6.0

        var score: Double = 100
        if savingsRatio < 0.15 { score -= 20 }
        if fixedRatio > 0.5 { score -= 15 }
        if surplus < 0 { score -= 25 }
        if emergencyMonths < targetMonths { score -= 20 }
        if score < 0 { score = 0 }
        if score > 100 { score = 100 }

        return BudgetResult(
            income: income,
            total: total,
            surplus: surplus,
            healthScore: score
        )
    }
}
