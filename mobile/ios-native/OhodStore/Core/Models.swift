import Foundation

// نفس بيانات الموقع: data.json على GitHub Pages (المنتجات والأسعار والصور والإعدادات)
enum AppConfig {
    static let site = URL(string: "https://1097mbnalll-ui.github.io/Super/")!
    static let defaultAPI = "https://ohod-admin.1097mbnalll.workers.dev"
    /// الخادم يقبل هذا المصدر (ALLOWED_ORIGIN فيه capacitor://localhost)
    static let origin = "capacitor://localhost"

    static func asset(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http") { return URL(string: path) }
        guard path.hasPrefix("p/") || path.hasPrefix("cat/") else { return nil }
        return URL(string: path, relativeTo: site)?.absoluteURL
    }
}

struct Pack: Hashable, Sendable {
    let unit: String
    let count: Int
    let price: Double
}

struct SubCategory: Hashable, Sendable, Identifiable {
    let id: String
    let name: String
}

struct Category: Hashable, Sendable, Identifiable {
    let id: String
    let name: String
    let image: String?
    let tint: String?
    let soon: Bool
    let subs: [SubCategory]

    var emoji: String {
        if let custom = AppLook.current.catIcons[id] { return custom }
        switch id {
        case "bakery": return "🥐"
        case "dairy": return "🥛"
        case "cheese": return "🧀"
        case "veg": return "🥬"
        case "meat": return "🍗"
        case "pantry": return "🧺"
        case "roast": return "☕️"
        case "drinks": return "🥤"
        case "sweets": return "🍫"
        case "clean": return "🧴"
        case "care": return "🧼"
        case "misc": return "🏠"
        case "cartons": return "📦"
        case "print": return "🖨️"
        default: return "🛒"
        }
    }
}

struct Product: Hashable, Sendable, Identifiable {
    let id: String
    let name: String
    let unit: String
    let price: Double
    let old: Double?
    let cat: String
    let sub: String?
    let image: String?
    let inStock: Bool
    let packs: [Pack]
    let barcode: String?
    let max: Int?
    /// شارة المالك (طازج، جديد...) و«يحلى معه» (sugg)
    var badge: String? = nil
    var sugg: [String] = []
    /// الاسم باللغة الثانية (للبحث): الإنجليزي، أو العربي لو التطبيق إنجليزي
    var nameEN: String? = nil
    /// منتجات خدمة الطباعة (print): ما تطلع بالبحث
    var isPrint = false
    /// منتج «قريباً» (soon في data.json): ينشاف بدون سعر ولا إضافة
    var soon = false

    var imageURL: URL? { AppConfig.asset(image) }
    var hasPhoto: Bool { image?.hasPrefix("p/") == true }
    /// كرتون أو شدّة (الوحدة من ملف التحديث اليومي، أو خيار بيع) ← قسم «الكراتين والشدّات»
    var isCarton: Bool {
        let re = ["كرتون", "كرتونه", "شدّة", "شدة", "شده"]
        return re.contains { unit.hasPrefix($0) } || packs.contains { pk in pk.price > 0 && re.contains { pk.unit.hasPrefix($0) } }
    }
    var discount: Double? {
        guard let old, old > price else { return nil }
        return old - price
    }
    var discountPercent: Int? {
        guard let old, old > price else { return nil }
        return Swift.max(1, Int(((old - price) / old * 100).rounded()))
    }
    /// أول عرض كمية: N حبات بسعر أقل من N × سعر الحبة (مثل ٣ بـ ١٠)
    var quantityOffer: (index: Int, count: Int, price: Double, before: Double)? {
        for (i, p) in packs.enumerated() where p.count > 1 && p.price > 0 {
            let before = (Double(p.count) * price * 100).rounded() / 100
            if p.price < before - 0.001 { return (i, p.count, p.price, before) }
        }
        return nil
    }
    /// شارة العرض على البطاقة: «خصم ٢٠٪» أو «عرض ٣ حبات»
    var offerBadge: String? {
        if let d = discountPercent { return "خصم \(d)٪" }
        return nil
    }
    static func pieces(_ n: Int) -> String { n == 2 ? "حبتين" : n <= 10 ? "\(n) حبات" : "\(n) حبة" }
}

