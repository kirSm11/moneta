import WidgetKit
import SwiftUI
import AppIntents

private func sharedDefaults() -> UserDefaults? {
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
          let data = try? Data(contentsOf: url),
          let raw = String(data: data, encoding: .isoLatin1),
          let xmlStart = raw.range(of: "<?xml"),
          let xmlEnd = raw.range(of: "</plist>", range: xmlStart.lowerBound..<raw.endIndex) else {
        return UserDefaults(suiteName: "group.com.kirsm11.moneta")
    }
    let xml = String(raw[xmlStart.lowerBound..<xmlEnd.upperBound])
    guard let xmlData = xml.data(using: .utf8),
          let plist = try? PropertyListSerialization.propertyList(from: xmlData, format: nil) as? [String: Any],
          let entitlements = plist["Entitlements"] as? [String: Any],
          let groups = entitlements["com.apple.security.application-groups"] as? [String],
          let group = groups.first else {
        return UserDefaults(suiteName: "group.com.kirsm11.moneta")
    }
    return UserDefaults(suiteName: group)
}

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
    func placeholder(in context: Context) -> Entry { Entry(date: .now, spent: 500, limit: 2000) }

    func snapshot(for configuration: MonetaWidgetConfiguration, in context: Context) async -> Entry {
        entry(configuration)
    }

    func timeline(for configuration: MonetaWidgetConfiguration, in context: Context) async -> Timeline<Entry> {
        Timeline(entries: [entry(configuration)], policy: .after(Date().addingTimeInterval(15 * 60)))
    }

    private func entry(_ configuration: MonetaWidgetConfiguration) -> Entry {
        let defaults = sharedDefaults()
        let spent = defaults?.double(forKey: "todaySpent") ?? 0
        return Entry(date: .now, spent: spent, limit: max(0, configuration.dailyLimit))
    }
}

private let ink = Color(red: 0.045, green: 0.042, blue: 0.055)
private let mustard = Color(red: 0.91, green: 0.68, blue: 0.22)
private let violet = Color(red: 0.48, green: 0.29, blue: 0.88)
private let softWhite = Color.white.opacity(0.92)

struct MonetaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    var entry: Entry

    private var left: Double { entry.limit - entry.spent }
    private var progress: Double {
        guard entry.limit > 0 else { return 0 }
        return min(max(entry.spent / entry.limit, 0), 1)
    }

    var body: some View {
        if family == .systemMedium { medium } else { small }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer(minLength: 8)
            Text(left >= 0 ? "ОСТАЛОСЬ" : "СВЕРХ ЛИМИТА")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .tracking(1.15)
                .foregroundStyle(Color.white.opacity(0.48))
            Text(money(abs(left)))
                .font(.system(size: 27, weight: .heavy, design: .rounded))
                .foregroundStyle(left >= 0 ? mustard : softWhite)
                .minimumScaleFactor(0.62)
                .lineLimit(1)
            Spacer(minLength: 9)
            progressBar
            HStack(spacing: 3) {
                Text("Потрачено").foregroundStyle(Color.white.opacity(0.48))
                Spacer()
                Text(money(entry.spent)).foregroundStyle(softWhite).fontWeight(.semibold)
            }
            .font(.system(size: 10, design: .rounded))
            .padding(.top, 6)
        }
        .padding(15)
        .containerBackground(for: .widget) { background }
    }

    private var medium: some View {
        HStack(spacing: 17) {
            VStack(alignment: .leading, spacing: 0) {
                header
                Spacer()
                Text(left >= 0 ? "Можно потратить сегодня" : "Лимит превышен")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.48))
                Text(money(abs(left)))
                    .font(.system(size: 31, weight: .heavy, design: .rounded))
                    .foregroundStyle(left >= 0 ? mustard : softWhite)
                    .minimumScaleFactor(0.65).lineLimit(1)
            }
            Rectangle().fill(Color.white.opacity(0.08)).frame(width: 1)
            VStack(alignment: .leading, spacing: 9) {
                Spacer()
                stat("ПОТРАЧЕНО", money(entry.spent), violet)
                progressBar
                HStack { Text("ЛИМИТ"); Spacer(); Text(money(entry.limit)) }
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.43))
                Spacer()
            }
        }
        .padding(17)
        .containerBackground(for: .widget) { background }
    }

    private var header: some View {
        HStack(spacing: 7) {
            ZStack {
                RoundedRectangle(cornerRadius: 7, style: .continuous).fill(violet).frame(width: 25, height: 25)
                Text("₽").font(.system(size: 13, weight: .black, design: .rounded)).foregroundStyle(.white)
            }
            Text("МОНЕТА").font(.system(size: 11, weight: .bold, design: .rounded)).tracking(0.7).foregroundStyle(softWhite)
        }
    }

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.09))
                Capsule()
                    .fill(LinearGradient(colors: [violet, mustard], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(5, geo.size.width * progress))
            }
        }.frame(height: 6)
    }

    private func stat(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 9, weight: .bold, design: .rounded)).tracking(0.8).foregroundStyle(Color.white.opacity(0.42))
            Text(value).font(.system(size: 18, weight: .bold, design: .rounded)).foregroundStyle(color).minimumScaleFactor(0.7).lineLimit(1)
        }
    }

    private var background: some View {
        ZStack {
            ink
            RadialGradient(colors: [violet.opacity(0.20), .clear], center: .topTrailing, startRadius: 0, endRadius: 180)
            LinearGradient(colors: [.clear, mustard.opacity(0.055)], startPoint: .top, endPoint: .bottomLeading)
        }
    }

    private func money(_ value: Double) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.maximumFractionDigits = 0; f.groupingSeparator = " "
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
        .description("Дневной лимит минус расходы из карточки «Сегодня».")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct MonetaWidgetBundle: WidgetBundle {
    var body: some Widget { MonetaDailyWidget() }
}
