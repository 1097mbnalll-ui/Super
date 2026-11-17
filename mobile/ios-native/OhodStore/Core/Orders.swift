import Foundation
import Observation
import CoreLocation

/// عنوان توصيل محفوظ في الجوال (ما ينرسل لأحد إلا مع الطلب). الزبون يحفظ أكثر من واحد باسم (البيت، الدوام، …) مثل ohod-addrs في الموقع
struct DeliveryAddress: Codable, Equatable, Identifiable {
    var id: String
    var label: String
    var lat: Double
    var lng: Double
    var details: String
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lng) }
    /// الاسم اللي يطلع للزبون
    var title: String {
        let t = label.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? "عنوان" : t
    }

    init(id: String = UUID().uuidString, label: String = "البيت", lat: Double, lng: Double, details: String = "") {
        self.id = id; self.label = label; self.lat = lat; self.lng = lng; self.details = details
    }

    private enum CodingKeys: String, CodingKey { case id, label, lat, lng, details }

    /// العنوان القديم (قبل العناوين المتعددة) ما فيه id ولا label: ياخذ «البيت»
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? "البيت"
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        details = try c.decodeIfPresent(String.self, forKey: .details) ?? ""
    }
}

/// طلب انرسل من هالجوال (للمتابعة و«اطلب مرة ثانية»)
struct SavedOrder: Codable, Identifiable, Equatable {
    var no: String          // "#1042"
    var total: Double
    var phone: String
    var pay: String
    var at: Date
    var status: String      // new / accepted / onway / delivered / canceled
    var items: [String: Int]
    var keys: [String]
    /// نسخة من السلة وقت الطلب (للتفاصيل). اختيارية عشان الطلبات القديمة المحفوظة
    var lines: [SavedLine]? = nil
    var subtotal: Double? = nil
    var fee: Double? = nil
    var savings: Double? = nil
    var details: String? = nil
    var sub: String? = nil
    var lat: Double? = nil
    var lng: Double? = nil
    /// الخادم يتابع الطلب (track). false = بدون تتبع ولا إلغاء من التطبيق
    var track: Bool? = nil
    /// اللي انخصم من المحفظة (هللة)
    var walletCents: Int? = nil
    /// نص الطباعة: بعد الطلب يرسل الملف على واتساب برقم الطلب
    var printText: String? = nil
    /// تقييم الزبون بعد التوصيل (من /track أو /rate)، وهل يقدر يقيّم/يعدّل الحين (canRate من الخادم)
    var rating: OrderRating? = nil
    var canRate: Bool? = nil
    /// الزبون قفل تذكير «قيّم طلبك»
    var rateSkip: Bool? = nil
    var id: String { no }
    var count: Int { lines?.reduce(0) { $0 + $1.qty } ?? items.values.reduce(0, +) }
    /// طلب شغّال: حالته مفتوحة وعمره أقل من ١٢ ساعة (مثل activeOrder في الموقع)
    var isActive: Bool { ["new", "accepted", "onway"].contains(status) && Date().timeIntervalSince(at) < 12 * 3600 && track != false }
}

/// تقييم الطلب (نفس حقول الخادم: stars ١–٥، tags، note، at، until بالملي ثانية)
struct OrderRating: Codable, Equatable {
    var stars: Int
    var tags: [String]
    var note: String
    var at: Date
    /// آخر وقت للتعديل (٢٤ ساعة من أول تقييم)
    var until: Date

    static func parse(_ raw: Any?) -> OrderRating? {
        guard let x = raw as? [String: Any], let s = CatalogParser.num(x["stars"]) else { return nil }
        let ms = { (k: String) in Date(timeIntervalSince1970: (CatalogParser.num(x[k]) ?? 0) / 1000) }
        return OrderRating(stars: Int(s), tags: (x["tags"] as? [Any] ?? []).compactMap { $0 as? String },
                           note: x["note"] as? String ?? "", at: ms("at"), until: ms("until"))
    }
    var editable: Bool { Date() < until }
}

/// اختيارات التقييم السريعة (نفس مفاتيح الموقع والخادم). good = مزايا (٤–٥ نجوم)، غيرها مشاكل (١–٢)، و٣ نجوم الكل
enum RateTag {
    static let all: [(id: String, title: String, good: Bool)] = [
        ("driver", "المندوب ممتاز", true), ("fast", "وصل بسرعة", true), ("fresh", "المنتجات طازجة", true), ("packing", "تغليف مرتب", true),
        ("late", "تأخر", false), ("missing", "منتج ناقص", false), ("wrong", "منتج غلط", false), ("damaged", "منتج تالف", false),
    ]
    static func forStars(_ n: Int) -> [(id: String, title: String, good: Bool)] { all.filter { n == 3 || (n >= 4 ? $0.good : !$0.good) } }
    static func title(_ id: String) -> String { all.first { $0.id == id }?.title ?? "" }
    static func word(_ n: Int) -> String { ["اختر عدد النجوم", "سيئة", "مو زينة", "عادية", "حلوة", "ممتازة"][max(0, min(5, n))] }
}

