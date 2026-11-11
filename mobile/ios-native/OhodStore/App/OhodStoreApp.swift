import SwiftUI

@main
struct OhodStoreApp: App {
    @State private var catalog = CatalogStore()
    @State private var cart = Cart()
    @State private var orders = OrderCenter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(catalog)
                .environment(cart)
                .environment(orders)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar_SA@numbers=latn"))   // عربي بأرقام إنجليزية (قرار المالك)
                .tint(Theme.brand)
                .preferredColorScheme(.light)
        }
    }
}

enum AppTab: Hashable {
    case home, categories, offers, cart, account
}

/// تبويبات النظام (Liquid Glass تلقائي في iOS 26). كل تبويب له مسار تنقل خاص يتذكره
struct RootView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(OrderCenter.self) private var orders
    @Environment(\.scenePhase) private var scenePhase
    @State private var previewAddress = false
    @State private var previewPlaced: SavedOrder?
    @State private var previewDetails: SavedOrder?
    @State private var tab: AppTab = .home
    @State private var homePath = NavigationPath()
    @State private var categoriesPath = NavigationPath()
    @State private var offersPath = NavigationPath()
    @State private var cartPath = NavigationPath()
    @State private var accountPath = NavigationPath()
    @Namespace private var zoom

    var body: some View {
        TabView(selection: $tab) {
            TabStack(path: $homePath) { HomeView(tab: $tab, path: $homePath) }
                .tabItem { Label("الرئيسية", systemImage: "house.fill") }
                .tag(AppTab.home)
            TabStack(path: $categoriesPath) { CategoriesView(path: $categoriesPath) }
                .tabItem { Label("الأقسام", systemImage: "square.grid.2x2.fill") }
                .tag(AppTab.categories)
            TabStack(path: $offersPath) { OffersView() }
                .tabItem { Label("العروض", systemImage: "tag.fill") }
                .tag(AppTab.offers)
            TabStack(path: $cartPath) { CartView(tab: $tab) }
                .tabItem { Label("السلة", systemImage: "bag.fill") }
                .badge(cart.count)
                .tag(AppTab.cart)
            TabStack(path: $accountPath) { AccountView(tab: $tab) }
                .tabItem { Label("حسابي", systemImage: "person.fill") }
                .tag(AppTab.account)
        }
        .modifier(TabBarMinimize())
        .environment(\.zoomNamespace, zoom)
        .task {
            await catalog.load()
            applyLaunchArguments()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task {
                    await catalog.refreshStock()
                    await orders.refresh(catalog: catalog)
                }
            }
        }
        .task(id: orders.current?.no) {
            // نتابع الطلب الشغّال: كل ١٠ ثواني وهو في الطريق، وإلا كل ٢٠
            while !Task.isCancelled, orders.current != nil {
                await orders.refresh(catalog: catalog)
                try? await Task.sleep(for: .seconds(orders.current?.status == "onway" ? 10 : 20))
            }
        }
        .sheet(isPresented: $previewAddress) { AddressView() }
        .sheet(item: $previewDetails) { OrderDetailView(order: $0) }
        .fullScreenCover(item: $previewPlaced) { order in
            OrderPlacedView(order: order, onTrack: { previewPlaced = nil }, onShop: { previewPlaced = nil })
        }
    }

    /// للتصوير الآلي على المحاكي (Codemagic): -screen home|categories|category:<id>|product:<id>|cart|offers|account|address|placed و -seed-cart و -seed-order
    private func applyLaunchArguments() {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-seed-cart"), cart.isEmpty, let index = catalog.index {
            for (i, p) in index.featured.prefix(4).enumerated() { cart.set(p.id, i == 0 ? 2 : 1) }
        }
        if args.contains("-seed-driver"), let first = orders.orders.first {
            orders.seedPreview(first, driver: DriverInfo(lat: 24.8418, lng: 46.8102, eta: 8, before: 1, near: false))
        }
        if args.contains("-seed-order"), orders.orders.isEmpty, let index = catalog.index {
            let picks = index.featured.prefix(5)
            var o = SavedOrder(no: "#1042", total: 46.85, phone: "0550000000", pay: "cash", at: Date(),
                               status: "onway", items: Dictionary(uniqueKeysWithValues: picks.map { ($0.id, 1) }),
                               keys: picks.map(\.id))
            o.lines = picks.map { SavedLine(key: $0.id, name: $0.name, unit: $0.unit, qty: 1, price: $0.price, old: $0.old) }
            o.subtotal = picks.reduce(0) { $0 + $1.price }; o.fee = 0; o.savings = 3.5
            o.details = "فيلا ١٢، الباب الأخضر"; o.sub = "swap"; o.lat = 24.8452; o.lng = 46.8148
            orders.seedPreview(o, driver: DriverInfo(lat: 24.8418, lng: 46.8102, eta: 8, before: 1, near: false))
        }
        guard let i = args.firstIndex(of: "-screen"), i + 1 < args.count else { return }
        let value = args[i + 1]
        if value == "categories" { tab = .categories }
        else if value == "offers" { tab = .offers }
        else if value == "cart" { tab = .cart }
        else if value == "account" { tab = .account }
        else if value == "address" { tab = .cart; previewAddress = true }
        else if value == "placed" { tab = .cart; previewPlaced = orders.orders.first }
        else if value == "orderdetails" { tab = .account; previewDetails = orders.orders.first }
        else if value.hasPrefix("category:") { tab = .categories; categoriesPath.append(Route.category(String(value.dropFirst(9)))) }
        else if value.hasPrefix("product:") {
            let id = String(value.dropFirst(8))
            tab = .home
            homePath.append(Route.product(id == "first" ? (catalog.index?.featured.first?.id ?? "") : id))
        }
    }
}

private struct TabBarMinimize: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}

/// NavigationStack لكل تبويب مع وجهات موحّدة
struct TabStack<Root: View>: View {
    @Binding var path: NavigationPath
    @ViewBuilder var root: () -> Root

    var body: some View {
        NavigationStack(path: $path) {
            root()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .category(let id): CategoryView(categoryID: id)
                    case .product(let id): ProductView(productID: id)
                    case .search: SearchView()
                    case .offers: OffersView()
                    }
                }
        }
    }
}
