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
    var orders: OrderCenter? = nil
    var favorites: Favorites? = nil

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
            else if id == "home" { tab?.wrappedValue = .home } else if id == "account" || id == "more" { tab?.wrappedValue = .account } else if id == "offers" { tab?.wrappedValue = .offers }
            else if id == "fav" { path.wrappedValue.append(Route.favorites) } else if id == "addrs" { path.wrappedValue.append(Route.addresses) }
        case "fav":
            // القلب في صفحة حية: نحفظه في مفضلة التطبيق
            if !id.isEmpty { favorites?.set(id, on: m["on"] as? Bool ?? true) }
        case "cart.add":
            if let key = m["key"] as? String, let q = CatalogParser.num(m["qty"]) { cart.add(key: key, delta: Int(q)); Haptics.added() }
        case "cart.set":
            if let set = m["set"] as? [String: Any] { for (k, v) in set { cart.set(k, Int(CatalogParser.num(v) ?? 0)) }; Haptics.added() }
        case "cart.sync":
            // شاشة الموقع غيّرت السلة: سلة التطبيق تصير نفسها بالضبط
            if let set = m["cart"] as? [String: Any] {
                var want: [String: Int] = [:]
                for (k, v) in set { want[k] = Int(CatalogParser.num(v) ?? 0) }
                for k in cart.snapshot.keys where want[k] == nil { cart.set(k, 0) }
                for (k, q) in want { cart.set(k, q) }
            }
        case "order":
            if let no = m["no"] as? String ?? (CatalogParser.num(m["no"]).map { String(Int($0)) }) {
                CartPing.shared.orderPlaced()   // الطلب من شاشة الموقع: الخادم صفّر عدّ السلة (cart.sync اللي بعده ما يرسل نبضة)
                var items: [String: Int] = [:]
                for (k, v) in (m["items"] as? [String: Any]) ?? [:] { items[k] = Int(CatalogParser.num(v) ?? 0) }
                orders?.adopt(no: no, total: CatalogParser.num(m["total"]) ?? 0, phone: m["phone"] as? String ?? "", pay: m["pay"] as? String ?? "cash",
                              items: items, lat: CatalogParser.num(m["lat"]), lng: CatalogParser.num(m["lng"]))
            }
        case "close": close?()
        default: break
        }
    }

    static func url(_ items: [URLQueryItem], cart: Cart, version: String) -> URL {
        var c = URLComponents(url: AppConfig.site, resolvingAgainstBaseURL: false)!
        let cj = (try? JSONSerialization.data(withJSONObject: cart.snapshot, options: [.sortedKeys])).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        // الصفحة نفسها ثابتة (embed + نسخة البيانات) فتنحفظ بالكاش وتفتح بسرعة، والباقي بعد # (الموقع يقراه من هناك)
        c.queryItems = [URLQueryItem(name: "embed", value: "1"), URLQueryItem(name: "v", value: version)]
        // المفضلة (fav=id,id) عشان القلوب في الصفحة تطلع مثل التطبيق
        let fav = Favorites.stored.prefix(300).joined(separator: ",")
        var f = URLComponents(); f.queryItems = items + [URLQueryItem(name: "cart", value: cj), URLQueryItem(name: "dev", value: Device.id)] + (fav.isEmpty ? [] : [URLQueryItem(name: "fav", value: fav)])
        c.percentEncodedFragment = String((f.percentEncodedQuery ?? "").replacingOccurrences(of: "#", with: "%23"))
        return c.url!
    }
}

/// الرئيسية الحية: البنرات وأي قسم جديد. لو الموقع ما فتح خلال ١٥ ثانية يطلع البديل الأصلي.
/// st (رأس الرئيسية «head»): ارتفاع شريط الساعة. المربع يطلع لين أعلى الشاشة (السما ورا الساعة) والموقع ينزّل محتواه تحتها بنفس المقدار.
/// وهو يحمّل يطلع البديل الأصلي (الرأس) مكانه عشان الشاشة ما تكون بدون رأس
struct LiveHomeBlocks<Fallback: View>: View {
    let blocks: [String]
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    var st: CGFloat? = nil
    /// يصير true لما صفحة الموقع تنعرض فعلاً (فتحت ولها ارتفاع)، false وهي تحمّل أو لو ما فتحت
    var shown: Binding<Bool>? = nil
    @ViewBuilder var fallback: () -> Fallback
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(Favorites.self) private var favorites
    @State private var height: CGFloat = 0
    @State private var failed = false

    private var items: [URLQueryItem] {
        var q = [URLQueryItem(name: "blocks", value: blocks.joined(separator: ","))]
        if let st { q.append(URLQueryItem(name: "st", value: String(Int(st.rounded())))) }
        return q
    }

    /// قرار المالك ١٥ نوفمبر ٢٠٢٦ (خط أحمر): التطبيق منفصل عن الموقع، فما ينعرض شي من الموقع داخله. البديل الأصلي دايماً
    var body: some View {
        VStack(spacing: 0) { fallback() }
            .onAppear { shown?.wrappedValue = false }
    }
}

