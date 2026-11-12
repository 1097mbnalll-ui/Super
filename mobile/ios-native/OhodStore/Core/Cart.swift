import Foundation
import Observation

/// سطر واحد في السلة. كل كرت منتج يراقب سطره بس، فالضغط ما يعيد رسم الشبكة كلها
@MainActor
@Observable
final class CartLine {
    let key: String
    fileprivate(set) var qty: Int = 0
    init(key: String) { self.key = key }
}

struct CartRow: Identifiable {
    let key: String
    let product: Product
    let pack: Pack?
    let qty: Int
    var available: Bool
    /// عرض الكمية (مثل ٤ بـ ٧): ينطبق لحاله على كل ٤ حبات بالسطر
    var offer: (index: Int, count: Int, price: Double)? = nil
    /// سطر عرض المتجر (d: / t: / x:) وسعره
    var promo: PromoLine.Kind? = nil
    var promoPrice: Double? = nil
    var bannerID: String? = nil
    /// «كل منتج بـ ٠٫٩٥» مقفول (الطلب العادي أقل من الحد): ما يدخل بالإجمالي
    var locked = false
    var id: String { key }
    var unitPrice: Double { promoPrice ?? pack?.price ?? product.price }
    var unitLabel: String { pack?.unit ?? product.unit }
    var bundles: Int { offer.map { qty / $0.count } ?? 0 }
    var loose: Int { qty - bundles * (offer?.count ?? 1) }
    var lineTotal: Double {
        guard let o = offer else { return unitPrice * Double(qty) }
        return Double(bundles) * o.price + Double(loose) * unitPrice
    }
    var regularTotal: Double { unitPrice * Double(qty) }
    var offerSaving: Double { regularTotal - lineTotal }
    /// كم حبة باقي عشان ينطبق العرض (للمرة الجاية)
    var missingForOffer: Int? {
        guard let o = offer, qty > 0 else { return nil }
        let r = qty % o.count
        return r == 0 ? nil : o.count - r
    }
    var saving: Double {
        if promo != nil { return Swift.max(0, (product.price - unitPrice) * Double(qty)) }
        return (pack == nil ? (product.discount ?? 0) * Double(qty) : 0) + offerSaving
    }
}

struct CartTotals {
    var rows: [CartRow] = []
    var count = 0
    var subtotal: Double = 0
    var fee: Double = 0
    var savings: Double = 0
    var freeOver: Double = 0
    var minOrder: Double = 0
    var total: Double { subtotal + fee }
    var freeRemaining: Double { freeOver > 0 ? max(0, freeOver - subtotal) : 0 }
    var freeProgress: Double { freeOver > 0 ? min(1, subtotal / freeOver) : 1 }
    var belowMinimum: Double? { minOrder > 0 && subtotal < minOrder ? minOrder - subtotal : nil }
    /// «كل منتج بـ ٠٫٩٥»: مجموع الطلب العادي، هل انفتح، وكم باقي ويفتح، وكم قطعة منه بالسلة
    var regularSubtotal: Double = 0
    var dealUnlocked = false
    var dealLeft: Double = 0
    var dealCount = 0
}

@MainActor
@Observable
final class Cart {
    @ObservationIgnored private var lines: [String: CartLine] = [:]
    @ObservationIgnored private var order: [String] = []
    /// يتغير مع كل تعديل: الإجمالي والشارة يراقبونه
    private(set) var revision = 0

    /// «لو منتج ناقص» اختيار واحد عام فوق السلة (swap / remove / call)
    var substitution: String = UserDefaults.standard.string(forKey: "cart.sub2") ?? "call" {
        didSet { UserDefaults.standard.set(substitution, forKey: "cart.sub2") }
    }
    /// ملاحظات الطلب (مثل «الخبز يكون حار»): تنمسح بعد ما ينرسل الطلب
    var note: String = UserDefaults.standard.string(forKey: "cart.note") ?? "" {
        didSet { UserDefaults.standard.set(note, forKey: "cart.note") }
    }
    /// الدفع عند الاستلام: cash أو card
    var payment: String = UserDefaults.standard.string(forKey: "cart.pay") ?? "cash" {
        didSet { UserDefaults.standard.set(payment, forKey: "cart.pay") }
    }

    init() { restore() }

    func line(_ key: String) -> CartLine {
        if let l = lines[key] { return l }
        let l = CartLine(key: key)
        lines[key] = l
        return l
    }

