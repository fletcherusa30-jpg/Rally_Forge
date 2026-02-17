import SwiftUI

struct BudgetPlanner: View {
    @State private var result: BudgetResult?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(\"Budget Planner\")
                .font(.system(size: 22, weight: .bold))

            Button(\"Calculate\") {
                result = BudgetEngine().calculate()
            }

            if let r = result {
                VStack(alignment: .leading, spacing: 4) {
                    Text(\"Income: $\(r.income, specifier: \"%.2f\")\")
                    Text(\"Expenses: $\(r.total, specifier: \"%.2f\")\")
                    Text(\"Surplus: $\(r.surplus, specifier: \"%.2f\")\")
                        .foregroundColor(r.surplus >= 0 ? .green : .red)
                    Text(\"Health Score: \(r.healthScore, specifier: \"%.0f\")\")
                        .foregroundColor(.yellow)
                }
            }
        }
        .padding()
        .background(Color(red: 0.02, green: 0.04, blue: 0.09))
        .cornerRadius(12)
    }
}
