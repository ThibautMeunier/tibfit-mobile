import WidgetKit
import SwiftUI

// MARK: - Shared data model (via App Group UserDefaults)

struct WidgetSession: Codable {
    let id: Int
    let titre: String
    let duree_minutes: Int
    let sport: String?
    let emoji: String?
    let zone: String?
}

// MARK: - Timeline

struct WidgetEntry: TimelineEntry {
    let date: Date
    let sessions: [WidgetSession]
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), sessions: [
            WidgetSession(id: 0, titre: "Sortie longue", duree_minutes: 90,
                          sport: "Course à pied", emoji: "🏃", zone: "Z3"),
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let entry = loadEntry()
        let nextMidnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 1),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }

    private func loadEntry() -> WidgetEntry {
        let defaults = UserDefaults(suiteName: "group.com.tibfit.app")
        let json = defaults?.string(forKey: "widget_sessions") ?? "[]"
        let sessions = (try? JSONDecoder().decode([WidgetSession].self, from: Data(json.utf8))) ?? []
        return WidgetEntry(date: Date(), sessions: sessions)
    }
}

// MARK: - Design tokens (Bloc direction)

private let bgColor   = Color(red: 0.039, green: 0.039, blue: 0.059)   // #0A0A0F
private let cardColor = Color(red: 0.086, green: 0.086, blue: 0.122)   // #16161F
private let textMain  = Color(red: 0.941, green: 0.941, blue: 0.973)
private let textSub   = Color(red: 0.941, green: 0.941, blue: 0.973).opacity(0.6)
private let textDim   = Color(red: 0.941, green: 0.941, blue: 0.973).opacity(0.35)

private func zoneColor(_ zone: String?) -> Color {
    switch zone {
    case "Z1": return Color(red: 0.557, green: 0.557, blue: 0.604)  // #8E8E9A
    case "Z2": return Color(red: 0.086, green: 0.639, blue: 0.290)  // #16A34A
    case "Z3": return Color(red: 0.918, green: 0.702, blue: 0.031)  // #EAB308
    case "Z4": return Color(red: 0.976, green: 0.451, blue: 0.086)  // #F97316
    case "Z5": return Color(red: 0.937, green: 0.267, blue: 0.267)  // #EF4444
    default:   return Color(red: 0.557, green: 0.557, blue: 0.604)
    }
}

private func zoneLabel(_ zone: String?) -> String {
    switch zone {
    case "Z1": return "Endurance légère"
    case "Z2": return "Base aérobie"
    case "Z3": return "Tempo"
    case "Z4": return "Seuil"
    case "Z5": return "VO₂ max"
    default:   return zone ?? ""
    }
}

// MARK: - Entry view

struct TibFitWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            BlocSmallView(sessions: entry.sessions)
        default:
            BlocMediumView(sessions: entry.sessions)
        }
    }
}

// MARK: - Bloc Small

struct BlocSmallView: View {
    let sessions: [WidgetSession]

