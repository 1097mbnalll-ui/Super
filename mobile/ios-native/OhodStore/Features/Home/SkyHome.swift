import SwiftUI

// «سما الرياض» أول الرئيسية بشاشة أصلية (قرار المالك ١٥ نوفمبر ٢٠٢٦: التطبيق منفصل عن الموقع).
// نفس شكل الموقع (.kqsky.ktop و skyNow و SKYLINE في index.html): السما تبدأ من أعلى الشاشة ورا الساعة،
// فيها الشعار والمدة والمنطقة والبحث ورسالة الإقفال والتحية والمدينة، وبعدها ديمة والبنرات داخل السما، والسما تذوب بلون الصفحة تحت.

/// وقت السما بتوقيت الرياض (UTC+3)، بنفس حدود skyNow في الموقع
enum SkyKey: String {
    case morning, noon, asr, maghrib, night

    static func at(_ d: Date) -> SkyKey {
        let h = (d.timeIntervalSince1970 / 3600 + 3).truncatingRemainder(dividingBy: 24)
        if h < 4 { return .night }
        if h < 11 { return .morning }
        if h < 15 { return .noon }
        if h < 17.5 { return .asr }
        if h < 19 { return .maghrib }
        return .night
    }

    var greeting: String {
        switch self {
        case .morning: return "صباح الخير"
        case .noon: return "الظهر"
        case .asr: return "العصر"
        case .maghrib: return "المغرب"
        case .night: return "مساء الخير"
        }
    }
    var line: String {
        switch self {
        case .morning: return "فطورك ناقصه شي؟ نوصله لبابك"
        case .noon: return "غداك يبيله مقاضي؟ احنا جاهزين"
        case .asr: return "وقت القهوة والحلا"
        case .maghrib: return "جهّز عشاك قبل الزحمة"
        case .night: return "السهرة بدت، وعروضها جاهزة"
        }
    }
    /// ألوان التدرج (--g1 --g2 --g3 في .kqsky.ktop)
    var colors: (Color, Color, Color) {
        switch self {
        case .morning: return (Color(hex: 0x8FD0F5), Color(hex: 0xCDEBFA), Color(hex: 0xF7E7C6))
        case .noon: return (Color(hex: 0x4FA9E8), Color(hex: 0xA7D8F5), Color(hex: 0xEFE3CC))
        case .asr: return (Color(hex: 0x6BB6E8), Color(hex: 0xF2D49B), Color(hex: 0xF3C58A))
        case .maghrib: return (Color(hex: 0x3B2A7A), Color(hex: 0xB6407E), Color(hex: 0xF38B4C))
        case .night: return (Color(hex: 0x0F0B2E), Color(hex: 0x2E1A66), Color(hex: 0x5B2A7E))
        }
    }
    /// المغرب والليل: الكلام فاتح فوق السما الغامقة
    var isDark: Bool { self == .maghrib || self == .night }
    var hasSun: Bool { self != .night }
    var hasClouds: Bool { self == .morning || self == .noon || self == .asr }
    var stars: Double { self == .night ? 1 : self == .maghrib ? 0.4 : 0 }
}

/// ارتفاع شريط الساعة من نافذة التطبيق
@MainActor
enum SkyInsets {
    static var top: CGFloat {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let win = scenes.compactMap(\.keyWindow).first ?? scenes.flatMap(\.windows).first
        return win?.safeAreaInsets.top ?? 0
    }
}

/// المدينة (SKYLINE في الموقع: viewBox 342×60، يتمدد بعرض الشاشة)
struct SkylineShape: Shape {
    private static let d = "M0 60V42h18v-8h14v8h10V28h12v14h16V34h10v-6h8v6h12v8h14V20h10v22h18V38h12v-10h6l4-8 4 8h6v10h12v4h20V14h4l8-14 8 14h4v28h16V32h22v10h14V24h10v18h18v-6h16v6h14v18z"

