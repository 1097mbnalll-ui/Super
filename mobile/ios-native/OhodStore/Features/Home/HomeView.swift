import SwiftUI

/// الرئيسية (design/mix-01-home.webp)
struct HomeView: View {
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                HomeHeader(path: $path)
                BannerCarousel(path: $path)
                    .padding(.horizontal, 16).padding(.top, 16)
                if catalog.store.closed {
                    ClosedNotice(message: catalog.store.closedMessage)
                        .padding(.horizontal, 16).padding(.top, 12)
                }
                if AppLook.current.showChips {
                    QuickChips(tab: $tab, path: $path)
                        .padding(.top, 14)
                }
                if let index = catalog.index {
                    if AppLook.current.showFeatured {
                        SectionHeader(title: "مختارات لك", emoji: "✨", actionTitle: "كل العروض") { tab = .offers }
                            .padding(.top, 18).padding(.bottom, 8)
                        ProductGrid(products: index.featured, showCategory: true)
                    } else {
                        SectionHeader(title: "العروض", emoji: "🔥", actionTitle: "الكل") { tab = .offers }
                            .padding(.top, 18).padding(.bottom, 8)
                        ProductGrid(products: Array(index.offers.prefix(30)), showCategory: true)
                    }
                } else if catalog.failed {
                    LoadFailedView { Task { await catalog.refresh() } }
                        .padding(.top, 40)
                } else {
                    LoadingGrid().padding(.top, 18)
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Color.white)
        .refreshable { await catalog.refresh() }
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .bottomLeading) {
            if let order = orders.current {
                OrderBubble(order: order) { tab = .account }
                    .padding(.leading, 16).padding(.bottom, 14)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.7), value: orders.current?.no)
    }
}

/// دائرة الطلب الشغّال في الرئيسية: أيقونة الحالة والدقايق الباقية، تضغطها تروح لطلبك
private struct OrderBubble: View {
    let order: SavedOrder
    let action: () -> Void
    @Environment(OrderCenter.self) private var orders
    @State private var pulse = false
    @AppStorage("bubble.tipShown") private var tipShown = false
    @State private var showTip = false

