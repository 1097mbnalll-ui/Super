import SwiftUI

/// الرئيسية (design/mix-01-home.webp)
struct HomeView: View {
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                HomeHeader(path: $path)
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
                        .frame(width: 40, height: 40)
                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                    Text(catalog.store.name)
                        .font(.kufi(22, .bold, relativeTo: .title))
                        .foregroundStyle(Theme.brandDeep)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 6) {
                    Label("توصيل خلال \(catalog.store.eta)", systemImage: "bolt")
                        .font(.kufi(11.5, .semibold, relativeTo: .caption))
                        .foregroundStyle(Theme.oliveInk)
                        .lineLimit(1)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(.white.opacity(0.55), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .strokeBorder(Theme.olive, style: StrokeStyle(lineWidth: 1.3, dash: [4, 3])))
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                        Text("التوصيل في \(catalog.store.area)")
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink)
                }
            }
            Button {
                path.append(Route.search)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").font(.system(size: 17, weight: .medium))
                    Text("وش ناقص بيتك اليوم؟").font(.system(size: 15))
                    Spacer()
                }
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 16)
                .frame(height: 50)
                .background(.white, in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0xD9DEE4), lineWidth: 1.3))
            }
            .buttonStyle(PressableStyle(scale: 0.98))
            .accessibilityLabel("ابحث")

            BannerCarousel(path: $path)
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 10)
        .background(alignment: .top) {
            Theme.headerGradient.ignoresSafeArea(edges: .top)
        }
    }
}

/// بنرات تتصفحها بالسحب (بدون تقليب تلقائي: احترام «تقليل الحركة» والقراءة على راحتك)
private struct BannerCarousel: View {
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @State private var current: String?

    var body: some View {
        let banners = catalog.store.banners
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
                        .font(.kufi(20, .bold, relativeTo: .title2))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    if !banner.subtitle.isEmpty {
                        Text(banner.subtitle).font(.system(size: 13)).foregroundStyle(.white.opacity(0.9))
                    }
                    Spacer(minLength: 0)
                    Text("تسوّق الحين")
                        .font(.kufi(12.5, .bold))
                        .foregroundStyle(Theme.brandDeep)
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(.white, in: Capsule())
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
        .frame(height: 150)
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