struct Banner: Hashable, Sendable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let target: String?   // cat:<id> أو prod:<id> أو offers
    let image: String?
    var color: String? = nil
    var style: String? = nil
    var kicker: String? = nil
    var go: String? = nil
    var ids: [String] = []
    /// باقة (style == "bundle"): سعرها كاملة
    var bundlePrice: Double? = nil
    var color2: String? = nil
    var dark = false
    /// بنر صورة كاملة من الإدارة (img) وهل يطلع النص فوقها
    var picture: String? = nil
    var showText = true
    var noGo = false
}

/// «كل منتج بـ ٠٫٩٥» (store.deal95): يفتح لما مجموع الطلب العادي يوصل min. المفتاح في السلة d:<id>
struct Deal95: Sendable {
    var on = false
    var min: Double = 0
    var price: Double = 0.95
    var limit = 0
    var ids: [String] = []
}

/// عرض اليوم (store.daily): منتج واحد يتغير كل يوم من القائمة. المفتاح t:<id>
struct DailyDeal: Sendable {
    struct Item: Sendable { let id: String; let price: Double }
    var on = false
    var limit = 0
    var list: [Item] = []
}

/// تعديلات المالك على بنر جاهز من لوحة الإدارة (store.banEdit): نفس اللي يقرأها الموقع، فالتعديل يطلع بالتطبيق بدون تحديث
struct BannerSettings: Hashable, Sendable {
    var title: String?
    var sub: String?
    var kicker: String?
    var go: String?
    var color: String?
    var style: String?
    var noGo = false
    var picsN: Int?
}

/// «شكل التطبيق» من لوحة الإدارة (store.app): أحجام الخط والألوان والأيقونات وترتيب الرئيسية.
/// يتغير في التطبيق أول ما ينفتح، بدون تحديث.
struct AppLook: Equatable, Sendable {
    var textScale: Double = 1
    var priceScale: Double = 1
    var bannerScale: Double = 1
    var brand: String? = nil
    var accent: String? = nil
    var header = "dark"
    var columns = 3
    var showFeatured = true
    var showChips = true
    var catIcons: [String: String] = [:]
    var tabIcons: [String: String] = [:]
    /// زر الإضافة: filled أخضر مليان / outline أبيض بإطار
    var addStyle = "filled"
    /// حواف الكروت: round / soft / square
    var radius = "round"
    /// خلفية الصفحات: white / gray
    var background = "white"
    var showCatChip = true

    /// النسخة المطبّقة الحين (تتغير لما تنحمّل بيانات المتجر)
    nonisolated(unsafe) static var current = AppLook()

    static func parse(_ any: Any?) -> AppLook {
        var l = AppLook()
        guard let o = any as? [String: Any] else { return l }
        func scale(_ v: Any?, _ lo: Double, _ hi: Double) -> Double? { CatalogParser.num(v).map { Swift.min(hi, Swift.max(lo, $0)) } }
        l.textScale = scale(o["textScale"], 0.8, 1.35) ?? 1
        l.priceScale = scale(o["priceScale"], 0.8, 1.4) ?? 1
        l.bannerScale = scale(o["bannerScale"], 0.75, 1.4) ?? 1
        l.brand = CatalogParser.str(o["brand"])
        l.accent = CatalogParser.str(o["accent"])
        l.header = CatalogParser.str(o["header"]) == "light" ? "light" : "dark"
        l.columns = CatalogParser.num(o["columns"]) == 2 ? 2 : 3
        l.showFeatured = (o["showFeatured"] as? Bool) ?? true
        l.showChips = (o["showChips"] as? Bool) ?? true
        for (k, v) in (o["catIcons"] as? [String: Any]) ?? [:] { if let e = CatalogParser.str(v) { l.catIcons[k] = String(e.prefix(4)) } }
        for (k, v) in (o["tabIcons"] as? [String: Any]) ?? [:] { if let e = CatalogParser.str(v) { l.tabIcons[k] = e } }
        l.addStyle = CatalogParser.str(o["addStyle"]) == "outline" ? "outline" : "filled"
        l.radius = ["soft", "square"].contains(CatalogParser.str(o["radius"]) ?? "") ? CatalogParser.str(o["radius"])! : "round"
        l.background = CatalogParser.str(o["background"]) == "gray" ? "gray" : "white"
        l.showCatChip = (o["showCatChip"] as? Bool) ?? true
        return l
    }
}

struct PromoSlot: Hashable, Sendable {
    let id: String
    let on: Bool
}