struct SavedLine: Codable, Equatable, Identifiable {
    var key: String
    var name: String
    var unit: String
    var qty: Int
    var price: Double
    var old: Double?
    var id: String { key }
    var total: Double { price * Double(qty) }
}

/// موقع المندوب من /track (وقت ما يكون الطلب في الطريق)
struct DriverInfo: Equatable {
    var lat: Double
    var lng: Double
    var eta: Int?
    var before: Int
    var near: Bool
    /// المسافة بالمتر وآخر تحديث لموقع المندوب
    var meters: Double? = nil
    var at: Date? = nil
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lng) }
    static func == (a: DriverInfo, b: DriverInfo) -> Bool { a.lat == b.lat && a.lng == b.lng && a.eta == b.eta && a.before == b.before && a.meters == b.meters && a.at == b.at && a.near == b.near }
}

/// بديل اقترحه المندوب لمنتج ناقص (من /track subs): الزبون يوافق أو يشيل المنتج (/sub-answer)
struct SubOffer: Equatable, Identifiable {
    var id: Int
    var name: String        // المنتج الناقص
    var qty: Int
    var price: Double
    var toID: String
    var toName: String
    var toUnit: String
    var toPrice: Double
    var toImage: String
    var diff: Double        // الفرق على الإجمالي (+ زيادة، − نقص)
    var toImageURL: URL? { AppConfig.asset(toImage) }

    static func parse(_ raw: Any?) -> [SubOffer] {
        ((raw as? [[String: Any]]) ?? []).compactMap { x in
            guard let id = CatalogParser.num(x["id"]).map({ Int($0) }), let to = x["to"] as? [String: Any],
                  let toID = to["id"] as? String else { return nil }
            return SubOffer(id: id, name: x["name"] as? String ?? "", qty: Int(CatalogParser.num(x["qty"]) ?? 1),
                            price: CatalogParser.num(x["price"]) ?? 0, toID: toID, toName: to["name"] as? String ?? "",
                            toUnit: to["unit"] as? String ?? "", toPrice: CatalogParser.num(to["price"]) ?? 0,
                            toImage: to["img"] as? String ?? "", diff: CatalogParser.num(x["diff"]) ?? 0)
        }
    }
}

enum OrderStatus {
    static func title(_ s: String) -> String { tr(arTitle(s)) }
    static func detail(_ s: String) -> String { tr(arDetail(s)) }
    private static func arTitle(_ s: String) -> String {
        switch s {
        case "new": return "وصلنا طلبك"
        case "accepted": return "نجهّز طلبك"
        case "onway": return "المندوب في الطريق 🛵"
        case "delivered": return "وصلك الطلب ✓"
        case "canceled": return "الطلب ملغي"
        default: return "طلبك"
        }
    }
    private static func arDetail(_ s: String) -> String {
        switch s {
        case "new": return "ننتظر المحل يأكده، عادة خلال دقايق"
        case "accepted": return "انقبل طلبك وجاري تجهيزه"
        case "onway": return "جهّز الكاش أو الشبكة، المندوب قريب"
        case "delivered": return "بالعافية عليك"
        case "canceled": return "ما راح يوصلك هالطلب"
        default: return ""
        }
    }
    /// كم خطوة خلصت من ٤ (وصل، يتجهز، في الطريق، وصلك)
    static func step(_ s: String) -> Int {
        ["new": 1, "accepted": 2, "onway": 3, "delivered": 4][s] ?? 0
    }
}

enum OrderError: Error, Equatable {
    case phone(String)
    case message(String)
    case address(String)
    /// ما وصل الطلب: نعرض «أرسل الطلب على واتساب بدلها» مثل الموقع
    case whatsapp(String)
}

