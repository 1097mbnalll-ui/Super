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
                    WeightPicker(product: product, grams: $wGrams)
                        .padding(.horizontal, 18)
                        .padding(.top, 20)
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


/// شاشة الوزن (الخضار والفواكه). المالك يختار شكلها من الإدارة بدون تحديث (store.app.weigh.style):
///  ruler  مسطرة تنسحب والوزن والسعر كبير فوق (الافتراضي، اعتمده المالك ١٧ نوفمبر ٢٠٢٦، ونفسه في الموقع)
///  chips  شرائح أحجام بسعرها + عدّاد تحت
///  money  زر «بالوزن / بالمبلغ»: أحجام أو مبالغ جاهزة
///  wheel  عجلة اختيار (مثل منبّه الآيفون)
/// وفي كل الأشكال رابط «وزن أو مبلغ آخر» (store.app.weigh.input) يفتح خانتين يكتب فيها الزبون.
struct WeightPicker: View {
    let product: Product
    @Binding var grams: Int
    @Environment(Cart.self) private var cart
    @Environment(CatalogStore.self) private var catalog
    @State private var byMoney = false
    @State private var showInput = false

    static let green = Color(hex: 0x0E8A6A)
    static let soft = Color(hex: 0xF2F5F4)
    static func price(_ p: Product, _ g: Int) -> Double { (p.price * Double(g) / 1000 * 100).rounded() / 100 }
    /// «500 جرام» / «1.5 كيلو»
    static func label(_ g: Int) -> String { g < 1000 ? "\(g) جرام" : "\(Weight.kg(g)) كيلو" }
    /// اسم قصير للشريحة: ربع / نص / كيلو / 1.5 / 2 كيلو
    static func short(_ g: Int) -> String {
        switch g {
        case 250: return "ربع كيلو"
        case 500: return "نص كيلو"
        case 1000: return "كيلو"
        default: return label(g)
        }
    }
    static func gramsFor(_ p: Product, money: Double) -> Int { p.price > 0 ? Int((money / p.price * 1000).rounded()) : 0 }

