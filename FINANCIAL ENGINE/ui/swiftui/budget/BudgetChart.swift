import SwiftUI

struct BudgetChart: View {
    let result: BudgetResult

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(\"Income: $\(result.income, specifier: \"%.2f\")\")
            Text(\"Expenses: $\(result.total, specifier: \"%.2f\")\")
            Text(\"Surplus: $\(result.surplus, specifier: \"%.2f\")\")
                .foregroundColor(result.surplus >= 0 ? .green : .red)
        }
    }
}
