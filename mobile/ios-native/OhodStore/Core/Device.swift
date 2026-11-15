import Foundation

/// جهاز الزبون المجهول (شرائح إشعارات العروض، قرار المالك ١٤ نوفمبر ٢٠٢٦): رقم عشوائي d-… (٢٠ حرف) بدون اسم ولا جوال.
/// نفس ohod-dev في الموقع: ينرسل مع اشتراك الإشعارات (/push/promo و /push/order) والطلب (/order) ونبضة السلة (/cart-ping)،
/// وينرسل للصفحات الحية بالرابط (dev=…) عشان الطلب من شاشة الموقع داخل التطبيق ينحسب لنفس الجهاز.
enum Device {
    static let id: String = {
        let key = "device.id"
        if let v = UserDefaults.standard.string(forKey: key), valid(v) { return v }
        let chars = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        var s = "d-"
        for _ in 0..<20 { s.append(chars[Int.random(in: 0..<chars.count)]) }
        UserDefaults.standard.set(s, forKey: key)
        return s
    }()

    static func valid(_ s: String) -> Bool {
        s.count == 22 && s.hasPrefix("d-") && s.dropFirst(2).allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }
    }
}

/// نبضة السلة {dev, n}: عدد المنتجات بس (بدون محتواها). مثل الموقع (cartPingCheck):
/// مرة كل ١٠ دقايق بالأكثر، وعلى طول لما تفضى السلة، وبس للي مشترك بإشعارات العروض (خفيف على الخادم).
/// الطلب نفسه يفضّي عدّ السلة في الخادم، فبعد الطلب ما نرسل نبضة.
@MainActor
final class CartPing {
    static let shared = CartPing()
    private var sentN: Int = (UserDefaults.standard.object(forKey: "cartping.n") as? Int) ?? -1
    private var sentAt = Date(timeIntervalSince1970: UserDefaults.standard.double(forKey: "cartping.at"))
    private var current = 0
    private var pending: Task<Void, Never>?

    private var api: String { UserDefaults.standard.string(forKey: "push.promoApi") ?? "" }

    func changed(count n: Int) {
        current = n
        guard Push.shared.promo, !api.isEmpty else { return }
        if n == sentN { pending?.cancel(); pending = nil; return }
        let wait = sentAt.addingTimeInterval(600).timeIntervalSinceNow
        if (n == 0 && sentN > 0) || wait <= 0 { send(); return }
        guard pending == nil else { return }
        pending = Task { [weak self] in
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled else { return }
            self?.send()
        }
    }

    /// الطلب انرسل: الخادم صفّر السلة مع الطلب
    func orderPlaced() {
        sentN = 0
        persist()
    }

    private func send() {
        pending?.cancel(); pending = nil
        let n = current, base = api
        guard n != sentN, !base.isEmpty else { return }
        sentN = n; sentAt = Date(); persist()
        Task { _ = await API.post(base, "/cart-ping", ["dev": Device.id, "n": n]) }
    }

    private func persist() {
        UserDefaults.standard.set(sentN, forKey: "cartping.n")
        UserDefaults.standard.set(sentAt.timeIntervalSince1970, forKey: "cartping.at")
    }
}
