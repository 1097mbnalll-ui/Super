import SwiftUI

/// صفحة المنتج (design/mix-05-product.webp): تكبر من كرت المنتج وترجع له
struct ProductView: View {
    let productID: String
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var packIndex: Int? = nil   // nil = الحبة
    @State private var qty = 1
    @State private var justAdded = false

    var body: some View {
        Group {
            if let product = catalog.product(productID) {
                content(product)
            } else if catalog.index == nil {
                ProgressView()
            } else {
                ContentUnavailableView("المنتج مو موجود", systemImage: "questionmark.square.dashed")
            }
        }
        .modifier(ZoomDestination(id: productID))
        .onAppear { Analytics.shared.view(productID) }
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(_ product: Product) -> some View {
        let available = catalog.isAvailable(product)
        let pack = packIndex.flatMap { $0 < product.packs.count && product.packs[$0].price > 0 ? product.packs[$0] : nil }
        let unitPrice = pack?.price ?? product.price
        let key = packIndex.map { "\(product.id)~\($0)" } ?? product.id
        let category = catalog.category(product.cat)

        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    Theme.softGradient
                    RemoteImage(url: product.imageURL, maxPixel: 900)
                        .padding(36)
                        .opacity(available ? 1 : 0.5)
                    if available, let badge = product.offerBadge {
                        Label(badge, systemImage: "percent")
                            .font(.kufi(12, .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(Theme.copper, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .padding(16)
                    }
                }
                .frame(height: 330)

                VStack(alignment: .leading, spacing: 8) {
                    if let category {
                        Text([product.badge, category.name, catalog.dailyDeal?.product.id == product.id ? "عرض اليوم" : nil].compactMap { $0 }.joined(separator: " · "))
                            .font(.ui(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.oliveInk)
                            .padding(.horizontal, 9).padding(.vertical, 3)
                            .background(Theme.oliveSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    Text(product.name)
                        .font(.kufi(19, .bold, relativeTo: .title2))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        PriceLabel(price: unitPrice, old: pack == nil ? product.old : nil, size: 24)
                        Text(pack.map { "/ \($0.unit)" } ?? (product.packs.isEmpty ? "/ \(product.unit)" : "/ الحبة"))
                            .font(.ui(size: 14, weight: .semibold)).foregroundStyle(Theme.muted)
                    }
                    if let pack, pack.count > 1 {
                        Text("يعني الحبة بـ \(Money.sar((pack.price / Double(pack.count) * 100).rounded() / 100))")
                            .font(.ui(size: 13)).foregroundStyle(Theme.muted)
                    }
                    if available, let old = product.old, let pct = product.discountPercent {
                        Label("عليه عرض: كان \(Money.sar(old)) وصار \(Money.sar(product.price)) · وفّر \(Money.sar(old - product.price)) (\(pct)٪)",
                              systemImage: "flame.fill")
                            .font(.ui(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.copperInk)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    } else if available, let q = product.quantityOffer {
                        QuantityOfferBox(product: product, offer: (q.count, q.price, q.before))
                    }
                    if let dd = catalog.dailyDeal, dd.product.id == product.id, available {
                        NavigationLink(value: Route.daily) {
                            Label("عرض اليوم: \(Money.sar(dd.price)) بدل \(Money.sar(product.price)) · ينتهي نص الليل", systemImage: "flame.fill")
                                .font(.ui(size: 13.5, weight: .bold)).foregroundStyle(.white)
                                .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                                .background(Theme.copper, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    if available, let low = catalog.lowLeft(product) {
                        Text("باقي \(low) بس").font(.ui(size: 13, weight: .bold)).foregroundStyle(Theme.copperInk)
                    }
                    if available, let m = product.max, m > 0 {
                        Text("الحد الأقصى \(m) لكل طلب").font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                    }
                    if !available {
                        Label("نفد من المحل حالياً", systemImage: "exclamationmark.circle")
                            .font(.ui(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.copperInk)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)

                if product.packs.indices.contains(where: { $0 != product.quantityOffer?.index && product.packs[$0].price > 0 }) {
                    Text("طريقة الشراء")
                        .font(.kufi(15, .bold))
                        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 10)
                    PackPicker(product: product, selection: $packIndex)
                        .padding(.horizontal, 16)
                }

                // «يحلى معه» من اختيار المالك (sugg)، وإلا «ممكن يعجبك» من نفس القسم
                let picked = product.sugg.compactMap { catalog.product($0) }.filter { $0.id != product.id && catalog.isAvailable($0) }
                let suggestions = picked.isEmpty
                    ? Array(catalog.products(in: product.cat).filter { $0.id != product.id && $0.hasPhoto && catalog.isAvailable($0) }.prefix(12))
                    : picked
                if !suggestions.isEmpty {
                    SectionHeader(title: picked.isEmpty ? "ممكن يعجبك" : "يحلى معه").padding(.top, 24).padding(.bottom, 10)
                    ScrollView(.horizontal) {
                        LazyHStack(alignment: .top, spacing: 8) {
                            ForEach(Array(suggestions)) { p in
                                ProductCard(product: p).frame(width: 118)
                            }
                        }
                        .padding(.horizontal, 12)
                    }
                    .scrollIndicators(.hidden)
                }
            }
            .padding(.bottom, 20)
        }
        .scrollIndicators(.hidden)
        .background(Color.white)
        .safeAreaInset(edge: .bottom) {
            if available {
                // الشريط تحت يعدّل السلة نفسها: قبل الإضافة زر واحد، وبعدها عداد السلة ومجموع المنتج فيها
                let line = cart.line(key)
                let cap = cart.limit(for: key, in: catalog) ?? product.max
                Group {
                    if line.qty == 0 {
                        Button {
                            cart.increment(key, limit: cap)
                        } label: {
                            HStack {
                                Text("أضف للسلة")
                                Spacer()
                                Text(Money.sar(unitPrice))
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .transition(.opacity)
                    } else {
                        HStack(spacing: 10) {
                            StepperCapsule(qty: line.qty, atLimit: cap.map { line.qty >= $0 } ?? false, compact: false, large: true,
                                           onPlus: { cart.increment(key, limit: cap) },
                                           onMinus: { cart.decrement(key) })
                                .frame(width: 128)
                            let total = cart.totals(catalog).rows.first(where: { $0.key == key })?.lineTotal ?? unitPrice * Double(line.qty)
                            HStack {
                                Text("في السلة").font(.kufi(15, .bold))
                                Spacer()
                                Text(Money.sar(total)).font(.kufi(15, .bold))
                                    .contentTransition(.numericText(value: total))
                            }
                            .foregroundStyle(Theme.brandDeep)
                            .padding(.horizontal, 16)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Theme.mint, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .transition(.opacity)
                    }
                }
                .animation(.snappy(duration: 0.25), value: line.qty == 0)
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 6)
                .background(.bar)
            }
        }
        .onChange(of: packIndex) { _, _ in qty = 1 }
    }

    private func bestPackSaving(_ p: Product) -> (amount: Double, unit: String)? {
        var best: (Double, String)? = nil
        for pack in p.packs where pack.price > 0 {
            let saving = p.price * Double(pack.count) - pack.price
            if saving > 0.009, saving > (best?.0 ?? 0) { best = (saving, pack.unit) }
        }
        return best.map { (amount: $0.0, unit: $0.1) }
    }
}

/// حبة / شدّة / كرتون (أقل من ٥ خيارات: أزرار كبيرة واضحة)
struct PackPicker: View {
    let product: Product
    @Binding var selection: Int?

    var body: some View {
        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        LazyVGrid(columns: columns, spacing: 10) {
            option(title: product.unit.isEmpty ? "حبة" : product.unit, price: product.price, index: nil, best: false, before: nil)
            // عرض الكمية ما يطلع هنا: ينطبق لحاله في السلة
            ForEach(Array(product.packs.enumerated()).filter { $0.offset != product.quantityOffer?.index && $0.element.price > 0 }, id: \.offset) { i, pack in
                let before = (product.price * Double(pack.count) * 100).rounded() / 100
                option(title: "\(pack.unit)", price: pack.price, index: i,
                       best: before - pack.price > 0.009, before: before - pack.price > 0.009 ? before : nil)
            }
        }
    }

    private func option(title: String, price: Double, index: Int?, best: Bool, before: Double?) -> some View {
        let selected = selection == index
        return Button {
            guard selection != index else { return }
            Haptics.selected()
            withAnimation(.snappy) { selection = index }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(tv: title).font(.kufi(14, .bold)).foregroundStyle(Theme.ink).lineLimit(1)
                HStack(spacing: 4) {
                    Text(Money.sar(price)).font(.ui(size: 13, weight: before == nil ? .regular : .bold))
                        .foregroundStyle(before == nil ? Theme.muted : Theme.copperInk)
                    if let before {
                        Text(Money.plain(before)).font(.ui(size: 11.5)).strikethrough().foregroundStyle(Theme.muted)
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(selected ? Theme.mintSoft : .white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(selected ? Theme.brand : Theme.line, lineWidth: selected ? 2 : 1.3))
            .overlay(alignment: .topTrailing) {
                if best {
                    Text("الأوفر")
                        .font(.kufi(10, .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Theme.copper, in: Capsule())
                        .offset(x: -8, y: -9)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// «🔥 عرض: أي ٤ حبات بـ ٧ ر.س» مع شريط تقدّم: «عندك ٢ بالسلة · أضف ٢ وتحصل على العرض»
/// «مرتين»، «٣ مرات»، «١٣ مرة»
private func times(_ n: Int) -> String {
    switch n {
    case ..<2: return ""
    case 2: return " مرتين"
    case 3...10: return " \(n) مرات"
    default: return " \(n) مرة"
    }
}

private struct QuantityOfferBox: View {
    let product: Product
    let offer: (count: Int, price: Double, before: Double)
    @Environment(Cart.self) private var cart

    var body: some View {
        let inCart = cart.line(product.id).qty
        let rest = inCart % offer.count
        let applied = inCart / offer.count
        VStack(alignment: .leading, spacing: 8) {
            Label("عرض: أي \(Product.pieces(offer.count)) بـ \(Money.sar(offer.price))", systemImage: "flame.fill")
                .font(.ui(size: 15.5, weight: .bold))
            (Text("الحبة \(Money.plain(offer.price / Double(offer.count))) بدل \(Money.plain(product.price)) · وفّر \(Money.sar(offer.before - offer.price)) على كل \(offer.count)"))
                .font(.ui(size: 13, weight: .semibold))
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.copper.opacity(0.22))
                    Capsule().fill(Theme.copper)
                        .frame(width: geo.size.width * CGFloat(rest == 0 && applied > 0 ? 1 : Double(rest) / Double(offer.count)))
                }
            }
            .frame(height: 8)
            .animation(.smooth, value: inCart)
            Group {
                if inCart == 0 {
                    Text("أضف \(Product.pieces(offer.count)) وينطبق العرض لحاله")
                } else if applied > 0 {
                    Text("✓ العرض انطبق\(times(applied)) · عندك \(inCart) بالسلة")
                } else {
                    Text("عندك \(inCart) بالسلة · زود \(offer.count - rest) وتحصل على العرض")
                }
            }
            .font(.ui(size: 13.5, weight: .bold))
            .foregroundStyle(Theme.ink)
        }
        .foregroundStyle(Theme.copperInk)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.copper, lineWidth: 1.5))
    }
}