/// البديل الأصلي ينعرض وهو يحمّل (مكان الرأس الحي)، مو لأن الموقع ما فتح
private struct LiveHomeLoadingKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var liveHomeLoading: Bool { get { self[LiveHomeLoadingKey.self] } set { self[LiveHomeLoadingKey.self] = newValue } }
}

/// مكان البنرات وهي تحمّل من الموقع
struct LiveLoading: View {
    @State private var on = false
    var body: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(Theme.mint)
            .frame(height: 170)
            .opacity(on ? 0.55 : 1)
            .padding(.horizontal, 16).padding(.top, 4)
            .onAppear { withAnimation(.easeInOut(duration: 0.9).repeatForever()) { on = true } }
    }
}

/// التبويب الحالي عشان الشاشات الحية تنقل بين التبويبات
private struct LiveTabKey: EnvironmentKey { static let defaultValue: Binding<AppTab>? = nil }
extension EnvironmentValues {
    var liveTab: Binding<AppTab>? { get { self[LiveTabKey.self] } set { self[LiveTabKey.self] = newValue } }
}

/// شاشة تنعرض من الموقع لو المالك فعّلها (store.app.web)، وإلا الشاشة الأصلية. لو الموقع ما فتح ترجع الأصلية
struct RemoteScreen<Native: View>: View {
    let key: String
    var id: String = ""
    /// صفحة من الموقع بدل شاشة (مثل offers أو b:<بنر>)
    var page: String? = nil
    var path: Binding<NavigationPath>? = nil
    @ViewBuilder var native: () -> Native
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.livePath) private var livePath

    /// دايماً الشاشة الأصلية (التطبيق ما يعرض صفحات الموقع، قرار المالك ١٥ نوفمبر ٢٠٢٦)
    var body: some View { native() }
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
    @Environment(Favorites.self) private var favorites
    @State private var height: CGFloat = 0
    @State private var failed = false

    /// ما تنعرض: التطبيق منفصل عن الموقع (قرار المالك ١٥ نوفمبر ٢٠٢٦). الخانة باقية عشان الكود يتجمّع بس
    var body: some View { EmptyView() }
}

/// كانت صفحة حية من الموقع. من ١٥ نوفمبر ٢٠٢٦ (خط أحمر من المالك): كل صفحة (page) لها شاشة أصلية في NativePageView
struct LiveScreen: View {
    let page: String
    @Binding var path: NavigationPath
    var fallback: AnyView? = nil

    var body: some View { NativePageView(page: page, path: $path) }
}

/// (ما يُستخدم) عارض صفحات الموقع القديم، باقي للرجوع له بس
private struct LiveWeb: UIViewRepresentable {
    let url: URL
    let fit: Bool
    /// الصفحة تبدأ من أعلى الشاشة (تحت الساعة)، والموقع يحط المسافة بنفسه (st)
    var edge: Bool = false
    @Binding var height: CGFloat
    @Binding var failed: Bool
    /// نسخة المتجر اللي عند التطبيق: تنحقن في الصفحة قبل سكربتاتها فما تنزّل data.json مرة ثانية (الصفحة تتأكد إن نسختها نفس v بالرابط)
    var script: LiveScript? = nil
    let onMessage: ([String: Any]) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(context.coordinator, name: "ohod")
        context.coordinator.inject(cfg.userContentController)
        cfg.websiteDataStore = .default()
        let w = WKWebView(frame: .zero, configuration: cfg)
        w.isOpaque = false; w.backgroundColor = .clear; w.scrollView.backgroundColor = .clear
        w.scrollView.isScrollEnabled = !fit; w.scrollView.bounces = !fit
        w.scrollView.contentInsetAdjustmentBehavior = fit || edge ? .never : .automatic
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
        /// نسخة البيانات المحقونة حالياً في هالصفحة
        private var injected: String?
        init(_ p: LiveWeb) { parent = p }

        /// يحط (أو يبدّل) سكربت البيانات لو نسخة التطبيق تغيّرت. يشتغل من التحميل الجاي للصفحة
        func inject(_ uc: WKUserContentController) {
            guard let s = parent.script, s.tag != injected else { return }
            uc.removeAllUserScripts()
            uc.addUserScript(WKUserScript(source: s.source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            injected = s.tag
        }

        func load(_ w: WKWebView, _ url: URL) {
            loaded = url
            inject(w.configuration.userContentController)
            w.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 15))
            timer?.cancel()
            guard parent.fit else { return }
            timer = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(15))
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
            if let u, u.host != AppConfig.site.host, action.navigationType == .linkActivated || ["tel", "sms", "mailto", "whatsapp"].contains(u.scheme ?? "") {
                // روابط الاتصال والواتساب والخرائط من صفحات الموقع تفتح برّا التطبيق
                UIApplication.shared.open(u); decisionHandler(.cancel); return
            }
            decisionHandler(u?.host == AppConfig.site.host && action.targetFrame?.isMainFrame != false ? .allow : .cancel)
        }

        func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { DispatchQueue.main.async { self.parent.failed = true } }
        func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { DispatchQueue.main.async { self.parent.failed = true } }
    }
}