    /// أوامر المسار مقروءة مرة وحدة: (الأمر، أرقامه)
    private static let commands: [(Character, [Double])] = {
        var out: [(Character, [Double])] = []
        var cmd: Character? = nil
        var nums: [Double] = []
        var buf = ""
        func flushNumber() { if let v = Double(buf) { nums.append(v) }; buf = "" }
        for ch in d {
            if ch.isLetter {
                flushNumber()
                if let c = cmd { out.append((c, nums)) }
                cmd = ch; nums = []
            } else if ch == "-" {
                flushNumber(); buf = "-"
            } else if ch == " " || ch == "," {
                flushNumber()
            } else {
                buf.append(ch)
            }
        }
        flushNumber()
        if let c = cmd { out.append((c, nums)) }
        return out
    }()

    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 342, sy = rect.height / 60
        func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: rect.minX + CGFloat(x) * sx, y: rect.minY + CGFloat(y) * sy) }
        var p = Path()
        var x = 0.0, y = 0.0
        for (c, n) in Self.commands {
            switch c {
            case "M", "m":
                var i = 0
                while i + 1 < n.count {
                    if c == "M" { x = n[i]; y = n[i + 1] } else { x += n[i]; y += n[i + 1] }
                    if i == 0 { p.move(to: pt(x, y)) } else { p.addLine(to: pt(x, y)) }
                    i += 2
                }
            case "L", "l":
                var i = 0
                while i + 1 < n.count {
                    if c == "L" { x = n[i]; y = n[i + 1] } else { x += n[i]; y += n[i + 1] }
                    p.addLine(to: pt(x, y)); i += 2
                }
            case "H", "h":
                for v in n { x = c == "H" ? v : x + v; p.addLine(to: pt(x, y)) }
            case "V", "v":
                for v in n { y = c == "V" ? v : y + v; p.addLine(to: pt(x, y)) }
            case "Z", "z":
                p.closeSubpath()
            default: break
            }
        }
        return p
    }
}

/// خلفية السما: من أعلى الشاشة (ورا الساعة) ٦٤٠ نقطة، وتذوب بلون الصفحة. فوقها لون أعلى السما لو سحب الزبون الصفحة لتحت
struct SkyBackdrop: View {
    let key: SkyKey
    let top: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var twinkle = false

    var body: some View {
        let c = key.colors
        let g1 = c.0, g2 = c.1, g3 = c.2
        VStack(spacing: 0) {
            g1.frame(height: 600)
            LinearGradient(stops: [.init(color: g1, location: 0), .init(color: g2, location: 0.45),
                                   .init(color: g3, location: 0.75), .init(color: Theme.pageBG, location: 1)],
                           startPoint: .top, endPoint: .bottom)
                .frame(height: 640)
                .overlay(alignment: .top) {
                    if key.stars > 0 {
                        StarField()
                            .frame(height: 330)
                            .opacity(key.stars * (twinkle ? 0.55 : 1))
                    }
                }
        }
        .offset(y: -(600 + top))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.75).repeatForever(autoreverses: true)) { twinkle = true }
        }
    }
}

/// نجوم الليل (.kqsky-st): نقاط ثابتة بنسب من العرض والارتفاع
private struct StarField: View {
    private static let dots: [(x: CGFloat, y: CGFloat, r: CGFloat)] = [
        (0.12, 0.08, 1.6), (0.30, 0.04, 1), (0.52, 0.30, 1.3), (0.68, 0.14, 1),
        (0.84, 0.40, 1.5), (0.92, 0.22, 1), (0.06, 0.46, 1.2), (0.44, 0.52, 1),
        (0.22, 0.24, 1), (0.76, 0.06, 1.2), (0.60, 0.44, 0.9), (0.36, 0.16, 1.1)
    ]
    var body: some View {
        Canvas { ctx, size in
            for s in Self.dots {
                let r = s.r
                ctx.fill(Path(ellipseIn: CGRect(x: s.x * size.width - r, y: s.y * size.height - r, width: r * 2, height: r * 2)), with: .color(.white))
            }
        }
        .environment(\.layoutDirection, .leftToRight)
    }
}

