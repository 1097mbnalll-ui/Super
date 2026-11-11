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
                QuickChips(tab: $tab, path: $path)
                    .padding(.top, 14)
                if let index = catalog.index {
                    SectionHeader(title: "مختارات لك", emoji: "✨", actionTitle: "كل العروض") { tab = .offers }
                        .padding(.top, 18).padding(.bottom, 8)
                    ProductGrid(products: index.featured, showCategory: true)
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
                        Text(icon).font(.system(size: eta == nil ? 28 : 22))
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
                    .font(.system(size: 13, weight: .semibold))
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
                        .foregroundStyle(.white)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 6) {
                    Label("توصيل خلال \(catalog.store.eta)", systemImage: "bolt.fill")
                        .font(.kufi(12.5, .semibold, relativeTo: .caption))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(.white.opacity(0.3)))
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                        Text("التوصيل في \(catalog.store.area)")
                    }
                    .font(.system(size: 14.5, weight: .medium))
                    .foregroundStyle(.white.opacity(0.95))
                }
            }
            Button {
                path.append(Route.search)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").font(.system(size: 18, weight: .semibold))
                    Text("وش ناقص بيتك اليوم؟").font(.system(size: 16))
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
            Theme.headerGradient
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 28, bottomTrailingRadius: 28, style: .continuous))
                .ignoresSafeArea(edges: .top)
        }
    }
}

/// بنر في الرئيسية: من العروض الحقيقية (أقوى خصم، عرض كمية، كل العروض) + بنرات المالك
private struct HomeBanner: Identifiable {
    enum Style { case hot, deep, light, custom(Color) }
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

    private func makeBanners() -> [HomeBanner] {
        guard let index = catalog.index else { return [] }
        let offers = index.offers.filter { catalog.isAvailable($0) }
        var out: [HomeBanner] = []
        // ١) أقوى خصم
        if let top = offers.filter({ $0.discountPercent != nil }).max(by: { ($0.discountPercent ?? 0, $0.hasPhoto ? 1 : 0) < ($1.discountPercent ?? 0, $1.hasPhoto ? 1 : 0) }),
           let pct = top.discountPercent, let old = top.old {
            out.append(HomeBanner(id: "top", kicker: "أقوى خصم اليوم", title: "خصم \(pct)٪", subtitle: "\(top.name)\nكان \(Money.plain(old)) وصار \(Money.plain(top.price)) ر.س",
                                  button: "اطلبه الحين", style: .hot, images: top.imageURL.map { [$0] } ?? [], route: .product(top.id)))
        }
        // ٢) عرض كمية
        if let q = offers.first(where: { $0.quantityOffer != nil && $0.hasPhoto }) ?? offers.first(where: { $0.quantityOffer != nil }),
           let qo = q.quantityOffer {
            out.append(HomeBanner(id: "multi", kicker: "عرض \(Product.pieces(qo.count))", title: "\(Product.pieces(qo.count)) بـ \(Money.plain(qo.price)) ر.س",
                                  subtitle: "\(q.name)\nبدل \(Money.plain(qo.before)) · وفّر \(Money.plain(qo.before - qo.price))",
                                  button: "شوف العرض", style: .deep, images: q.imageURL.map { [$0] } ?? [], route: .product(q.id)))
        }
        // ٣) كل العروض
        if offers.count > 1 {
            let pics = offers.filter(\.hasPhoto).prefix(3).compactMap(\.imageURL)
            let maxPct = offers.compactMap(\.discountPercent).max() ?? 0
            out.append(HomeBanner(id: "all", kicker: "عروض الأسبوع", title: "\(offers.count) عرض في المحل",
                                  subtitle: maxPct > 0 ? "خصومات توصل \(maxPct)٪ وعروض كميات" : "أسعار أقل على منتجات مختارة",
                                  button: "كل العروض", style: .light, images: Array(pics), route: .offers))
        }
        // ٤) بنرات المالك (بلونها)
        for b in catalog.store.banners {
            var route: Route? = nil
            if let t = b.target {
                if t.hasPrefix("cat:") {
                    let id = String(t.dropFirst(4))
                    if catalog.category(id)?.soon == true { continue }
                    route = .category(id)
                } else if t.hasPrefix("prod:") { route = .product(String(t.dropFirst(5))) }
                else if t == "offers" { route = .offers }
            }
            let tint = Color(hexString: b.color) ?? Theme.brand
            let cat = b.target.flatMap { $0.hasPrefix("cat:") ? catalog.category(String($0.dropFirst(4))) : nil }
            let pics = cat.map { catalog.products(in: $0.id).filter { $0.hasPhoto && catalog.isAvailable($0) }.prefix(2).compactMap(\.imageURL) } ?? []
            out.append(HomeBanner(id: b.id, kicker: cat?.name ?? "", title: b.title, subtitle: b.subtitle, button: "تسوّق الحين",
                                  style: .custom(tint), images: Array(pics), route: route))
        }
        return out
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
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(kickerColor)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(kickerBackground, in: Capsule())
                    }
                    Text(banner.title)
                        .font(.kufi(18, .bold, relativeTo: .title3))
                        .foregroundStyle(textColor)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    if !banner.subtitle.isEmpty {
                        Text(banner.subtitle)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(textColor.opacity(0.9))
                            .lineLimit(2)
                    }
                    Spacer(minLength: 0)
                    Text(banner.button)
                        .font(.kufi(12, .bold))
                        .foregroundStyle(buttonText)
                        .padding(.horizontal, 13).padding(.vertical, 6)
                        .background(buttonBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
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

    private var isLight: Bool { if case .light = banner.style { return true }; return false }
    private var textColor: Color { isLight ? Theme.ink : .white }
    private var kickerColor: Color { isLight ? Theme.brandDeep : .white }
    private var kickerBackground: Color { isLight ? Theme.brand.opacity(0.12) : .white.opacity(0.2) }
    private var buttonText: Color {
        switch banner.style {
        case .hot: return Theme.copperInk
        case .deep: return Theme.brandDeep
        case .light: return .white
        case .custom(let c): return c
        }
    }
    private var buttonBackground: Color { isLight ? Theme.brand : .white }
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
                    .font(.system(size: 13)).foregroundStyle(Theme.muted)
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
