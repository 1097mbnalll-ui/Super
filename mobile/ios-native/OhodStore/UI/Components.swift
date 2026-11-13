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
    var body: some View {
        let size = self.size * AppLook.current.priceScale
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(tv: Money.plain(price))
                .font(.kufi(size, .bold, relativeTo: .headline))
                .foregroundStyle(old == nil ? Theme.ink : Theme.copperInk)
                .contentTransition(.numericText(value: price))
            Text("ر.س").font(.ui(size: size * 0.72, weight: .semibold)).foregroundStyle(Theme.ink)
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
