import SwiftUI

// MARK: - التنقل

enum Route: Hashable {
    case category(String)
    case product(String)
    case search
    case offers
    /// كل منتج بـ ٠٫٩٥
    case deals
    /// عرض اليوم
    case daily
    /// منتجات بنر (بدون هدف) أو باقة
    case banner(String)
    /// صفحة حية من الموقع (page=…): مثل اختيار عرض المجموعة
    case live(String)
    /// «المفضلة» و«عناويني» من «حسابي»
    case favorites
    case addresses
}

private struct ZoomNamespaceKey: EnvironmentKey {
    static let defaultValue: Namespace.ID? = nil
}

extension EnvironmentValues {
    /// مشترك بين كرت المنتج وصفحته عشان المنتج «يكبر» من كرته ويرجع له
    var zoomNamespace: Namespace.ID? {
        get { self[ZoomNamespaceKey.self] }
        set { self[ZoomNamespaceKey.self] = newValue }
    }
}

/// مصدر حركة التكبير (iOS 18+)، وفي iOS 17 انتقال عادي
struct ZoomSource: ViewModifier {
    let id: String
    @Environment(\.zoomNamespace) private var namespace
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), let namespace {
            content.matchedTransitionSource(id: id, in: namespace)
        } else {
            content
        }
    }
}

struct ZoomDestination: ViewModifier {
    let id: String
    @Environment(\.zoomNamespace) private var namespace
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), let namespace {
            content.navigationTransition(.zoom(sourceID: id, in: namespace))
        } else {
            content
        }
    }
}

// MARK: - الضغط

/// يتلوّن ويصغر أول ما تلمس، وينفّذ لما ترفع إصبعك (سحب الإصبع برا يلغي)
struct PressableStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

/// الزر الأخضر الرئيسي («أضف للسلة»، «أرسل الطلب»)
struct PrimaryButtonStyle: ButtonStyle {
    var color: Color = Theme.brand
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.kufi(15, .bold, relativeTo: .headline))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 18)
            .background(color.opacity(configuration.isPressed ? 0.85 : 1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

// MARK: - الصور

struct RemoteImage: View {
    let url: URL?
    var maxPixel: Int = 360
    var contentMode: ContentMode = .fit
    var blendWhite = true
    @State private var image: UIImage?

    init(url: URL?, maxPixel: Int = 360, contentMode: ContentMode = .fit, blendWhite: Bool = true) {
        self.url = url
        self.maxPixel = maxPixel
        self.contentMode = contentMode
        self.blendWhite = blendWhite
        // من الذاكرة مباشرة لو موجودة: ما فيه وميض لما ترجع للكرت
        _image = State(initialValue: url.flatMap { ImagePipeline.shared.cached($0, maxPixel: maxPixel) })
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .blendMode(blendWhite ? .multiply : .normal)
                    .transition(.opacity)
            } else if url == nil {
                Image(systemName: "basket")
                    .font(.ui(size: 26, weight: .light))
                    .foregroundStyle(Theme.muted.opacity(0.45))
            }
        }
        .task(id: url) {
            guard image == nil, let url else { return }
            let loaded = await ImagePipeline.shared.image(url, maxPixel: maxPixel)
            withAnimation(.smooth(duration: 0.2)) { image = loaded }
        }
    }
}

// MARK: - عناصر صغيرة

struct SectionHeader: View {
    let title: String
    var emoji: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            HStack(spacing: 6) {
                if let emoji { Text(tv: emoji).font(.ui(size: 22)) }
                Text(tv: title).font(.kufi(18, .bold, relativeTo: .title3)).foregroundStyle(Theme.ink)
            }
            Spacer()
            if let actionTitle, let action {
                Button(action: action) {
                    HStack(spacing: 2) {
                        Text(tv: actionTitle)
                        Image(systemName: "chevron.forward").font(.ui(size: 11, weight: .semibold))
                    }
                    .font(.ui(size: 14, weight: .medium))
                    .foregroundStyle(Theme.brandDeep)
                    .frame(minHeight: 44)
                }
            }
        }
        .padding(.horizontal, 16)
    }
}

