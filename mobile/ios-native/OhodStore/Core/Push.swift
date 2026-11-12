import Foundation
import UIKit
import UserNotifications

/// يستقبل رمز الجهاز من آبل، ويعرض الإشعار حتى لو التطبيق مفتوح
final class PushDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in Push.shared.received(token: hex) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in Push.shared.failed() }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}

/// إشعارات حالة الطلب (نفس الموقع: /push/order بـ {native:"ios", token}). الخادم يرسل لآبل لما تتغير الحالة
@MainActor
@Observable
final class Push {
    static let shared = Push()
    /// الزبون فعّلها (ohod-push في الموقع)
    private(set) var enabled = UserDefaults.standard.bool(forKey: "push.pref")
    private(set) var denied = false
    @ObservationIgnored private var token: String?
    @ObservationIgnored private var pending: [(no: String, phone: String, api: String)] = []

    /// يطلب الإذن ويسجّل الجهاز. false = الزبون رفض من إعدادات الجوال
    @discardableResult
    func enable() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        denied = !granted
        enabled = granted
        UserDefaults.standard.set(granted, forKey: "push.pref")
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    /// نربط الطلب بالجهاز عشان توصله تحديثاته
    func register(no: String, phone: String, api: String) {
        guard enabled, !api.isEmpty else { return }
        if let token { send(no: no, phone: phone, api: api, token: token) }
        else {
            pending.append((no, phone, api))
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func received(token t: String) {
        token = t
        let list = pending; pending = []
        for p in list { send(no: p.no, phone: p.phone, api: p.api, token: t) }
    }
    func failed() { pending = [] }

    private func send(no: String, phone: String, api: String, token: String) {
        Task { _ = await API.post(api, "/push/order", ["no": no, "phone": phone, "sub": ["native": "ios", "token": token]]) }
    }
}
