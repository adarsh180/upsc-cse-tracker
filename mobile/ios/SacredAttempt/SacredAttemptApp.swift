import SwiftUI

@main
struct SacredAttemptApp: App {
    var body: some Scene { WindowGroup { TrackerScreen() } }
}

struct TrackerScreen: View {
    @StateObject private var model = TrackerModel()
    @StateObject private var focus = FocusTimer()
    @State private var showFocus = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ZStack {
                TrackerWebView(model: model)
                if model.failed {
                    VStack(spacing: 20) {
                        Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                        Text("Your tracker couldn’t load").font(.title2.bold())
                        Text("Check your connection and try again. Your focus timer works offline. Unsaved web forms may need to be entered again.")
                            .multilineTextAlignment(.center)
                        Button("Try again") { model.retry() }.buttonStyle(.borderedProminent)
                        Button("Open focus timer") { showFocus = true }.buttonStyle(.bordered)
                    }.padding(28).frame(maxWidth: .infinity, maxHeight: .infinity).background(.background)
                }
                if model.loading { ProgressView().padding().background(.regularMaterial, in: Capsule()).frame(maxHeight: .infinity, alignment: .top) }
            }
            .navigationTitle("Sacred Attempt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { if model.webView.canGoBack { model.webView.goBack() } else { model.open("/dashboard") } }
                        label: { Image(systemName: "chevron.left") }.accessibilityLabel("Back")
                }
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    Button { showFocus = true } label: { Image(systemName: "timer") }.accessibilityLabel("Focus timer")
                    Menu {
                        Button("Dashboard") { model.open("/dashboard") }
                        Button("Daily goals") { model.open("/goals") }
                        Button("Tests") { model.open("/tests") }
                        Button("Report card") { model.open("/report-card") }
                        Button("Open in browser") { openURL(NavigationPolicy.home) }
                    } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("Workspace menu")
                }
            }
            .sheet(isPresented: $showFocus) { FocusScreen(focus: focus) }
            .alert("Open external website?", isPresented: Binding(get: { model.externalURL != nil }, set: { if !$0 { model.externalURL = nil } })) {
                Button("Open browser") { if let url = model.externalURL { openURL(url) }; model.externalURL = nil }
                Button("Cancel", role: .cancel) { model.externalURL = nil }
            } message: { Text(model.externalURL?.host ?? "") }
            .alert("Download in your browser", isPresented: $model.downloadNotice) {
                Button("Open tracker") { openURL(NavigationPolicy.home) }
                Button("Cancel", role: .cancel) {}
            } message: { Text("Open the tracker in your browser and sign in there to download this file. Your app session stays private.") }
        }.tint(Color(red: 0.5, green: 0.36, blue: 0.1))
    }
}

struct FocusScreen: View {
    @ObservedObject var focus: FocusTimer
    @Environment(\.dismiss) private var dismiss
    @State private var replacement: Int?
    @State private var clearConfirmation = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    Image(systemName: "timer").font(.system(size: 44)).padding(.top, 24)
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text(focus.label(at: context.date)).font(.system(size: 42, weight: .semibold, design: .rounded))
                            .monospacedDigit().minimumScaleFactor(0.6).lineLimit(2)
                    }
                    ForEach([25, 50, 90], id: \.self) { minutes in
                        Button("\(minutes) minutes") {
                            if let end = focus.end, end > Date() { replacement = minutes }
                            else { focus.start(minutes: minutes) }
                        }.buttonStyle(.borderedProminent).controlSize(.large)
                    }
                    if focus.end != nil { Button("Clear timer", role: .destructive) { clearConfirmation = true } }
                    Text("Works offline on this device. Time is not automatically logged as study. Record your actual work in Goals.")
                    Text(focus.notificationNote).foregroundStyle(.secondary)
                }.multilineTextAlignment(.center).padding(24).frame(maxWidth: .infinity)
            }
            .navigationTitle("Focus timer").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .alert("Replace your running timer?", isPresented: Binding(get: { replacement != nil }, set: { if !$0 { replacement = nil } })) {
                Button("Replace") { if let minutes = replacement { focus.start(minutes: minutes) }; replacement = nil }
                Button("Keep timer", role: .cancel) { replacement = nil }
            }
            .alert("Clear this timer?", isPresented: $clearConfirmation) {
                Button("Clear", role: .destructive) { focus.clear() }
                Button("Keep", role: .cancel) {}
            }
        }
    }
}