struct Chip: View {
    let title: String
    var selected = false
    var body: some View {
        Text(tv: title)
            .font(.ui(size: 15, weight: .semibold))
            .foregroundStyle(selected ? .white : Theme.ink)
            .padding(.horizontal, 15)
            .frame(height: 42)
            .background(selected ? Theme.brand : .white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(selected ? .clear : Theme.line, lineWidth: 1.2))
            .shadow(color: Theme.ink.opacity(selected ? 0 : 0.05), radius: 2, y: 1)
            .contentShape(Rectangle())
    }
}

struct PriceLabel: View {
    let price: Double
    var old: Double? = nil
    var size: CGFloat = 15
    /// منتج بالوزن: «ر.س / كيلو»
    var perKilo = false
    var body: some View {
        let size = self.size * AppLook.current.priceScale
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(tv: Money.plain(price))
                .font(.kufi(size, .bold, relativeTo: .headline))
                .foregroundStyle(old == nil ? Theme.ink : Theme.copperInk)
                .contentTransition(.numericText(value: price))
            Text(verbatim: (AppLang.english ? "SAR" : Money.sym) + (perKilo ? (AppLang.english ? " / kg" : " / كيلو") : "")).font(.ui(size: size * 0.72, weight: .semibold)).foregroundStyle(Theme.ink)
            if let old {
                Text(tv: Money.plain(old))
                    .font(.ui(size: size * 0.68))
                    .strikethrough()
                    .foregroundStyle(Theme.muted)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .environment(\.layoutDirection, .rightToLeft)
    }
}

// MARK: - المنتج بدون صورة

/// بلاطة المنتج بدون صورة (نفس phTag في index.html): لون القسم + رمز القسم الفرعي + اسم مختصر + الحجم، بدون صور
struct NoPhotoTile: View {
    let product: Product
    /// صفحة المنتج: خلفية أفتح عشان تبان فوق خلفية الصفحة
    var large = false
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        let category = catalog.category(product.cat)
        let emoji = NoPhoto.emoji(product, category: category)
        // الأسماء الجديدة: الحجم في الوحدة (السطر الرمادي) مو في الاسم
        let parts = NoPhoto.parts(product.name, unit: product.unit)
        let tint = Color(hexString: category?.tint) ?? Color(hex: 0xEEF0F3)
        GeometryReader { geo in
            let w = geo.size.width
            // كرت ضيق (٣ بالصف): بدون شريحة الحجم ورمز أصغر، عشان ما يتغطى بزر الإضافة
            let compact = w < 150
            ZStack {
                tint
                RadialGradient(colors: large ? [Color.white, Color.white.opacity(0.6)] : [Color.white.opacity(0.75), Color.white.opacity(0)],
                               center: .top, startRadius: 0, endRadius: w * (large ? 0.85 : 0.62))
                // الرمز كبير وباهت بالزاوية (علامة مائية)
                Text(verbatim: emoji)
                    .font(.system(size: w * 0.58))
                    .saturation(0.6)
                    .opacity(large ? 0.1 : 0.13)
                    .rotationEffect(.degrees(-14))
                    .offset(y: w * 0.1)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                VStack(spacing: w * 0.03) {
                    Text(verbatim: emoji)
                        .font(.system(size: w * (compact ? 0.13 : 0.16)))
                        .frame(width: compact ? w * 0.24 : Swift.max(34, w * 0.3), height: compact ? w * 0.24 : Swift.max(34, w * 0.3))
                        .background(Color.white.opacity(0.78), in: Circle())
                        .shadow(color: Theme.ink.opacity(0.08), radius: 6, y: 3)
                    Text(tv: parts.label)
                        .font(.kufi(compact ? 11 : Swift.min(22, Swift.max(11, w * 0.105)), .bold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                    if !parts.size.isEmpty, !compact {
                        Text(tv: parts.size)
                            .font(.ui(size: Swift.min(15, Swift.max(10, w * 0.08)), weight: .bold))
                            .foregroundStyle(Theme.ink.opacity(0.78))
                            .lineLimit(1)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color.white.opacity(0.82), in: Capsule())
                    }
                }
                .padding(.horizontal, w * 0.09)
                .padding(.top, w * 0.1)
                .padding(.bottom, large ? w * 0.1 : Swift.max(w * 0.22, 40))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(tv: product.name))
    }
}

/// منطق بلاطة «بدون صورة» (مطابق لـ SUB_EMO وphParts في الموقع)
enum NoPhoto {
    static let subEmoji: [String: String] = [
        "milk": "🥛", "laban": "🥣", "eggs": "🥚", "cheese": "🧀", "cream": "🧈", "water": "💧", "soft": "🥤", "juice": "🧃", "energy": "⚡️", "icedtea": "🧊", "tea": "☕️",
        "chips": "🍟", "chocolate": "🍫", "biscuits": "🍪", "cakes": "🧁", "candy": "🍬", "icecream": "🍦", "nuts": "🥜", "gum": "🍃", "rice": "🍚", "oil": "🫒", "flour": "🍞", "canned": "🥫",
        "pasta": "🍝", "breakfast": "🍯", "sugar": "🍮", "sauces": "🍅", "spices": "🌶️", "frozen": "❄️", "chicken": "🍗", "beef": "🥩", "processed": "🌭", "fish": "🐟",
        "laundry": "🧺", "dishes": "🍽️", "surfaces": "🧽", "bags": "🗑️", "paper": "🧻", "fresh": "🌸", "insects": "🦟", "baby": "🍼", "hair": "💆", "oral": "🪥", "body": "🧼", "deo": "🧴",
        "women": "🌷", "shave": "🪒", "care/tools": "💅", "kitchen": "🍳", "toys": "🧸", "stationery": "✏️", "bbq": "🔥", "pets": "🐾", "electronics": "🔌", "tools": "🔧", "clothes": "👕",
        "religious": "📿", "home": "🏠", "fruit": "🍎", "leaf": "🌿", "veg/veg": "🥕",
    ]