    private var cfg: WeighUI { catalog.store.weigh }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch cfg.style {
            case "chips": chipsBody
            case "money": moneyBody
            case "wheel": wheelBody
            default: rulerBody
            }
        }
        .onAppear {
            if grams == 0, cart.isWeighed(product.id) { grams = cart.line(product.id).qty }
            // المسطرة والعجلة لازم يبدون من وزن
            if grams == 0, cfg.style == "ruler" || cfg.style == "wheel" { grams = 1000 }
        }
        .sheet(isPresented: $showInput) {
            WeightInputSheet(product: product, grams: $grams)
                .presentationDetents([.height(300)])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: عنوان القسم ورابط «وزن أو مبلغ آخر»
    private func header(_ title: String) -> some View {
        HStack {
            Text(tv: title).font(.kufi(15, .bold)).foregroundStyle(Theme.ink)
            Spacer(minLength: 0)
            if cfg.input {
                Button { showInput = true } label: {
                    HStack(spacing: 3) {
                        Text("وزن أو مبلغ آخر")
                        Image(systemName: "chevron.left").font(.system(size: 11, weight: .bold))
                    }
                    .font(.ui(size: 13, weight: .semibold))
                    .foregroundStyle(Self.green)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: أ) شرائح
    private var chipsBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            header("اختر الوزن")
            chipRow(cfg.sizes.map { g in (g, Self.short(g), Money.plain(Self.price(product, g))) })
        }
    }

    /// صف شرائح: (الجرامات، العنوان، السطر الصغير). لو أكثر من ٥ ينسحب يمين ويسار
    @ViewBuilder
    private func chipRow(_ items: [(Int, String, String)]) -> some View {
        let row = HStack(spacing: 8) {
            ForEach(items, id: \.0) { it in
                let on = grams == it.0
                Button {
                    grams = it.0
                    Haptics.selected()
                } label: {
                    VStack(spacing: 2) {
                        Text(tv: it.1).font(.kufi(14, .bold)).lineLimit(1).minimumScaleFactor(0.75)
                        Text(tv: it.2).font(.ui(size: 12, weight: .semibold)).opacity(on ? 0.85 : 0.6)
                    }
                    .foregroundStyle(on ? Color.white : Theme.ink)
                    .padding(.vertical, 9).padding(.horizontal, 6)
                    .frame(minWidth: 62, maxWidth: items.count > 5 ? nil : CGFloat.infinity)
                    .background(on ? Self.green : Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(on ? Self.green : Theme.line, lineWidth: 1.5))
                    .animation(.snappy(duration: 0.15), value: on)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        if items.count > 5 {
            ScrollView(.horizontal) { row.padding(.vertical, 1) }.scrollIndicators(.hidden)
        } else {
            row
        }
    }

    // MARK: ب) مسطرة
    private var rulerBody: some View {
        VStack(spacing: 10) {
            header("اسحب المسطرة")
            HStack(spacing: 14) {
                roundButton("minus", enabled: grams > cfg.step) { grams = max(cfg.step, ((grams - 1) / cfg.step) * cfg.step) }
                VStack(spacing: 0) {
                    Text(tv: Self.label(grams)).font(.kufi(34, .bold)).foregroundStyle(Theme.ink)
                        .contentTransition(.numericText(value: Double(grams)))
                    Text(tv: Money.sar(Self.price(product, grams))).font(.ui(size: 16, weight: .bold)).foregroundStyle(Self.green)
                }
                .frame(maxWidth: .infinity)
                .animation(.snappy(duration: 0.15), value: grams)
                roundButton("plus", enabled: grams < 20000) { grams = min(20000, (grams / cfg.step + 1) * cfg.step) }
            }
            WeightRuler(grams: $grams, step: cfg.step)
                .frame(height: 74)
        }
    }

    // MARK: ج) بالوزن أو بالمبلغ
    private var moneyBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            header(byMoney ? "بكم تبي؟" : "كم تبي؟")
            Picker("", selection: $byMoney) {
                Text("بالوزن").tag(false)
                Text("بالمبلغ").tag(true)
            }
            .pickerStyle(.segmented)
            if byMoney {
                chipRow(cfg.money.map { m in (Self.gramsFor(product, money: m), Money.plain(m), "ريال") })
            } else {
                chipRow(cfg.sizes.map { g in (g, Self.short(g), Money.plain(Self.price(product, g))) })
            }
            if grams > 0 {
                HStack {
                    Text(tv: byMoney ? "يجيك تقريباً" : "السعر")
                    Spacer()
                    Text(tv: byMoney ? Self.label(grams) : Money.sar(Self.price(product, grams))).font(.ui(size: 14, weight: .bold))
                }
                .font(.ui(size: 13.5, weight: .semibold))
                .foregroundStyle(Color(hex: 0x086650))
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color(hex: 0xE8F6F0), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    // MARK: د) عجلة
    private var wheelBody: some View {
        let options = wheelOptions
        return VStack(alignment: .leading, spacing: 6) {
            header("لفّ واختر الوزن")
            Picker("", selection: $grams) {
                ForEach(options, id: \.self) { g in
                    Text(tv: "\(Self.label(g))  ·  \(Money.sar(Self.price(product, g)))").tag(g)
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 150)
            .background(Self.soft, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private var wheelOptions: [Int] {
        var l: [Int] = Array(stride(from: cfg.step, through: 10000, by: cfg.step))
        if grams > 0, !l.contains(grams) { l.append(grams); l.sort() }
        return l
    }

    private func roundButton(_ icon: String, enabled: Bool, _ act: @escaping () -> Void) -> some View {
        Button {
            act()
            Haptics.selected()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .bold))
                .frame(width: 40, height: 40)
                .foregroundStyle(enabled ? Self.green : Theme.muted)
                .background(Self.soft, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(Text(tv: icon == "plus" ? "زِد" : "نقّص"))
    }
}

/// مسطرة الوزن: تنسحب يمين ويسار، وكل شرطة = خطوة (ربع كيلو افتراضياً)، والخط الأخضر بالنص هو الوزن المختار
struct WeightRuler: View {
    @Binding var grams: Int
    let step: Int
    @State private var start: Int? = nil
    private let spacing: CGFloat = 16
    private let maxG = 20000

    var body: some View {
        Canvas { ctx, size in
            let mid = size.width / 2
            let cur = Double(grams) / Double(step)
            let half = Double(mid / spacing) + 1
            let first = max(1, Int(floor(cur - half)))
            let last = max(first, min(maxG / step, Int(ceil(cur + half))))
            for i in first...last {
                let x = mid + CGFloat(Double(i) - cur) * spacing
                let g = i * step
                let major = g % 1000 == 0, mid500 = g % 500 == 0
                let h: CGFloat = major ? 30 : mid500 ? 22 : 12
                var p = Path()
                p.move(to: CGPoint(x: x, y: 8))
                p.addLine(to: CGPoint(x: x, y: 8 + h))
                ctx.stroke(p, with: .color(major ? Color(hex: 0x8F9C96) : Color(hex: 0xC9D2CE)), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                if mid500 {
                    ctx.draw(Text(Weight.kg(g)).font(.system(size: 11, weight: .semibold)).foregroundColor(Theme.muted),
                             at: CGPoint(x: x, y: size.height - 11))
                }
            }
        }
        .overlay(alignment: .top) {
            Capsule().fill(WeightPicker.green).frame(width: 4, height: 44).padding(.top, 4)
        }
        .background(WeightPicker.soft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .environment(\.layoutDirection, .leftToRight)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 2)
                .onChanged { v in
                    if start == nil { start = max(step, grams) }
                    let d = Int((-v.translation.width / spacing).rounded())
                    let g = min(maxG, max(step, (start ?? step) + d * step))
                    if g != grams { grams = g; Haptics.selected() }
                }
                .onEnded { _ in start = nil }
        )
        .accessibilityElement()
        .accessibilityLabel(Text(tv: "الوزن"))
        .accessibilityValue(Text(tv: WeightPicker.label(grams)))
        .accessibilityAdjustableAction { dir in
            switch dir {
            case .increment: grams = min(maxG, grams + step)
            case .decrement: grams = max(step, grams - step)
            @unknown default: break
            }
        }
    }
}

/// «وزن أو مبلغ آخر»: خانتين، يكتب في وحدة والثانية تنحسب
struct WeightInputSheet: View {
    let product: Product
    @Binding var grams: Int
    @Environment(\.dismiss) private var dismiss
    @State private var kgText = ""
    @State private var sarText = ""
    @State private var g = 0
    @FocusState private var field: Field?
    enum Field { case kg, sar }

    private static func parse(_ s: String) -> Double {
        var t = ""
        for ch in s {
            if let v = ch.wholeNumberValue { t.append(String(v)) }
            else if ch == "." || ch == "," || ch == "٫" { t.append(".") }
        }
        return Double(t) ?? 0
    }
    private var ok: Bool { g >= 100 && g <= 50000 }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("اكتب الوزن أو المبلغ").font(.kufi(17, .bold))
            HStack(spacing: 10) {
                input("الوزن", unit: "كيلو", text: $kgText, which: .kg)
                input("المبلغ", unit: "ر.س", text: $sarText, which: .sar)
            }
            Text(tv: g > 0 && !ok ? "الوزن من ١٠٠ جرام إلى ٥٠ كيلو" : "اكتب واحد منهم والثاني ينحسب لحاله")
                .font(.ui(size: 12.5, weight: .semibold))
                .foregroundStyle(g > 0 && !ok ? Theme.copperInk : Theme.muted)
            Button {
                grams = g
                dismiss()
            } label: {
                Text("تم").font(.kufi(16, .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(WeightPicker.green, in: Capsule())
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            .disabled(!ok)
            .opacity(ok ? 1 : 0.45)
        }
        .padding(20)
        .onAppear {
            g = grams
            if grams > 0 { kgText = Weight.kg(grams); sarText = Money.plain(WeightPicker.price(product, grams)) }
            field = .kg
        }
        .onChange(of: kgText) { _, v in
            guard field == .kg else { return }
            g = Int((Self.parse(v) * 1000).rounded())
            sarText = g > 0 ? Money.plain(WeightPicker.price(product, g)) : ""
        }
        .onChange(of: sarText) { _, v in
            guard field == .sar, product.price > 0 else { return }
            g = Int((Self.parse(v) / product.price * 1000).rounded())
            kgText = g > 0 ? Weight.kg(g) : ""
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
                    .font(.kufi(22, .bold))
                    .foregroundStyle(Theme.ink)
                Text(tv: unit).font(.ui(size: 13, weight: .bold)).foregroundStyle(Theme.muted)
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(active ? WeightPicker.green : Theme.line, lineWidth: active ? 2 : 1))
        .contentShape(Rectangle())
        .onTapGesture { field = which }
    }
}

/// الشريط تحت في صفحة منتج بالوزن: (بالشرائح) عدّاد − الوزن + وزر «أضف · السعر»،
/// وبعد الإضافة «في السلة ✓» وزر يشيله من السلة
struct WeightAddBar: View {
    let product: Product
    @Binding var grams: Int
    @Environment(Cart.self) private var cart
    @Environment(CatalogStore.self) private var catalog
    private var ok: Bool { grams >= 100 && grams <= 50000 && product.price > 0 }

    var body: some View {
        let step = catalog.store.weigh.step
        let inCart = cart.isWeighed(product.id) ? cart.line(product.id).qty : 0
        let same = inCart > 0 && inCart == grams
        let counter = catalog.store.weigh.style == "chips" && grams > 0 && !same
        HStack(spacing: 10) {
            if same {
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
            } else if counter {
                HStack(spacing: 2) {
                    stepButton("plus", enabled: grams < 50000) { grams = min(50000, (grams / step + 1) * step) }
                    Text(tv: WeightPicker.short(grams))
                        .font(.kufi(13.5, .bold))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(minWidth: 64)
                        .contentTransition(.numericText(value: Double(grams)))
                    stepButton("minus", enabled: grams > step) { grams = max(step, ((grams - 1) / step) * step) }
                }
                .padding(5)
                .background(WeightPicker.soft, in: Capsule())
                .animation(.snappy(duration: 0.15), value: grams)
            }
            Button {
                cart.setWeight(product.id, grams: grams)
                Haptics.added()
            } label: {
                HStack(spacing: 6) {
                    Text(tv: !ok ? "اختر الوزن" : same ? "في السلة ✓" : inCart > 0 ? "حدّث السلة" : (counter ? "أضف" : "أضف للسلة"))
                    if ok {
                        Text(tv: "· " + (counter ? "" : WeightPicker.label(grams) + " · ") + Money.sar(WeightPicker.price(product, grams)))
                            .opacity(0.9)
                    }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .font(.kufi(15, .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(same ? Theme.brandDeep : WeightPicker.green, in: Capsule())
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            .disabled(!ok || same)
            .opacity(ok ? 1 : 0.45)
        }
        .animation(.snappy(duration: 0.2), value: same)
        .animation(.snappy(duration: 0.2), value: counter)
    }

    private func stepButton(_ icon: String, enabled: Bool, _ act: @escaping () -> Void) -> some View {
        Button {
            act()
            Haptics.selected()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .bold))
                .frame(width: 42, height: 42)
                .foregroundStyle(enabled ? WeightPicker.green : Theme.muted)
                .background(Color.white, in: Circle())
                .shadow(color: Theme.ink.opacity(0.08), radius: 3, y: 1)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(Text(tv: icon == "plus" ? "زِد" : "نقّص"))
    }
}
