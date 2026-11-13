import SwiftUI
import WebKit

/// «الآلية الحية» (طلب المالك ١٣ نوفمبر ٢٠٢٦): أجزاء من الموقع تنعرض داخل التطبيق، فأي ميزة أو تصميم جديد ينزل في الموقع
/// يطلع في التطبيق بدون تحديث. ثلاث أشكال:
///  - LiveHomeBlocks: أقسام الرئيسية (بنرات، عروض الأقسام، وأي قسم جديد) — index.html?embed=1&blocks=…
///  - LiveSlot: خانة داخل شاشة (صفحة المنتج، السلة) — ?embed=1&slot=product&id=… / slot=cart
///  - LiveScreen: صفحة كاملة (مثل اختيار عرض المجموعة) — ?embed=1&page=g:<id>
/// الموقع يكلم التطبيق بـ webkit.messageHandlers.ohod: h (الارتفاع)، product، category، chip، bundle، group، nav،
/// cart.add {key, qty}، cart.set {set: {id: qty}}، close. السلة الحالية تنرسل للموقع بالرابط (cart=…).
@MainActor
struct LiveBridge {
    var path: Binding<NavigationPath>
    var tab: Binding<AppTab>?
    let cart: Cart
    let catalog: CatalogStore
    var close: (() -> Void)? = nil

    func handle(_ m: [String: Any]) {
        let t = m["t"] as? String ?? "", id = m["id"] as? String ?? ""
        switch t {
        case "product": if !id.isEmpty { path.wrappedValue.append(Route.product(id)) }
        case "category": if !id.isEmpty { path.wrappedValue.append(Route.category(id)) }
        case "bundle": if !id.isEmpty { path.wrappedValue.append(Route.banner(id)) }
        case "group": if !id.isEmpty { path.wrappedValue.append(Route.live("g:" + id)) }
        case "page": if !id.isEmpty { path.wrappedValue.append(Route.live(id)) }
        case "chip":
            if id == "offers" { if let tab { tab.wrappedValue = .offers } else { path.wrappedValue.append(Route.offers) } }
            else if id == "deals" { path.wrappedValue.append(Route.deals) }
            else if id.hasPrefix("o:") || id.hasPrefix("c:") { path.wrappedValue.append(Route.category(String(id.dropFirst(2)))) }
            else if id.hasPrefix("b:") { path.wrappedValue.append(Route.banner(String(id.dropFirst(2)))) }
            else if id.hasPrefix("g:") { path.wrappedValue.append(Route.live(id)) }
        case "nav":
            if id == "cats" { tab?.wrappedValue = .categories } else if id == "search" { path.wrappedValue.append(Route.search) } else if id == "cart" { tab?.wrappedValue = .cart }
        case "cart.add":
            if let key = m["key"] as? String, let q = CatalogParser.num(m["qty"]) { cart.add(key: key, delta: Int(q)); Haptics.added() }
        case "cart.set":
            if let set = m["set"] as? [String: Any] { for (k, v) in set { cart.set(k, Int(CatalogParser.num(v) ?? 0)) }; Haptics.added() }
        case "close": close?()
        default: break
        }
    }

    static func url(_ items: [URLQueryItem], cart: Cart, version: Int) -> URL {
        var c = URLComponents(url: AppConfig.site, resolvingAgainstBaseURL: false)!
        let cj = (try? JSONSerialization.data(withJSONObject: cart.snapshot)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        c.queryItems = [URLQueryItem(name: "embed", value: "1")] + items + [URLQueryItem(name: "cart", value: cj), URLQueryItem(name: "v", value: String(version))]
        return c.url!
    }
}

/// الرئيسية الحية: البنرات وأي قسم جديد. لو الموقع ما فتح خلال ٨ ثواني يطلع البديل الأصلي
struct LiveHomeBlocks<Fallback: View>: View {
    let blocks: [String]
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @ViewBuilder var fallback: () -> Fallback
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var height: CGFloat = 0
    @State private var failed = false

    var body: some View {
        ZStack(alignment: .top) {
            if failed { fallback() }
            else {
                LiveWeb(url: LiveBridge.url([URLQueryItem(name: "blocks", value: blocks.joined(separator: ","))], cart: cart, version: catalog.version),
                        fit: true, height: $height, failed: $failed,
                        onMessage: LiveBridge(path: $path, tab: $tab, cart: cart, catalog: catalog).handle)
                    .frame(height: height > 0 ? height : 1)
                    .opacity(height > 0 ? 1 : 0)
                if height == 0 { fallback() }
            }
        }
        .padding(.top, 12)
        .task(id: catalog.version) { failed = false }
    }
}

/// مسار التنقل الحالي (يحطه TabStack) عشان الخانات الحية تفتح المنتجات والصفحات
private struct LivePathKey: EnvironmentKey { static let defaultValue: Binding<NavigationPath>? = nil }
extension EnvironmentValues {
    var livePath: Binding<NavigationPath>? { get { self[LivePathKey.self] } set { self[LivePathKey.self] = newValue } }
}

/// خانة حية داخل شاشة (صفحة المنتج، السلة): تختفي لو ما فيها شي
struct LiveSlot: View {
    let slot: String
    var id: String = ""
    @Environment(\.livePath) private var livePath
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var height: CGFloat = 0
    @State private var failed = false

