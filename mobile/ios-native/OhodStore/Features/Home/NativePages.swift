import SwiftUI

/// قرار المالك ١٥ نوفمبر ٢٠٢٦ (خط أحمر): التطبيق منفصل عن الموقع، ما يعرض أي صفحة منه.
/// الصفحات اللي كانت تنفتح من الموقع (Route.live) صار لها شاشات أصلية هنا، بنفس أسماء صفحات الموقع:
///  g:<عرض>[:<منتج>] نافذة اختيار عرض المجموعة · o:<قسم> عروض القسم · c:<قسم> القسم · b:<بنر> منتجات البنر · offers · deals
enum NativePage {
    static func supports(_ page: String) -> Bool {
        if page == "offers" || page == "deals" { return true }
        for pre in ["g:", "o:", "c:", "b:"] where page.hasPrefix(pre) && page.count > pre.count { return true }
        if page.hasPrefix("screen:") {
            let key = page.split(separator: ":", omittingEmptySubsequences: false).dropFirst().first.map(String.init) ?? ""
            return ["cat", "product", "search", "offers", "deals"].contains(key)
        }
        return false
    }
}

extension Money {
    /// مثل num() في الموقع: 13 بدون كسور، و11.95 بكسورها
    static func compact(_ v: Double) -> String { v == v.rounded() ? String(Int(v)) : plain(v) }
}

struct NativePageView: View {
    let page: String
    @Binding var path: NavigationPath

    var body: some View {
        let parts = page.split(separator: ":", omittingEmptySubsequences: false).map(String.init)
        let a = parts.count > 1 ? parts[1] : "", b = parts.count > 2 ? parts[2] : ""
        switch parts.first ?? "" {
        case "g": GroupPickerView(groupID: a, pre: b.isEmpty ? nil : b)
        case "o": OffersView(cat: a)
        case "c": CategoryView(categoryID: a)
        case "b": BannerProductsView(bannerID: a)
        case "deals": DealsView()
        case "screen":
            switch a {
            case "cat": CategoryView(categoryID: b)
            case "product": ProductView(productID: b)
            case "search": SearchView()
            case "deals": DealsView()
            default: OffersView()
            }
        default: OffersView()
        }
    }
}

/// نافذة «اختر ٣ علب من أي نوع» (عرض المجموعة، openGroupPicker في الموقع) بشاشة أصلية:
/// الاختيار محلي لين «أضف للسلة»، كل N بسعر العرض والزايد بسعر الحبة. «أضف» من كرت منتج بالعرض (pre) يحط علبة منه أول،
/// و«لا شكراً» تضيف علبة وحدة بس
struct GroupPickerView: View {
    let groupID: String
    var pre: String? = nil
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(\.dismiss) private var dismiss
    @State private var pick: [String: Int] = [:]
    @State private var preAdded: String? = nil
    @State private var started = false

    private var group: ProductGroup? { catalog.store.groups.first { $0.id == groupID } }