struct StoreInfo: Sendable {
    var name = "متاجر أحد"
    var phone = ""
    var whatsapp = ""
    var area = "حي الرمال"
    var hours = ""
    var eta = "30–45 دقيقة"
    var fee: Double = 0
    /// سعر التوصيل اللي يطلع مشطوب لما يكون مجاني (feeWas)، وينحسب ضمن «وفّرت»
    var feeWas: Double = 0
    var freeOver: Double = 0
    var minOrder: Double = 0
    var closed = false
    var closedMessage = ""
    /// مواعيد استقبال الطلبات اليومية بتوقيت الرياض ("12:00" و "01:00")، فاضي = مفتوح دايم
    var openAt: String? = nil
    var closeAt: String? = nil

    /// مقفل الحين: يدوي من الإدارة أو برا المواعيد (نفس حساب الموقع والخادم)
    var isClosedNow: Bool { closed || !StoreInfo.openNow(openAt, closeAt) }
    var closedNowMessage: String {
        if closed { return closedMessage }
        guard let a = openAt, let b = closeAt else { return "" }
        return "نستقبل الطلبات يومياً من \(StoreInfo.timeText(a)) لين \(StoreInfo.timeText(b)). تقدر تتصفح الحين وتطلب وقت الفتح."
    }
    static func minutes(_ x: String) -> Int { let q = x.split(separator: ":"); return (Int(q.first ?? "") ?? 0) * 60 + (q.count > 1 ? Int(q[1]) ?? 0 : 0) }
    static func openNow(_ a: String?, _ b: String?, now: Date = Date()) -> Bool {
        guard let a, let b else { return true }
        let m = Int((now.timeIntervalSince1970 / 60 + 180).truncatingRemainder(dividingBy: 1440))
        let o = minutes(a), c = minutes(b)
        return o == c ? true : o < c ? (m >= o && m < c) : (m >= o || m < c)
    }
    static func timeText(_ x: String) -> String {
        let t = minutes(x), h = t / 60, mi = t % 60
        let h12 = h == 0 ? 12 : h > 12 ? h - 12 : h
        let part = h == 0 || h < 5 ? "بالليل" : h < 12 ? "الصبح" : h < 16 ? "الظهر" : h < 19 ? "العصر" : "بالليل"
        return "\(h12)\(mi > 0 ? String(format: ":%02d", mi) : "") \(part)"
    }
    var api = AppConfig.defaultAPI
    var zone: [[Double]] = []
    /// إلغاء الزبون: new (قبل التجهيز) / accepted (قبل خروج المندوب) / off
    var custCancel = "new"
    var banners: [Banner] = []
    /// ترتيب البنرات وإخفاؤها (store.promos) وتعديلاتها (banEdit) وصورها المختارة (banPicks)
    var promos: [PromoSlot] = []
    var banEdit: [String: BannerSettings] = [:]
    var banPicks: [String: [String]] = [:]
    var look = AppLook()
    var deal95 = Deal95()
    var daily = DailyDeal()
    /// مختارات المالك أول الرئيسية (store.forYou)، وforOnly = الرئيسية تعرضها بس
    var forYou: [String] = []
    var forOnly = false
    /// «باقي N بس» يطلع لما المخزون الحي ≤ lowAt (افتراضي ٣)
    var lowAt = 3
    /// بدون منطقة مرسومة: المسافة القصوى من المحل (كم) وموقع المحل [lat, lng]، ومركز الخريطة
    var maxKm: Double? = nil
    var shop: [Double]? = nil
    var mapCenter: [Double]? = nil
    /// ترتيب أقسام الرئيسية (store.layout)
    var layout: [PromoSlot] = []
    /// عروض المجموعات (store.groups): «أي ٣ علب بـ …» تنختار من صفحة حية من الموقع
    var groups: [ProductGroup] = []
    /// الخانات الحية (store.app.slots): صفحة المنتج والسلة تعرض أجزاء من الموقع (ميزات جديدة بدون تحديث). افتراضياً شغّالة
    var liveProduct = true
    var liveCart = true
    /// تصرف الأزرار من الموقع (store.app.tap): «هالمنتج لما ينضغط يفتح صفحة كذا» بدون تحديث للتطبيق
    var tapRules: [TapRule] = []
    /// شاشات التطبيق اللي تنعرض من الموقع (store.app.web): true = كل الشاشات، أو قائمة مثل ["home","cat","product","cart"].
    /// المالك يقلبها من data.json فأي تعديل في الموقع يطلع في التطبيق بدون تحديث
    var webScreens: Set<String> = []
    /// خدمة الطباعة (store.print): «قريباً»، وأقل طلب لو السلة طباعة بس
    var printSoon = false
    var printMinOrder: Double? = nil
}

