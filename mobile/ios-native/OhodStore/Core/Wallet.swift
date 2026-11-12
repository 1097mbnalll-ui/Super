import Foundation
import Observation

/// محفظة الزبون والكاش باك (نفس الموقع: /wallet/login و/wallet/me و/wallet/logout).
/// الجلسة في الذاكرة بس (مثل الموقع): تنتهي لما ينقفل التطبيق، والخادم ينهيها بعد ٨ ساعات.
@MainActor
@Observable
final class WalletCenter {
    struct Entry: Identifiable, Equatable {
        let id = UUID()
        let at: Date
        let kind: String
        let deltaCents: Int
        var title: String {
            ["credit": "إضافة رصيد", "payment": "دفع طلب", "refund": "استرجاع رصيد",
             "cashback": "كاش باك", "cashback_reversal": "عكس كاش باك"][kind] ?? kind
        }
    }

    private(set) var phone: String?
    private(set) var balance: Double = 0
    private(set) var history: [Entry] = []
    private(set) var busy = false
    /// كم يدفع من المحفظة في الطلب الجاي (ريال)
    var useAmount: Double = 0
    @ObservationIgnored private(set) var token: String?

    var loggedIn: Bool { token != nil }

    /// nil = تم. غير كذا رسالة الخطأ
    func login(phone raw: String, password: String, api: String) async -> String? {
        busy = true; defer { busy = false }
        let (status, j) = await API.post(api, "/wallet/login", ["phone": OrderCenter.normalizedPhone(raw) ?? raw, "password": password])
        guard j["ok"] as? Bool == true, let t = j["token"] as? String else {
            if j["code"] as? String == "locked" { return "محاولات كثيرة. جرّب بعد شوي." }
            return status == 0 ? "ما قدرنا نوصل للمحل. تأكد من النت." : "تعذر الدخول؛ راجع البيانات أو تواصل مع المتجر."
        }
        token = t
        phone = j["phone"] as? String
        balance = CatalogParser.num(j["balance"]) ?? 0
        useAmount = 0
        await refresh(api: api)
        return nil
    }

    func refresh(api: String) async {
        guard let token else { return }
        let (_, j) = await API.post(api, "/wallet/me", ["token": token])
        guard j["ok"] as? Bool == true else {
            if j["code"] as? String == "session_expired" { clear() }
            return
        }
        phone = j["phone"] as? String ?? phone
        balance = CatalogParser.num(j["balance"]) ?? balance
        history = ((j["history"] as? [[String: Any]]) ?? []).map {
            Entry(at: Date(timeIntervalSince1970: (CatalogParser.num($0["at"]) ?? 0) / 1000),
                  kind: $0["kind"] as? String ?? "", deltaCents: Int(CatalogParser.num($0["delta"]) ?? 0))
        }
    }

    /// nil = تم
    func logout(api: String) async -> String? {
        guard let token else { return nil }
        busy = true; defer { busy = false }
        let (_, j) = await API.post(api, "/wallet/logout", ["token": token])
        if j["ok"] as? Bool != true, j["code"] as? String != "session_expired" { return "تعذر تسجيل الخروج؛ حاول مجددًا" }
        clear()
        return nil
    }

    /// بعد طلب ناجح دفع جزء منه بالمحفظة
    func spent(_ amount: Double) {
        balance = max(0, balance - amount)
        useAmount = 0
    }

    func clear() {
        token = nil; phone = nil; balance = 0; history = []; useAmount = 0
    }
}