    var body: some View {
        let eta = orders.drivers[order.no]?.eta
        HStack(spacing: 10) {
            Button(action: { tipShown = true; showTip = false; action() }) {
                ZStack {
                    Circle().strokeBorder(Theme.brand.opacity(0.35), lineWidth: 3)
                        .frame(width: 84, height: 84)
                        .scaleEffect(pulse ? 1.08 : 0.96)
                        .opacity(pulse ? 0.2 : 0.8)
                    Circle().fill(Theme.headerGradient)
                        .frame(width: 70, height: 70)
                        .overlay(Circle().strokeBorder(.white, lineWidth: 3))
                        .shadow(color: Theme.brandDeep.opacity(0.45), radius: 10, y: 5)
                    VStack(spacing: 0) {
                        Text(icon).font(.ui(size: eta == nil ? 28 : 22))
                        if let eta, order.status == "onway" {
                            Text(verbatim: "\(max(1, eta)) د").font(.kufi(13, .bold)).foregroundStyle(.white)
                        }
                    }
                    Circle().fill(Theme.copper).frame(width: 16, height: 16)
                        .overlay(Circle().strokeBorder(.white, lineWidth: 3))
                        .offset(x: 26, y: -26)
                }
                .frame(width: 86, height: 86)
                .contentShape(Circle())
            }
            .buttonStyle(PressableStyle(scale: 0.92))
            .accessibilityLabel("طلبك \(order.no): \(OrderStatus.title(order.status))")

            if showTip {
                Text(order.status == "onway" ? "طلبك في الطريق · اضغط تتابعه" : "تابع طلبك من هنا")
                    .font(.ui(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Theme.ink, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .transition(.opacity.combined(with: .move(edge: .leading)))
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { pulse = true }
            if !tipShown {
                withAnimation(.snappy.delay(0.4)) { showTip = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) { withAnimation(.snappy) { showTip = false }; tipShown = true }
            }
        }
    }

    private var icon: String {
        switch order.status {
        case "onway": return "🛵"
        case "accepted": return "🧺"
        default: return "🧾"
        }
    }
}

private struct HomeHeader: View {
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog

    /// شكل الرأس من «شكل التطبيق» في الإدارة: أخضر غامق (الافتراضي) أو فاتح
    private var lightHeader: Bool { AppLook.current.header == "light" }
    private var headerText: Color { lightHeader ? Theme.ink : .white }
    @ViewBuilder private var headerBackground: some View {
        if lightHeader { Theme.softGradient } else { Theme.headerGradient }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                HStack(spacing: 8) {
                    Image("Logo")
                        .resizable()
                        .frame(width: 42, height: 42)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
                    Text(catalog.store.name)
                        .font(.kufi(24, .bold, relativeTo: .title))
                        .foregroundStyle(lightHeader ? Theme.brandDeep : .white)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 6) {
                    Label(catalog.store.eta, systemImage: "bolt.fill")
                        .font(.kufi(12.5, .semibold, relativeTo: .caption))
                        .foregroundStyle(headerText)
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(lightHeader ? Theme.brand.opacity(0.1) : .white.opacity(0.16), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(lightHeader ? Theme.brand.opacity(0.25) : .white.opacity(0.3)))
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                        Text("التوصيل في \(catalog.store.area)")
                    }
                    .font(.ui(size: 14.5, weight: .medium))
                    .foregroundStyle(headerText.opacity(0.95))
                }
            }
            Button {
                path.append(Route.search)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").font(.ui(size: 18, weight: .semibold))
                    Text("وش ناقص بيتك اليوم؟").font(.ui(size: 16))
                    Spacer()
                }
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 16)
                .frame(height: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.15), radius: 8, y: 3)
            }
            .buttonStyle(PressableStyle(scale: 0.98))
            .accessibilityLabel("ابحث")
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 18)
        .background(alignment: .top) {
            // الأخضر يمتد لفوق خلف الساعة (بدون شريط أبيض)، وحتى لو سحب الزبون الصفحة لتحت
            headerBackground
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 28, bottomTrailingRadius: 28, style: .continuous))
                .padding(.top, -600)
        }
    }
}

/// بنر في الرئيسية: من العروض الحقيقية (أقوى خصم، عرض كمية، كل العروض) + بنرات المالك
private struct HomeBanner: Identifiable {
    /// نفس أسماء تصاميم الموقع (لوحة الإدارة): night ليلي، shelf رف، calm هادي، split نص ونص، glass ناعم
    enum Style { case hot, deep, light, night, calm, glass, custom(Color) }
    let id: String
    let kicker: String
    let title: String
    let subtitle: String
    let button: String
    let style: Style
    let images: [URL]
    let route: Route?
}

/// بنرات تتصفحها بالسحب (بدون تقليب تلقائي: احترام «تقليل الحركة» والقراءة على راحتك)
private struct BannerCarousel: View {
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @State private var current: String?

