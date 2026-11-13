import SwiftUI
import WebKit

/// «الرئيسية الحية» (طلب المالك ١٣ نوفمبر ٢٠٢٦): بنرات العروض وأي قسم جديد في رئيسية الموقع
/// تنعرض هنا من الموقع نفسه (index.html?embed=1&blocks=…)، فأي تصميم أو قسم جديد يطلع في التطبيق بدون تحديث.
/// الضغطات ترجع للتطبيق ويفتحها بشاشاته (المنتج، القسم، العروض). لو الموقع ما فتح خلال ٨ ثواني يطلع البديل الأصلي.
struct LiveHomeBlocks<Fallback: View>: View {
    let blocks: [String]
    @Binding var tab: AppTab
    @Binding var path: NavigationPath
    @ViewBuilder var fallback: () -> Fallback
    @Environment(CatalogStore.self) private var catalog
    @State private var height: CGFloat = 0
    @State private var failed = false

    var body: some View {
        ZStack(alignment: .top) {
            if failed { fallback() }
            else {
                LiveBlocksWeb(url: url, height: $height, failed: $failed, onMessage: handle)
                    .frame(height: height > 0 ? height : 1)
                    .opacity(height > 0 ? 1 : 0)
                if height == 0 { fallback() }   // لين يجهز الموقع
            }
        }
        .padding(.top, 12)
        .task(id: catalog.version) { failed = false }
    }

    private var url: URL {
        var c = URLComponents(url: AppConfig.site, resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "embed", value: "1"),
                        URLQueryItem(name: "blocks", value: blocks.joined(separator: ",")),
                        URLQueryItem(name: "v", value: String(catalog.version))]
        return c.url!
    }

    private func handle(_ m: [String: Any]) {
        let t = m["t"] as? String ?? "", id = m["id"] as? String ?? ""
        switch t {
        case "h":
            if let h = m["h"] as? Double, h > 0 { withAnimation(.snappy) { height = CGFloat(h) } }
        case "product": if !id.isEmpty { path.append(Route.product(id)) }
        case "category": if !id.isEmpty { path.append(Route.category(id)) }
        case "bundle": if !id.isEmpty { path.append(Route.banner(id)) }
        case "chip":
            if id == "offers" { tab = .offers }
            else if id == "deals" { path.append(Route.deals) }
            else if id.hasPrefix("o:") { path.append(Route.category(String(id.dropFirst(2)))) }
            else if id.hasPrefix("c:") { path.append(Route.category(String(id.dropFirst(2)))) }
            else if id.hasPrefix("b:") { path.append(Route.banner(String(id.dropFirst(2)))) }
        case "nav":
            if id == "cats" { tab = .categories } else if id == "search" { path.append(Route.search) } else if id == "cart" { tab = .cart }
        default: break
        }
    }
}

private struct LiveBlocksWeb: UIViewRepresentable {
    let url: URL
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
        w.scrollView.isScrollEnabled = false; w.scrollView.bounces = false
        w.scrollView.contentInsetAdjustmentBehavior = .never
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
        var parent: LiveBlocksWeb
        var loaded: URL?
        private var timer: Task<Void, Never>?
        init(_ p: LiveBlocksWeb) { parent = p }

        func load(_ w: WKWebView, _ url: URL) {
            loaded = url
            w.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 15))
            timer?.cancel()
            timer = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(8))
                guard let self, !Task.isCancelled, self.parent.height == 0 else { return }
                self.parent.failed = true
            }
        }

        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let m = message.body as? [String: Any] else { return }
            DispatchQueue.main.async { self.parent.onMessage(m) }
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
