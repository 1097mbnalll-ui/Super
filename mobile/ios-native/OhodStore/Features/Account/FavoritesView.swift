import SwiftUI

/// «المفضلة» من «حسابي» (favHTML في الموقع): المتوفر أول، والنافد رمادي بـ«نفد» آخر القائمة، وزر يضيف المتوفر للسلة
struct FavoritesView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(Favorites.self) private var favorites
    @Environment(\.liveTab) private var liveTab

    var body: some View {
        let all = favorites.ids.compactMap { catalog.product($0) }.filter { !$0.isPrint }
        let available = all.filter { catalog.isAvailable($0) }
        let out = all.filter { !catalog.isAvailable($0) }
        let missing = available.filter { cart.snapshot[$0.id] == nil && catalog.tap("add", $0) == nil }
        Group {
            if catalog.index == nil {
                ProgressView()
            } else if all.isEmpty {
                ContentUnavailableView {
                    Label("ما عندك منتجات مفضلة للحين", systemImage: "heart")
                } description: {
                    Text("اضغط القلب ♡ على أي منتج، ويصير هنا عشان تطلبه بسرعة.")
                } actions: {
                    Button("ابدأ التسوّق") { liveTab?.wrappedValue = .home }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            Text(tv: "\(all.count) منتج" + (out.isEmpty ? "" : " · \(out.count) نفد"))
                                .font(.ui(size: 13.5)).foregroundStyle(Theme.muted)
                            Spacer(minLength: 0)
                            if !missing.isEmpty {
                                Button { addAll(missing) } label: {
                                    Label("أضف المتوفر للسلة", systemImage: "cart.badge.plus")
                                        .font(.ui(size: 14, weight: .semibold))
                                        .foregroundStyle(Theme.brandDeep)
                                        .padding(.horizontal, 14).frame(minHeight: 40)
                                        .background(Theme.mint, in: Capsule())
                                }
                                .buttonStyle(PressableStyle(scale: 0.96))
                            }
                        }
                        .padding(.horizontal, 16)
                        ProductGrid(products: available + out, showCategory: true)
                    }
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageBG)
        .navigationTitle("المفضلة")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// حبة من كل منتج متوفر مو بالسلة (مثل «أضف المتوفر للسلة» في الموقع)
    private func addAll(_ list: [Product]) {
        for p in list { cart.increment(p.id, limit: cart.limit(for: p.id, in: catalog) ?? p.max) }
        Haptics.success()
    }
}
