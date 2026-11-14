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
    /// ضغط الزبون على الإشعار: لو فيه وجهة (?go=offers أو o:<قسم>) نفتحها
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let url = response.notification.request.content.userInfo["url"] as? String,
              let go = URLComponents(string: url)?.queryItems?.first(where: { $0.name == "go" })?.value, !go.isEmpty else { return }
        await MainActor.run { NotificationCenter.default.post(name: .ohodGo, object: go) }
    }
}

extension Notification.Name { static let ohodGo = Notification.Name("ohod.go") }

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
        // قرار المالك ١٤ نوفمبر ٢٠٢٦: موافقة آبل وحدها تكفي لكل الإشعارات (الطلب والعروض)
        if granted { promo = true; UserDefaults.standard.set(true, forKey: "push.promo"); UIApplication.shared.registerForRemoteNotifications() }
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
        if promo, let api = UserDefaults.standard.string(forKey: "push.promoApi"), !api.isEmpty { Task { _ = await API.post(api, "/push/promo", ["sub": ["native": "ios", "token": t]]) } }
    }

    /// إشعارات العروض (يرسلها المالك من الإدارة): الزبون يشترك أو يوقفها من «حسابي»
    private(set) var promo = UserDefaults.standard.bool(forKey: "push.promo")
    func enablePromo(api: String) async {
        guard !api.isEmpty, await enable() else { return }
        promo = true
        UserDefaults.standard.set(true, forKey: "push.promo"); UserDefaults.standard.set(api, forKey: "push.promoApi")
        if let t = token { _ = await API.post(api, "/push/promo", ["sub": ["native": "ios", "token": t]]) } else { UIApplication.shared.registerForRemoteNotifications() }
    }
    func disablePromo() {
        promo = false
        UserDefaults.standard.set(false, forKey: "push.promo")
        if let t = token, let api = UserDefaults.standard.string(forKey: "push.promoApi"), !api.isEmpty { Task { _ = await API.post(api, "/push/promo", ["sub": ["native": "ios", "token": t], "off": true]) } }
    }
    /// عند فتح التطبيق: لو الزبون مشترك نحدّث رمز جهازه (يتغير أحياناً)
    func resumePromo(api: String) {
        guard !api.isEmpty else { return }
        UserDefaults.standard.set(api, forKey: "push.promoApi")
        // اللي وافق على الإشعارات من قبل (من الطلب) ينضاف للعروض بعد
        if enabled, !promo { promo = true; UserDefaults.standard.set(true, forKey: "push.promo") }
        guard promo else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }
    func failed() { pending = [] }

    private func send(no: String, phone: String, api: String, token: String) {
        Task { _ = await API.post(api, "/push/order", ["no": no, "phone": phone, "sub": ["native": "ios", "token": token]]) }
    }
}
