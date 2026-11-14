import SwiftUI

/// «كل منتج بـ ٠٫٩٥»: يفتح لما طلبك العادي يوصل الحد (store.deal95). نفس قسم الموقع
struct DealsView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart

    var body: some View {
        let t = cart.totals(catalog)
        let d = catalog.store.deal95
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                DealLockBox(totals: t).padding(.horizontal, 16).padding(.top, 12)
                let list = catalog.dealProducts
                if list.isEmpty {
                    ContentUnavailableView("ما فيه منتجات بهالعرض الحين", systemImage: "lock")
                        .padding(.top, 40)
                } else {
                    Text(tv: "\(list.count) منتج · بحد \(max(1, d.limit)) من كل منتج")
                        .font(.ui(size: 13)).foregroundStyle(Theme.muted)
                        .padding(.horizontal, 16)
                    ProductGrid(products: list, showCategory: true, kind: .deal)
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Theme.pageBG)
        .navigationTitle("كل منتج بـ \(Money.plain(d.price)) \(Money.sym)")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// صندوق القفل: «تنفتح لطلبك فوق ٢٥٠ · باقي X» أو «انفتحت! ضيف اللي تبغاه» (السلة وصفحة العرض)
struct DealLockBox: View {
    let totals: CartTotals
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        let d = catalog.store.deal95
        let progress = d.min > 0 ? min(1, totals.regularSubtotal / d.min) : 1
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: totals.dealUnlocked ? "lock.open.fill" : "lock.fill")
                    .foregroundStyle(totals.dealUnlocked ? Theme.brand : Theme.copper)
                VStack(alignment: .leading, spacing: 2) {
                    Text(tv: totals.dealUnlocked ? "عروض \(Money.plain(d.price)) \(Money.sym) انفتحت لك 🎉" : "كل منتج بـ \(Money.plain(d.price)) \(Money.sym)")
                        .font(.kufi(15, .bold))
                    Text(tv: totals.dealUnlocked ? "ضيف اللي تبغاه من المنتجات المختارة"
                         : "تنفتح لطلبك فوق \(Money.sar(d.min)) · باقي \(Money.sar(totals.dealLeft))")
                        .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                }
                Spacer(minLength: 0)
            }
            ProgressView(value: progress).tint(totals.dealUnlocked ? Theme.brand : Theme.copper)
            if totals.dealCount > 0, !totals.dealUnlocked {
                Text("عندك \(totals.dealCount) منتج من العرض بالسلة، ما ينحسب لين ينفتح")
                    .font(.ui(size: 12, weight: .semibold)).foregroundStyle(Theme.copperInk)
            }
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
    }
}

/// عرض اليوم: منتج واحد بسعر خاص لين نص الليل (store.daily)
struct DailyDealView: View {
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        ScrollView {
            if let dd = catalog.dailyDeal {
                VStack(spacing: 14) {
                    RemoteImage(url: dd.product.imageURL, maxPixel: 600)
                        .padding(24)
                        .frame(height: 260)
                        .frame(maxWidth: .infinity)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                    VStack(alignment: .leading, spacing: 6) {
                        Text("🔥 عرض اليوم").font(.ui(size: 13, weight: .bold)).foregroundStyle(Theme.copperInk)
                        Text(tv: dd.product.name).font(.kufi(20, .bold))
                        Text(tv: dd.product.unit).font(.ui(size: 13)).foregroundStyle(Theme.muted)
                        PriceLabel(price: dd.price, old: dd.product.price, size: 24)
                        Countdown()
                        if catalog.store.daily.limit > 0 {
                            Text("الحد \(catalog.store.daily.limit) لكل طلب").font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    DailyAddButton(key: "t:\(dd.product.id)", total: dd.price)
                }
                .padding(16)
            } else {
                ContentUnavailableView("ما فيه عرض اليوم", systemImage: "flame").padding(.top, 60)
            }
        }
        .background(Theme.pageBG)
        .navigationTitle("عرض اليوم")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// زر كبير: «أضف للسلة» وبعدها عداد
private struct DailyAddButton: View {
    let key: String
    let total: Double
    @Environment(Cart.self) private var cart
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        let line = cart.line(key)
        let cap = cart.limit(for: key, in: catalog)
        if line.qty == 0 {
            Button { cart.increment(key, limit: cap) } label: {
                HStack {
                    Text("أضف للسلة").font(.kufi(16, .bold))
                    Spacer()
                    Text(tv: Money.sar(total)).font(.kufi(15, .bold))
                }
                .foregroundStyle(.white).padding(.horizontal, 18)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Theme.brand, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(PressableStyle(scale: 0.97))
        } else {
            HStack(spacing: 10) {
                Text("في السلة").font(.kufi(15, .bold))
                Spacer()
                StepperCapsule(qty: line.qty, atLimit: cap.map { line.qty >= $0 } ?? false, large: true,
                               onPlus: { cart.increment(key, limit: cap) }, onMinus: { cart.decrement(key) })
                    .frame(width: 150)
            }
        }
    }
}

/// «ينتهي بعد ٣:١٢:٠٥» لين نص الليل (نفس countdown في الموقع)
struct Countdown: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let end = Calendar.current.startOfDay(for: ctx.date).addingTimeInterval(86400)
            let s = max(0, Int(end.timeIntervalSince(ctx.date)))
            Text(tv: "ينتهي بعد " + String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60))
                .font(.ui(size: 13, weight: .semibold)).monospacedDigit()
                .foregroundStyle(Theme.copperInk)
        }
    }
}

