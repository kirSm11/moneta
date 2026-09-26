import WidgetKit
import SwiftUI
import AppIntents

private let appGroupID = "group.com.kirsm11.moneta.shared"
private let widgetKind = "MonetaDailyBudget"

struct DailyLimitIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Лимит на день"
    static var description = IntentDescription("Укажи, сколько можно потратить за день.")

    @Parameter(title: "Лимит на день, ₽", default: 1500)
    var dailyLimit: Int

    static var parameterSummary: some ParameterSummary {
        Summary("Лимит: \(\.$dailyLimit) ₽")
    }
}

struct MonetaEntry: TimelineEntry {
    let date: Date
    let spent: Double
    let limit: Double

    var remaining: Double { limit - spent }
    var progress: Double { limit > 0 ? min(max(spent / limit, 0), 1) : 0 }
}

struct MonetaProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> MonetaEntry {
        MonetaEntry(date: Date(), spent: 620, limit: 1500)
    }

    func snapshot(for configuration: DailyLimitIntent, in context: Context) async -> MonetaEntry {
        makeEntry(configuration)
    }

    func timeline(for configuration: DailyLimitIntent, in context: Context) async -> Timeline<MonetaEntry> {
        let entry = makeEntry(configuration)
        let nextMidnight = Calendar.current.startOfDay(for: Date()).addingTimeInterval(24 * 60 * 60 + 60)
        return Timeline(entries: [entry], policy: .after(nextMidnight))
    }

    private func makeEntry(_ configuration: DailyLimitIntent) -> MonetaEntry {
        let shared = UserDefaults(suiteName: appGroupID)
        let storedDate = shared?.string(forKey: "spentDate")
        let today = Self.localDateString(Date())
        let spent = storedDate == today ? (shared?.double(forKey: "spentToday") ?? 0) : 0
        let limit = max(0, Double(configuration.dailyLimit))
        return MonetaEntry(date: Date(), spent: spent, limit: limit)
    }

    private static func localDateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = .current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

struct MonetaWidgetView: View {
    let entry: MonetaEntry

    private var over: Bool { entry.remaining < 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("MONETA")
                    .font(.caption2.weight(.black))
                    .tracking(1.0)
                    .foregroundStyle(Color(red: 0.95, green: 0.76, blue: 0.29))
                Spacer()
                Text("сегодня")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Потрачено")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(rubles(entry.spent))
                    .font(.title3.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(over ? "Сверх лимита" : "Осталось")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(rubles(abs(entry.remaining)))
                    .font(.title2.weight(.black))
                    .foregroundStyle(over ? .red : .primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.62)
            }

            ProgressView(value: entry.progress)
                .tint(over ? .red : Color(red: 0.95, green: 0.76, blue: 0.29))

            Text("Лимит \(rubles(entry.limit))")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .containerBackground(for: .widget) {
            Color(red: 0.055, green: 0.055, blue: 0.067)
        }
    }

    private func rubles(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = value.rounded() == value ? 0 : 2
        f.locale = Locale(identifier: "ru_RU")
        return (f.string(from: NSNumber(value: value)) ?? "0") + " ₽"
    }
}

struct MonetaDailyBudgetWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: widgetKind, intent: DailyLimitIntent.self, provider: MonetaProvider()) { entry in
            MonetaWidgetView(entry: entry)
        }
        .configurationDisplayName("Расходы за день")
        .description("Показывает, сколько потрачено сегодня и сколько осталось от дневного лимита.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct MonetaWidgetBundle: WidgetBundle {
    var body: some Widget {
        MonetaDailyBudgetWidget()
    }
}