    var body: some View {
        Group {
            if let g = group {
                content(g)
            } else {
                ContentUnavailableView("العرض انتهى", systemImage: "tag", description: Text("تقدر تشوف باقي العروض من تبويب العروض."))
            }
        }
        .background(Theme.pageBG)
        .navigationTitle(group.map { "عرض " + $0.name } ?? "العرض")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: start)
    }

    private func items(_ g: ProductGroup) -> [Product] {
        g.ids.compactMap { catalog.product($0) }.filter { catalog.isAvailable($0) }
    }

    private func start() {
        guard !started, let g = group else { return }
        started = true
        let snap = cart.snapshot
        var p: [String: Int] = [:]
        for id in g.ids { if let q = snap[id], q > 0 { p[id] = q } }
        if let pre, g.ids.contains(pre), let prod = catalog.product(pre), catalog.isAvailable(prod), canHave(pre, (p[pre] ?? 0) + 1) {
            p[pre, default: 0] += 1; preAdded = pre
        }
        pick = p
    }

    private func canHave(_ id: String, _ q: Int) -> Bool {
        guard let cap = cart.limit(for: id, in: catalog) else { return true }
        return q <= cap
    }

    /// grpPrice في الموقع: كل N بسعر العرض، والباقي بمتوسط سعر الحبة
    private func price(_ g: ProductGroup) -> Double {
        var units = 0, reg = 0.0
        for (id, q) in pick { if let p = catalog.product(id) { units += q; reg += Double(q) * p.price } }
        guard units > 0 else { return 0 }
        let n = max(1, g.count), sets = units / n
        return ((Double(sets) * g.price + Double(units - sets * n) * (reg / Double(units))) * 100).rounded() / 100
    }

    @ViewBuilder private func content(_ g: ProductGroup) -> some View {
        let list = items(g)
        let n = max(1, g.count)
        let c = pick.values.reduce(0, +)
        let ok = c > 0 && c % n == 0
        let need = c % n == 0 ? 0 : n - c % n
        let snap = cart.snapshot
        let inCart = g.ids.reduce(0) { $0 + (snap[$1] ?? 0) }
        let unit = list.first?.price ?? 0
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(tv: "اختر \(n) \(g.w) من أي نوع").font(.kufi(19, .bold)).foregroundStyle(Theme.ink)
                    Text(tv: "أي \(n) \(g.w) بـ \(Money.compact(g.price)) ر.س · كانت \(g.w1) بـ \(Money.compact(unit))")
                        .font(.ui(size: 13.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
                }
                .padding(.horizontal, 16).padding(.top, 14)

                VStack(spacing: 0) {
                    ForEach(list) { p in
                        let q = pick[p.id] ?? 0
                        HStack(spacing: 12) {
                            RemoteImage(url: p.imageURL, maxPixel: 200)
                                .frame(width: 58, height: 58)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tv: p.name).font(.ui(size: 14.5, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2)
                                Text(tv: p.unit).font(.ui(size: 12)).foregroundStyle(Theme.muted).lineLimit(1)
                            }
                            Spacer(minLength: 6)
                            HStack(spacing: 0) {
                                Button {
                                    if q > 1 { pick[p.id] = q - 1 } else { pick[p.id] = nil }
                                    Haptics.selected()
                                } label: {
                                    Image(systemName: "minus").font(.system(size: 14, weight: .bold)).frame(width: 40, height: 40)
                                }
                                .disabled(q == 0)
                                .accessibilityLabel("نقص")
                                Text(verbatim: "\(q)").font(.kufi(15, .bold)).frame(minWidth: 22)
                                    .contentTransition(.numericText(value: Double(q)))
                                Button {
                                    if canHave(p.id, q + 1) { pick[p.id] = q + 1; Haptics.selected() } else { Haptics.warning() }
                                } label: {
                                    Image(systemName: "plus").font(.system(size: 14, weight: .bold)).frame(width: 40, height: 40)
                                }
                                .accessibilityLabel("زيادة")
                            }
                            .foregroundStyle(Theme.brandDeep)
                            .background(Theme.mint, in: Capsule())
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        if p.id != list.last?.id { Divider().padding(.leading, 84) }
                    }
                }
                .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                Text(tv: c == 0 ? "اختر \(n) \(g.w)" : need > 0 ? "أضف \(need) وتحصل على العرض: أي \(n) \(g.w) بـ \(Money.compact(g.price)) ر.س" : "اخترت \(c) · عليها العرض ✓")
                    .font(.ui(size: 13.5, weight: .bold))
                    .foregroundStyle(need > 0 ? Theme.copperInk : Theme.brandDeep)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                let enabled = ok || (c > 0 && preAdded == nil) || (c == 0 && inCart > 0)
                Button {
                    for id in g.ids { cart.set(id, pick[id] ?? 0) }
                    Haptics.success()
                    dismiss()
                } label: {
                    HStack {
                        if c == 0 { Text("شيل من السلة") }
                        else if ok || preAdded == nil { Text("أضف للسلة"); Spacer(); Text(tv: Money.sar(price(g))) }
                        else { Text(tv: "اختر \(need) بعد") }
                    }
                }
                .buttonStyle(PrimaryButtonStyle(color: c == 0 ? Theme.copperInk : Theme.brand))
                .disabled(!enabled)
                .opacity(enabled ? 1 : 0.5)
                if let pid = preAdded, !ok, let p = catalog.product(pid) {
                    let one = g.w1.hasPrefix("ال") ? String(g.w1.dropFirst(2)) : g.w1
                    Button {
                        cart.increment(pid, limit: cart.limit(for: pid, in: catalog))
                        dismiss()
                    } label: {
                        Text(tv: "لا شكراً، أضف \(one) وحدة بس · \(Money.sar(p.price))")
                            .font(.ui(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(.bar)
        }
    }
}

/// تنبيه السلة لعرض مجموعة ناقص: «أضف ١ وتحصل على العرض» وزر «كمّل» لنافذة الاختيار (الطلب ما ينقفل)
struct GroupNudges: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart

    var body: some View {
        let snap = cart.snapshot
        ForEach(catalog.store.groups, id: \.id) { g in
            let n = max(2, g.count)
            let units = g.ids.reduce(0) { $0 + (snap[$1] ?? 0) }
            if units > 0, units % n != 0 {
                HStack(spacing: 10) {
                    Image(systemName: "gift.fill").foregroundStyle(Theme.copper)
                    Text(tv: "أضف \(n - units % n) وتحصل على العرض: أي \(n) \(g.w) بـ \(Money.compact(g.price)) ر.س")
                        .font(.ui(size: 13.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
                    Spacer(minLength: 0)
                    NavigationLink("كمّل", value: Route.live("g:" + g.id)).font(.ui(size: 13.5, weight: .bold))
                }
                .padding(12)
                .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }
}
