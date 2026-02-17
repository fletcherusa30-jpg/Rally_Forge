import SwiftUI

struct ScenarioChart: View {
    let scenarios: RetirementScenarios

    var data: [(String, Double)] {
        [
            ("Worst", scenarios.worstValue),
            ("Median", scenarios.medianValue),
            ("Best", scenarios.bestValue)
        ]
    }

    var maxValue: Double {
        data.map { .1 }.max() ?? 1
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 16) {
            ForEach(data, id: \.0) { item in
                VStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(RFTheme.barGradient)
                        .frame(height: CGFloat(item.1 / maxValue) * 120)

                    Text(item.0)
                        .font(RFTheme.label)
                        .foregroundColor(RFTheme.textMuted)

                    Text("$\(item.1, specifier: "%.0f")")
                        .font(RFTheme.value)
                        .foregroundColor(RFTheme.text)
                }
            }
        }
    }
}
