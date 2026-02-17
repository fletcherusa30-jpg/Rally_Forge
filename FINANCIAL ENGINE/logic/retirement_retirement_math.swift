import Foundation

struct RetirementMath {
    func futureValue(P: Double, r: Double, n: Int) -> Double {
        if r == 0 { return P * Double(n) }
        let growth = pow(1 + r, Double(n))
        let fv = P * ((growth - 1) / r)
        return (fv * 100).rounded() / 100
    }

    func scenarios(P: Double, r: Double, n: Int, spread: Double = 0.03) -> [String: Double] {
        return [
            ""worstRate"": r - spread,
            ""worstValue"": futureValue(P: P, r: r - spread, n: n),
            ""medianRate"": r,
            ""medianValue"": futureValue(P: P, r: r, n: n),
            ""bestRate"": r + spread,
            ""bestValue"": futureValue(P: P, r: r + spread, n: n)
        ]
    }
}
