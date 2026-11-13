import SwiftUI

/// كرت المنتج (٣ بالصف): صورة + شريط «عرض» + زر الإضافة/العداد فوق الصورة + الاسم سطرين بالضبط + السعر
struct ProductCard: View {
    let product: Product
    var showCategory = false
    /// كرت عرض: deal (كل منتج بـ ٠٫٩٥) أو daily (عرض اليوم)، ومفتاحه في السلة d:/t:
    var kind: PromoLine.Kind? = nil
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart

    private var key: String { kind == .deal ? "d:\(product.id)" : kind == .daily ? "t:\(product.id)" : product.id }
    private var promoPrice: Double? {
        switch kind {
        case .deal: return catalog.store.deal95.price
        case .daily: return catalog.dailyDeal?.product.id == product.id ? catalog.dailyDeal?.price : nil
        default: return nil
        }
    }
    private var badgeText: String? {
        switch kind {
        case .deal: return "🔒 بـ \(Money.plain(catalog.store.deal95.price))"
        case .daily: return "🔥 عرض اليوم"
        default: return product.offerBadge ?? product.badge
        }
    }

    var body: some View {
        let available = catalog.isAvailable(product)
        // الضغط على الكرت: صفحة المنتج، أو صفحة حية لو الموقع حدد (store.app.tap on=open)
        NavigationLink(value: kind == nil ? catalog.tap("open", product).map { Route.live($0.page) } ?? Route.product(product.id) : Route.product(product.id)) {
            VStack(alignment: .leading, spacing: 3) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(Theme.surface)
                    RemoteImage(url: product.imageURL, maxPixel: 300)
                        .padding(12)
                        .padding(.bottom, 12)
                        .opacity(available ? 1 : 0.45)
                    if available, let badge = badgeText {
                        Text(tv: badge)
                            .font(.kufi(10.5, .bold, relativeTo: .caption2))
                            .lineLimit(1)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(Theme.copper, in: UnevenRoundedRectangle(bottomTrailingRadius: 10, topTrailingRadius: 0, style: .continuous))
                    }
                    if available, let low = catalog.lowLeft(product) {
                        Text(tv: "باقي \(low) بس")
                            .font(.ui(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.copperInk, in: Capsule())
                            .padding(5)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                    if !available {
                        Text("نفد")
                            .font(.ui(size: 11, weight: .bold))
                            .foregroundStyle(Theme.muted)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(.white, in: Capsule())
                            .padding(6)
                    }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .modifier(ZoomSource(id: product.id))

                if showCategory, AppLook.current.showCatChip, let cat = catalog.category(product.cat) {
                    Text(tv: cat.name)
                        .font(.ui(size: 10.5, weight: .semibold))
                        .foregroundStyle(Theme.oliveInk)
                        .lineLimit(1)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Theme.oliveSoft, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .padding(.top, 4)
                }
                Text(tv: product.name)
                    .font(.ui(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                    .padding(.top, showCategory ? 0 : 4)
                Text(tv: product.unit)
                    .font(.ui(size: 12.5))
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
                if let pp = promoPrice {
                    PriceLabel(price: pp, old: product.price, size: 17)
                } else if available, let q = product.quantityOffer {
                    // عرض الكمية مثل: ٥٫٨٠ ر.س  ~٦٫٠٠~  [العدد ٣]  ثم «🔥 وفّر ٠٫٢٠ ر.س بالعرض»
                    // السعر بسطر لحاله (الكرت ضيق)، وتحته «العدد N» و«وفّر»
                    PriceLabel(price: q.price, old: q.before, size: 16)
                    HStack(spacing: 4) {
                        HStack(spacing: 2) {
                            Text("العدد").font(.ui(size: 9.5, weight: .bold))
                            Text(tv: "\(q.count)").font(.kufi(12.5, .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(Theme.copper, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .fixedSize()
                        Text("🔥 وفّر \(Money.plain(q.before - q.price))")
                            .font(.ui(size: 10.5, weight: .bold))
                            .foregroundStyle(Theme.copperInk)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                } else {
                    PriceLabel(price: product.price, old: available ? product.old : nil, size: 17)
                }
            }
            .padding(6)
            .padding(.bottom, 4)
            .background(.white, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous).strokeBorder(Theme.line))
            .shadow(color: Theme.ink.opacity(0.06), radius: 4, y: 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle(scale: 0.97))
        // العداد فوق الصورة (برا الرابط عشان ضغطته ما تفتح المنتج)
        .overlay(alignment: .top) {
            Color.clear
                .aspectRatio(1, contentMode: .fit)
                .padding(6)
                .overlay(alignment: .bottom) {
                    if available {
                        if kind == .deal, !cart.dealUnlocked(catalog) {
                            HStack {
                                Spacer(minLength: 0)
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 13 * Theme.controlScale, weight: .bold))
                                    .foregroundStyle(Theme.muted)
                                    .frame(width: 30 * Theme.controlScale, height: 30 * Theme.controlScale)
                                    .background(.white, in: RoundedRectangle(cornerRadius: 9 * Theme.controlScale, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 9 * Theme.controlScale, style: .continuous).strokeBorder(Theme.line))
                                    .accessibilityLabel("مقفول: يفتح لطلبك فوق \(Money.sar(catalog.store.deal95.min))")
                            }
                            .padding(6)
                        } else {
                            CardQuantityControl(key: key, limit: product.max)
                                .padding(6)
                        }
                    }
                }
        }
        .accessibilityElement(children: .contain)
    }
}

/// زر + أبيض (مو مملوء، عشان ما تكثر الأزرار البارزة)، وبعد الإضافة يتحول لعداد أخضر
struct CardQuantityControl: View {
    let key: String
    let limit: Int?
    @Environment(Cart.self) private var cart
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.livePath) private var livePath

    var body: some View {
        let line = cart.line(key)
        let cap = cart.limit(for: key, in: catalog) ?? limit
        // زر + يتصرف حسب الموقع (store.app.tap)، مثل منتج داخل عرض مجموعة: يفتح نافذة الاختيار الحية والمنتج محطوط فيها
        let live = key.contains(":") || key.contains("~") ? nil : catalog.product(key).flatMap { catalog.tap("add", $0) }
        Group {
            if line.qty == 0 || live != nil {
                HStack {
                    Spacer(minLength: 0)
                    Button {
                        if let live, let lp = livePath { lp.wrappedValue.append(Route.live(live.page)); return }
                        cart.increment(key, limit: cap)
                    } label: {
                        // الزر متناسق مع حجم الكرت والسعر، ويكبر ويصغر مع الخط من «شكل التطبيق»
                        let outline = AppLook.current.addStyle == "outline"
                        Image(systemName: "plus")
                            .font(.system(size: 15 * Theme.controlScale, weight: .bold))
                            .foregroundStyle(outline ? Theme.brandDeep : .white)
                            .frame(width: 30 * Theme.controlScale, height: 30 * Theme.controlScale)
                            .background(outline ? Color.white : Theme.brand, in: RoundedRectangle(cornerRadius: 9 * Theme.controlScale, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 9 * Theme.controlScale, style: .continuous).strokeBorder(outline ? Theme.line : .clear))
                            .shadow(color: (outline ? Color.black : Theme.brand).opacity(outline ? 0.08 : 0.3), radius: 3, y: 1)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(PressableStyle(scale: 0.88))
                    .accessibilityLabel("أضف للسلة")
                }
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            } else {
                StepperCapsule(qty: line.qty, atLimit: cap.map { line.qty >= $0 } ?? false,
                               onPlus: { cart.increment(key, limit: cap) },
                               onMinus: { cart.decrement(key) })
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .animation(.snappy(duration: 0.25), value: line.qty == 0)
    }
}

/// [+ ٢ −] (− يصير سلة مهملات عند ١). الأرقام تتقلب بنعومة
struct StepperCapsule: View {
    let qty: Int
    var atLimit = false
    var compact = false
    /// صفحة المنتج: عداد كبير جنب زر «في السلة»
    var large = false
    let onPlus: () -> Void
    let onMinus: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onPlus) {
                Image(systemName: "plus")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
            }
            .opacity(atLimit ? 0.45 : 1)
            .accessibilityLabel("زيادة")
            Text(tv: String(qty))
                .font(.kufi(large ? 17 : 14, .bold))
                .contentTransition(.numericText(value: Double(qty)))
                .frame(minWidth: 22)
                .animation(.snappy, value: qty)
            Button(action: onMinus) {
                Image(systemName: qty == 1 ? "trash" : "minus")
                    .contentTransition(.symbolEffect(.replace))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(qty == 1 ? "شيل من السلة" : "نقص")
        }
        .font(.ui(size: compact ? 13 : 14, weight: .semibold))
        .foregroundStyle(.white)
        .frame(height: large ? 50 : (compact ? 38 : 32) * Theme.controlScale)
        .frame(minWidth: compact ? 96 : nil)
        .background(Theme.brand, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: Theme.brand.opacity(0.3), radius: 4, y: 2)
        .buttonStyle(PressableStyle(scale: 0.9))
    }
}

/// شبكة ٣ بالصف (صفين لو المستخدم كبّر الخط)
struct ProductGrid: View {
    let products: [Product]
    var showCategory = false
    var kind: PromoLine.Kind? = nil
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .top),
                            count: typeSize >= .accessibility1 ? 2 : AppLook.current.columns)
        LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            ForEach(products) { p in
                ProductCard(product: p, showCategory: showCategory, kind: kind)
            }
        }
        .padding(.horizontal, 10)
    }
}