@MainActor
@Observable
final class OrderCenter {
    /// العناوين المحفوظة (أقصى ١٠) والمختار منها للطلب
    private(set) var addresses: [DeliveryAddress] = [] { didSet { persistAddresses() } }
    private(set) var selectedAddressID: String? = nil { didSet { persistAddresses() } }
    /// عنوان الطلب: المختار، وإلا أول عنوان
    var address: DeliveryAddress? { addresses.first { $0.id == selectedAddressID } ?? addresses.first }
    static let maxAddresses = 10
    var name: String = UserDefaults.standard.string(forKey: "order.name") ?? "" {
        didSet { UserDefaults.standard.set(name, forKey: "order.name") }
    }
    var phone: String = UserDefaults.standard.string(forKey: "order.phone") ?? "" {
        didSet { UserDefaults.standard.set(phone, forKey: "order.phone") }
    }
    private(set) var orders: [SavedOrder] = [] { didSet { Self.store(orders, "order.history") } }
    private(set) var sending = false
    /// موقع المندوب لكل طلب في الطريق (ما ينحفظ)
    private(set) var drivers: [String: DriverInfo] = [:]
    /// بدائل تنتظر رد الزبون لكل طلب (ما تنحفظ، تجي من /track)
    private(set) var subs: [String: [SubOffer]] = [:]
    var pendingSubs: Int { subs.values.reduce(0) { $0 + $1.count } }

    /// محاولة إرسال ما تأكدت نتيجتها (النت انقطع). نعيد نفس المحتوى بنفس الرقم فما يتكرر الطلب
    private struct Attempt: Codable {
        var requestId: String
        var signature: String
        var payload: Data
        var at: Date? = nil
    }
    @ObservationIgnored private var attempt: Attempt? { didSet { Self.store(attempt, "order.attempt") } }

    init() {
        if let saved: [DeliveryAddress] = Self.load("order.addresses") {
            addresses = saved
            selectedAddressID = UserDefaults.standard.string(forKey: "order.addressID")
        } else if let old: DeliveryAddress = Self.load("order.address") {
            // أول مرة بعد التحديث: العنوان الوحيد القديم يصير «البيت»
            addresses = [old]
            selectedAddressID = old.id
        }
        persistAddresses()
        orders = Self.load("order.history") ?? []
        attempt = Self.load("order.attempt")
    }

    var current: SavedOrder? { orders.first(where: \.isActive) }
    /// آخر طلب وصل (آخر ٣ أيام) وينتظر تقييم، أو انقيّم وباقي وقت تعديله: بطاقة التقييم في «حسابي» (مثل rateHTML في الموقع)
    var rateCard: SavedOrder? {
        guard let o = orders.first(where: { $0.status == "delivered" && $0.track != false }), Date().timeIntervalSince(o.at) < 3 * 86400 else { return nil }
        if let r = o.rating { return r.editable && o.canRate != false ? o : nil }
        return o.canRate == true && o.rateSkip != true ? o : nil
    }
    /// تذكير «قيّم طلبك» في الرئيسية: ما انقيّم وما قفله الزبون (rateDue في الموقع)
    var rateDue: SavedOrder? { rateCard.flatMap { $0.rating == nil ? $0 : nil } }
    var hasPendingAttempt: Bool { attempt != nil }

    /// طلب انرسل من شاشة الموقع داخل التطبيق: نحفظه هنا عشان المتابعة والإشعارات وطلباتي
    func adopt(no: String, total: Double, phone: String, pay: String, items: [String: Int], lat: Double?, lng: Double?) {
        guard !no.isEmpty, !orders.contains(where: { $0.no == no }) else { return }
        var o = SavedOrder(no: no.hasPrefix("#") ? no : "#" + no, total: total, phone: phone, pay: pay, at: Date(), status: "new",
                           items: items, keys: Array(items.keys))
        o.lat = lat; o.lng = lng; o.track = true
        if !phone.isEmpty { self.phone = phone }
        orders.insert(o, at: 0)
    }