    var count: Int {
        _ = revision
        return order.reduce(0) { $0 + (lines[$1]?.qty ?? 0) }
    }

    var isEmpty: Bool { count == 0 }

    func set(_ key: String, _ qty: Int) {
        let l = line(key)
        let old = l.qty
        let q = max(0, min(qty, 99))
        guard q != old else { return }
        l.qty = q
        if q > 0, !order.contains(key) { order.append(key) }
        if q == 0 { order.removeAll { $0 == key } }
        revision &+= 1
        save()
        if old == 0 && q > 0 { Haptics.added(); Analytics.shared.addedToCart(key) } else if q == 0 { Haptics.removed() }
    }

    func increment(_ key: String, limit: Int?) {
        let l = line(key)
        if let limit, l.qty >= limit {
            Haptics.warning()
            return
        }
        set(key, l.qty + 1)
    }

    func decrement(_ key: String) { set(key, line(key).qty - 1) }

    func clear() {
        for k in order { lines[k]?.qty = 0 }
        order.removeAll()
        revision &+= 1
        save()
        Haptics.removed()
    }

    /// أقصى كمية لسطر: حد المنتج (بالحبات) والمخزون الحي
    func limit(for key: String, in catalog: CatalogStore) -> Int? {
        if let pl = catalog.promoLine(key) { return pl.limit }
        guard let r = catalog.resolve(key) else { return nil }
        let per = r.pack?.count ?? 1
        // الحد والمخزون بالحبات لكل المنتج: الحبة والكرتون والعروض تنجمع (canAddProduct في الموقع)
        let mine = (lines[key]?.qty ?? 0) * per
        let others = piecesInCart(r.product.id, catalog: catalog) - mine
        var cap: Int? = nil
        if let m = r.product.max, m > 0 { cap = max(1, (m - others) / per) }
        if let left = catalog.liveStock[r.product.id] { cap = min(cap ?? Int.max, max(0, (left - others) / per)) }
        return cap
    }

    func totals(_ catalog: CatalogStore) -> CartTotals {
        _ = revision
        var t = CartTotals()
        let store = catalog.store
        t.freeOver = store.freeOver
        t.minOrder = store.minOrder
        let bundleOK = validBundles(catalog)
        var dealRows: [Int] = []
        for key in order {
            guard let qty = lines[key]?.qty, qty > 0 else { continue }
            if let pl = catalog.promoLine(key) {
                var row = CartRow(key: key, product: pl.product, pack: nil, qty: qty, available: catalog.isAvailable(pl.product))
                row.promo = pl.kind; row.promoPrice = pl.price; row.bannerID = pl.bannerID
                switch pl.kind {
                case .deal: if !pl.valid { row.available = false }
                case .daily: if !pl.valid { row.promo = nil; row.promoPrice = nil }   // انتهى عرض اليوم: سعر عادي
                case .bundle: if !bundleOK.contains(pl.bannerID ?? "") { row.available = false }
                }
                t.rows.append(row)
                if row.promo == .deal { if row.available { dealRows.append(t.rows.count - 1) }; continue }
                guard row.available else { continue }
                t.count += qty; t.subtotal += row.lineTotal; t.savings += row.saving
                continue
            }
            guard let r = catalog.resolve(key) else { continue }
            var row = CartRow(key: key, product: r.product, pack: r.pack, qty: qty, available: catalog.isAvailable(r.product))
            if r.pack == nil, let q = r.product.quantityOffer { row.offer = (q.index, q.count, q.price) }
            t.rows.append(row)
            guard row.available else { continue }
            t.count += qty
            t.subtotal += row.lineTotal
            t.savings += row.saving
        }
        // ٠٫٩٥ يفتح لما الطلب العادي يوصل الحد، وما يدخل بالإجمالي قبلها
        t.regularSubtotal = (t.subtotal * 100).rounded() / 100
        let dmin = store.deal95.min
        t.dealUnlocked = catalog.dealOn && t.regularSubtotal >= dmin
        t.dealLeft = Swift.max(0, dmin - t.regularSubtotal)
        for i in dealRows {
            t.dealCount += t.rows[i].qty
            if t.dealUnlocked {
                t.count += t.rows[i].qty; t.subtotal += t.rows[i].lineTotal; t.savings += t.rows[i].saving
            } else {
                t.rows[i].locked = true
            }
        }
        t.subtotal = (t.subtotal * 100).rounded() / 100
        if t.count > 0 { t.fee = (store.freeOver > 0 && t.subtotal >= store.freeOver) ? 0 : store.fee }
        return t
    }