/// الشمس والقمر والسحاب والمدينة (.kqsky-hi2، ١٢٠ نقطة). مواقعها يسار/يمين ثابتة مثل الموقع مهما كانت لغة التطبيق
private struct SkyDecor: View {
    let key: SkyKey
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false
    @State private var drift = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack(alignment: .topLeading) {
                if key.hasClouds {
                    cloud.offset(x: drift ? -120 : w + 20, y: 6)
                        .animation(reduceMotion ? nil : Animation.linear(duration: 40).repeatForever(autoreverses: false), value: drift)
                    cloud.scaleEffect(0.7).offset(x: drift ? -140 : w * 0.55, y: 58)
                        .animation(reduceMotion ? nil : Animation.linear(duration: 55).repeatForever(autoreverses: false), value: drift)
                }
                if key.hasSun { sun.offset(x: 24, y: sunTop) }
                if key == .night {
                    Image(systemName: "moon.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(Color(hex: 0xFDE68A))
                        .rotationEffect(.degrees(-20))
                        .offset(x: 30, y: 12)
                }
                SkylineShape()
                    .fill(.white.opacity(0.62))
                    .frame(width: w, height: 66)
                    .offset(y: geo.size.height - 66)
            }
            .frame(width: w, height: geo.size.height, alignment: .topLeading)
        }
        .clipped()
        .environment(\.layoutDirection, .leftToRight)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            guard !reduceMotion else { return }
            drift = true
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) { pulse = true }
        }
    }

    private var sunTop: CGFloat { key == .maghrib ? 62 : key == .asr ? 26 : 10 }
    private var sunColor: Color { key == .maghrib ? Color(hex: 0xFB923C) : key == .asr ? Color(hex: 0xFDBA4D) : Color(hex: 0xFDE047) }

    private var sun: some View {
        ZStack {
            Circle().fill(sunColor.opacity(0.22)).frame(width: pulse ? 70 : 62, height: pulse ? 70 : 62)
            Circle().fill(sunColor).frame(width: 42, height: 42)
                .shadow(color: (key == .maghrib ? Color(hex: 0xFB923C) : Color(hex: 0xFBBF24)).opacity(0.7), radius: 17)
        }
        .frame(width: 42, height: 42)
    }

    private var cloud: some View {
        ZStack(alignment: .topLeading) {
            Capsule().frame(width: 80, height: 22).offset(y: 15)
            Circle().frame(width: 34, height: 34).offset(x: 14)
        }
        .frame(width: 80, height: 37, alignment: .topLeading)
        .foregroundStyle(.white.opacity(0.75))
        .opacity(0.85)
        .offset(y: -15)
    }
}

/// السما كاملة أول الرئيسية: الرأس + التحية والمدينة + ديمة + البنرات المتحركة
struct SkyHome: View {
    let key: SkyKey
    var showFeatured = true
    var showPromos = true
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        let group = DeemahBanner.featuredGroup(catalog)
        VStack(spacing: 0) {
            head
            greeting
            if showFeatured, let group {
                DeemahBanner(group: group) { path.append(Route.live("g:" + group.id)) }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
            }
            if showPromos {
                // العرض المميز داخل البنرات المتحركة لو قسم «featured» مطفي (FGB في الموقع)
                BannerCarousel(path: $path, tab: $tab, featured: showFeatured ? nil : group)
            }
        }
        .padding(.bottom, 6)
        .background(alignment: .top) { SkyBackdrop(key: key, top: SkyInsets.top) }
    }

    // MARK: الرأس (.kq-head داخل السما)
    private var nameColor: Color { key.isDark ? Color(hex: 0xFDE68A) : Theme.brandDeep }
    private var metaColor: Color { key.isDark ? Color(hex: 0xF5D0FE) : Color(hex: 0x3A4652) }

    private var head: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
                HStack(spacing: 8) {
                    // الشعار المقصوص بدون إطار أبيض (logo-cut.webp في الموقع)
                    Image("LogoCut")
                        .resizable().scaledToFit()
                        .frame(width: 46, height: 46)
                        .shadow(color: .black.opacity(0.18), radius: 2, y: 2)
                        .accessibilityHidden(true)
                    Text(tv: catalog.store.name)
                        .font(.kufi(19, .bold, relativeTo: .title3))
                        .foregroundStyle(nameColor)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 4) {
                    HStack(spacing: 5) {
                        Image(systemName: "truck.box.fill").font(.system(size: 12, weight: .semibold))
                        Text(tv: catalog.store.eta).lineLimit(1)
                    }
                    .font(.ui(size: 11.5, weight: .bold))
                    .foregroundStyle(Color(hex: 0xC42A3F))
                    .fixedSize()
                    .padding(.horizontal, 9).padding(.vertical, 3)
                    .background(Color(hex: 0xFFF1F3), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(Color(hex: 0xE8394F), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                    HStack(spacing: 3) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 11, weight: .semibold))
                        Text(tv: catalog.store.area).lineLimit(1)
                        Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                    }
                    .font(.ui(size: 11.5, weight: .medium))
                    .foregroundStyle(metaColor)
                    .fixedSize()
                }
            }
            Button { path.append(Route.search) } label: {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.ink)
                    // نص البحث يتبدل كل ٣ ثواني (مثل الموقع)
                    TimelineView(.periodic(from: .now, by: 3.2)) { ctx in
                        let list = ["قهوتك ناقصها حلا؟ ابحث عن الشوكولاتة…", "وش ناقص بيتك اليوم؟", "جهز جمعتك.. ابحث عن المشروبات…", "خبز حار؟ حليب؟ بيض؟ ابحث هنا…"]
                        Text(tv: list[Int(ctx.date.timeIntervalSince1970 / 3.2) % list.count])
                            .font(.ui(size: 14.5))
                            .foregroundStyle(Color(hex: 0x8A939C))
                            .lineLimit(1)
                            .contentTransition(.opacity)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .frame(height: 50)
                .background(.white, in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0xE6EAEE)))
                .shadow(color: Color(hex: 0x17212B).opacity(0.06), radius: 5, y: 2)
                .contentShape(Capsule())
            }
            .buttonStyle(PressableStyle(scale: 0.98))
            .accessibilityLabel("ابحث")
            // المحل مقفل: البطاقة داخل السما تحت البحث، زجاجية على المغرب والليل
            if catalog.store.isClosedNow {
                ClosedNotice(glass: key.isDark)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }

    // MARK: التحية والمدينة (.kqsky-hi2)
    private var greeting: some View {
        ZStack(alignment: .topLeading) {
            SkyDecor(key: key).id(key)
            VStack(alignment: .leading, spacing: 1) {
                Text(tv: key.greeting)
                    .font(.kufi(19, .bold, relativeTo: .title3))
                    .foregroundStyle(key.isDark ? Color.white : Color(hex: 0x0F2A44))
                Text(tv: key.line)
                    .font(.ui(size: 12.5, weight: .bold))
                    .foregroundStyle(key.isDark ? Color(hex: 0xF5D0FE) : Color(hex: 0x24496B))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16).padding(.top, 4)
            .accessibilityElement(children: .combine)
        }
        .frame(height: 120)
        // ديمة والبنرات تركب شوي فوق المدينة (margin-bottom:-20px في الموقع)
        .padding(.bottom, -20)
    }
}