/// قاعدة تصرف زر (store.app.tap = [{on, ids, cat, group, page, label}]): أول قاعدة تطابق تفوز.
/// on: add (زر + في الكرت) / open (الضغط على الكرت) / buy (زر صفحة المنتج). page: صفحة حية مثل «g:{group}:{id}»
/// أو «o:{cat}»، ويتبدل فيها {id} {group} {cat}. page فاضي = التصرف الأصلي للتطبيق
struct TapRule: Sendable, Hashable {
    let on: Set<String>
    let ids: Set<String>?
    let cats: Set<String>?
    let group: Bool?
    let offer: Bool?
    let page: String
    let label: String?
}

struct ProductGroup: Sendable, Hashable {
    let id: String
    let name: String
    let count: Int
    let price: Double
    let ids: [String]
}

struct Catalog: Sendable {
    var store: StoreInfo
    var categories: [Category]
    var products: [Product]
}

/// تحليل data.json بتسامح: أي منتج ناقص أو غلط ينتجاهل بدل ما يطيح كل الملف
enum CatalogParser {
    static func parse(_ data: Data) throws -> Catalog {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw URLError(.cannotParseResponse)
        }
        let s = root["store"] as? [String: Any] ?? [:]
        var store = StoreInfo()
        let en = AppLang.english
        /// الحقل الإنجليزي (name_en...) لو التطبيق إنجليزي وموجود
        func pick(_ k: String) -> Any? { en ? (s[k + "_en"] ?? s[k]) : s[k] }
        store.name = str(pick("name")) ?? store.name
        store.phone = str(s["phone"]) ?? ""
        store.whatsapp = str(s["wa"]) ?? store.phone
        store.area = str(pick("area")) ?? store.area
        store.hours = str(pick("hours")) ?? ""
        store.eta = str(pick("eta")).map(latinDigits) ?? store.eta
        store.fee = num(s["fee"]) ?? 0
        store.freeOver = num(s["freeOver"]) ?? 0
        store.feeWas = max(0, num(s["feeWas"]) ?? 0)
        store.minOrder = num(s["minOrder"]) ?? 0
        store.closed = (s["closed"] as? Bool) ?? false
        store.closedMessage = str(pick("closedMsg")) ?? str(s["closedMessage"]) ?? ""
        store.openAt = str(s["openAt"])
        store.closeAt = str(s["closeAt"])
        store.api = str(s["api"]) ?? AppConfig.defaultAPI
        store.custCancel = str(s["custCancel"]) ?? "new"
        if let zone = s["zone"] as? [[Any]] {
            store.zone = zone.compactMap { pair in
                guard pair.count == 2, let a = num(pair[0]), let b = num(pair[1]) else { return nil }
                return [a, b]
            }
        }
        // بنرات المالك من لوحة الإدارة. بنرات العروض تنبني في الرئيسية من العروض الحقيقية
        var banners: [Banner] = []
        for b in (s["bans"] as? [[String: Any]]) ?? [] {
            guard let id = str(b["id"]), let title = text(en ? (b["title_en"] ?? b["title"]) : b["title"]) else { continue }
            banners.append(Banner(id: id, title: title, subtitle: text(en ? (b["sub_en"] ?? b["sub"]) : b["sub"]) ?? "", target: str(b["target"]), image: nil,
                                  color: str(b["color"]), style: str(b["style"]), kicker: text(b["k"]), go: text(b["go"]),
                                  ids: (b["ids"] as? [Any])?.compactMap { str($0) } ?? [],
                                  bundlePrice: num(b["bprice"]), color2: str(b["color2"]), dark: (b["dark"] as? Bool) ?? false,
                                  picture: str(b["img"]), showText: (b["showText"] as? Bool) ?? true, noGo: (b["noGo"] as? Bool) ?? false))
        }
        store.look = AppLook.parse(s["app"])
        store.promos = ((s["promos"] as? [[String: Any]]) ?? []).compactMap { x in
            str(x["id"]).map { PromoSlot(id: $0, on: (x["on"] as? Bool) ?? true) }
        }
        for (k, v) in (s["banEdit"] as? [String: Any]) ?? [:] {
            guard let o = v as? [String: Any] else { continue }
            store.banEdit[k] = BannerSettings(title: text(o["title"]), sub: text(o["sub"]), kicker: text(o["k"]), go: text(o["go"]),
                                              color: str(o["color"]), style: str(o["style"]), noGo: (o["noGo"] as? Bool) ?? false,
                                              picsN: num(o["picsN"]).map { Int($0) })
        }
        for (k, v) in (s["banPicks"] as? [String: Any]) ?? [:] {
            let ids = (v as? [Any])?.compactMap { str($0) } ?? []
            if !ids.isEmpty { store.banPicks[k] = ids }
        }
        store.banners = banners
        if let d = s["deal95"] as? [String: Any] {
            store.deal95 = Deal95(on: (d["on"] as? Bool) ?? false, min: num(d["min"]) ?? 0, price: num(d["price"]) ?? 0.95,
                                  limit: Int(num(d["limit"]) ?? 0), ids: (d["ids"] as? [Any])?.compactMap { str($0) } ?? [])
        }
        if let d = s["daily"] as? [String: Any] {
            store.daily = DailyDeal(on: (d["on"] as? Bool) ?? false, limit: Int(num(d["limit"]) ?? 0),
                                    list: ((d["list"] as? [[String: Any]]) ?? []).compactMap { x in
                                        guard let id = str(x["id"]), let pr = num(x["price"]) else { return nil }
                                        return DailyDeal.Item(id: id, price: pr)
                                    })
        }
        if let pr = s["print"] as? [String: Any] {
            store.printSoon = (pr["soon"] as? Bool) ?? false
            store.printMinOrder = num(pr["minOrder"])
        }
        store.forYou = (s["forYou"] as? [Any])?.compactMap { str($0) } ?? []
        store.forOnly = (s["forOnly"] as? Bool) ?? false
        if s["lowAt"] != nil, let v = num(s["lowAt"]) { store.lowAt = Int(v) }
        store.maxKm = num(s["maxKm"]).flatMap { $0 > 0 ? $0 : nil }
        func point(_ any: Any?) -> [Double]? {
            guard let a = any as? [Any], a.count == 2, let la = num(a[0]), let ln = num(a[1]) else { return nil }
            return [la, ln]
        }
        store.shop = point(s["shop"])
        store.mapCenter = point(s["mapCenter"])
        store.layout = ((s["layout"] as? [[String: Any]]) ?? []).compactMap { x in
            str(x["id"]).map { PromoSlot(id: $0, on: (x["on"] as? Bool) ?? true) }
        }
        store.groups = ((s["groups"] as? [[String: Any]]) ?? []).compactMap { g in
            guard (g["on"] as? Bool) != false, let id = str(g["id"]), let pr = num(g["price"]), let ids = g["ids"] as? [String], !ids.isEmpty else { return nil }
            return ProductGroup(id: id, name: str(g["name"]) ?? "", count: Int(num(g["n"]) ?? 3), price: pr, ids: ids)
        }
        if let app = s["app"] as? [String: Any], let slots = app["slots"] as? [String: Any] {
            store.liveProduct = (slots["product"] as? Bool) ?? true
            store.liveCart = (slots["cart"] as? Bool) ?? true
        }
        if let app = s["app"] as? [String: Any] {
            if (app["web"] as? Bool) == true { store.webScreens = ["*"] }
            else if let l = app["web"] as? [Any] { store.webScreens = Set(l.compactMap { str($0) }) }
        }
        if let app = s["app"] as? [String: Any], let taps = app["tap"] as? [[String: Any]] {
            let set: (Any?) -> Set<String>? = { v in
                if let a = v as? [Any] { return Set(a.compactMap { str($0) }) }
                return str(v).map { Set([$0]) }
            }
            store.tapRules = taps.compactMap { t in
                guard let on = set(t["on"]), !on.isEmpty else { return nil }
                return TapRule(on: on, ids: set(t["ids"]), cats: set(t["cat"]), group: t["group"] as? Bool, offer: t["offer"] as? Bool,
                               page: str(t["page"]) ?? "", label: str(t["label"]))
            }
        }

