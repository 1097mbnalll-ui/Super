import SwiftUI

/// صفحة المنتج (design/mix-05-product.webp): تكبر من كرت المنتج وترجع له
struct ProductView: View {
    let productID: String
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var packIndex: Int? = nil   // nil = الحبة
    @State private var qty = 1
    @State private var justAdded = false
    @State private var wGrams = 0   // الوزن المختار بالجرام (الخضار والفواكه)
    @Environment(\.livePath) private var livePath

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
        .onAppear { Analytics.shared.view(productID); Visits.shared.viewed(productID) }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // المفضلة (مثل القلب أعلى صفحة المنتج في الموقع)
            if let p = catalog.product(productID), !catalog.isSoon(p) {
                ToolbarItem(placement: .topBarTrailing) { FavoriteButton(productID: productID, large: true) }
            }
        }
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
                    if product.imageURL == nil {
                        // بدون صورة: بلاطة مائلة بلون القسم (مثل الموقع)
                        NoPhotoTile(product: product, large: true)
                            .frame(width: 220, height: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
                            .shadow(color: Theme.ink.opacity(0.16), radius: 17, y: 11)
                            .rotationEffect(.degrees(-4))
                            .saturation(available ? 1 : 0.15)
                            .opacity(available ? 1 : 0.6)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        RemoteImage(url: product.imageURL, maxPixel: 900)
                            .padding(36)
                            .opacity(available ? 1 : 0.5)
                    }
                    if available, let badge = product.offerBadge {
                        Label(tr(badge), systemImage: "percent")
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
                        Text(tv: [product.badge, product.brand, category.name, catalog.dailyDeal?.product.id == product.id ? "عرض اليوم" : nil].compactMap { $0 }.joined(separator: " · "))
                            .font(.ui(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.oliveInk)
                            .padding(.horizontal, 9).padding(.vertical, 3)
                            .background(Theme.oliveSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    Text(tv: product.name)
                        .font(.kufi(19, .bold, relativeTo: .title2))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        if catalog.isSoon(product) { Text("قريباً").font(.ui(size: 22, weight: .bold)).foregroundStyle(Theme.copper) }
                        else { PriceLabel(price: unitPrice, old: pack == nil ? product.old : nil, size: 24, perKilo: pack == nil && product.weighed) }
                        Text(tv: pack.map { "/ \($0.unit)" } ?? (product.packs.isEmpty ? "/ \(product.unit)" : "/ الحبة"))
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
                        Label(catalog.isSoon(product) ? "قريباً إن شاء الله نوفّره، تابعنا." : "نفد من المحل حالياً", systemImage: catalog.isSoon(product) ? "clock" : "exclamationmark.circle")
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

                if available, packIndex == nil, catalog.isWeighed(product) {
                    Text("كم تبي؟")
                        .font(.kufi(16, .bold))
                        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 10)
                    WeightPicker(product: product, grams: $wGrams)
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
            if available, let live = catalog.tap("buy", product) {
                // زر الشراء يفتح صفحة حية حسب الموقع (store.app.tap on=buy)، مثل نافذة اختيار عرض المجموعة
                let g = catalog.group(for: product.id)
                Button { livePath?.wrappedValue.append(Route.live(live.page)) } label: {
                    HStack {
                        Text(tv: live.label ?? "أضف للسلة"); Spacer()
                        if let g { Text("\(g.count) بـ \(Money.plain(g.price))") } else { Text(tv: Money.sar(unitPrice)) }
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(.bar)
            } else if available, packIndex == nil, catalog.isWeighed(product) {
                // بالوزن: الاختيار فوق في الصفحة (WeightPicker)، وتحت زر الإضافة بس
                WeightAddBar(product: product, grams: $wGrams)
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 6)
                    .background(.bar)
            } else if available {
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
                                Text(tv: Money.sar(unitPrice))
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
                                Text(tv: Money.sar(total)).font(.kufi(15, .bold))
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
                    Text(tv: Money.sar(price)).font(.ui(size: 13, weight: before == nil ? .regular : .bold))
                        .foregroundStyle(before == nil ? Theme.muted : Theme.copperInk)
                    if let before {
                        Text(tv: Money.plain(before)).font(.ui(size: 11.5)).strikethrough().foregroundStyle(Theme.muted)
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


/// اختيار الوزن (الخضار والفواكه، ١٧ نوفمبر ٢٠٢٦ طلب المالك «مرتبة أكثر»):
/// ١) أحجام جاهزة بكروت واضحة (ربع، نص، كيلو، كيلوين) وتحت كل واحد سعره
/// ٢) زر − / + يزيد وينقص ربع كيلو
/// ٣) «تبي وزن أو مبلغ معيّن؟» تنفتح وفيها خانتين (الوزن بالكيلو أو المبلغ بالريال)
/// والزر تحت (WeightAddBar) يضيف للسلة بالوزن المختار. السعر لكل كيلو، والخادم يحسب نفس الشي.
struct WeightPicker: View {
    let product: Product
    @Binding var grams: Int
    @Environment(Cart.self) private var cart
    @State private var custom = false
    @State private var kgText = ""
    @State private var sarText = ""
    @FocusState private var field: Field?
    enum Field { case kg, sar }

    static let green = Color(hex: 0x0E8A6A)
    private static let sizes: [(Int, String)] = [(250, "ربع كيلو"), (500, "نص كيلو"), (1000, "كيلو"), (2000, "كيلوين")]
    static func price(_ p: Product, _ g: Int) -> Double { (p.price * Double(g) / 1000 * 100).rounded() / 100 }
    static func label(_ g: Int) -> String { g < 1000 ? "\(g) جرام" : "\(Weight.kg(g)) كيلو" }
    private static func parse(_ s: String) -> Double {
        var t = ""
        for ch in s {
            if let v = ch.wholeNumberValue { t.append(String(v)) }
            else if ch == "." || ch == "," || ch == "٫" { t.append(".") }
        }
        return Double(t) ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(Self.sizes, id: \.0) { s in tile(s.0, s.1) }
            }
            stepper
            customBox
        }
        .onAppear {
            if grams == 0, cart.isWeighed(product.id) { grams = cart.line(product.id).qty }
            sync()
        }
        .onChange(of: grams) { _, _ in sync() }
        .onChange(of: kgText) { _, v in if field == .kg { grams = Int((Self.parse(v) * 1000).rounded()) } }
        .onChange(of: sarText) { _, v in if field == .sar, product.price > 0 { grams = Int((Self.parse(v) / product.price * 1000).rounded()) } }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("تم") { field = nil }
            }
        }
    }

    private func sync() {
        if field != .kg { kgText = grams > 0 ? Weight.kg(grams) : "" }
        if field != .sar { sarText = grams > 0 ? Money.plain(Self.price(product, grams)) : "" }
    }

    // كرت حجم جاهز: الاسم كبير، الوزن بالجرام، والسعر
    private func tile(_ g: Int, _ name: String) -> some View {
        let on = grams == g
        return Button {
            field = nil
            grams = g
            Haptics.selected()
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(tv: name).font(.kufi(16, .bold)).foregroundStyle(Theme.ink)
                    Spacer(minLength: 0)
                    Image(systemName: on ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20))
                        .foregroundStyle(on ? Self.green : Theme.line)
                }
                Text(tv: Self.label(g)).font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(Theme.muted)
                Text(tv: Money.sar(Self.price(product, g)))
                    .font(.ui(size: 15.5, weight: .bold))
                    .foregroundStyle(on ? Self.green : Theme.ink)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(on ? Color(hex: 0xEEF9F4) : Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(on ? Self.green : Theme.line, lineWidth: on ? 2 : 1))
            .animation(.snappy(duration: 0.18), value: on)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // − الوزن الحالي + (ربع كيلو مع كل ضغطة)
    private var stepper: some View {
        let down = max(250, ((grams - 1) / 250) * 250)
        let up = min(50000, (grams / 250 + 1) * 250)
        return VStack(spacing: 6) {
            Text("أو زِد ونقّص بربع كيلو").font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(Theme.muted)
            HStack(spacing: 12) {
                stepButton("minus", enabled: grams > 250, label: "نقّص ربع كيلو") { grams = down }
                VStack(spacing: 2) {
                    Text(tv: grams > 0 ? Self.label(grams) : "اختر الوزن")
                        .font(.kufi(19, .bold)).foregroundStyle(Theme.ink)
                        .contentTransition(.numericText(value: Double(grams)))
                    if grams > 0 {
                        Text(tv: Money.sar(Self.price(product, grams)))
                            .font(.ui(size: 13.5, weight: .bold)).foregroundStyle(Self.green)
                    }
                }
                .frame(maxWidth: .infinity)
                .animation(.snappy(duration: 0.18), value: grams)
                stepButton("plus", enabled: grams < 50000, label: "زِد ربع كيلو") { grams = up }
            }
        }
        .padding(10)
        .background(Color(hex: 0xF2F5F4), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func stepButton(_ icon: String, enabled: Bool, label: String, _ act: @escaping () -> Void) -> some View {
        Button {
            field = nil
            act()
            Haptics.selected()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .bold))
                .frame(width: 48, height: 48)
                .foregroundStyle(enabled ? Color.white : Theme.muted)
                .background(enabled ? Self.green : Theme.line, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(Text(tv: label))
    }

    // خانة اختيارية: الوزن بالكيلو أو المبلغ بالريال (الثاني ينحسب)
    @ViewBuilder private var customBox: some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) { custom.toggle() }
            if !custom { field = nil }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "pencil.line")
                Text("تبي وزن أو مبلغ معيّن؟ اكتبه")
                Spacer(minLength: 0)
                Image(systemName: custom ? "chevron.up" : "chevron.down")
            }
            .font(.ui(size: 14, weight: .semibold))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 4).padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        if custom {
            HStack(spacing: 10) {
                input("الوزن", unit: "كيلو", text: $kgText, which: .kg)
                input("المبلغ", unit: "ر.س", text: $sarText, which: .sar)
            }
            Text(tv: grams > 0 && (grams < 100 || grams > 50000) ? "الوزن من ١٠٠ جرام إلى ٥٠ كيلو" : "اكتب واحد منهم والثاني ينحسب لحاله")
                .font(.ui(size: 12, weight: .semibold))
                .foregroundStyle(grams > 0 && (grams < 100 || grams > 50000) ? Theme.copperInk : Theme.muted)
        }
    }

    private func input(_ title: String, unit: String, text: Binding<String>, which: Field) -> some View {
        let active = field == which
        return VStack(alignment: .leading, spacing: 4) {
            Text(tv: title).font(.ui(size: 12, weight: .bold)).foregroundStyle(Theme.muted)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                TextField("0", text: text)
                    .keyboardType(.decimalPad)
                    .focused($field, equals: which)
                    .font(.kufi(20, .bold))
                    .foregroundStyle(Theme.ink)
                Text(tv: unit).font(.ui(size: 13, weight: .bold)).foregroundStyle(Theme.muted)
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(active ? Self.green : Theme.line, lineWidth: active ? 2 : 1))
        .contentShape(Rectangle())
        .onTapGesture { field = which }
    }
}