    var body: some View {
        if !failed {
            LiveWeb(url: LiveBridge.url([URLQueryItem(name: "slot", value: slot), URLQueryItem(name: "id", value: id)], cart: cart, version: catalog.version &+ (slot == "cart" ? cart.revision : 0)),
                    fit: true, height: $height, failed: $failed,
                    onMessage: LiveBridge(path: livePath ?? .constant(NavigationPath()), tab: nil, cart: cart, catalog: catalog).handle)
                .frame(height: height > 4 ? height : 0)
                .clipped()
        }
    }
}

/// صفحة حية كاملة من الموقع (مثل «اختر ٣ علب من أي نوع»)
struct LiveScreen: View {
    let page: String
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var height: CGFloat = 0
    @State private var failed = false
    @State private var url: URL? = nil

    var body: some View {
        Group {
            if failed {
                VStack(spacing: 10) {
                    Image(systemName: "wifi.exclamationmark").font(.system(size: 34)).foregroundStyle(Theme.muted)
                    Text("ما قدرنا نفتح الصفحة. تأكد من النت وجرّب مرة ثانية.").font(.ui(size: 14)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
                    Button("جرّب مرة ثانية") { failed = false; url = nil }
                }.padding(30)
            } else if let url {
                LiveWeb(url: url, fit: false, height: $height, failed: $failed,
                        onMessage: LiveBridge(path: $path, tab: nil, cart: cart, catalog: catalog, close: { if !path.isEmpty { path.removeLast() } }).handle)
            } else { ProgressView() }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageBG)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: failed) { if url == nil { url = LiveBridge.url([URLQueryItem(name: "page", value: page)], cart: cart, version: catalog.version) } }
    }

    private var title: String {
        if page.hasPrefix("g:"), let g = catalog.store.groups.first(where: { $0.id == page.split(separator: ":").dropFirst().first.map(String.init) }) { return "عرض " + g.name }
        return catalog.store.name
    }
}

private struct LiveWeb: UIViewRepresentable {
    let url: URL
    let fit: Bool
    @Binding var height: CGFloat
    @Binding var failed: Bool
    let onMessage: ([String: Any]) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(context.coordinator, name: "ohod")
        cfg.websiteDataStore = .default()
        let w = WKWebView(frame: .zero, configuration: cfg)
        w.isOpaque = false; w.backgroundColor = .clear; w.scrollView.backgroundColor = .clear
        w.scrollView.isScrollEnabled = !fit; w.scrollView.bounces = !fit
        w.scrollView.contentInsetAdjustmentBehavior = fit ? .never : .automatic
        w.navigationDelegate = context.coordinator
        context.coordinator.load(w, url)
        return w
    }

    func updateUIView(_ w: WKWebView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.loaded != url { context.coordinator.load(w, url) }
    }

    static func dismantleUIView(_ w: WKWebView, coordinator: Coordinator) {
        w.configuration.userContentController.removeScriptMessageHandler(forName: "ohod")
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: LiveWeb
        var loaded: URL?
        private var timer: Task<Void, Never>?
        init(_ p: LiveWeb) { parent = p }

        func load(_ w: WKWebView, _ url: URL) {
            loaded = url
            w.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 15))
            timer?.cancel()
            guard parent.fit else { return }
            timer = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(8))
                guard let self, !Task.isCancelled, self.parent.height == 0 else { return }
                self.parent.failed = true
            }
        }

        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let m = message.body as? [String: Any] else { return }
            DispatchQueue.main.async {
                if m["t"] as? String == "h" {
                    if let h = CatalogParser.num(m["h"]) { withAnimation(.snappy) { self.parent.height = CGFloat(h) } }
                } else { self.parent.onMessage(m) }
            }
        }

        // ما يفتح أي صفحة ثانية داخل المربع: بس صفحة المتجر نفسها
        func webView(_ w: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let u = action.request.url
            decisionHandler(u?.host == AppConfig.site.host && action.targetFrame?.isMainFrame != false ? .allow : .cancel)
        }

        func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { DispatchQueue.main.async { self.parent.failed = true } }
        func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { DispatchQueue.main.async { self.parent.failed = true } }
    }
}
