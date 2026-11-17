import Foundation
import Observation

/// عدّاد الزوار الدقيق (/hit، نفس الموقع ١٧ نوفمبر ٢٠٢٦): زائر = جهاز (Device.id).
/// ينرسل عند فتح التطبيق، وأول مرة باليوم لكل منتج يشوفه (st 1) ومحتوى السلة (st 2) ووصول صفحة الطلب (st 3).
/// اللي ما وصل ينحفظ بالجهاز وينرسل بعدين بوقته الأصلي. ورد الخادم ممكن يكون فيه «عرض رجعة» (offer).
@MainActor
final class Visits {
    static let shared = Visits()
    var apiBase = ""
    private var queue: [[String: Any]] = []
    private var busy = false
    private var cartTask: Task<Void, Never>?
    private var lastOpen = Date.distantPast

    private init() {
        if let d = UserDefaults.standard.data(forKey: "hit.q"), let q = try? JSONSerialization.jsonObject(with: d) as? [[String: Any]] { queue = q }
    }

    private static var day: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Asia/Riyadh"); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
    private static var now: Int { Int(Date().timeIntervalSince1970 * 1000) }

    private func save() {
        if queue.count > 40 { queue = Array(queue.suffix(40)) }
        if let d = try? JSONSerialization.data(withJSONObject: queue) { UserDefaults.standard.set(d, forKey: "hit.q") }
    }

    private func add(_ h: [String: Any]) {
        var h = h; h["at"] = Self.now; h["app"] = "ios"
        queue.append(h); save(); flush()
    }

    /// فتح التطبيق (أو رجع له بعد ٣٠ دقيقة)
    func opened(src: String = "") {
        guard Date().timeIntervalSince(lastOpen) > 30 * 60 else { flush(); return }
        lastOpen = Date()
        add(["st": 0, "src": src.isEmpty ? "ios" : src])
    }

    /// شاف منتج: كل منتج مرة باليوم، وبالكثير ١٥
    func viewed(_ id: String) {
        let base = Analytics.productID(id), d = Self.day
        var seen = UserDefaults.standard.stringArray(forKey: "hit.v.\(d)") ?? []
        guard !seen.contains(base), seen.count < 15 else { return }
        seen.append(base); UserDefaults.standard.set(seen, forKey: "hit.v.\(d)")
        add(["st": 1, "id": base])
    }

    /// محتوى السلة (أرقام المنتجات بس) بعد ٣ ثواني من آخر تغيير، ولو تغيّر
    func cartChanged(_ keys: [String]) {
        cartTask?.cancel()
        cartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            var ids: [String] = []
            for k in keys { let b = Analytics.productID(k); if !ids.contains(b), b.range(of: "^[A-Za-z0-9_-]{1,40}$", options: .regularExpression) != nil { ids.append(b) } }
            ids = Array(ids.prefix(15))
            let sig = ids.sorted().joined(separator: ",")
            guard sig != UserDefaults.standard.string(forKey: "hit.c") else { return }
            UserDefaults.standard.set(sig, forKey: "hit.c")
            let h: [String: Any] = ids.isEmpty ? ["st": 0, "o": 0, "ids": [String]()] : ["st": 2, "ids": ids]
            self?.add(h)
        }
    }

    /// وصل صفحة إكمال الطلب (مرة باليوم)
    func checkout() {
        let k = "hit.co.\(Self.day)"
        guard !UserDefaults.standard.bool(forKey: k) else { return }
        UserDefaults.standard.set(true, forKey: k)
        add(["st": 3])
    }

    func flush() {
        guard !busy, !apiBase.isEmpty, !queue.isEmpty else { return }
        busy = true
        let batch = queue, n = batch.count, base = apiBase
        Task { [weak self] in
            let (status, j) = await API.post(base, "/hit", ["dev": Device.id, "staff": 0, "q": batch])
            guard let self else { return }
            self.busy = false
            if status == 200 || status == 400 {
                self.queue.removeFirst(min(n, self.queue.count)); self.save()
                if let o = j["offer"] as? [String: Any] { OfferCenter.shared.got(o) }
                if !self.queue.isEmpty { self.flush() }
            }
        }
    }
}

/// عرض الرجعة الشخصي اللي يعطيه الخادم (سلة متروكة / المنتج اللي يبغاه / عجلة الهدايا).
/// الكود مربوط بالجهاز، وينطبق تلقائي في السلة، والخادم يتأكد من كل شي وقت الطلب.
@MainActor @Observable
final class OfferCenter {
    static let shared = OfferCenter()

    struct Prize: Codable, Equatable { var kind: String; var value: Double; var cap: Double; var min: Double }
    struct Offer: Codable, Equatable, Identifiable {
        var code: String; var src: String; var kind: String; var value: Double; var cap: Double; var min: Double; var until: Double
        var need: String?; var price: Double?; var newPrice: Double?; var views: Int?; var adds: Int?
        var ids: [String]?; var pi: Int?; var prizes: [Prize]?
        var seen = false; var spun = false
        var id: String { code }
        var live: Bool { until / 1000 > Date().timeIntervalSince1970 }
        var hoursLeft: Int { max(0, Int((until / 1000 - Date().timeIntervalSince1970) / 3600)) }
    }

    var offer: Offer?
    /// يفتح نافذة العرض (أول مرة يوصل)
    var showSheet = false

    private init() {
        if let d = UserDefaults.standard.data(forKey: "offer.v1"), let o = try? JSONDecoder().decode(Offer.self, from: d), o.live { offer = o }
    }

    var live: Offer? { offer?.live == true ? offer : nil }

    private func save() {
        if let o = offer, let d = try? JSONEncoder().encode(o) { UserDefaults.standard.set(d, forKey: "offer.v1") }
        else { UserDefaults.standard.removeObject(forKey: "offer.v1") }
    }

    private static func n(_ v: Any?) -> Double? { CatalogParser.num(v) }

    func got(_ j: [String: Any]) {
        guard let code = j["code"] as? String, !code.isEmpty else { return }
        let prizes = (j["prizes"] as? [[String: Any]])?.map { Prize(kind: $0["kind"] as? String ?? "percent", value: Self.n($0["value"]) ?? 0, cap: Self.n($0["cap"]) ?? 0, min: Self.n($0["min"]) ?? 0) }
        var o = Offer(code: code, src: j["src"] as? String ?? "", kind: j["kind"] as? String ?? "percent", value: Self.n(j["value"]) ?? 0,
                      cap: Self.n(j["cap"]) ?? 0, min: Self.n(j["min"]) ?? 0, until: Self.n(j["until"]) ?? 0,
                      need: j["need"] as? String, price: Self.n(j["price"]), newPrice: Self.n(j["newPrice"]),
                      views: (Self.n(j["views"])).map { Int($0) }, adds: (Self.n(j["adds"])).map { Int($0) },
                      ids: j["ids"] as? [String], pi: (Self.n(j["pi"])).map { Int($0) }, prizes: prizes)
        if let old = offer, old.code == code { o.seen = old.seen; o.spun = old.spun }
        offer = o; save()
        if !o.seen { showSheet = true }
    }

    func markSeen() { offer?.seen = true; save() }
    func markSpun() { offer?.spun = true; save() }
    /// الطلب انرسل بالكود (أو الخادم رفضه): نشيله
    func drop(_ code: String) { if offer?.code == code { offer = nil; save() } }

    static func prizeText(_ p: Prize) -> String {
        p.kind == "percent" ? "خصم \(Money.plain(p.value))٪" : "\(Money.plain(p.value)) ر.س خصم"
    }
}
