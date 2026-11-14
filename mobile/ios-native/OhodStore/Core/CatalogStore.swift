import Foundation
import Observation

/// فهرس مبني في الخلفية مرة وحدة (٧٬٧٠٠+ منتج) عشان الشاشات ما تحسب شي داخل body
struct CatalogIndex: Sendable {
    let catalog: Catalog
    let byId: [String: Product]
    let categoriesById: [String: Category]
    let byCategory: [String: [Product]]
    let search: [(id: String, text: String, barcode: String)]
    let offers: [Product]
    let featured: [Product]

    static func build(from data: Data) throws -> CatalogIndex {
        let catalog = try CatalogParser.parse(data)
        var byId: [String: Product] = [:]
        byId.reserveCapacity(catalog.products.count)
        var byCategory: [String: [Product]] = [:]
        for p in catalog.products {
            byId[p.id] = p
            byCategory[p.cat, default: []].append(p)
        }
        // قسم «الكراتين والشدّات» (cartons): كل منتج وحدته كرتون/شدّة أو له خيار كرتون/شدّة، من كل الأقسام (مثل الموقع)
        if catalog.categories.contains(where: { $0.id == "cartons" }) {
            byCategory["cartons"] = catalog.products.filter(\.isCarton)
        }
        // داخل كل قسم: المتوفر أول، وبعده اللي له صورة، مع الحفاظ على ترتيب المتجر
        for (k, list) in byCategory {
            byCategory[k] = list.enumerated().sorted { a, b in
                let ra = (a.element.inStock ? 0 : 2) + (a.element.hasPhoto ? 0 : 1)
                let rb = (b.element.inStock ? 0 : 2) + (b.element.hasPhoto ? 0 : 1)
                return ra == rb ? a.offset < b.offset : ra < rb
            }.map(\.element)
        }
        // البحث يشمل أسماء الخيارات (شدّة/كرتون) وكلماتها العامة، و«موية» للماء
        let water = try? NSRegularExpression(pattern: "(^|\\s)(ماء|مياه)(\\s|$)")
        let catNames = Dictionary(catalog.categories.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
        let search = catalog.products.filter { !$0.isPrint }.map { p -> (id: String, text: String, barcode: String) in
            // نفس فهرس الموقع: الاسم والإنجليزي والباركود واسم القسم والخيارات
            var text = [p.name, p.nameEN ?? "", p.barcode ?? "", catNames[p.cat] ?? "", p.unit, p.isCarton ? "كرتون كرتونه شده شد كراتين جملة" : ""].joined(separator: " ")
            if !p.packs.isEmpty { text += " " + p.packs.map(\.unit).joined(separator: " ") + " كرتون كرتونه شده شد باكت علبه" }
            if water?.firstMatch(in: p.name, range: NSRange(p.name.startIndex..., in: p.name)) != nil { text += " موية مويه مويا مياه ماء" }
            return (id: p.id, text: ArabicSearch.normalize(text), barcode: p.barcode ?? "")
        }
        // منتجات «اختر من أي نوع» (ديمة) عروض بعد، تطلع في تبويب العروض
        let inGroup = Set(catalog.store.groups.flatMap(\.ids))
        let offers = catalog.products.filter { $0.inStock && ($0.discount != nil || $0.quantityOffer != nil || inGroup.contains($0.id)) }
            .sorted { ($0.hasPhoto ? 0 : 1, -($0.discount ?? 0)) < ($1.hasPhoto ? 0 : 1, -($1.discount ?? 0)) }
        // مختارات الرئيسية: العروض اللي لها صور، ثم منتجات بصور من أهم الأقسام بالتناوب
        var featured = offers.filter(\.hasPhoto)
        var seen = Set(featured.map(\.id))
        let lanes = ["bakery", "dairy", "drinks", "sweets", "pantry", "clean", "care"].map { id in
            (byCategory[id] ?? []).filter { $0.inStock && $0.hasPhoto }
        }
        var i = 0
        while featured.count < 60 && i < 40 {
            for lane in lanes where i < lane.count && !seen.contains(lane[i].id) {
                featured.append(lane[i]); seen.insert(lane[i].id)
            }
            i += 1
        }
        return CatalogIndex(catalog: catalog, byId: byId,
                            categoriesById: Dictionary(catalog.categories.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first }),
                            byCategory: byCategory, search: search, offers: offers, featured: featured)
    }
}

struct PromoLine {
    enum Kind { case deal, daily, bundle }
    let kind: Kind
    let product: Product
    let price: Double
    let limit: Int?
    /// العرض لسا شغّال (لو انتهى: عرض اليوم يرجع سعر عادي، و٠٫٩٥ ينشال)
    let valid: Bool
    var bannerID: String? = nil
}