    /// رمز القسم الفرعي، وإلا رمز القسم (اللي يقدر المالك يغيّره من «شكل التطبيق»)
    static func emoji(_ p: Product, category: Category?) -> String {
        let s = p.sub ?? ""
        return subEmoji["\(p.cat)/\(s)"] ?? subEmoji[s] ?? category?.emoji ?? "🛒"
    }

    private static let unit = "(?:مل|ملي|مللي|لتر|لترات|ل|جم|جرام|غرام|غم|غ|كجم|كغ|كيلو|كلغ|كغم|حبة|حبه|حبات|قطعة|قطعه|قطع|قرص|اقراص|منديل|مناديل|ورقة|ورقه|كيس|اكياس|جالون|سم|متر|م|انش|واط|g|gm|gr|kg|ml|l|L|ltr|cm|pcs)"
    private static let sizeRE = try? NSRegularExpression(pattern: #"(\d+(?:[.,]\d+)?\s*(?:[×xX*/]\s*\d+(?:[.,]\d+)?\s*)*"# + unit + #"(?:\s*[×xX*]\s*\d+)?)(?=\s|$)"#)
    private static let dimRE = try? NSRegularExpression(pattern: #"(\d+(?:[.,]\d+)?\s*[×xX*]\s*\d+(?:[.,]\d+)?)(?=\s|$)"#)
    private static let codeRE = try? NSRegularExpression(pattern: #"^[A-Za-z]*\d{3,}[A-Za-z0-9]*$"#)

    /// «عصير الربيع برتقال 125 مل» ← اسم «عصير الربيع برتقال» وحجم «125 مل» (وأرقام الموديلات الطويلة تنشال)
    static func parts(_ raw: String, unit: String) -> (label: String, size: String) {
        let r = parts(raw)
        return r.size.isEmpty && unit.contains(where: \.isNumber) ? (r.label, unit) : r
    }
    static func parts(_ raw: String) -> (label: String, size: String) {
        let name = raw.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        let ns = name as NSString
        let all = NSRange(location: 0, length: ns.length)
        var size = ""
        var rest = name
        if let m = sizeRE?.firstMatch(in: name, range: all) ?? dimRE?.firstMatch(in: name, range: all) {
            size = ns.substring(with: m.range(at: 1))
                .replacingOccurrences(of: #"\s*([×xX*/])\s*"#, with: " $1 ", options: .regularExpression)
                .split(whereSeparator: \.isWhitespace).joined(separator: " ")
            rest = ns.replacingCharacters(in: m.range, with: " ")
        }
        let words = rest.split(whereSeparator: \.isWhitespace).map(String.init).filter { w in
            if ["×", "x", "X", "*", "/", "-"].contains(w) { return false }
            let r = NSRange(location: 0, length: (w as NSString).length)
            return codeRE?.firstMatch(in: w, range: r) == nil
        }
        let label = words.joined(separator: " ")
        return (label.isEmpty ? name : label, size)
    }
}