/// منتجات بنر المالك (بنر بدون هدف وفيه أكثر من منتج) أو الباقة
struct BannerProductsView: View {
    let bannerID: String
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart

    var body: some View {
        let b = catalog.banner(bannerID)
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let b, let al = catalog.bundle(b) {
                    BundleBox(banner: b, sum: al.sum, price: al.price, alloc: al.alloc, ids: al.ids)
                        .padding(.horizontal, 16).padding(.top, 12)
                } else if let b {
                    let list = b.ids.compactMap { catalog.product($0) }
                    if let sub = b.subtitle.isEmpty ? nil : b.subtitle {
                        Text(tv: sub).font(.ui(size: 14)).foregroundStyle(Theme.muted).padding(.horizontal, 16).padding(.top, 10)
                    }
                    ProductGrid(products: list, showCategory: true)
                } else {
                    ContentUnavailableView("العرض انتهى", systemImage: "tag").padding(.top, 60)
                }
            }
            .padding(.bottom, 24)
        }
        .background(Theme.pageBG)
        .navigationTitle(tr(b?.title.replacingOccurrences(of: "\n", with: " ") ?? "عرض"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// الباقة: منتجاتها وسعر كل واحد داخلها، والمجموع قبل وبعد، وزر «أضف الباقة» (كل المنتجات مع بعض)
struct BundleBox: View {
    let banner: Banner
    let sum: Double
    let price: Double
    let alloc: [String: Double]
    let ids: [String]
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var refused = false

    var body: some View {
        let n = cart.bundleCount(banner.id, catalog: catalog)
        VStack(alignment: .leading, spacing: 12) {
            Text("باقة \(ids.count) منتجات").font(.ui(size: 13, weight: .bold)).foregroundStyle(Theme.copperInk)
            ForEach(ids, id: \.self) { id in
                if let p = catalog.product(id) {
                    HStack(spacing: 10) {
                        RemoteImage(url: p.imageURL, maxPixel: 140).padding(4).frame(width: 52, height: 52)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tv: p.name).font(.ui(size: 14, weight: .semibold)).lineLimit(2)
                            Text(tv: p.unit).font(.ui(size: 12)).foregroundStyle(Theme.muted)
                        }
                        Spacer(minLength: 4)
                        PriceLabel(price: alloc[id] ?? p.price, old: p.price, size: 14)
                    }
                }
            }
            Divider()
            HStack {
                Text("سعر الباقة").font(.ui(size: 14, weight: .semibold))
                Spacer()
                PriceLabel(price: price, old: sum, size: 20)
            }
            Text("وفّر \(Money.sar(sum - price))").font(.ui(size: 12.5, weight: .bold)).foregroundStyle(Theme.brandDeep)
            if n == 0 {
                Button {
                    refused = !cart.setBundle(banner.id, 1, catalog: catalog)
                } label: {
                    Text("أضف الباقة للسلة").font(.kufi(15, .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.brand, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(PressableStyle(scale: 0.97))
            } else {
                HStack {
                    Text("في السلة: \(n) باقة").font(.ui(size: 14, weight: .semibold))
                    Spacer()
                    StepperCapsule(qty: n, compact: true,
                                   onPlus: { refused = !cart.setBundle(banner.id, n + 1, catalog: catalog) },
                                   onMinus: { cart.setBundle(banner.id, n - 1, catalog: catalog) })
                }
            }
            if refused {
                Text("ما نقدر نزيد: وصلت الحد أو الكمية المتوفرة من أحد منتجات الباقة")
                    .font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
            }
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
    }
}