    var body: some View {
        let s = sessions.first
        let col = zoneColor(s?.zone)
        let deepLink = s.flatMap { URL(string: "tibfit://session/\($0.id)") }

        ZStack(alignment: .topLeading) {
            if s != nil {
                LinearGradient(
                    stops: [
                        .init(color: col.opacity(0.15), location: 0),
                        .init(color: col.opacity(0.04), location: 0.6),
                        .init(color: bgColor, location: 1)
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            } else {
                LinearGradient(
                    colors: [Color(red: 0.102, green: 0.102, blue: 0.157), bgColor],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            }

            VStack(alignment: .leading, spacing: 0) {
                if let s = s {
                    HStack(alignment: .top) {
                        Text(s.emoji ?? "🏃").font(.system(size: 24))
                        Spacer()
                        if let zone = s.zone {
                            Text(zone)
                                .font(.system(size: 9, weight: .black))
                                .foregroundColor(.white)
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(col)
                                .cornerRadius(6)
                        }
                    }
                    Spacer()
                    Text(s.titre)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(textMain)
                        .lineLimit(2)
                    HStack(alignment: .lastTextBaseline, spacing: 2) {
                        Text("\(s.duree_minutes)")
                            .font(.system(size: 24, weight: .black))
                            .foregroundColor(col)
                        Text("min")
                            .font(.system(size: 11))
                            .foregroundColor(textSub)
                    }
                } else {
                    Text("TIBFIT")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(textDim)
                    Spacer()
                    Text("🏖️").font(.system(size: 28))
                    Text("Repos")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(textMain)
                    Spacer()
                    Text("Aujourd'hui")
                        .font(.system(size: 9))
                        .foregroundColor(textDim)
                }
            }
            .padding(14)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(s != nil ? col.opacity(0.2) : Color.white.opacity(0.07), lineWidth: 1)
        )
        .widgetBg(bgColor)
        .widgetURL(deepLink)
    }
}

// MARK: - Bloc Medium

struct BlocMediumView: View {
    let sessions: [WidgetSession]

    var body: some View {
        let shown = Array(sessions.prefix(2))

        ZStack {
            cardColor
            if shown.isEmpty {
                HStack(spacing: 14) {
                    Text("🏖️").font(.system(size: 40))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Repos aujourd'hui")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(textMain)
                        Text("Récupération · Mobilité conseillée")
                            .font(.system(size: 10))
                            .foregroundColor(textSub)
                    }
                }
                .padding(16)
            } else {
                HStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.offset) { i, s in
                        let col = zoneColor(s.zone)
                        let deepLink = URL(string: "tibfit://session/\(s.id)")

                        Link(destination: deepLink ?? URL(string: "tibfit://")!) {
                            ZStack(alignment: .topLeading) {
                                LinearGradient(
                                    stops: [
                                        .init(color: col.opacity(0.15), location: 0),
                                        .init(color: col.opacity(0.04), location: 0.6),
                                        .init(color: bgColor, location: 1)
                                    ],
                                    startPoint: .topLeading, endPoint: .bottomTrailing
                                )
                                VStack(alignment: .leading, spacing: 0) {
                                    HStack(alignment: .top) {
                                        Text(s.emoji ?? "🏃").font(.system(size: 20))
                                        Spacer()
                                        if let zone = s.zone {
                                            Text(zone)
                                                .font(.system(size: 9, weight: .black))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 7).padding(.vertical, 3)
                                                .background(col)
                                                .cornerRadius(6)
                                        }
                                    }
                                    Spacer()
                                    Text(s.titre)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundColor(textMain)
                                        .lineLimit(2)
                                    Text(zoneLabel(s.zone))
                                        .font(.system(size: 9))
                                        .foregroundColor(textSub)
                                        .padding(.top, 2)
                                    HStack(alignment: .lastTextBaseline, spacing: 2) {
                                        Text("\(s.duree_minutes)")
                                            .font(.system(size: 22, weight: .black))
                                            .foregroundColor(col)
                                        Text("min")
                                            .font(.system(size: 10))
                                            .foregroundColor(textSub)
                                    }
                                    .padding(.top, 6)
                                }
                                .padding(14)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }

                        if i == 0 && shown.count > 1 {
                            Rectangle()
                                .fill(Color.white.opacity(0.07))
                                .frame(width: 1)
                        }
                    }
                }
            }
        }
        .widgetBg(cardColor)
    }
}

// MARK: - containerBackground helper

extension View {
    func widgetBg(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            return AnyView(self.containerBackground(color, for: .widget))
        } else {
            return AnyView(self.background(color))
        }
    }
}

// MARK: - Widget + Bundle

struct TibFitWidgetItem: Widget {
    let kind: String = "TibFitWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TibFitWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("TibFit")
        .description("Votre séance du jour")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct TibFitWidgetBundle: WidgetBundle {
    var body: some Widget {
        TibFitWidgetItem()
    }
}
