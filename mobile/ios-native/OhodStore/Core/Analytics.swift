import Foundation

/// تحليل التصفح بدون أي بيانات شخصية (نفس EV في الموقع ← /ev): زيارة، مشاهدات المنتجات، الإضافة للسلة، البحث، دخول الدفع.
/// يغذي «التحليل» و«النصائح» في لوحة الإدارة، فزبائن التطبيق ينحسبون مثل زبائن الموقع.
@MainActor
final class Analytics {
    static let shared = Analytics()
    /// رابط الخادم (يتحدث مع بيانات المتجر)
    var apiBase = ""
    private var visit = 1
    private var views: [String: Int] = [:]
    private var carts: [String: Int] = [:]
    private var searches: [[String: Any]] = []
    private var searched = Set<String>()
    private var checkout = 0
    private var lastActive = Date()
    private var timer: Timer?

    private init() {
        // كل دقيقتين لو فيه بحث أو مشاهدات كثيرة (مثل الموقع)
        timer = Timer.scheduledTimer(withTimeInterval: 120, repeats: true) { _ in
            Task { @MainActor in
                let a = Analytics.shared
                if !a.searches.isEmpty || a.views.count > 20 { a.flush() }
            }
        }
    }

    /// معرّف المنتج الأساسي من مفتاح السلة (id أو id~رقم أو d:id أو t:id أو x:بنر:id)
    static func productID(_ key: String) -> String {
        let last = key.split(separator: ":").last.map(String.init) ?? key
        return last.split(separator: "~").first.map(String.init) ?? last
    }

    func view(_ id: String) { views[id, default: 0] += 1 }
    func addedToCart(_ key: String) { carts[Self.productID(key), default: 0] += 1 }
    func checkoutStarted() { checkout = 1 }

    /// بحث بعد ما يوقف الزبون الكتابة (الموقع: بعد ١٫٥ ثانية، حرفين فأكثر، ١٥ بحث بالدفعة)
    func search(_ q: String, found: Int) {
        let k = q.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard k.count > 1, !searched.contains(k), searches.count < 15 else { return }
        searched.insert(k)
        searches.append(["q": k, "f": found])
    }

    /// التطبيق رجع للواجهة: زيارة جديدة لو غاب أكثر من ٣٠ دقيقة
    func becameActive() {
        if Date().timeIntervalSince(lastActive) > 30 * 60 { visit = 1 }
        lastActive = Date()
    }

    /// التطبيق راح للخلفية: نرسل اللي تجمّع
    func flush() {
        lastActive = Date()
        guard !apiBase.isEmpty, visit == 1 || checkout == 1 || !searches.isEmpty || !views.isEmpty || !carts.isEmpty else { return }
        let body: [String: Any] = ["visit": visit, "v": views, "c": carts, "s": searches, "co": checkout]
        visit = 0; views = [:]; carts = [:]; searches = []; checkout = 0
        let base = apiBase
        Task { _ = await API.post(base, "/ev", body) }
    }
}
