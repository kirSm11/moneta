import WidgetKit
import SwiftUI

private let appGroup = "group.com.kirsm11.moneta"

struct Entry: TimelineEntry {
    let date: Date
    let spentToday: Double
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now, spentToday: 2) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [readEntry()], policy: .after(Date().addingTimeInterval(15 * 60))))
    }

    private func readEntry() -> Entry {
        let defaults = UserDefaults(suiteName: appGroup)
        return Entry(date: .now, spentToday: defaults?.double(forKey: "todaySpent") ?? 0)
    }
}

private let ink = Color(red: 0.045, green: 0.042, blue: 0.055)
private let mustard = Color(red: 0.91, green: 0.68, blue: 0.22)
private let violet = Color(red: 0.48, green: 0.29, blue: 0.88)

struct MonetaWidgetView: View {
    var entry: Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(violet)
                        .frame(width: 26, height: 26)
                    Text("₽")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                }
                Text("МОНЕТА")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .tracking(0.7)
                    .foregroundStyle(.white.opacity(0.92))
                Spacer()
            }

            Spacer()

            Text("СЕГОДНЯ")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(.white.opacity(0.45))

            Text(money(entry.spentToday))
                .font(.system(size: 31, weight: .heavy, design: .rounded))
                .foregroundStyle(mustard)
                .minimumScaleFactor(0.55)
                .lineLimit(1)

            Text("потрачено")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.48))
                .padding(.top, 2)
        }
        .padding(16)
        .containerBackground(for: .widget) {
            ZStack {
                ink
                RadialGradient(colors: [violet.opacity(0.22), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 180)
                LinearGradient(colors: [.clear, mustard.opacity(0.055)],
                               startPoint: .top, endPoint: .bottomLeading)
            }
        }
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
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MonetaWidgetView(entry: entry)
        }
        .configurationDisplayName("Монета · Сегодня")
        .description("Та же сумма «Сегодня», что и в статистике Монеты.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct MonetaWidgetBundle: WidgetBundle {
    var body: some Widget { MonetaDailyWidget() }
}