    func dealUnlocked(_ catalog: CatalogStore) -> Bool { totals(catalog).dealUnlocked }

    /// الباقة تنحسب بس لو كل منتجاتها بالسلة وبنفس العدد (مثل normalize في الموقع)
    private func validBundles(_ catalog: CatalogStore) -> Set<String> {
        var groups: [String: [Int]] = [:]
        for key in order where key.hasPrefix("x:") {
            let k = key.split(separator: ":").map(String.init)
            if k.count == 3, let q = lines[key]?.qty, q > 0 { groups[k[1], default: []].append(q) }
        }
        var ok = Set<String>()
        for (bid, qs) in groups {
            guard let b = catalog.banner(bid), let al = catalog.bundle(b), qs.count == al.ids.count, Set(qs).count == 1,
                  al.ids.allSatisfy({ (lines["x:\(bid):\($0)"]?.qty ?? 0) > 0 && catalog.product($0).map(catalog.isAvailable) == true })
            else { continue }
            ok.insert(bid)
        }
        return ok
    }

    /// كم باقة كاملة من البنر بالسلة
    func bundleCount(_ bannerID: String, catalog: CatalogStore) -> Int {
        guard let b = catalog.banner(bannerID), let al = catalog.bundle(b) else { return 0 }
        return al.ids.map { lines["x:\(bannerID):\($0)"]?.qty ?? 0 }.min() ?? 0
    }

    /// يغيّر عدد الباقات (كل منتجاتها مع بعض). false = الحد أو المخزون ما يسمح
    @discardableResult
    func setBundle(_ bannerID: String, _ qty: Int, catalog: CatalogStore) -> Bool {
        guard let b = catalog.banner(bannerID), let al = catalog.bundle(b) else { return false }
        let q = Swift.max(0, Swift.min(qty, 99))
        if q > bundleCount(bannerID, catalog: catalog) {
            for id in al.ids {
                guard let p = catalog.product(id), catalog.isAvailable(p) else { Haptics.warning(); return false }
                let others = piecesInCart(id, catalog: catalog) - (lines["x:\(bannerID):\(id)"]?.qty ?? 0)
                if let m = p.max, m > 0, others + q > m { Haptics.warning(); return false }
                if let l = catalog.liveStock[id], others + q > l { Haptics.warning(); return false }
            }
        }
        for id in al.ids {
            let key = "x:\(bannerID):\(id)"
            let l = line(key)
            l.qty = q
            if q > 0, !order.contains(key) { order.append(key) }
        }
        order.removeAll { (lines[$0]?.qty ?? 0) == 0 }
        revision &+= 1
        save()
        if q > 0 { Haptics.added() } else { Haptics.removed() }
        return true
    }

    /// كل الحبات من منتج بالسلة (حبة، كرتون، عروض، باقات): للحد والمخزون مثل canAddProduct
    func piecesInCart(_ productID: String, catalog: CatalogStore) -> Int {
        var n = 0
        for key in order {
            guard let q = lines[key]?.qty, q > 0 else { continue }
            if let pl = catalog.promoLine(key) { if pl.product.id == productID { n += q }; continue }
            if let r = catalog.resolve(key), r.product.id == productID { n += q * (r.pack?.count ?? 1) }
        }
        return n
    }

    /// بعد ما يتحدث المتجر: عرض يوم انتهى يرجع سطر عادي، و٠٫٩٥ اللي انشال من القائمة ينشال، والباقة الناقصة تنشال
    func normalize(_ catalog: CatalogStore) {
        guard catalog.index != nil else { return }
        var changed = false
        let bundleOK = validBundles(catalog)
        for key in order {
            guard let q = lines[key]?.qty, q > 0, key.contains(":") else { continue }
            let pl = catalog.promoLine(key)
            if key.hasPrefix("t:"), pl?.valid != true {
                let id = String(key.dropFirst(2))
                if catalog.product(id) != nil { let b = line(id); b.qty += q; if !order.contains(id) { order.append(id) } }
                lines[key]?.qty = 0; changed = true
            } else if key.hasPrefix("d:"), pl?.valid != true {
                lines[key]?.qty = 0; changed = true
            } else if key.hasPrefix("x:"), !bundleOK.contains(pl?.bannerID ?? key.split(separator: ":").dropFirst().first.map(String.init) ?? "") {
                lines[key]?.qty = 0; changed = true
            }
        }
        guard changed else { return }
        order.removeAll { (lines[$0]?.qty ?? 0) == 0 }
        revision &+= 1
        save()
    }