    /// يحفظ العنوان (جديد أو تعديل) ويختاره للطلب، مع الجوال والاسم
    func save(address: DeliveryAddress, phone: String, name: String) {
        saveAddress(address)
        self.phone = Self.normalizedPhone(phone) ?? phone
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// إضافة أو تعديل عنوان (بنفس id) ويصير المختار
    func saveAddress(_ address: DeliveryAddress) {
        var a = address
        a.details = a.details.trimmingCharacters(in: .whitespacesAndNewlines)
        a.label = a.label.trimmingCharacters(in: .whitespacesAndNewlines)
        if a.label.isEmpty { a.label = nextLabel.isEmpty ? "عنوان \(addresses.count + 1)" : nextLabel }
        var list = addresses
        if let i = list.firstIndex(where: { $0.id == a.id }) { list[i] = a }
        else { list.append(a); if list.count > Self.maxAddresses { list.removeFirst(list.count - Self.maxAddresses) } }
        addresses = list
        selectedAddressID = a.id
    }

    func selectAddress(_ id: String) {
        guard addresses.contains(where: { $0.id == id }) else { return }
        selectedAddressID = id
    }

    /// حذف عنوان. لو كان المختار: نختار أول عنوان باقي
    func deleteAddress(_ id: String) {
        addresses.removeAll { $0.id == id }
        if selectedAddressID == id || !addresses.contains(where: { $0.id == selectedAddressID }) { selectedAddressID = addresses.first?.id }
    }

    /// اسم مقترح للعنوان الجديد: «البيت» ثم «الدوام» (مثل nextLabel في الموقع)
    var nextLabel: String {
        !addresses.contains { $0.label == "البيت" } ? "البيت" : !addresses.contains { $0.label == "الدوام" } ? "الدوام" : ""
    }

    /// العنوان برّا منطقة التوصيل (المرسومة أو maxKm)؟
    static func outside(_ a: DeliveryAddress, _ store: StoreInfo) -> Bool {
        !inZone(a.coordinate, store.zone) || tooFar(a.coordinate, store) != nil
    }

    private func persistAddresses() {
        Self.store(addresses, "order.addresses")
        UserDefaults.standard.set(selectedAddressID, forKey: "order.addressID")
        // نسخة من المختار بالمفتاح القديم (لو رجع الزبون لنسخة أقدم من التطبيق)
        Self.store(address, "order.address")
    }

    /// للتصوير على المحاكي بس (-seed-order)
    func seedPreview(_ order: SavedOrder, driver: DriverInfo? = nil) {
        orders = [order]
        drivers[order.no] = driver
        if address == nil { saveAddress(DeliveryAddress(lat: 24.845, lng: 46.815, details: "فيلا ١٢، الباب الأخضر")) }
    }

    /// للتصوير بس (-seed-sub)
    func seedSubs(_ no: String, _ list: [SubOffer]) { subs[no] = list }

    // MARK: إرسال الطلب

    func place(cart: Cart, catalog: CatalogStore, wallet: WalletCenter? = nil) async -> Result<SavedOrder, OrderError> {
        guard !sending else { return .failure(.message("الطلب جاري إرساله")) }
        guard let phone = Self.normalizedPhone(phone) else { return .failure(.phone("اكتب رقم جوال سعودي صحيح، مثل 05XXXXXXXX")) }
        guard let address else { return .failure(.address("حدد بيتك على الخريطة أول")) }
        if !Self.inZone(address.coordinate, catalog.store.zone) {
            return .failure(.address("الموقع برا منطقة التوصيل. حرّك الدبوس على بيتك"))
        }
        if let km = Self.tooFar(address.coordinate, catalog.store) {
            return .failure(.address("بيتك يبعد \(Money.plain(km)) كم عن المحل، ونوصل لين \(Money.plain(catalog.store.maxKm ?? 0)) كم بس"))
        }
        let items = cart.orderItems(catalog)
        let snapshot = cart.totals(catalog)
        // الدفع من المحفظة: لازم دخول بنفس الجوال، والمبلغ ما يتعدى الرصيد ولا الإجمالي (مثل الموقع)
        let walletUse = wallet.map { ($0.useAmount * 100).rounded() / 100 } ?? 0
        if walletUse > 0 {
            guard let w = wallet, w.loggedIn, w.phone == phone, walletUse <= snapshot.total + 0.001, walletUse <= w.balance + 0.001 else {
                return .failure(.message("راجع رقم الجوال ورصيد المحفظة والمبلغ المستخدم."))
            }
        }
        let keyOrder = snapshot.rows.map(\.key)
        var body: [String: Any] = [
            "items": cart.payload(items), "phone": phone, "name": name, "details": address.details,
            "note": [cart.printNote(catalog), cart.note.trimmingCharacters(in: .whitespacesAndNewlines)].filter { !$0.isEmpty }.joined(separator: "\n"),
            "pay": cart.payment == "card" ? "card" : "cash", "sub": cart.substitution,
            "lat": (address.lat * 1e6).rounded() / 1e6, "lng": (address.lng * 1e6).rounded() / 1e6, "walletAmount": walletUse,
        ]
        let promo = cart.promoCode.trimmingCharacters(in: .whitespaces)
        if !promo.isEmpty { body["promo"] = promo }
        let signature = Self.signature(body)
        var resendingOld = false
        // محاولة قديمة ما تأكدنا منها: بعد ٢٠ دقيقة ما نرسلها (لا ترسل سلة قديمة بدل الجديدة)
        if let a = attempt, Date().timeIntervalSince(a.at ?? .distantPast) > 20 * 60 { attempt = nil }
        if let a = attempt {
            if a.signature != signature, let old = try? JSONSerialization.jsonObject(with: a.payload) as? [String: Any] {
                // فيه طلب قديم ما تأكدنا منه: نتأكد منه أول قبل أي طلب جديد
                body = old
                resendingOld = true
            }
            body["requestId"] = a.requestId
            body["walletRequestId"] = a.requestId
        } else {
            guard !items.isEmpty else { return .failure(.message("سلتك فاضية")) }
            let id = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
            body["requestId"] = id
            body["walletRequestId"] = id
            attempt = Attempt(requestId: id, signature: signature,
                              payload: (try? JSONSerialization.data(withJSONObject: body.filter { $0.key != "requestId" && $0.key != "walletRequestId" })) ?? Data(), at: Date())
        }

        // توكن المحفظة ما ينحفظ مع المحاولة، ينضاف وقت الإرسال بس
        body["walletToken"] = (wallet?.phone == body["phone"] as? String) ? (wallet?.token ?? "") : ""
        // جهاز الزبون المجهول (شرائح إشعارات العروض): نفس الموقع
        body["dev"] = Device.id
        sending = true
        defer { sending = false }
        let (status, json) = await API.post(catalog.apiBase, "/order", body)

        if json["ok"] as? Bool == true, let no = json["orderNo"] as? String {
            attempt = nil
            let sent = body["items"] as? [String: Int] ?? items
            let order = SavedOrder(no: no, total: CatalogParser.num(json["total"]) ?? 0, phone: body["phone"] as? String ?? phone,
                                   pay: body["pay"] as? String ?? "cash", at: Date(), status: "new",
                                   items: sent, keys: keyOrder.filter { sent[$0] != nil } + sent.keys.filter { !keyOrder.contains($0) }.sorted())
            var order2 = order
            if !resendingOld {
                order2.lines = snapshot.rows.filter { $0.available }.map {
                    SavedLine(key: $0.key, name: $0.product.name, unit: $0.weighed ? Weight.label($0.qty) : $0.unitLabel, qty: $0.weighed ? 1 : $0.qty,
                              price: $0.weighed ? $0.lineTotal : ($0.lineTotal / Double(Swift.max(1, $0.qty)) * 100).rounded() / 100,
                              old: $0.offerSaving > 0.009 ? $0.unitPrice : ($0.pack == nil ? $0.product.old : nil))
                }
                order2.subtotal = snapshot.subtotal; order2.fee = snapshot.fee; order2.savings = snapshot.savings
                order2.details = address.details; order2.sub = cart.substitution
                order2.lat = address.lat; order2.lng = address.lng
            }
            order2.track = json["track"] as? Bool ?? true
            let pn = resendingOld ? "" : cart.printNote(catalog)
            if !pn.isEmpty { order2.printText = pn }
            let usedWallet = CatalogParser.num(body["walletAmount"]) ?? 0
            if usedWallet > 0 { order2.walletCents = Int((usedWallet * 100).rounded()); wallet?.spent(usedWallet) }
            if !resendingOld { cart.note = "" }
            if !orders.contains(where: { $0.no == no }) { orders.insert(order2, at: 0) }
            if orders.count > 30 { orders.removeLast(orders.count - 30) }
            CartPing.shared.orderPlaced()   // الخادم صفّر عدّ السلة مع الطلب
            cart.remove(sent: sent, catalog: catalog)
            if order2.track != false { Push.shared.register(no: no, phone: order2.phone, api: catalog.apiBase) }
            Haptics.success()
            Task { await catalog.refreshStock(force: true) }
            return .success(order2)
        }

        let code = json["code"] as? String ?? (status == 0 ? "network" : "error")
        let uncertain = status == 0 || status >= 500 || code == "network"
        if !uncertain { attempt = nil }
        Haptics.warning()
        if resendingOld && uncertain {
            return .failure(.message("عندك طلب سابق ما تأكدنا إنه وصل. تأكد من النت واضغط «أرسل الطلب» مرة ثانية، وما راح يتكرر."))
        }
        switch code {
        case "network", "timeout", "db", "data":
            return .failure(.whatsapp("ما قدرنا نتأكد إن الطلب وصل. تأكد من النت واضغط «أرسل الطلب» مرة ثانية، وما راح يتكرر."))
        case "bad_phone":
            return .failure(.phone("رقم الجوال غير صحيح"))
        case "bad_location":
            return .failure(.address("الموقع المحدد خارج السعودية. حرّك الخريطة على بيتك"))
        case "out_of_zone":
            return .failure(.address("بيتك برا منطقة التوصيل حالياً. نوصل داخل \(catalog.store.area) بس"))
        case "too_far":
            let km = CatalogParser.num(json["km"]).map { Money.plain($0) } ?? ""
            return .failure(.address("بيتك يبعد \(km) كم عن المحل، ونوصل لين \(Money.plain(catalog.store.maxKm ?? 0)) كم بس"))
        case "wallet_login", "wallet_balance", "bad_payment":
            return .failure(.message("تعذر استخدام المحفظة. سجّل الدخول مجددًا وراجع الرصيد والمبلغ."))
        case "bad_items":
            await catalog.refresh()
            return .failure(.message("فيه منتج بسلتك تغيّر أو انشال. راجع السلة وأرسل مرة ثانية."))
        case "bad_request_id", "request_conflict":
            attempt = nil
            return .failure(.message("صار تعارض في إرسال الطلب. اضغط «أرسل الطلب» مرة ثانية."))
        case "unavailable":
            if let id = json["id"] as? String, let left = CatalogParser.num(json["left"]).map({ Int($0) }) {
                catalog.setLiveStock(id, left)
                cart.applyStock(productID: id, left: left, catalog: catalog)
                let name = catalog.product(id)?.name ?? "منتج"
                return .failure(.message(left > 0
                    ? "باقي \(left) بس من «\(name)»، وعدّلنا الكمية في سلتك. اضغط «أرسل الطلب» مرة ثانية."
                    : "«\(name)» نفد للتو وشلناه من سلتك. اضغط «أرسل الطلب» مرة ثانية."))
            }
            await catalog.refreshStock(force: true)
            await catalog.refresh()
            return .failure(.message("فيه منتج في سلتك نفد للتو. راجع السلة وأرسل مرة ثانية."))
        case "pack_only":
            return .failure(.message("فيه عرض ينباع بالمجموعة بس (مثل ٣ علب). كمّل الاختيار من السلة وأرسل مرة ثانية."))
        case "promo_invalid", "promo_expired", "promo_used", "promo_limit", "promo_min":
            cart.promoCode = ""
            return .failure(.message(["promo_invalid": "كود الخصم غير صحيح.", "promo_expired": "كود الخصم انتهى.", "promo_used": "استخدمت هالكود قبل.", "promo_limit": "الكود خلص عدد استخداماته.", "promo_min": "الكود يحتاج مبلغ أعلى."][json["code"] as? String ?? ""]! + " شلناه، اضغط «أرسل الطلب» مرة ثانية."))
        case "item_limit":
            return .failure(.message("تجاوزت الحد المسموح لأحد المنتجات. قلّل الكمية وأرسل مرة ثانية."))
        case "closed":
            return .failure(.message("المحل مقفل الحين وما نستقبل طلبات."))
        case "min_order":
            let min = CatalogParser.num(json["min"]) ?? catalog.store.minOrder
            return .failure(.message("أقل مبلغ للطلب \(Money.short(min))"))
        case "slow_down":
            return .failure(.whatsapp("أرسلت طلبات كثيرة بوقت قصير. انتظر شوي أو اتصل علينا."))
        default:
            return .failure(.whatsapp("صار خطأ وما انرسل الطلب. جرّب مرة ثانية أو اتصل علينا."))
        }
    }

    /// نص الطلب للواتساب (waOrderText في الموقع)
    func whatsappText(cart: Cart, catalog: CatalogStore) -> String {
        let t = cart.totals(catalog)
        var m = "طلب جديد من تطبيق \(catalog.store.name):\n"
        for r in t.rows where r.available && !r.locked {
            m += "• \(r.product.name) (\(r.unitLabel)) × \(r.qty) = \(Money.sar(r.lineTotal))\n"
        }
        m += "\nالإجمالي: \(Money.sar(t.total))" + (t.fee > 0 ? " (شامل التوصيل)" : " (التوصيل مجاني)")
        m += "\nالدفع: " + (cart.payment == "card" ? "شبكة" : "كاش") + " عند الاستلام"
        m += "\nالجوال: " + (Self.normalizedPhone(phone) ?? phone)
        if let a = address {
            m += "\nالموقع: https://www.google.com/maps?q=\(String(format: "%.6f", a.lat)),\(String(format: "%.6f", a.lng))"
            if !a.details.isEmpty { m += "\nتفاصيل البيت: " + a.details }
        }
        let note = cart.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { m += "\nملاحظات: " + note }
        return m
    }

    // MARK: متابعة وإلغاء

    func refresh(catalog: CatalogStore) async {
        // الطلبات الشغالة، والطلب اللي وصل وما نعرف حالة تقييمه (مرة وحدة)
        for order in orders where order.isActive || (order.status == "delivered" && order.canRate == nil && order.track != false && Date().timeIntervalSince(order.at) < 7 * 86400) {
            let (_, json) = await API.post(catalog.apiBase, "/track", ["no": order.no, "phone": order.phone])
            if let d = json["driver"] as? [String: Any], let la = CatalogParser.num(d["lat"]), let ln = CatalogParser.num(d["lng"]) {
                drivers[order.no] = DriverInfo(lat: la, lng: ln, eta: CatalogParser.num(d["eta"]).map { Int($0.rounded()) },
                                               before: Int(CatalogParser.num(d["before"]) ?? 0), near: d["near"] as? Bool ?? false,
                                               meters: CatalogParser.num(d["m"]),
                                               at: CatalogParser.num(d["at"]).map { Date(timeIntervalSince1970: $0 / 1000) })
            } else if json["ok"] as? Bool == true {
                drivers[order.no] = nil
            }
            if json["ok"] as? Bool == true {
                let list = SubOffer.parse(json["subs"])
                if subs[order.no] ?? [] != list {
                    if list.count > (subs[order.no] ?? []).count { Haptics.warning() }
                    subs[order.no] = list.isEmpty ? nil : list
                }
            }
            // تقييم الطلب الواصل (الخادم القديم ما يرجعه: نخليه مجهول)
            if json["ok"] as? Bool == true, json["canRate"] != nil, let i = orders.firstIndex(where: { $0.no == order.no }) {
                let r = OrderRating.parse(json["rating"]), can = json["canRate"] as? Bool ?? false
                if orders[i].rating != r || orders[i].canRate != can { orders[i].rating = r; orders[i].canRate = can }
            }
            guard json["ok"] as? Bool == true, let st = json["status"] as? String,
                  let i = orders.firstIndex(where: { $0.no == order.no }), orders[i].status != st else { continue }
            orders[i].status = st
            if st == "delivered" { Haptics.success() }
        }
    }

    func canCancel(_ order: SavedOrder, policy: String) -> Bool {
        guard order.track != false else { return false }
        switch policy {
        case "off": return false
        case "accepted": return ["new", "accepted"].contains(order.status)
        default: return order.status == "new"
        }
    }

    /// nil = انلغى. غير كذا رسالة الخطأ
    func cancel(_ order: SavedOrder, reason: String = "", catalog: CatalogStore) async -> String? {
        let (status, json) = await API.post(catalog.apiBase, "/cancel", ["no": order.no, "phone": order.phone, "reason": reason])
        if json["ok"] as? Bool == true {
            if let i = orders.firstIndex(where: { $0.no == order.no }) { orders[i].status = "canceled" }
            subs[order.no] = nil
            return nil
        }
        switch json["code"] as? String {
        case "too_late":
            await refresh(catalog: catalog)
            return "بدأنا في طلبك، فما نقدر نلغيه من هنا. اتصل على المحل."
        case "slow_down": return "محاولات كثيرة، جرّب بعد شوي."
        default: return status == 0 ? "ما قدرنا نوصل للمحل. تأكد من النت." : "ما قدرنا نلغي الطلب. اتصل على المحل."
        }
    }

    /// تقييم الطلب بعد التوصيل (/rate). nil = وصل، غير كذا رسالة الخطأ
    func rate(_ order: SavedOrder, stars: Int, tags: [String], note: String, catalog: CatalogStore) async -> String? {
        let clean = String(note.trimmingCharacters(in: .whitespacesAndNewlines).prefix(300))
        let (status, json) = await API.post(catalog.apiBase, "/rate", ["no": order.no, "phone": order.phone, "stars": stars, "tags": tags, "note": clean])
        let i = orders.firstIndex(where: { $0.no == order.no })
        if json["ok"] as? Bool == true {
            if let i { orders[i].rating = OrderRating.parse(json["rating"]); orders[i].canRate = json["canRate"] as? Bool ?? false }
            Haptics.success()
            return nil
        }
        switch json["code"] as? String {
        case "locked", "too_old":
            if let i {
                if let r = OrderRating.parse(json["rating"]) { orders[i].rating = r }
                orders[i].canRate = false
            }
            return json["code"] as? String == "locked" ? "انتهت مدة تعديل التقييم (٢٤ ساعة)." : "انتهت مدة تقييم هالطلب."
        case "slow_down": return "محاولات كثيرة، جرّب بعد شوي."
        default: return status == 0 ? "ما وصل تقييمك. تأكد من النت وجرّب مرة ثانية." : "ما وصل تقييمك. جرّب مرة ثانية."
        }
    }

    /// الزبون قفل تذكير «قيّم طلبك»
    func skipRating(_ order: SavedOrder) {
        if let i = orders.firstIndex(where: { $0.no == order.no }) { orders[i].rateSkip = true }
    }

    /// للتصوير بس (-seed-delivered)
    func seedDelivered() {
        guard !orders.isEmpty else { return }
        orders[0].status = "delivered"; orders[0].canRate = true; orders[0].rating = nil; orders[0].rateSkip = nil
    }

    /// رد الزبون على بديل المندوب. nil = تم، غير كذا رسالة الخطأ
    func answer(_ offer: SubOffer, accept: Bool, order: SavedOrder, catalog: CatalogStore) async -> String? {
        let (status, json) = await API.post(catalog.apiBase, "/sub-answer", ["no": order.no, "phone": order.phone, "offer": offer.id, "accept": accept])
        if json["ok"] as? Bool == true {
            subs[order.no]?.removeAll { $0.id == offer.id }
            if subs[order.no]?.isEmpty == true { subs[order.no] = nil }
            if let t = CatalogParser.num((json["order"] as? [String: Any])?["total"]), let i = orders.firstIndex(where: { $0.no == order.no }) {
                orders[i].total = t
                // السطور المحفوظة صارت قديمة بعد التبديل: التفاصيل تعرض من الخادم بعدين
                if accept {
                    orders[i].lines = orders[i].lines?.filter { $0.name != offer.name }
                    orders[i].lines?.append(SavedLine(key: offer.toID, name: offer.toName, unit: offer.toUnit, qty: offer.qty, price: offer.toPrice, old: nil))
                } else {
                    orders[i].lines = orders[i].lines?.filter { $0.name != offer.name }
                }
            }
            Haptics.success()
            return nil
        }
        switch json["code"] as? String {
        case "last_item": return "هذا آخر منتج في طلبك. وافق على البديل أو ألغِ الطلب."
        case "stale":
            subs[order.no]?.removeAll { $0.id == offer.id }
            return "الاقتراح تغيّر. حدّثنا الطلب."
        case "bad_swap": return "البديل خلص للأسف. المندوب بيقترح غيره."
        case "slow_down": return "محاولات كثيرة، جرّب بعد شوي."
        default: return status == 0 ? "ما وصل ردك. تأكد من النت وجرّب مرة ثانية." : "ما وصل ردك. جرّب مرة ثانية."
        }
    }

    // MARK: أدوات

    /// نفس قاعدة الخادم: 05XXXXXXXX (يقبل +966 والأرقام العربية)
    static func normalizedPhone(_ raw: String) -> String? {
        var s = CatalogParser.latinDigits(raw).filter { $0.isNumber || $0 == "+" }
        if s.hasPrefix("+") { s.removeFirst() }
        if s.hasPrefix("966") { s.removeFirst(3) }
        if s.hasPrefix("0") { s.removeFirst() }
        guard s.count == 9, s.hasPrefix("5"), s.allSatisfy(\.isNumber) else { return nil }
        return "0" + s
    }

    /// بدون منطقة مرسومة: المسافة من المحل أكثر من maxKm؟ يرجع المسافة (كم) لو بعيد، وإلا nil (مثل tooFar في الموقع)
    static func tooFar(_ c: CLLocationCoordinate2D, _ store: StoreInfo) -> Double? {
        guard store.zone.count < 3, let max = store.maxKm, let shop = store.shop else { return nil }
        let d = CLLocation(latitude: c.latitude, longitude: c.longitude).distance(from: CLLocation(latitude: shop[0], longitude: shop[1])) / 1000
        return d > max ? (d * 10).rounded() / 10 : nil
    }

    /// المنطقة المرسومة [[lat, lng]]. بدون منطقة = نقبل (الخادم يقرر)
    static func inZone(_ c: CLLocationCoordinate2D, _ zone: [[Double]]) -> Bool {
        guard zone.count >= 3 else { return true }
        var inside = false
        var j = zone.count - 1
        for i in 0..<zone.count {
            let (yi, xi) = (zone[i][0], zone[i][1]), (yj, xj) = (zone[j][0], zone[j][1])
            if (yi > c.latitude) != (yj > c.latitude),
               c.longitude < (xj - xi) * (c.latitude - yi) / (yj - yi) + xi {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    private static func signature(_ body: [String: Any]) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys]) else { return UUID().uuidString }
        return String(decoding: d, as: UTF8.self)
    }

    private static func store<T: Encodable>(_ value: T?, _ key: String) {
        if let value, let d = try? JSONEncoder().encode(value) { UserDefaults.standard.set(d, forKey: key) }
        else { UserDefaults.standard.removeObject(forKey: key) }
    }
    private static func load<T: Decodable>(_ key: String) -> T? {
        guard let d = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: d)
    }
}

/// نداء الخادم: POST JSON مع Origin المسموح للتطبيق. status 0 = ما وصلنا (نت)
enum API {
    static func post(_ base: String, _ path: String, _ body: [String: Any]) async -> (Int, [String: Any]) {
        guard let url = URL(string: base + path), let data = try? JSONSerialization.data(withJSONObject: body) else {
            return (0, ["code": "network"])
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.httpBody = data
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(AppConfig.origin, forHTTPHeaderField: "Origin")
        do {
            let (d, resp) = try await URLSession.shared.data(for: req)
            let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            let json = (try? JSONSerialization.jsonObject(with: d) as? [String: Any]) ?? [:]
            return (status, json)
        } catch {
            return (0, ["code": (error as? URLError)?.code == .timedOut ? "timeout" : "network"])
        }
    }
}
