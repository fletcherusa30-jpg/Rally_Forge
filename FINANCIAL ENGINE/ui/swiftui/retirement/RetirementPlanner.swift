import SwiftUI

struct RetirementPlanner: View {
    @State private var contribution: Double = 15000
    @State private var rate: Double = 0.15
    @State private var years: Double = 20

    @State private var futureValue: Double?
    @State private var scenarios: RetirementScenarios?

    let calc = RetirementCalculator()

    func calculate() {
        futureValue = calc.futureValue(P: contribution, r: rate, n: Int(years))
        scenarios = calc.scenarios(P: contribution, r: rate, n: Int(years))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Retirement Planner")
                .font(RFTheme.heading)

            Group {
                RFTheme.inputField("Annual Contribution", value: )
                RFTheme.inputField("Growth Rate (decimal)", value: )
                RFTheme.sliderField("Years Until Retirement", value: , range: 1...50)
            }

            Button("Calculate", action: calculate)
                .buttonStyle(RFTheme.primaryButton)

            if let fv = futureValue {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Projected Retirement Savings")
                        .font(RFTheme.subheading)
                    Text("$\(fv, specifier: "%.2f")")
                        .font(RFTheme.result)
                }
                .padding(.top, 8)
            }

            if let sc = scenarios {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Scenario Comparison")
                        .font(RFTheme.subheading)
                    ScenarioChart(scenarios: sc)
                }
                .padding(.top, 8)
            }
        }
        .padding()
        .background(RFTheme.card)
        .cornerRadius(12)
    }
}
