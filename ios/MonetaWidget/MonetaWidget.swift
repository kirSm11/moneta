import WidgetKit
import SwiftUI
import AppIntents

private let appGroup = "group.com.kirsm11.moneta"

struct MonetaWidgetConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Дневной лимит"
    static var description = IntentDescription("Сколько можно потратить за день.")

    @Parameter(title: "Лимит, ₽", default: 2000)
    var dailyLimit: Double
}

struct Entry: TimelineEntry {
    let date: Date
    let spent: Double
    let limit: Double
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now, spent: 1240, limit: 2000) }

    func snapshot(for configuration: MonetaWidgetConfiguration, in context: Context) async -> Entry {
        entry(configuration)
    }

    func timeline(for configuration: MonetaWidgetConfiguration, in context: Context) async -> Timeline<Entry> {
        let e = entry(configuration)
        return Timeline(entries: [e], policy: .after(Date().addingTimeInterval(15 * 60)))
    }

    private func entry(_ configuration: MonetaWidgetConfiguration) -> Entry {
        let defaults = UserDefaults(suiteName: appGroup)
        let storedDate = defaults?.string(forKey: "todayDate") ?? ""
        let df = DateFormatter()
        df.calendar = Calendar(identifier: .gregorian)
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        let today = df.string(from: .now)
        let spent = storedDate == today ? (defaults?.double(forKey: "todaySpent") ?? 0) : 0
        return Entry(date: .now, spent: spent, limit: max(0, configuration.dailyLimit))
    }
}

struct MonetaWidgetView: View {
    var entry: Entry
    private var left: Double { entry.limit - entry.spent }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("МОНЕТА").font(.caption.bold())
                Spacer()
                Image(systemName: "rublesign.circle.fill")
            }
            Spacer()
            Text(money(entry.spent))
                .font(.title2.bold())
                .minimumScaleFactor(0.7)
            Text("потрачено сегодня")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Text(left >= 0 ? "Осталось" : "Сверх лимита")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(money(abs(left))).font(.caption.bold())
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }

    private func money(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.groupingSeparator = " "
        return (f.string(from: NSNumber(value: value)) ?? "0") + " ₽"
    }
}

struct MonetaDailyWidget: Widget {
    let kind = "MonetaDailyWidget"
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: MonetaWidgetConfiguration.self, provider: Provider()) { entry in
            MonetaWidgetView(entry: entry)
        }
        .configurationDisplayName("Монета · Сегодня")
        .description("Расходы за день и сколько осталось до дневного лимита.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct MonetaWidgetBundle: WidgetBundle {
    var body: some Widget { MonetaDailyWidget() }
}
