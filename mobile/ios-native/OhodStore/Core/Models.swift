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

    var imageURL: URL? { AppConfig.asset(image) }
    var hasPhoto: Bool { image?.hasPrefix("p/") == true }
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
        for (i, p) in packs.enumerated() where p.count > 1 {
            let before = (Double(p.count) * price * 100).rounded() / 100
            if p.price < before - 0.001 { return (i, p.count, p.price, before) }
        }
        return nil
    }
    /// شارة العرض على البطاقة: «خصم ٢٠٪» أو «عرض ٣ حبات»
    var offerBadge: String? {
        if let d = discountPercent { return "خصم \(d)٪" }
        if let q = quantityOffer { return "عرض \(Product.pieces(q.count))" }
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
}

struct StoreInfo: Sendable {
    var name = "متاجر أحد"
    var phone = ""
    var whatsapp = ""
    var area = "حي الرمال"
    var hours = ""
    var eta = "30–45 دقيقة"
    var fee: Double = 0
    var freeOver: Double = 0
    var minOrder: Double = 0
    var closed = false
    var closedMessage = ""
    var api = AppConfig.defaultAPI
    var zone: [[Double]] = []
    /// إلغاء الزبون: new (قبل التجهيز) / accepted (قبل خروج المندوب) / off
    var custCancel = "new"
    var banners: [Banner] = []
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
        store.name = str(s["name"]) ?? store.name
        store.phone = str(s["phone"]) ?? ""
        store.whatsapp = str(s["wa"]) ?? store.phone
        store.area = str(s["area"]) ?? store.area
        store.hours = str(s["hours"]) ?? ""
        store.eta = str(s["eta"]).map(latinDigits) ?? store.eta
        store.fee = num(s["fee"]) ?? 0
        store.freeOver = num(s["freeOver"]) ?? 0
        store.minOrder = num(s["minOrder"]) ?? 0
        store.closed = (s["closed"] as? Bool) ?? false
        store.closedMessage = str(s["closedMsg"]) ?? str(s["closedMessage"]) ?? ""
        store.api = str(s["api"]) ?? AppConfig.defaultAPI
        store.custCancel = str(s["custCancel"]) ?? "new"
        if let zone = s["zone"] as? [[Any]] {
            store.zone = zone.compactMap { pair in
                guard pair.count == 2, let a = num(pair[0]), let b = num(pair[1]) else { return nil }
                return [a, b]
            }
        }
        var banners: [Banner] = [
            Banner(id: "bakery", title: "خبز وكيك\nطازج كل يوم", subtitle: "من مخبز متاجر أحد 🥐", target: "cat:bakery", image: "cat/bakery.webp"),
            Banner(id: "offers", title: "عروض\nالأسبوع", subtitle: "أسعار أقل على منتجات مختارة", target: "offers", image: nil),
        ]
        for b in (s["bans"] as? [[String: Any]]) ?? [] {
            guard let id = str(b["id"]), let title = str(b["title"]) else { continue }
            banners.append(Banner(id: id, title: title, subtitle: "", target: str(b["target"]), image: nil))
        }
        store.banners = banners

        let cats: [Category] = ((root["cats"] as? [[String: Any]]) ?? []).compactMap { c in
            guard let id = str(c["id"]), let name = str(c["name"]) else { return nil }
            let subs: [SubCategory] = ((c["subs"] as? [[String: Any]]) ?? []).compactMap { sc in
                guard let sid = str(sc["id"]), let sname = str(sc["name"]) else { return nil }
                return SubCategory(id: sid, name: sname)
            }
            return Category(id: id, name: name, image: str(c["img"]), tint: str(c["tint"]),
                            soon: (c["soon"] as? Bool) ?? false, subs: subs)
        }

        let products: [Product] = ((root["products"] as? [[String: Any]]) ?? []).compactMap { p in
            guard let id = str(p["id"]), let name = str(p["name"]), let price = num(p["price"]), price > 0,
                  let cat = str(p["cat"]) else { return nil }
            let packs: [Pack] = ((p["packs"] as? [[String: Any]]) ?? []).compactMap { pk in
                guard let unit = str(pk["u"]), let n = num(pk["n"]), let pr = num(pk["price"]), n >= 1, pr > 0 else { return nil }
                return Pack(unit: unit, count: Int(n), price: pr)
            }
            let old = num(p["old"])
            return Product(id: id, name: name, unit: str(p["unit"]) ?? "", price: price,
                           old: (old ?? 0) > price ? old : nil, cat: cat, sub: str(p["sub"]),
                           image: str(p["img"]), inStock: (p["stock"] as? Bool) ?? true, packs: packs,
                           barcode: str(p["bc"]), max: num(p["max"]).map { Int($0) })
        }
        return Catalog(store: store, categories: cats, products: products)
    }

    static func num(_ any: Any?) -> Double? {
        if let n = any as? NSNumber { return n.doubleValue }
        if let s = any as? String { return Double(latinDigits(s)) }
        return nil
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