@MainActor
@Observable
final class CatalogStore {
    private(set) var index: CatalogIndex?
    private(set) var failed = false
    private(set) var liveStock: [String: Int] = [:]
    @ObservationIgnored private var lastStock = Date.distantPast

    var store: StoreInfo {
        guard previewPromos, var st = index?.catalog.store, let f = index?.featured, f.count > 12 else { return index?.catalog.store ?? StoreInfo() }
        // للتصوير بس (-seed-promos): عروض المتجر شغّالة على منتجات من المختارات
        st.deal95 = Deal95(on: true, min: 30, price: 0.95, limit: 1, ids: f[6..<12].map(\.id))
        st.daily = DailyDeal(on: true, limit: 2, list: [DailyDeal.Item(id: f[0].id, price: (f[0].price * 0.7 * 100).rounded() / 100)])
        let ids = f[1..<4].map(\.id)
        let sum = f[1..<4].reduce(0) { $0 + $1.price }
        if !st.banners.contains(where: { $0.id == "pv-bundle" }) {
            st.banners.append(Banner(id: "pv-bundle", title: "باقة الفطور", subtitle: "", target: nil, image: nil, color: nil, style: "bundle",
                                     ids: ids, bundlePrice: (sum * 0.85 * 100).rounded() / 100))
        }
        return st
    }
    /// للتصوير على المحاكي بس
    var previewPromos = false
    var categories: [Category] { index?.catalog.categories ?? [] }

    func product(_ id: String) -> Product? { index?.byId[id] }
    /// عرض المجموعة اللي فيه المنتج (store.groups)
    func group(for productID: String) -> ProductGroup? { store.groups.first { $0.ids.contains(productID) } }

    /// وين يروح الزر (store.app.tap من الموقع). nil = تصرف التطبيق الأصلي. منتج داخل عرض مجموعة: «أضف» يفتح نافذة الاختيار (افتراضي)
    func tap(_ on: String, _ p: Product) -> (page: String, label: String?)? {
        let g = group(for: p.id)
        for r in store.tapRules where r.on.contains(on) {
            if let ids = r.ids, !ids.contains(p.id) { continue }
            if let cats = r.cats, !cats.contains(p.cat) { continue }
            if let want = r.group, want != (g != nil) { continue }
            if let want = r.offer, want != (p.old != nil) { continue }
            if r.page.isEmpty || r.page == "native" { return nil }
            let page = r.page.replacingOccurrences(of: "{id}", with: p.id).replacingOccurrences(of: "{group}", with: g?.id ?? "")
                .replacingOccurrences(of: "{cat}", with: p.cat)
            return (page, r.label)
        }
        if let g, on == "add" || on == "buy" { return ("g:\(g.id):\(p.id)", nil) }
        return nil
    }
    func category(_ id: String) -> Category? { index?.categoriesById[id] }
    func products(in category: String) -> [Product] { index?.byCategory[category] ?? [] }

    /// هل الشاشة تنعرض من الموقع (store.app.web)
    func web(_ key: String) -> Bool { store.webScreens.contains("*") || store.webScreens.contains(key) }

    /// «قريباً»: منتج جديد بدون سعر أو في قسم قريباً، ينعرض بدون إضافة
    func isSoon(_ p: Product) -> Bool { !isAvailable(p) && (p.soon || category(p.cat)?.soon == true) }

    func isAvailable(_ p: Product) -> Bool {
        guard p.inStock, !p.soon, category(p.cat)?.soon != true else { return false }
        if let left = liveStock[p.id] { return left > 0 }
        return true
    }

    /// المفتاح "id" أو "id~رقم الخيار" (نفس صيغة الموقع والخادم)
    func resolve(_ key: String) -> (product: Product, pack: Pack?, packIndex: Int?)? {
        let parts = key.split(separator: "~", maxSplits: 1).map(String.init)
        guard let p = product(parts[0]) else { return nil }
        if parts.count == 2 {
            guard let i = Int(parts[1]), i >= 0, i < p.packs.count, p.packs[i].price > 0 else { return nil }
            return (p, p.packs[i], i)
        }
        return (p, nil, nil)
    }

