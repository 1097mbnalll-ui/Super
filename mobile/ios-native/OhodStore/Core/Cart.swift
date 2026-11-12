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
    let available: Bool
    /// عرض الكمية (مثل ٤ بـ ٧): ينطبق لحاله على كل ٤ حبات بالسطر
    var offer: (index: Int, count: Int, price: Double)? = nil
    var id: String { key }
    var unitPrice: Double { pack?.price ?? product.price }
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
    var saving: Double { (pack == nil ? (product.discount ?? 0) * Double(qty) : 0) + offerSaving }
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
}

@MainActor
@Observable
final class Cart {
    @ObservationIgnored private var lines: [String: CartLine] = [:]
    @ObservationIgnored private var order: [String] = []
    /// يتغير مع كل تعديل: الإجمالي والشارة يراقبونه
    private(set) var revision = 0

    /// «لو منتج ناقص» اختيار واحد عام فوق السلة (swap / remove / call)
    var substitution: String = UserDefaults.standard.string(forKey: "cart.sub") ?? "swap" {
        didSet { UserDefaults.standard.set(substitution, forKey: "cart.sub") }
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
        if old == 0 && q > 0 { Haptics.added() } else if q == 0 { Haptics.removed() }
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
        guard let r = catalog.resolve(key) else { return nil }
        let per = r.pack?.count ?? 1
        var cap: Int? = nil
        if let m = r.product.max, m > 0 { cap = max(1, m / per) }
        if let left = catalog.liveStock[r.product.id] { cap = min(cap ?? Int.max, max(0, left / per)) }
        return cap
    }

    func totals(_ catalog: CatalogStore) -> CartTotals {
        _ = revision
        var t = CartTotals()
        let store = catalog.store
        t.freeOver = store.freeOver
        t.minOrder = store.minOrder
        for key in order {
            guard let qty = lines[key]?.qty, qty > 0, let r = catalog.resolve(key) else { continue }
            var row = CartRow(key: key, product: r.product, pack: r.pack, qty: qty, available: catalog.isAvailable(r.product))
            if r.pack == nil, let q = r.product.quantityOffer { row.offer = (q.index, q.count, q.price) }
            t.rows.append(row)
            guard row.available else { continue }
            t.count += qty
            t.subtotal += row.lineTotal
            t.savings += row.saving
        }
        t.subtotal = (t.subtotal * 100).rounded() / 100
        if t.count > 0 { t.fee = (store.freeOver > 0 && t.subtotal >= store.freeOver) ? 0 : store.fee }
        return t
    }

    /// اللي ينرسل للخادم: المتوفر بس، بنفس مفاتيح الموقع ("id" أو "id~رقم الخيار")
    func orderItems(_ catalog: CatalogStore) -> [String: Int] {
        var items: [String: Int] = [:]
        // عرض الكمية: كل مجموعة كاملة تنرسل كخيار العرض (id~رقم) والباقي حبات، والخادم يسعّرها
        for row in totals(catalog).rows where row.available {
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
            guard let r = catalog.resolve(key), r.product.id == productID, let l = lines[key] else { continue }
            let per = r.pack?.count ?? 1
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
