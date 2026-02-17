import Foundation

struct RetirementScenarios {
    let worstRate: Double
    let worstValue: Double
    let medianRate: Double
    let medianValue: Double
    let bestRate: Double
    let bestValue: Double
}

struct RetirementCalculator {

    func futureValue(P: Double, r: Double, n: Int) -> Double {
        if r == 0 { return P * Double(n) }
        let growth = pow(1 + r, Double(n))
        let fv = P * ((growth - 1) / r)
        return (fv * 100).rounded() / 100
    }

    func scenarios(P: Double, r: Double, n: Int, spread: Double = 0.03) -> RetirementScenarios {
        let worst = r - spread
        let median = r
        let best = r + spread

        return RetirementScenarios(
            worstRate: worst,
            worstValue: futureValue(P: P, r: worst, n: n),
            medianRate: median,
            medianValue: futureValue(P: P, r: median, n: n),
            bestRate: best,
            bestValue: futureValue(P: P, r: best, n: n)
        )
    }
}