/// بنر عرض المجموعة (ديمة) بتصميم «الحظ» (ART.featured الرابع في الموقع): بنفسجي غامق، ٣ صور في خانات بيضاء داخل إطار أصفر
struct DeemahBanner: View {
    let group: ProductGroup
    let action: () -> Void
    @Environment(CatalogStore.self) private var catalog

    /// أول عرض مجموعة مفعّل وفيه منتجات متوفرة (fg في homeHTML)
    @MainActor static func featuredGroup(_ catalog: CatalogStore) -> ProductGroup? {
        catalog.store.groups.first { g in g.top && g.ids.contains { id in catalog.product(id).map(catalog.isAvailable) == true } }
    }

    var body: some View {
        let items = group.ids.compactMap { catalog.product($0) }.filter { catalog.isAvailable($0) }
        let pics = items.filter(\.hasPhoto)
        let unit = items.first?.price ?? 0
        // «سابقاً 13 ر.س للعلبة الواحدة»: لل + الكلمة بدون «ال»، وإلا لـ
        let w1 = group.w1.hasPrefix("ال") ? "لل" + String(group.w1.dropFirst(2)) : "لـ" + group.w1
        Button(action: action) {
            ZStack {
                LinearGradient(colors: [Color(hex: 0x1E1B4B), Color(hex: 0x4C1D95)],
                               startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tv: group.name)
                            .font(.ui(size: 12.5, weight: .heavy))
                            .foregroundStyle(Color(hex: 0xFDE68A))
                            .lineLimit(1)
                        Text(tv: "أي \(group.count) \(group.w)")
                            .font(.kufi(21, .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text(tv: "بـ \(Money.compact(group.price)) ر.س")
                            .font(.kufi(21, .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1).minimumScaleFactor(0.6)
                        if unit > 0 {
                            Text(tv: "سابقاً \(Money.compact(unit)) ر.س\n\(w1) الواحدة")
                                .font(.ui(size: 11, weight: .semibold))
                                .foregroundStyle(Color(hex: 0xE9D5FF))
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, 1)
                        }
                        Spacer(minLength: 4)
                        Text("جرّب حظك")
                            .font(.ui(size: 13, weight: .heavy))
                            .foregroundStyle(Color(hex: 0x1E1B4B))
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .background(Color(hex: 0xF59E0B), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .padding(.top, 18).padding(.bottom, 14).padding(.leading, 16)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                    VStack(spacing: 0) {
                        slots(pics)
                        Spacer(minLength: 4)
                        Text(tv: "★ ★ ★ اخلطها مثل ما تبي")
                            .font(.ui(size: 12, weight: .heavy))
                            .foregroundStyle(Color(hex: 0xFDE68A))
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .padding(.top, 26).padding(.bottom, 16).padding(.trailing, 16)
                }
            }
            .frame(height: 176)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        }
        .buttonStyle(PressableStyle(scale: 0.98))
        .accessibilityLabel("عرض \(group.name): أي \(group.count) \(group.w) بـ \(Money.compact(group.price))")
    }

    /// ثلاث خانات بيضاء (.aslot) فيها صور المنتجات، داخل إطار أصفر بحد برتقالي
    private func slots(_ pics: [Product]) -> some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { i in
                let p = pics.isEmpty ? nil : pics[i < pics.count ? i : 0]
                RemoteImage(url: p?.imageURL, maxPixel: 200)
                    .frame(width: 50, height: 50)
                    .padding(.top, 14)
                    .frame(width: 54, height: 80, alignment: .top)
                    .background(.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(7)
        .background(Color(hex: 0xFDE68A), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(4)
        .background(Color(hex: 0xF59E0B), in: RoundedRectangle(cornerRadius: 19, style: .continuous))
    }
}

/// «عروض الأقسام» (SEC.catoffers في الموقع): مربع لكل قسم فيه عروض، أكثر الأقسام عروض أول، لين ٨
struct CatOffersGrid: View {
    @Binding var path: NavigationPath
    @Binding var tab: AppTab
    @Environment(CatalogStore.self) private var catalog
    private static let tints: [UInt32] = [0xFFEBD6, 0xE4F1FF, 0xE1F6EC, 0xFFE6EA, 0xEEE9FF, 0xDFF5F8, 0xFFE8F2, 0xE8EEFF, 0xFFF5D6, 0xEEF0F3]

    private struct Tile: Identifiable {
        let cat: Category
        let tint: Color
        let n: Int
        let pct: Int
        let pic: Product?
        var id: String { cat.id }
    }

    private func tiles() -> [Tile] {
        guard let index = catalog.index else { return [] }
        let offers = index.offers.filter { catalog.isAvailable($0) }
        var out: [Tile] = []
        for (i, c) in catalog.categories.enumerated() {
            let l = offers.filter { $0.cat == c.id }
            guard !l.isEmpty else { continue }
            let mx = l.map(CatOffersGrid.pct).max() ?? 0
            let tint = Color(hexString: c.tint) ?? Color(hex: Self.tints[i % Self.tints.count])
            out.append(Tile(cat: c, tint: tint, n: l.count, pct: mx, pic: l.first(where: \.hasPhoto)))
        }
        return Array(out.sorted { $0.n > $1.n }.prefix(8))
    }

    /// نسبة العرض: خصم السعر أو عرض الكمية (pctOf في الموقع)
    static func pct(_ p: Product) -> Int {
        if let d = p.discountPercent { return d }
        if let q = p.quantityOffer, q.before > 0 { return Int(((1 - q.price / q.before) * 100).rounded()) }
        return 0
    }

    var body: some View {
        let list = tiles()
        if list.count > 1 {
            VStack(alignment: .leading, spacing: 0) {
                SectionHeader(title: "عروض الأقسام", emoji: "🏷️", actionTitle: "كل العروض") { tab = .offers }
                    .padding(.top, 18).padding(.bottom, 8)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(list) { t in
                        Button { path.append(Route.live("o:" + t.cat.id)) } label: {
                            ZStack(alignment: .topLeading) {
                                t.tint
                                if let pic = t.pic {
                                    RemoteImage(url: pic.imageURL, maxPixel: 260)
                                        .frame(width: 70, height: 70)
                                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                                        .padding(.trailing, 4).padding(.bottom, 6)
                                }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(tv: "عروض \(t.cat.name)")
                                        .font(.ui(size: 14, weight: .heavy))
                                        .foregroundStyle(Color(hex: 0x13213C))
                                        .lineLimit(2)
                                    if t.pct > 0 {
                                        Text(tv: "حتى \(t.pct)٪").font(.kufi(16, .bold)).foregroundStyle(Color(hex: 0xD9472B))
                                    }
                                    Text(tv: "\(t.n) منتج").font(.ui(size: 11)).foregroundStyle(Color(hex: 0x5B6474))
                                }
                                .frame(maxWidth: 110, alignment: .leading)
                                .padding(12)
                            }
                            .frame(height: 118)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.black.opacity(0.04)))
                        }
                        .buttonStyle(PressableStyle(scale: 0.97))
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }
}
