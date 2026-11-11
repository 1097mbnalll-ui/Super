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
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(_ product: Product) -> some View {
        let available = catalog.isAvailable(product)
        let pack = packIndex.flatMap { $0 < product.packs.count ? product.packs[$0] : nil }
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
                    if let saving = bestPackSaving(product), available {
                        Label("وفّر \(Money.plain(saving.amount)) ر.س بالـ\(saving.unit)", systemImage: "percent")
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
                        Text(category.name)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.oliveInk)
                            .padding(.horizontal, 9).padding(.vertical, 3)
                            .background(Theme.oliveSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    Text(product.name)
                        .font(.kufi(19, .bold, relativeTo: .title2))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        PriceLabel(price: product.price, old: product.old, size: 24)
                        Text("/ \(product.unit)").font(.system(size: 14)).foregroundStyle(Theme.muted)
                    }
                    if !available {
                        Label("نفد من المحل حالياً", systemImage: "exclamationmark.circle")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.copperInk)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)

                if !product.packs.isEmpty {
                    Text("طريقة الشراء")
                        .font(.kufi(15, .bold))
                        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 10)
                    PackPicker(product: product, selection: $packIndex)
                        .padding(.horizontal, 16)
                }

                let suggestions = catalog.products(in: product.cat)
                    .filter { $0.id != product.id && $0.hasPhoto && catalog.isAvailable($0) }
                    .prefix(12)
                if !suggestions.isEmpty {
                    SectionHeader(title: "ممكن يعجبك").padding(.top, 24).padding(.bottom, 10)
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
                HStack(spacing: 10) {
                    StepperCapsule(qty: qty, atLimit: qty >= 20, compact: false,
                                   onPlus: { if qty < 20 { qty += 1 } },
                                   onMinus: { if qty > 1 { qty -= 1 } })
                        .frame(width: 118)
                    Button {
                        let line = cart.line(key)
                        let cap = cart.limit(for: key, in: catalog) ?? product.max
                        let target = cap.map { min(line.qty + qty, $0) } ?? line.qty + qty
                        cart.set(key, target)
                        Haptics.success()
                        withAnimation(.snappy) { justAdded = true }
                        Task {
                            try? await Task.sleep(for: .seconds(1.6))
                            withAnimation(.snappy) { justAdded = false }
                        }
                    } label: {
                        HStack {
                            Text(justAdded ? "انضاف للسلة ✓" : "أضف للسلة")
                            Spacer()
                            Text(Money.sar(unitPrice * Double(qty)))
                                .contentTransition(.numericText(value: unitPrice * Double(qty)))
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
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
        for pack in p.packs {
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
            option(title: product.unit.isEmpty ? "حبة" : product.unit, price: product.price, index: nil, best: false)
            ForEach(Array(product.packs.enumerated()), id: \.offset) { i, pack in
                option(title: "\(pack.unit)", price: pack.price, index: i,
                       best: product.price * Double(pack.count) - pack.price > 0.009)
            }
        }
    }

    private func option(title: String, price: Double, index: Int?, best: Bool) -> some View {
        let selected = selection == index
        return Button {
            guard selection != index else { return }
            Haptics.selected()
            withAnimation(.snappy) { selection = index }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.kufi(14, .bold)).foregroundStyle(Theme.ink).lineLimit(1)
                Text(Money.sar(price)).font(.system(size: 13)).foregroundStyle(Theme.muted)
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