    var body: some View {
        let banners = makeBanners()
        VStack(spacing: 8) {
            ScrollView(.horizontal) {
                LazyHStack(spacing: 10) {
                    ForEach(banners) { banner in
                        Button { if let r = banner.route { path.append(r) } } label: { BannerCard(banner: banner) }
                            .buttonStyle(PressableStyle(scale: 0.98))
                            .containerRelativeFrame(.horizontal)
                            .id(banner.id)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollIndicators(.hidden)
            .scrollPosition(id: $current)
            .frame(height: 150)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

            if banners.count > 1 {
                HStack(spacing: 5) {
                    ForEach(banners) { b in
                        Capsule()
                            .fill((current ?? banners.first?.id) == b.id ? Theme.brandDeep : Theme.brand.opacity(0.25))
                            .frame(width: (current ?? banners.first?.id) == b.id ? 16 : 6, height: 6)
                    }
                }
                .animation(.snappy, value: current)
                .accessibilityHidden(true)
            }
        }
    }

    /// البنرات من إعدادات لوحة الإدارة (نفس الموقع): الترتيب والإخفاء والنصوص واللون والتصميم والصور.
    /// أي تعديل من الإدارة يطلع هنا أول ما ينفتح التطبيق، بدون تحديث للتطبيق.
    private func makeBanners() -> [HomeBanner] {
        guard let index = catalog.index else { return [] }
        let store = catalog.store
        let offers = index.offers.filter { catalog.isAvailable($0) }
        var built: [String: HomeBanner] = [:]

        func images(_ id: String, _ fallback: [Product], max n: Int = 3) -> [URL] {
            let limit = store.banEdit[id]?.picsN ?? n
            let picked = (store.banPicks[id] ?? []).compactMap { catalog.product($0) }
            let list = picked.isEmpty ? fallback : picked
            return Array(list.filter(\.hasPhoto).prefix(Swift.max(0, limit)).compactMap(\.imageURL))
        }
        func style(_ name: String?, color: String?, fallback: HomeBanner.Style) -> HomeBanner.Style {
            if let c = Color(hexString: color) { return .custom(c) }
            switch name {
            case "night": return .night
            case "shelf": return .light
            case "calm": return .calm
            case "glass": return .glass
            case "split": return .custom(Color(hex: 0x17407A))
            default: return fallback
            }
        }
        func make(_ id: String, kicker: String, title: String, subtitle: String, button: String, style def: HomeBanner.Style,
                  products: [Product], route: Route?) -> HomeBanner {
            let o = store.banEdit[id]
            return HomeBanner(id: id, kicker: o?.kicker ?? kicker, title: o?.title ?? title, subtitle: o?.sub ?? subtitle,
                              button: o?.noGo == true ? "" : (o?.go ?? button), style: style(o?.style, color: o?.color, fallback: def),
                              images: images(id, products), route: route)
        }

        // أقوى خصم
        if let top = offers.filter({ $0.discountPercent != nil }).max(by: { ($0.discountPercent ?? 0, $0.hasPhoto ? 1 : 0) < ($1.discountPercent ?? 0, $1.hasPhoto ? 1 : 0) }),
           let pct = top.discountPercent, let old = top.old {
            built["top"] = make("top", kicker: "أقوى خصم اليوم · خصم \(pct)٪", title: top.name,
                                subtitle: "كان \(Money.plain(old)) وصار \(Money.plain(top.price)) ر.س", button: "اطلبه الحين",
                                style: .calm, products: [top], route: .product(top.id))
        }
        // عرض كمية
        if let q = offers.first(where: { $0.quantityOffer != nil && $0.hasPhoto }) ?? offers.first(where: { $0.quantityOffer != nil }),
           let qo = q.quantityOffer {
            built["multi"] = make("multi", kicker: "عرض كمية", title: "\(Product.pieces(qo.count)) بـ \(Money.plain(qo.price)) ر.س",
                                  subtitle: "\(q.name)\nبدل \(Money.plain(qo.before)) · وفّر \(Money.plain(qo.before - qo.price))",
                                  button: "شوف العرض", style: .custom(Color(hex: 0x17407A)), products: [q], route: .product(q.id))
        }
        // كل العروض
        if offers.count > 1 {
            let maxPct = offers.compactMap(\.discountPercent).max() ?? 0
            built["offers"] = make("offers", kicker: "عروض الأسبوع", title: "خصومات على \(offers.count) منتج",
                                   subtitle: maxPct > 0 ? "خصم لين \(maxPct)٪" : "أسعار أقل على منتجات مختارة",
                                   button: "تسوّق العروض", style: .glass, products: offers, route: .offers)
        }
        // المخبز: بس لو القسم مفتوح (مو «قريباً»)
        if let bakery = catalog.category("bakery"), !bakery.soon {
            let items = catalog.products(in: "bakery").filter { catalog.isAvailable($0) }
            if !items.isEmpty {
                built["bakery"] = make("bakery", kicker: "من فرن \(store.name)", title: "الخبز طالع\nمن الفرن", subtitle: "",
                                       button: "اطلبه حار", style: .light, products: items, route: .category("bakery"))
            }
        }
        // بنرات المالك الخاصة
        for b in store.banners {
            var route: Route? = nil
            var catID: String? = nil
            if let t = b.target {
                if t.hasPrefix("cat:") {
                    let id = String(t.dropFirst(4))
                    if catalog.category(id)?.soon == true { continue }
                    route = .category(id); catID = id
                } else if t.hasPrefix("prod:") { route = .product(String(t.dropFirst(5))) }
                else if t == "offers" { route = .offers }
            }
            var products = b.ids.compactMap { catalog.product($0) }
            if products.isEmpty, let catID { products = catalog.products(in: catID).filter { $0.hasPhoto && catalog.isAvailable($0) } }
            if route == nil, products.count == 1 { route = .product(products[0].id) }
            let from = products.map(\.price).min()
            built[b.id] = HomeBanner(id: b.id, kicker: b.kicker ?? (catID.flatMap { catalog.category($0)?.name } ?? ""), title: b.title,
                                     subtitle: b.subtitle.isEmpty ? (from.map { "تبدأ من \(Money.plain($0)) ر.س" } ?? "") : b.subtitle,
                                     button: b.go ?? "تسوّق الحين", style: style(b.style, color: b.color, fallback: .light),
                                     images: Array(products.prefix(3).compactMap(\.imageURL)), route: route)
        }

        // الترتيب والإخفاء من «ترتيب الواجهة» في الإدارة؛ الجديد اللي ما له ترتيب ينضاف آخر شي
        let defaults = ["top", "multi", "daily", "offers", "deals", "bakery"] + store.banners.map(\.id)
        var order = store.promos.filter { defaults.contains($0.id) }
        for id in defaults where !order.contains(where: { $0.id == id }) { order.append(PromoSlot(id: id, on: true)) }
        return order.filter(\.on).compactMap { built[$0.id] }
    }
}

private struct BannerCard: View {
    let banner: HomeBanner

    var body: some View {
        ZStack {
            background
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    if !banner.kicker.isEmpty {
                        Text(banner.kicker)
                            .font(.ui(size: 11.5 * AppLook.current.bannerScale, weight: .bold))
                            .foregroundStyle(kickerColor)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(kickerBackground, in: Capsule())
                    }
                    Text(banner.title)
                        .font(.kufi(18 * AppLook.current.bannerScale, .bold, relativeTo: .title3))
                        .foregroundStyle(textColor)
                        .lineLimit(2)
                        .minimumScaleFactor(0.75)
                    if !banner.subtitle.isEmpty {
                        Text(banner.subtitle)
                            .font(.ui(size: 12 * AppLook.current.bannerScale, weight: .medium))
                            .foregroundStyle(textColor.opacity(0.9))
                            .lineLimit(2)
                    }
                    Spacer(minLength: 0)
                    if !banner.button.isEmpty {
                    Text(banner.button)
                        .font(.kufi(12 * AppLook.current.bannerScale, .bold))
                        .foregroundStyle(buttonText)
                        .padding(.horizontal, 13).padding(.vertical, 6)
                        .background(buttonBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .padding(.vertical, 14).padding(.leading, 16)
                Spacer(minLength: 0)
                pictures.padding(.trailing, 12)
            }
        }
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    @ViewBuilder private var background: some View {
        switch banner.style {
        case .hot: Theme.bannerGradient
        case .deep: Theme.headerGradient
        case .light:
            LinearGradient(colors: [Theme.mint, Color(hex: 0xF4FBF8)], startPoint: .topTrailing, endPoint: .bottomLeading)
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.brand.opacity(0.18)))
        case .night:
            LinearGradient(colors: [Color(hex: 0x1B1F3B), Color(hex: 0x0D1020)], startPoint: .topTrailing, endPoint: .bottomLeading)
        case .calm:
            Color(hex: 0xF4EFE6)
        case .glass:
            LinearGradient(colors: [Color(hex: 0xFCE4EF), Color(hex: 0xFFF6E0), Color(hex: 0xDDEEFF)], startPoint: .topTrailing, endPoint: .bottomLeading)
        case .custom(let c):
            LinearGradient(colors: [c, c.opacity(0.78)], startPoint: .topTrailing, endPoint: .bottomLeading)
        }
    }

    @ViewBuilder private var pictures: some View {
        if banner.images.count >= 2 {
            ZStack {
                ForEach(Array(banner.images.prefix(3).enumerated()), id: \.offset) { i, url in
                    RemoteImage(url: url, maxPixel: 260)
                        .padding(6)
                        .frame(width: 64, height: 64)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
                        .rotationEffect(.degrees(Double(i - 1) * 8))
                        .offset(x: CGFloat(i - 1) * 30, y: CGFloat(abs(i - 1)) * 8)
                }
            }
            .frame(width: 128, height: 120)
        } else if let url = banner.images.first {
            RemoteImage(url: url, maxPixel: 360)
                .padding(10)
                .frame(width: 112, height: 112)
                .background(.white, in: Circle())
                .shadow(color: .black.opacity(0.18), radius: 8, y: 4)
        }
    }

    private var isLight: Bool {
        switch banner.style {
        case .light, .calm, .glass: return true
        default: return false
        }
    }
    private var textColor: Color { isLight ? Theme.ink : .white }
    private var kickerColor: Color { isLight ? Theme.brandDeep : .white }
    private var kickerBackground: Color { isLight ? Theme.brand.opacity(0.12) : .white.opacity(0.2) }
    private var buttonText: Color {
        switch banner.style {
        case .hot: return Theme.copperInk
        case .deep: return Theme.brandDeep
        case .night: return Color(hex: 0x1B1F3B)
        case .light, .calm, .glass: return .white
        case .custom(let c): return c
        }
    }
    private var buttonBackground: Color {
        switch banner.style {
        case .calm, .glass: return Theme.ink
        case .light: return Theme.brand
        default: return .white
        }
    }
}

private struct QuickChips: View {
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                Button { tab = .offers } label: { Chip(title: "🔥 العروض") }
                    .buttonStyle(PressableStyle())
                ForEach(catalog.categories.filter { !$0.soon }) { c in
                    Button { path.append(Route.category(c.id)) } label: { Chip(title: "\(c.emoji) \(c.name)") }
                        .buttonStyle(PressableStyle())
                }
            }
            .padding(.horizontal, 16)
        }
        .scrollIndicators(.hidden)
    }
}

