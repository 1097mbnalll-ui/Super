import SwiftUI

/// الرئيسية (design/mix-01-home.webp). من ١٥ نوفمبر ٢٠٢٦ (قرار المالك، خط أحمر): كلها شاشات أصلية بدون أي شي من الموقع.
/// أولها «سما الرياض» (SkyHome) من أعلى الشاشة ورا الساعة: الرأس والبحث ورسالة الإقفال وديمة والبنرات
struct HomeView: View {
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    /// وقت السما (يتحدث كل دقيقة)
    @State private var sky = SkyKey.at(.now)

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                SkyHome(key: sky, showFeatured: sections.contains("featured"), showPromos: sections.contains("promos"),
                        tab: $tab, path: $path)
                // ترتيب أقسام الرئيسية من الإدارة (store.layout) مثل الموقع. الأقسام اللي ما لها شاشة أصلية (الرئيسية الذكية) ما تنعرض
                ForEach(sections.filter { Self.native.contains($0) }, id: \.self) { id in section(id) }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Theme.pageBG)
        .refreshable { await catalog.refresh() }
        .toolbar(.hidden, for: .navigationBar)
        .overlay {
            // المغرب والليل: شريط ضبابي فاتح ورا الساعة بس، عشان الساعة والبطارية (سود) تنقرا فوق السما الغامقة
            if sky.isDark {
                Rectangle().fill(.ultraThinMaterial)
                    .environment(\.colorScheme, .light)
                    .opacity(0.85)
                    .frame(height: SkyInsets.top)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .ignoresSafeArea(edges: .top)
                    .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .bottomLeading) {
            if let order = orders.current {
                OrderBubble(order: order) { tab = .account }
                    .padding(.leading, 16).padding(.bottom, 14)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            } else if let due = orders.rateDue {
                // طلب وصل وما انقيّم: تذكير خفيف (rateDue في الموقع)، يفتح «حسابي» أو ينقفل بـ×
                RateReminder(order: due, open: { tab = .account }, close: { orders.skipRating(due) })
                    .padding(.horizontal, 16).padding(.bottom, 14)
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.7), value: orders.current?.no)
        .animation(.spring(response: 0.45, dampingFraction: 0.7), value: orders.rateDue?.no)
        .task {
            while !Task.isCancelled {
                let k = SkyKey.at(.now)
                if k != sky { withAnimation(.easeInOut(duration: 0.6)) { sky = k } }
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }

    /// لون أعلى سما الرياض حسب الوقت
    static func skyTop(_ d: Date) -> Color { SkyKey.at(d).colors.0 }

    private var sections: [String] {
        let lay = catalog.store.layout
        if lay.isEmpty { return ["featured", "promos", "catoffers", "free", "catgrid", "grid"] }   // العروض و٠٫٩٥ مخفية افتراضياً
        var out = lay.filter { $0.on }.map(\.id)
        // اللي مو بالترتيب (جديد) ينضاف بعد، ما عدا العروض و٠٫٩٥
        for id in ["promos", "free", "catgrid", "grid"] where !lay.contains(where: { $0.id == id }) { out.append(id) }
        if !lay.contains(where: { $0.id == "featured" }) { out.insert("featured", at: 0) }
        // «عروض الأقسام»: لو ما هي في ترتيب المالك تنحط بعد البنرات (مثل الموقع)
        if !lay.contains(where: { $0.id == "catoffers" }), let i = out.firstIndex(of: "promos") { out.insert("catoffers", at: i + 1) }
        return out
    }

    /// أقسام الرئيسية اللي لها شاشة أصلية تحت السما (featured وpromos داخل السما نفسها)
    static let native: Set<String> = ["catoffers", "free", "catgrid", "offers", "deals", "grid"]

    @ViewBuilder private func section(_ id: String) -> some View {
        switch id {
        case "catoffers":
            CatOffersGrid(path: $path, tab: $tab)
        case "free":
            if catalog.store.freeOver > 0 {
                // كرت التوصيل المجاني (SEC.free في الموقع)
                HStack(spacing: 12) {
                    Image(systemName: "truck.box.fill").font(.system(size: 18)).foregroundStyle(Theme.brandDeep)
                        .frame(width: 40, height: 40).background(Theme.mint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("احصل على توصيلك المجاني!").font(.kufi(14, .bold))
                        Text("لطلباتك فوق \(Money.sar(catalog.store.freeOver))").font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                    }
                    Spacer(minLength: 0)
                }
                .padding(12)
                .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
                .padding(.horizontal, 16).padding(.top, 12)
            }
        case "catgrid":
            if AppLook.current.showChips {
                QuickChips(tab: $tab, path: $path)
                    .padding(.top, 14)
            }
        case "offers":
            if let index = catalog.index, !index.offers.isEmpty {
                SectionHeader(title: "أفضل العروض", emoji: "🔥", actionTitle: "عرض الكل") { tab = .offers }
                    .padding(.top, 18).padding(.bottom, 8)
                ScrollView(.horizontal) {
                    LazyHStack(alignment: .top, spacing: 8) {
                        ForEach(Array(index.offers.filter { catalog.isAvailable($0) }.prefix(20))) { p in
                            ProductCard(product: p).frame(width: 118)
                        }
                    }
                    .padding(.horizontal, 12)
                }
                .scrollIndicators(.hidden)
            }
        case "deals":
            let deals = catalog.dealProducts
            if !deals.isEmpty {
                SectionHeader(title: "كل منتج بـ \(Money.plain(catalog.store.deal95.price)) \(Money.sym)", emoji: "🔒", actionTitle: "عرض الكل") { path.append(Route.deals) }
                    .padding(.top, 18).padding(.bottom, 8)
                ScrollView(.horizontal) {
                    LazyHStack(alignment: .top, spacing: 8) {
                        ForEach(Array(deals.prefix(20))) { p in
                            ProductCard(product: p, kind: .deal).frame(width: 118)
                        }
                    }
                    .padding(.horizontal, 12)
                }
                .scrollIndicators(.hidden)
            }
        default:
            if let index = catalog.index {
                if AppLook.current.showFeatured {
                    SectionHeader(title: "مختارات لك", emoji: "✨", actionTitle: "كل العروض") { tab = .offers }
                        .padding(.top, 18).padding(.bottom, 8)
                    ProductGrid(products: forYou(index), showCategory: true)
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
    }

    /// «مختارات لك»: اختيارات المالك (store.forYou) أول، وforOnly = بس هي (مثل الموقع)
    private func forYou(_ index: CatalogIndex) -> [Product] {
        let picks = catalog.store.forYou.compactMap { catalog.product($0) }.filter { catalog.isAvailable($0) }
        if catalog.store.forOnly, !picks.isEmpty { return picks }
        let ids = Set(picks.map(\.id))
        return picks + index.featured.filter { !ids.contains($0.id) }
    }
}

/// دائرة الطلب الشغّال في الرئيسية: أيقونة الحالة والدقايق الباقية، تضغطها تروح لطلبك
/// «وصلك طلبك؟ قيّم تجربتك» فوق الرئيسية بعد التوصيل
private struct RateReminder: View {
    let order: SavedOrder
    let open: () -> Void
    let close: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button(action: open) {
                HStack(spacing: 10) {
                    Image(systemName: "star.fill").font(.ui(size: 18, weight: .bold)).foregroundStyle(Color(hex: 0xF5A524))
                        .frame(width: 38, height: 38).background(.white.opacity(0.14), in: Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text(tv: "وصلك طلبك \(order.no)؟ قيّم تجربتك").font(.ui(size: 14, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                        Text("ثواني وتساعدنا نصير أحسن").font(.ui(size: 12)).foregroundStyle(.white.opacity(0.75))
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            Button(action: close) {
                Image(systemName: "xmark").font(.ui(size: 12, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 30, height: 30).background(.white.opacity(0.14), in: Circle())
            }
            .accessibilityLabel("إخفاء")
        }
        .padding(.leading, 10).padding(.trailing, 8).padding(.vertical, 8)
        .background(Theme.ink, in: Capsule())
        .shadow(color: .black.opacity(0.2), radius: 10, y: 4)
    }
}

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
                        Text(tv: icon).font(.ui(size: eta == nil ? 28 : 22))
                        if let eta, order.status == "onway" {
                            Text(tv: "\(max(1, eta)) د").font(.kufi(13, .bold)).foregroundStyle(.white)
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
            .accessibilityLabel("طلبك \(order.no): \(OrderStatus.title(order))")

            let hasSub = !(orders.subs[order.no] ?? []).isEmpty
            if showTip || hasSub {
                Text(tv: hasSub ? "فيه بديل ينتظر موافقتك" : order.status == "onway" ? "طلبك في الطريق · اضغط تتابعه" : "تابع طلبك من هنا")
                    .font(.ui(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(hasSub ? Theme.copperInk : Theme.ink, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
    /// من الإدارة: لون ثاني للتدرج، نص غامق، وصورة كاملة للبنر (وهل يطلع النص فوقها)
    var color2: Color? = nil
    var darkText = false
    var picture: URL? = nil
    var showText = true
    /// بدل route: يفتح تبويب (السلة لبنر التوصيل المجاني والهدية)، أو بنر عرض المجموعة (ديمة) بتصميمه
    var tab: AppTab? = nil
    var group: ProductGroup? = nil
}

/// البنرات المتحركة (kqBanners في الموقع) بشاشة أصلية: بنر واحد بعرض الشاشة كل مرة، تسحب تتنقل صفحة صفحة (ما يوقف بين بنرين أبداً)،
/// وتتقلب لحالها كل ٥ ثواني، ولو لمسها الزبون تنتظر ٦ ثواني. النقاط تحت. الضغط يفتح نفس وجهة بنر الموقع
struct BannerCarousel: View {
    @Binding var path: NavigationPath
    var tab: Binding<AppTab>? = nil
    /// عرض المجموعة (ديمة) أول البنرات لو قسمه مطفي في ترتيب الرئيسية
    var featured: ProductGroup? = nil
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var current: String?
    /// آخر بنر قلّبه المؤقت (عشان نفرّق بين تقليب المؤقت وسحب الزبون)
    @State private var autoTarget: String?
    @State private var touched = Date.distantPast
    @State private var moved = Date()

    static let height: CGFloat = 176

    var body: some View {
        let banners = catalog.store.isOff("banners") ? [] : makeBanners()
        let shown = current ?? banners.first?.id
        if !banners.isEmpty {
            VStack(spacing: 8) {
                ScrollView(.horizontal) {
                    HStack(spacing: 0) {
                        ForEach(banners) { banner in
                            page(banner)
                                .padding(.horizontal, 16)
                                .containerRelativeFrame(.horizontal)
                                .id(banner.id)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollIndicators(.hidden)
                .scrollPosition(id: $current)
                .frame(height: Self.height)
                .onChange(of: current) { _, new in
                    // تغيّر بدون المؤقت = الزبون سحب: التقليب يوقف ٦ ثواني
                    if new != autoTarget { touched = Date() }
                    autoTarget = nil
                    moved = Date()
                }
                .task(id: banners.map(\.id)) {
                    guard banners.count > 1, !reduceMotion else { return }
                    moved = Date()
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .seconds(1))
                        guard !Task.isCancelled else { return }
                        let now = Date()
                        guard now.timeIntervalSince(moved) >= 5, now.timeIntervalSince(touched) >= 6 else { continue }
                        let i = banners.firstIndex { $0.id == (current ?? banners.first?.id) } ?? 0
                        let next = banners[(i + 1) % banners.count].id
                        autoTarget = next
                        moved = now
                        withAnimation(.smooth(duration: 0.45)) { current = next }
                    }
                }

                if banners.count > 1 {
                    HStack(spacing: 5) {
                        ForEach(banners) { b in
                            Capsule()
                                .fill(shown == b.id ? Theme.ink : Color(hex: 0xD5DBE1))
                                .frame(width: shown == b.id ? 18 : 6, height: 6)
                        }
                    }
                    .animation(.snappy, value: shown)
                    .accessibilityHidden(true)
                }
            }
            .padding(.top, 4)
        }
    }

    @ViewBuilder private func page(_ banner: HomeBanner) -> some View {
        if let g = banner.group, banner.picture == nil {
            DeemahBanner(group: g) { open(banner) }
        } else {
            Button { open(banner) } label: { BannerCard(banner: banner) }
                .buttonStyle(PressableStyle(scale: 0.98))
        }
    }

    private func open(_ banner: HomeBanner) {
        if let g = banner.group { path.append(Route.live("g:" + g.id)) }
        else if let t = banner.tab { tab?.wrappedValue = t }
        else if let r = banner.route { path.append(r) }
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
                                subtitle: "كان \(Money.plain(old)) وصار \(Money.plain(top.price)) \(Money.sym)", button: "اطلبه الحين",
                                style: .calm, products: [top], route: .product(top.id))
        }
        // عرض كمية
        if let q = offers.first(where: { $0.quantityOffer != nil && $0.hasPhoto }) ?? offers.first(where: { $0.quantityOffer != nil }),
           let qo = q.quantityOffer {
            built["multi"] = make("multi", kicker: "عرض كمية", title: "\(Product.pieces(qo.count)) بـ \(Money.plain(qo.price)) \(Money.sym)",
                                  subtitle: "\(q.name)\nبدل \(Money.plain(qo.before)) · وفّر \(Money.plain(qo.before - qo.price))",
                                  button: "شوف العرض", style: .custom(Color(hex: 0x17407A)), products: [q], route: .product(q.id))
        }
        // عرض اليوم (store.daily): منتج واحد لين نص الليل
        if let dd = catalog.dailyDeal {
            built["daily"] = make("daily", kicker: "🔥 عرض اليوم · ينتهي نص الليل", title: dd.product.name,
                                  subtitle: "\(Money.plain(dd.price)) \(Money.sym) بدل \(Money.plain(dd.product.price))", button: "اطلبه الحين",
                                  style: .calm, products: [dd.product], route: .daily)
        }
        // كل منتج بـ ٠٫٩٥ (store.deal95)
        let deals = catalog.dealProducts
        if !deals.isEmpty {
            let d = store.deal95
            built["deals"] = make("deals", kicker: "🔒 عروض مقفولة", title: "كل منتج بـ \(Money.plain(d.price)) \(Money.sym)",
                                  subtitle: "تنفتح لطلبك فوق \(Money.plain(d.min)) \(Money.sym)", button: "شوف المنتجات",
                                  style: .night, products: deals, route: .deals)
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
        // التوصيل المجاني بشريط السلة (free في الموقع): يفتح السلة
        if store.freeOver > 0 {
            let have = cart.totals(catalog).subtotal, left = Swift.max(0, store.freeOver - have)
            built["free"] = make("free", kicker: "🛵 توصيل مجاني", title: left > 0 ? "باقي \(Money.short(left))\nوتوصيلك مجاني" : "توصيلك صار مجاني 🎉",
                                 subtitle: "لطلباتك فوق \(Money.short(store.freeOver))", button: left > 0 ? "كمّل سلتك" : "شوف سلتك",
                                 style: .deep, products: [], route: nil)
            built["free"]?.tab = .cart
        }
        // القسم اللي فيه أكثر عروض (catdeal): يفتح عروض القسم بس
        var perCat: [String: (n: Int, pct: Int, pics: [Product])] = [:]
        for p in offers {
            var c = perCat[p.cat] ?? (n: 0, pct: 0, pics: [])
            c.n += 1; c.pct = Swift.max(c.pct, CatOffersGrid.pct(p)); if p.hasPhoto { c.pics.append(p) }
            perCat[p.cat] = c
        }
        if let best = perCat.filter({ $0.value.pics.count >= 2 && catalog.category($0.key) != nil }).max(by: { $0.value.n < $1.value.n }),
           let cat = catalog.category(best.key) {
            built["catdeal"] = make("catdeal", kicker: "🏷️ عروض القسم", title: "عروض \(cat.name)",
                                    subtitle: best.value.pct > 0 ? "خصم لين \(best.value.pct)٪ · \(best.value.n) منتج" : "\(best.value.n) منتج عليها عرض",
                                    button: "شوف العروض", style: .glass, products: best.value.pics, route: .live("o:" + cat.id))
        }
        // السهرة (night): من ٧ المساء لين ٢ بالليل، شبس ومشروب
        let hr = Calendar.current.component(.hour, from: Date())
        if hr >= 19 || hr < 2 {
            let all = index.catalog.products
            if let ch = all.first(where: { $0.sub == "chips" && $0.hasPhoto && catalog.isAvailable($0) }) {
                let so = all.first(where: { $0.sub == "soft" && $0.hasPhoto && catalog.isAvailable($0) })
                built["night"] = make("night", kicker: "🌙 السهرة", title: "طلعات السهرة\nلين بابك", subtitle: "شبس ومشروبات باردة",
                                      button: "تسوّق الحين", style: .night, products: [ch] + (so.map { [$0] } ?? []), route: .category(ch.cat))
            }
        }
        // قسم «قريباً» فيه ٣ صور وفوق (veg: الخضار والفواكه)
        if let vc = catalog.categories.first(where: { $0.soon && $0.id != "print" && catalog.products(in: $0.id).filter(\.hasPhoto).count >= 3 }) {
            built["veg"] = make("veg", kicker: "قريباً", title: vc.name, subtitle: "قريباً في \(store.name) إن شاء الله",
                                button: "شوف القسم", style: .light, products: catalog.products(in: vc.id).filter(\.hasPhoto), route: .category(vc.id))
        }
        // هدية أول طلب (store.welcome): يفتح السلة
        if let wg = store.welcome {
            built["welcome"] = make("welcome", kicker: "🎁 هديتك", title: wg.amount > 0 ? "خصم \(Money.short(wg.amount))\nعلى أول طلب" : "هدية أول طلب",
                                    subtitle: "الكود \(wg.code)" + (wg.min > 0 ? " · لطلبك فوق \(Money.short(wg.min))" : ""),
                                    button: "اطلب الحين", style: .hot, products: [], route: nil)
            built["welcome"]?.tab = .cart
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
                else if t == "deals" { route = .deals }
            }
            var products = b.ids.compactMap { catalog.product($0) }
            if products.isEmpty, let catID { products = catalog.products(in: catID).filter { $0.hasPhoto && catalog.isAvailable($0) } }
            // الباقة: صفحتها فيها «أضف الباقة»
            let bundle = catalog.bundle(b)
            if b.style == "bundle", bundle == nil { continue }
            if bundle != nil { route = .banner(b.id) }
            if route == nil, products.count == 1 { route = .product(products[0].id) }
            if route == nil, products.count > 1 { route = .banner(b.id) }
            let from = products.map(\.price).min()
            built[b.id] = HomeBanner(id: b.id, kicker: b.kicker ?? (catID.flatMap { catalog.category($0)?.name } ?? ""), title: b.title,
                                     subtitle: b.subtitle.isEmpty ? (bundle.map { "الباقة بـ \(Money.plain($0.price)) بدل \(Money.plain($0.sum)) \(Money.sym)" } ?? from.map { "تبدأ من \(Money.plain($0)) \(Money.sym)" } ?? "") : b.subtitle,
                                     button: b.noGo ? "" : (b.go ?? (bundle != nil ? "أضف الباقة" : "تسوّق الحين")), style: style(b.style, color: b.color, fallback: .light),
                                     images: Array(products.prefix(3).compactMap(\.imageURL)), route: route,
                                     color2: Color(hexString: b.color2), darkText: b.dark,
                                     picture: b.picture.flatMap { AppConfig.asset($0) ?? URL(string: $0) },
                                     showText: b.showText)
        }

        // الترتيب والإخفاء من «ترتيب الواجهة» في الإدارة؛ الجديد اللي ما له ترتيب ينضاف آخر شي
        let defaults = ["top", "multi", "daily", "offers", "deals", "bakery", "free", "catdeal", "night", "veg", "welcome"] + store.banners.map(\.id)
        var order = store.promos.filter { defaults.contains($0.id) }
        for id in defaults where !order.contains(where: { $0.id == id }) { order.append(PromoSlot(id: id, on: true)) }
        var list = order.filter(\.on).compactMap { built[$0.id] }
        if let g = featured, !store.isOff("featured") {
            list.insert(HomeBanner(id: "featured", kicker: "", title: g.name, subtitle: "", button: "", style: .deep, images: [], route: nil, group: g), at: 0)
        }
        // نفس تصميم بنرات الموقع (المالك ١٦ نوفمبر ٢٠٢٦: «طابقها اللي بالموقع»): صورة البنر من الموقع بدل الرسم، والضغط يفتح نفس الوجهة
        for i in list.indices where !store.isOff("banImg") {
            if let u = store.banImg[list[i].id], let url = AppConfig.asset(u) { list[i].picture = url; list[i].showText = false }
        }
        return list
    }
}

private struct BannerCard: View {
    let banner: HomeBanner

    var body: some View {
        ZStack {
            background
            if let pic = banner.picture {
                RemoteImage(url: pic, maxPixel: 1200, contentMode: .fill, blendWhite: false)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
            }
            if banner.picture == nil || banner.showText {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    if !banner.kicker.isEmpty {
                        Text(tv: banner.kicker)
                            .font(.ui(size: 11.5 * AppLook.current.bannerScale, weight: .bold))
                            .foregroundStyle(kickerColor)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(kickerBackground, in: Capsule())
                    }
                    Text(tv: banner.title)
                        .font(.kufi(18 * AppLook.current.bannerScale, .bold, relativeTo: .title3))
                        .foregroundStyle(textColor)
                        .lineLimit(2)
                        .minimumScaleFactor(0.75)
                    if !banner.subtitle.isEmpty {
                        Text(tv: banner.subtitle)
                            .font(.ui(size: 12 * AppLook.current.bannerScale, weight: .medium))
                            .foregroundStyle(textColor.opacity(0.9))
                            .lineLimit(2)
                    }
                    Spacer(minLength: 0)
                    if !banner.button.isEmpty {
                    Text(tv: banner.button)
                        .font(.kufi(12 * AppLook.current.bannerScale, .bold))
                        .foregroundStyle(buttonText)
                        .padding(.horizontal, 13).padding(.vertical, 6)
                        .background(buttonBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .padding(.vertical, 14).padding(.leading, 16)
                Spacer(minLength: 0)
                if banner.picture == nil { pictures.padding(.trailing, 12) }
            }
            }
        }
        .frame(height: BannerCarousel.height)
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
            LinearGradient(colors: [c, banner.color2 ?? c.opacity(0.78)], startPoint: .topTrailing, endPoint: .bottomLeading)
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
        if banner.darkText { return true }
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
                if catalog.dailyDeal != nil {
                    Button { path.append(Route.daily) } label: { Chip(title: "⏰ عرض اليوم") }
                        .buttonStyle(PressableStyle())
                }
                if !catalog.dealProducts.isEmpty {
                    Button { path.append(Route.deals) } label: { Chip(title: "🔒 بـ \(Money.plain(catalog.store.deal95.price)) \(Money.sym)") }
                        .buttonStyle(PressableStyle())
                }
                ForEach(catalog.store.banners.filter { catalog.bundle($0) != nil }) { b in
                    Button { path.append(Route.banner(b.id)) } label: { Chip(title: "🎁 \(b.title.replacingOccurrences(of: "\n", with: " "))") }
                        .buttonStyle(PressableStyle())
                }
                // قسم «قريباً» فيه منتجات (مثل أصناف مخبز جديدة): يطلع في الأزرار بشارته، بدون تحديث
                ForEach(catalog.categories.filter { !$0.soon || !catalog.products(in: $0.id).isEmpty }) { c in
                    Button { path.append(Route.category(c.id)) } label: { Chip(title: "\(c.emoji) \(c.name)") }
                        .buttonStyle(PressableStyle())
                }
            }
            .padding(.horizontal, 16)
        }
        .scrollIndicators(.hidden)
    }
}

/// رسالة «المحل مقفل» مثل بطاقة الموقع (closedBarHTML، ١٥ نوفمبر ٢٠٢٦): «نفتح بعد ساعتين و١١ دقيقة» بعدّاد يتحدث كل ٣٠ ثانية،
/// و«الساعة ١٢ الظهر · جهّز سلتك الحين واطلبها أول ما نفتح». المقفل اليدوي: «المحل مقفل مؤقتاً» + رسالة المالك
struct ClosedNotice: View {
    /// زجاجي فوق سما المغرب والليل (closedbar.v2 داخل .kqsky.ktop.s-night في الموقع)
    var glass = false
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        let title = glass ? Color.white : Color(hex: 0x1C1917)
        let em = glass ? Color(hex: 0xFDE68A) : Color(hex: 0xC2410C)
        let sub = glass ? Color(hex: 0xE9D5FF) : Color(hex: 0x57534E)
        TimelineView(.periodic(from: .now, by: 30)) { ctx in
            let store = catalog.store, t = store.openInMinutes(now: ctx.date)
            HStack(spacing: 12) {
                Image(systemName: "moon.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xFDE68A))
                    .frame(width: 42, height: 42)
                    .background {
                        if glass {
                            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xFDE68A).opacity(0.16))
                        } else {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(LinearGradient(colors: [Color(hex: 0x1E1B4B), Color(hex: 0x4C1D95)], startPoint: .top, endPoint: .bottom))
                        }
                    }
                VStack(alignment: .leading, spacing: 2) {
                    if t < 0 {
                        Text("المحل مقفل مؤقتاً").font(.kufi(15, .bold)).foregroundStyle(title)
                        Text(tv: store.closedMessage.isEmpty ? "تقدر تتصفح المنتجات، والطلب يرجع يشتغل لما نفتح." : store.closedMessage)
                            .font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(sub)
                    } else {
                        (Text(verbatim: "نفتح بعد ").foregroundStyle(title)
                         + Text(verbatim: StoreInfo.durationText(t)).foregroundStyle(em))
                            .font(.kufi(15, .bold))
                            .contentTransition(.numericText())
                        Text(verbatim: "الساعة \(StoreInfo.timeText(store.openAt ?? "")) · جهّز سلتك الحين واطلبها أول ما نفتح")
                            .font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(sub)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background {
                if glass {
                    RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.ultraThinMaterial)
                        .environment(\.colorScheme, .dark)
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.08)))
                } else {
                    RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.94))
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(glass ? 0.28 : 0.7)))
            .shadow(color: Color(hex: 0x0F0B2E).opacity(glass ? 0 : 0.12), radius: 11, y: 8)
            .accessibilityElement(children: .combine)
        }
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
