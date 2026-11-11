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
        // داخل كل قسم: المتوفر أول، وبعده اللي له صورة، مع الحفاظ على ترتيب المتجر
        for (k, list) in byCategory {
            byCategory[k] = list.enumerated().sorted { a, b in
                let ra = (a.element.inStock ? 0 : 2) + (a.element.hasPhoto ? 0 : 1)
                let rb = (b.element.inStock ? 0 : 2) + (b.element.hasPhoto ? 0 : 1)
                return ra == rb ? a.offset < b.offset : ra < rb
            }.map(\.element)
        }
        let search = catalog.products.map { (id: $0.id, text: ArabicSearch.normalize($0.name), barcode: $0.barcode ?? "") }
        let offers = catalog.products.filter { $0.inStock && ($0.discount != nil || !$0.packs.isEmpty) }
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

@MainActor
@Observable
final class CatalogStore {
    private(set) var index: CatalogIndex?
    private(set) var failed = false
    private(set) var liveStock: [String: Int] = [:]
    @ObservationIgnored private var lastStock = Date.distantPast

    var store: StoreInfo { index?.catalog.store ?? StoreInfo() }
    var categories: [Category] { index?.catalog.categories ?? [] }

    func product(_ id: String) -> Product? { index?.byId[id] }
    func category(_ id: String) -> Category? { index?.categoriesById[id] }
    func products(in category: String) -> [Product] { index?.byCategory[category] ?? [] }

    func isAvailable(_ p: Product) -> Bool {
        guard p.inStock, category(p.cat)?.soon != true else { return false }
        if let left = liveStock[p.id] { return left > 0 }
        return true
    }

    /// المفتاح "id" أو "id~رقم الخيار" (نفس صيغة الموقع والخادم)
    func resolve(_ key: String) -> (product: Product, pack: Pack?, packIndex: Int?)? {
        let parts = key.split(separator: "~", maxSplits: 1).map(String.init)
        guard let p = product(parts[0]) else { return nil }
        if parts.count == 2 {
            guard let i = Int(parts[1]), i >= 0, i < p.packs.count else { return nil }
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
            if (digits.count >= 6 && entry.barcode == digits) || words.allSatisfy({ entry.text.contains($0) }),
               let p = index.byId[entry.id] {
                hits.append(p)
                if hits.count >= limit * 3 { break }
            }
        }
        return Array(hits.sorted { (isAvailable($0) ? 0 : 1, $0.hasPhoto ? 0 : 1) < (isAvailable($1) ? 0 : 1, $1.hasPhoto ? 0 : 1) }.prefix(limit))
    }

    // MARK: تحميل البيانات (من الجوال أول، وبعدها من الموقع)

    func load() async {
        if index == nil, let cached = Self.readCache() {
            try? await apply(cached)
        }
        await refresh()
    }

    func refresh() async {
        do {
            var comps = URLComponents(url: AppConfig.site.appendingPathComponent("data.json"), resolvingAgainstBaseURL: false)!
            comps.queryItems = [URLQueryItem(name: "v", value: String(Int(Date().timeIntervalSince1970)))]
            var req = URLRequest(url: comps.url!)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            req.timeoutInterval = 20
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            try await apply(data)
            Self.writeCache(data)
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

    private func apply(_ data: Data) async throws {
        let built = try await Task.detached(priority: .userInitiated) { try CatalogIndex.build(from: data) }.value
        index = built
    }

    private static var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("catalog-data.json")
    }
    private static func readCache() -> Data? { try? Data(contentsOf: cacheURL) }
    private static func writeCache(_ data: Data) { try? data.write(to: cacheURL, options: .atomic) }
}