    /// اللي ينرسل للخادم: المتوفر بس، بنفس مفاتيح الموقع ("id" أو "id~رقم الخيار")
    func orderItems(_ catalog: CatalogStore) -> [String: Int] {
        var items: [String: Int] = [:]
        // عرض الكمية: كل مجموعة كاملة تنرسل كخيار العرض (id~رقم) والباقي حبات، والخادم يسعّرها
        for row in totals(catalog).rows where row.available && !row.locked {
            if row.key.hasPrefix("t:"), row.promo == nil {
                // عرض اليوم انتهى قبل الإرسال: ينرسل سطر عادي
                items[row.product.id, default: 0] += row.qty
                continue
            }
            if let o = row.offer, row.bundles > 0 {
                let packKey = "\(row.product.id)~\(o.index)"
                items[packKey, default: 0] += row.bundles
                if row.loose > 0 { items[row.key, default: 0] += row.loose }
            } else {
                items[row.key, default: 0] += row.qty
            }
        }
        return items
    }

    /// يحط سلة كاملة (اطلب مرة ثانية). المنتج اللي ما عاد موجود ينتجاهل
    func add(_ items: [String: Int], order keys: [String], catalog: CatalogStore) {
        for k0 in keys {
            guard var q = items[k0], q > 0, let r = catalog.resolve(k0), catalog.isAvailable(r.product) else { continue }
            // خيار عرض الكمية يرجع حبات (العرض ينطبق لحاله في السلة)
            var key = k0
            if let pi = r.packIndex, let o = r.product.quantityOffer, o.index == pi { key = r.product.id; q *= o.count }
            let cap = limit(for: key, in: catalog) ?? 99
            let l = line(key)
            let newQty = min(l.qty + q, cap)
            guard newQty > l.qty else { continue }
            l.qty = newQty
            if !order.contains(key) { order.append(key) }
        }
        revision &+= 1
        save()
        Haptics.added()
    }

    /// الخادم قال باقي `left` حبة من المنتج: نعدّل كل الأسطر اللي عليه (حبة وكرتون)
    func applyStock(productID: String, left: Int, catalog: CatalogStore) {
        var remaining = max(0, left)
        for key in order {
            let pl = catalog.promoLine(key)
            guard let l = lines[key], let pid = pl?.product.id ?? catalog.resolve(key)?.product.id, pid == productID else { continue }
            let per = pl != nil ? 1 : (catalog.resolve(key)?.pack?.count ?? 1)
            let q = min(l.qty, remaining / per)
            remaining -= q * per
            l.qty = q
        }
        order.removeAll { (lines[$0]?.qty ?? 0) == 0 }
        revision &+= 1
        save()
    }

    /// بعد نجاح الطلب: نفضّي اللي انرسل بس (لو الزبون غيّر السلة أثناء الإرسال يبقى الفرق)
    func remove(sent items: [String: Int], catalog: CatalogStore) {
        for (key, q) in items {
            var rest = q
            if let l = lines[key] { let take = min(rest, l.qty); l.qty -= take; rest -= take }
            if rest > 0, let l = lines["t:" + key] { let take = min(rest, l.qty); l.qty -= take; rest -= take }
            // عرض كمية انرسل كخيار (id~رقم) وهو بالسلة حبات: ننقص الحبات
            if rest > 0, let r = catalog.resolve(key), let pack = r.pack, let base = lines[r.product.id] {
                base.qty = max(0, base.qty - rest * pack.count)
            }
        }
        order.removeAll { (lines[$0]?.qty ?? 0) == 0 }
        revision &+= 1
        save()
    }

    private func save() {
        var dict: [String: Int] = [:]
        for k in order { if let q = lines[k]?.qty, q > 0 { dict[k] = q } }
        UserDefaults.standard.set(dict, forKey: "cart.items")
        UserDefaults.standard.set(order, forKey: "cart.order")
    }

    private func restore() {
        let dict = UserDefaults.standard.dictionary(forKey: "cart.items") as? [String: Int] ?? [:]
        let saved = UserDefaults.standard.stringArray(forKey: "cart.order") ?? Array(dict.keys)
        for k in saved { if let q = dict[k], q > 0 { line(k).qty = q; order.append(k) } }
    }
}