    func search(_ query: String, limit: Int = 120) -> [Product] {
        guard let index else { return [] }
        let words = ArabicSearch.words(query)
        guard !words.isEmpty else { return [] }
        let digits = CatalogParser.latinDigits(query).filter(\.isNumber)
        var hits: [Product] = []
        for entry in index.search {
            if (digits.count >= 6 && entry.barcode.contains(digits)) || words.allSatisfy({ entry.text.contains($0) }),
               let p = index.byId[entry.id] {
                hits.append(p)
                if hits.count >= limit * 3 { break }
            }
        }
        return Array(hits.sorted { (isAvailable($0) ? 0 : 1, $0.hasPhoto ? 0 : 1) < (isAvailable($1) ? 0 : 1, $1.hasPhoto ? 0 : 1) }.prefix(limit))
    }

    // MARK: عروض المتجر (نفس الموقع: dealsList / daily / bundleAlloc / lineOf)

    var dealOn: Bool { store.deal95.on }
    /// منتجات «كل منتج بـ ٠٫٩٥» المتوفرة
    var dealProducts: [Product] { dealOn ? store.deal95.ids.compactMap { product($0) }.filter { isAvailable($0) } : [] }

    /// رقم اليوم (تاريخ الجوال) مثل dayNo في الموقع
    static func dayNo(_ now: Date = Date()) -> Int {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: now)
        var utc = Calendar(identifier: .gregorian); utc.timeZone = TimeZone(identifier: "UTC")!
        let d = utc.date(from: DateComponents(year: c.year, month: c.month, day: c.day)) ?? now
        return Int(floor(d.timeIntervalSince1970 / 86400))
    }

    /// عرض اليوم: منتج واحد يتبدل كل يوم من القائمة (المتوفر بس)
    var dailyDeal: (product: Product, price: Double)? {
        let d = store.daily
        guard d.on else { return nil }
        let l: [(Product, Double)] = d.list.compactMap { x in
            guard let p = product(x.id), p.inStock, x.price > 0 else { return nil }
            return (p, x.price)
        }
        guard !l.isEmpty else { return nil }
        let x = l[Self.dayNo() % l.count]
        return (x.0, x.1)
    }

    /// الباقة: ٢–٤ منتجات متوفرة بسعر أقل من مجموعها، ويتوزع السعر عليها نسبياً (الأخير ياخذ الباقي)
    func bundle(_ b: Banner) -> (ids: [String], alloc: [String: Double], sum: Double, price: Double)? {
        guard b.style == "bundle" else { return nil }
        var seen = Set<String>()
        let ids = Array(b.ids.filter { !$0.isEmpty && seen.insert($0).inserted }.prefix(4))
        guard ids.count >= 2 else { return nil }
        let ps = ids.compactMap { product($0) }
        guard ps.count == ids.count, ps.allSatisfy(\.inStock) else { return nil }
        let sum = (ps.reduce(0) { $0 + $1.price } * 100).rounded() / 100
        guard let bp = b.bundlePrice, bp > 0, bp < sum else { return nil }
        var alloc: [String: Double] = [:]
        var acc = 0.0
        for (i, p) in ps.enumerated() where i < ps.count - 1 {
            let v = (p.price * bp / sum * 100).rounded() / 100
            alloc[p.id] = v; acc += v
        }
        alloc[ps[ps.count - 1].id] = ((bp - acc) * 100).rounded() / 100
        return (ids, alloc, sum, bp)
    }
    func banner(_ id: String) -> Banner? { store.banners.first { $0.id == id } }

    /// سطر عرض: d:<id> (٠٫٩٥) أو t:<id> (عرض اليوم) أو x:<بنر>:<id> (باقة). nil = مو سطر عرض أو انتهى
    func promoLine(_ key: String) -> PromoLine? {
        let k = key.split(separator: ":").map(String.init)
        guard k.count >= 2 else { return nil }
        switch k[0] {
        case "d":
            guard let p = product(k[1]) else { return nil }
            return PromoLine(kind: .deal, product: p, price: store.deal95.price, limit: cap(p, store.deal95.limit),
                             valid: dealOn && store.deal95.ids.contains(p.id))
        case "t":
            guard let p = product(k[1]) else { return nil }
            let dd = dailyDeal
            let ok = dd?.product.id == p.id
            return PromoLine(kind: .daily, product: p, price: ok ? dd!.price : p.price, limit: cap(p, store.daily.limit), valid: ok)
        case "x":
            guard k.count == 3, let p = product(k[2]), let b = banner(k[1]), let al = bundle(b), let price = al.alloc[p.id] else { return nil }
            return PromoLine(kind: .bundle, product: p, price: price, limit: nil, valid: true, bannerID: b.id)
        default: return nil
        }
    }

    /// capOf في الموقع: حد العرض، وحد المنتج، والمخزون الحي
    func cap(_ p: Product, _ base: Int) -> Int? {
        var c = base > 0 ? base : 0
        if let m = p.max, m > 0 { c = c > 0 ? Swift.min(c, m) : m }
        if let l = liveStock[p.id], l > 0 { c = c > 0 ? Swift.min(c, l) : l }
        return c > 0 ? c : nil
    }

    /// باقي كم من المنتج (المخزون الحي) لو أقل من حد التنبيه
    func lowLeft(_ p: Product) -> Int? {
        guard isAvailable(p), let l = liveStock[p.id], l <= store.lowAt else { return nil }
        return l
    }

    /// الخادم قال إن المنتج باقي منه كذا (وقت إرسال الطلب)
    func setLiveStock(_ id: String, _ left: Int) { liveStock[id] = left }

    var apiBase: String { store.api.trimmingCharacters(in: CharacterSet(charactersIn: "/")) }

    // MARK: تحميل البيانات (من الجوال أول، وبعدها من الموقع)

    func load() async {
        if index == nil, let cached = Self.readCache() {
            // البصمة قبل ما تنرسم الرئيسية، عشان الصفحة الحية ما تنفتح مرتين (مرة بنسخة 0 ومرة بالبصمة)
            let t = await Task.detached(priority: .userInitiated) { Self.tag(cached) }.value
            try? await apply(cached)
            dataTag = t
        }
        await refresh()
    }

    @ObservationIgnored private var lastRefresh = Date.distantPast
    /// يزيد مع كل تحديث ناجح للمتجر (الرئيسية الحية تعيد التحميل)
    private(set) var version = 0
    /// بصمة نسخة البيانات: الصفحات الحية ما تعيد التحميل إلا لو المتجر تغيّر فعلاً (مو مع كل فتحة للتطبيق)
    private(set) var dataTag = "0"
    nonisolated private static func tag(_ d: Data) -> String {
        var h: UInt64 = 1469598103934665603
        for b in d { h = (h ^ UInt64(b)) &* 1099511628211 }
        return String(h % 1_000_000_007, radix: 36)
    }

    /// لما يرجع الزبون للتطبيق: نجيب آخر نسخة من المتجر (بنرات، أسعار، عروض) لو مر عليها أكثر من دقيقة
    func refreshIfStale() async {
        guard Date().timeIntervalSince(lastRefresh) > 60 else { await refreshStock(); return }
        await refresh()
    }

    func refresh() async {
        lastRefresh = Date()
        do {
            var comps = URLComponents(url: AppConfig.site.appendingPathComponent("data.json"), resolvingAgainstBaseURL: false)!
            comps.queryItems = [URLQueryItem(name: "v", value: String(Int(Date().timeIntervalSince1970)))]
            var req = URLRequest(url: comps.url!)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            req.timeoutInterval = 20
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let t = await Task.detached(priority: .userInitiated) { Self.tag(data) }.value
            if t != dataTag || index == nil {
                try await apply(data)
                Self.writeCache(data)
                dataTag = t
                version += 1
            }
            failed = false
        } catch {
            if index == nil { failed = true }
        }
        await refreshStock(force: true)
    }

    func refreshStock(force: Bool = false) async {
        guard force || Date().timeIntervalSince(lastStock) > 60 else { return }
        lastStock = Date()
        guard let url = URL(string: store.api.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/stock") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        req.setValue(AppConfig.origin, forHTTPHeaderField: "Origin")
        guard let result = try? await URLSession.shared.data(for: req),
              let json = try? JSONSerialization.jsonObject(with: result.0) as? [String: Any],
              let stock = json["stock"] as? [String: Any] else { return }
        var live: [String: Int] = [:]
        for (k, v) in stock { if let n = CatalogParser.num(v) { live[k] = Int(n) } }
        liveStock = live
    }

    /// يزيد لما يتغير «شكل التطبيق» من الإدارة، والواجهة تنرسم من جديد
    private(set) var lookVersion = 0
    /// يزيد مع كل نسخة جديدة من المتجر (السلة تنظّف عروضها المنتهية)
    private(set) var dataVersion = 0

    private func apply(_ data: Data) async throws {
        let built = try await Task.detached(priority: .userInitiated) { try CatalogIndex.build(from: data) }.value
        if built.catalog.store.look != AppLook.current {
            AppLook.current = built.catalog.store.look
            lookVersion += 1
        }
        index = built
        dataVersion += 1
        Analytics.shared.apiBase = built.catalog.store.api.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private static var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("catalog-data.json")
    }
    private static func readCache() -> Data? { try? Data(contentsOf: cacheURL) }
    private static func writeCache(_ data: Data) { try? data.write(to: cacheURL, options: .atomic) }
}