        let cats: [Category] = ((root["cats"] as? [[String: Any]]) ?? []).compactMap { c in
            guard let id = str(c["id"]), let name = str(en ? (c["name_en"] ?? c["name"]) : c["name"]) else { return nil }
            let subs: [SubCategory] = ((c["subs"] as? [[String: Any]]) ?? []).compactMap { sc in
                guard let sid = str(sc["id"]), let sname = str(en ? (sc["name_en"] ?? sc["name"]) : sc["name"]) else { return nil }
                return SubCategory(id: sid, name: sname)
            }
            // قسم الطباعة «قريباً» من إعداد الطباعة (catSoon في الموقع)
            return Category(id: id, name: name, image: str(c["img"]), tint: str(c["tint"]),
                            soon: id == "print" ? store.printSoon : ((c["soon"] as? Bool) ?? false), subs: subs)
        }

        let products: [Product] = ((root["products"] as? [[String: Any]]) ?? []).compactMap { p in
            guard let id = str(p["id"]), let name = str(en ? (p["name_en"] ?? p["name"]) : p["name"]), let price = num(p["price"]), price > 0,
                  let cat = str(p["cat"]) else { return nil }
            // نفس ترقيم الخادم (packProduct): ما نشيل أي خيار عشان ما يتغير رقم «id~رقم»؛ الخيار بدون سعر يبقى مكانه ومخفي
            let packs: [Pack] = ((p["packs"] as? [[String: Any]]) ?? []).map { pk in
                let pr = num(pk["price"]) ?? 0
                return Pack(unit: str(pk["u"]) ?? "", count: Swift.max(1, Int(num(pk["n"]) ?? 1)), price: pr > 0 ? pr : 0)
            }
            let old = num(p["old"])
            return Product(id: id, name: name, unit: en ? (str(p["unit_en"]) ?? tr(str(p["unit"]) ?? "")) : (str(p["unit"]) ?? ""), price: price,
                           old: (old ?? 0) > price ? old : nil, cat: cat, sub: str(p["sub"]),
                           image: str(p["img"]), inStock: (p["stock"] as? Bool) ?? true, packs: packs,
                           barcode: str(p["bc"]), max: num(p["max"]).map { Int($0) },
                           badge: str(en ? (p["badge_en"] ?? p["badge"]) : p["badge"]), sugg: (p["sugg"] as? [Any])?.compactMap { str($0) } ?? [],
                           nameEN: str(en ? p["name"] : p["name_en"]), isPrint: p["print"] != nil && !(p["print"] is NSNull) && (p["print"] as? Bool) != false,
                           soon: (p["soon"] as? Bool) ?? false)
        }
        return Catalog(store: store, categories: cats, products: products)
    }

    static func num(_ any: Any?) -> Double? {
        if let n = any as? NSNumber { return n.doubleValue }
        if let s = any as? String { return Double(latinDigits(s)) }
        return nil
    }

    /// نص من الإدارة: <br> سطر جديد، وبدون وسوم HTML
    static func text(_ any: Any?) -> String? {
        guard var t = str(any) else { return nil }
        t = t.replacingOccurrences(of: "<br>", with: "\n").replacingOccurrences(of: "<br/>", with: "\n")
        t = t.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        let out = t.trimmingCharacters(in: .whitespacesAndNewlines)
        return out.isEmpty ? nil : out
    }

    static func str(_ any: Any?) -> String? {
        if let s = any as? String {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        if let n = any as? NSNumber { return n.stringValue }
        return nil
    }

    static func latinDigits(_ s: String) -> String {
        var out = ""
        for ch in s.unicodeScalars {
            switch ch.value {
            case 0x0660...0x0669: out.unicodeScalars.append(Unicode.Scalar(ch.value - 0x0660 + 0x30)!)
            case 0x06F0...0x06F9: out.unicodeScalars.append(Unicode.Scalar(ch.value - 0x06F0 + 0x30)!)
            default: out.unicodeScalars.append(ch)
            }
        }
        return out
    }
}

/// تطبيع البحث العربي: بدون تشكيل، الهمزات = ا، ة = ه، ى = ي، والأرقام عربية أو إنجليزية
enum ArabicSearch {
    static func normalize(_ s: String) -> String {
        var out = ""
        out.reserveCapacity(s.count)
        for ch in CatalogParser.latinDigits(s).lowercased().unicodeScalars {
            switch ch.value {
            case 0x064B...0x065F, 0x0670, 0x0640: continue           // تشكيل وتطويل
            case 0x0622, 0x0623, 0x0625, 0x0671: out.append("ا")
            case 0x0629: out.append("ه")
            case 0x0649: out.append("ي")
            case 0x0624: out.append("و")
            case 0x0626: out.append("ي")
            default: out.unicodeScalars.append(ch)
            }
        }
        return out
    }

    static func words(_ query: String) -> [String] {
        normalize(query).split(whereSeparator: { $0 == " " || $0 == "\n" }).map(String.init)
    }
}