struct ClosedNotice: View {
    let message: String
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "moon.zzz.fill").foregroundStyle(Theme.copperInk)
            VStack(alignment: .leading, spacing: 2) {
                Text("المتجر مقفل الحين").font(.kufi(13, .bold))
                Text(message.isEmpty ? "تقدر تتصفح وتجهّز سلتك، ونستقبل الطلبات وقت الفتح." : message)
                    .font(.ui(size: 13)).foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct LoadingGrid: View {
    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 16) {
            ForEach(0..<9, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 6) {
                    RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.surface).aspectRatio(1, contentMode: .fit)
                    RoundedRectangle(cornerRadius: 4).fill(Theme.surface).frame(height: 10)
                    RoundedRectangle(cornerRadius: 4).fill(Theme.surface).frame(width: 50, height: 10)
                }
            }
        }
        .padding(.horizontal, 12)
        .accessibilityLabel("جاري التحميل")
    }
}

struct LoadFailedView: View {
    let retry: () -> Void
    var body: some View {
        ContentUnavailableView {
            Label("ما قدرنا نحمّل المنتجات", systemImage: "wifi.exclamationmark")
        } description: {
            Text("تأكد من الإنترنت وجرّب مرة ثانية.")
        } actions: {
            Button("جرّب مرة ثانية", action: retry).buttonStyle(.borderedProminent)
        }
    }
}
