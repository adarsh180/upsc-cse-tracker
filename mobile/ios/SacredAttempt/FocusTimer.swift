import Foundation
import Combine
import UserNotifications

final class FocusTimer: ObservableObject {
    @Published private(set) var end: Date?
    @Published var notificationNote = "Finish alerts require notification permission."
    private let key = "focusDeadline"
    private let notificationID = "focus-completion"

    init() {
        let timestamp = UserDefaults.standard.double(forKey: key)
        end = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }

    func start(minutes: Int) {
        let deadline = Date().addingTimeInterval(Double(minutes * 60))
        end = deadline
        UserDefaults.standard.set(deadline.timeIntervalSince1970, forKey: key)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        center.removeDeliveredNotifications(withIdentifiers: [notificationID])
        center.requestAuthorization(options: [.alert, .sound]) { [weak self] granted, _ in
            DispatchQueue.main.async {
                guard let self, self.end == deadline else { return }
                self.notificationNote = granted ? "Finish alert enabled. Focus settings may silence it." : "Notifications are off. Your timer still works."
                guard granted else { return }
                let content = UNMutableNotificationContent()
                content.title = "Focus timer finished"
                content.body = "Record what you completed in your Goals."
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, deadline.timeIntervalSinceNow), repeats: false)
                center.add(UNNotificationRequest(identifier: self.notificationID, content: content, trigger: trigger)) { error in
                    if error != nil {
                        DispatchQueue.main.async { self.notificationNote = "The finish alert could not be scheduled. Your timer still works." }
                    }
                }
            }
        }
    }

    func clear() {
        end = nil
        UserDefaults.standard.removeObject(forKey: key)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        center.removeDeliveredNotifications(withIdentifiers: [notificationID])
    }
    func label(at now: Date) -> String {
        guard let end else { return "Ready when you are" }
        let seconds = max(0, Int(ceil(end.timeIntervalSince(now))))
        return seconds == 0 ? "Timer finished" : String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}
