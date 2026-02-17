import SwiftUI

enum RFTheme {
    static let text = Color(red: 0.90, green: 0.91, blue: 0.93)
    static let textMuted = Color(red: 0.61, green: 0.64, blue: 0.67)

    static let card = Color(red: 0.06, green: 0.09, blue: 0.16)

    static let accent = Color(red: 0.98, green: 0.45, blue: 0.09)

    static let heading = Font.system(size: 22, weight: .bold)
    static let subheading = Font.system(size: 16, weight: .medium)
    static let result = Font.system(size: 28, weight: .bold)
    static let label = Font.system(size: 12)
    static let value = Font.system(size: 12, weight: .medium)

    static let barGradient = LinearGradient(
        colors: [Color.orange, Color(red: 0.49, green: 0.18, blue: 0.07)],
        startPoint: .top,
        endPoint: .bottom
    )

    static func inputField(_ label: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundColor(textMuted)
            TextField("", value: value, format: .number)
                .padding(8)
                .background(Color(red: 0.07, green: 0.09, blue: 0.15))
                .cornerRadius(8)
        }
    }

    static func sliderField(_ label: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(alignment: .leading) {
            Text("\(label): \(Int(value.wrappedValue))")
                .font(.caption)
                .foregroundColor(textMuted)
            Slider(value: value, in: range, step: 1)
        }
    }

    static let primaryButton = ButtonStyleConfiguration.Style { config in
        config.label
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(accent)
            .foregroundColor(Color.black)
            .cornerRadius(999)
    }
}