/// الزر تحت في صفحة منتج بالوزن: «أضف للسلة · نص كيلو · ٤٫٠٠»، وبعد الإضافة «في السلة ✓» وزر سلة المهملات يشيله
struct WeightAddBar: View {
    let product: Product
    @Binding var grams: Int
    @Environment(Cart.self) private var cart
    private var ok: Bool { grams >= 100 && grams <= 50000 && product.price > 0 }

    var body: some View {
        let inCart = cart.isWeighed(product.id) ? cart.line(product.id).qty : 0
        let same = inCart > 0 && inCart == grams
        HStack(spacing: 10) {
            if inCart > 0 {
                Button {
                    cart.setWeight(product.id, grams: 0)
                    Haptics.removed()
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(width: 54, height: 54)
                        .foregroundStyle(Theme.copperInk)
                        .background(Theme.copperSoft, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("شيله من السلة"))
            }
            Button {
                cart.setWeight(product.id, grams: grams)
                Haptics.added()
            } label: {
                HStack(spacing: 8) {
                    Text(tv: !ok ? "اختر الوزن من فوق" : same ? "في السلة ✓" : inCart > 0 ? "حدّث السلة" : "أضف للسلة")
                    Spacer(minLength: 4)
                    if ok { Text(tv: "\(WeightPicker.label(grams)) · \(Money.sar(WeightPicker.price(product, grams)))") }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .font(.kufi(15.5, .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(same ? Theme.brandDeep : WeightPicker.green, in: Capsule())
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            .disabled(!ok || same)
            .opacity(ok ? 1 : 0.45)
        }
        .animation(.snappy(duration: 0.2), value: inCart > 0)
    }
}
