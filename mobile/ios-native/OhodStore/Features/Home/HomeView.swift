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

/// بنرات تتصفحها بالسحب (بدون تقليب تلقائي: احترام «تقليل الحركة» والقراءة على راحتك)
private struct BannerCarousel: View {
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @State private var current: String?

    var body: some View {
        let banners = catalog.store.banners.filter { b in
            guard let t = b.target, t.hasPrefix("cat:") else { return true }
            return catalog.category(String(t.dropFirst(4)))?.soon != true
        }
        VStack(spacing: 8) {
            ScrollView(.horizontal) {
                LazyHStack(spacing: 10) {
                    ForEach(banners) { banner in
                        Button { open(banner) } label: { BannerCard(banner: banner) }
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
            .frame(height: 160)
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

    private func open(_ banner: Banner) {
        guard let target = banner.target else { return }
        if target.hasPrefix("cat:") { path.append(Route.category(String(target.dropFirst(4)))) }
        else if target.hasPrefix("prod:") { path.append(Route.product(String(target.dropFirst(5)))) }
        else if target == "offers" { path.append(Route.offers) }
    }
}

private struct BannerCard: View {
    let banner: Banner
    var body: some View {
        ZStack(alignment: .topLeading) {
            Theme.bannerGradient
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(banner.title)
                        .font(.kufi(21, .bold, relativeTo: .title2))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .fixedSize(horizontal: false, vertical: true)
                    if !banner.subtitle.isEmpty {
                        Text(banner.subtitle).font(.system(size: 14)).foregroundStyle(.white.opacity(0.95))
                    }
                    Spacer(minLength: 0)
                    Text("تسوّق الحين")
                        .font(.kufi(13.5, .bold))
                        .foregroundStyle(Theme.copperInk)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .padding(16)
                Spacer(minLength: 0)
                if let url = AppConfig.asset(banner.image) {
                    RemoteImage(url: url, maxPixel: 420, contentMode: .fill, blendWhite: false)
                        .frame(width: 130, height: 126)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .padding(12)
                }
            }
        }
        .frame(height: 160)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
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
