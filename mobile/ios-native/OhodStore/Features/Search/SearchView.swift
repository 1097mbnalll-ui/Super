import SwiftUI

/// البحث: يتجاهل الهمزات والتشكيل، كل كلمة لازم تنوجد، ويقبل الباركود
struct SearchView: View {
    @Environment(CatalogStore.self) private var catalog
    @State private var query = ""
    @State private var results: [Product] = []
    @State private var presented = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if query.trimmingCharacters(in: .whitespaces).isEmpty {
                    SectionHeader(title: "تصفّح الأقسام").padding(.top, 12).padding(.bottom, 10)
                    FlowChips()
                        .padding(.horizontal, 16)
                } else if results.isEmpty {
                    ContentUnavailableView.search(text: query)
                        .padding(.top, 40)
                } else {
                    Text("\(results.count) نتيجة")
                        .font(.ui(size: 13)).foregroundStyle(Theme.muted)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                    ProductGrid(products: results, showCategory: true)
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.immediately)
        .background(Color.white)
        .navigationTitle("البحث")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, isPresented: $presented, placement: .navigationBarDrawer(displayMode: .always), prompt: "اسم المنتج أو الباركود")
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(150))
            guard !Task.isCancelled else { return }
            results = catalog.search(query)
        }
    }
}

private struct FlowChips: View {
    @Environment(CatalogStore.self) private var catalog
    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 140), spacing: 8, alignment: .leading)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(catalog.categories.filter { !$0.soon }) { c in
                NavigationLink(value: Route.category(c.id)) {
                    Chip(title: "\(c.emoji) \(c.name)")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(PressableStyle())
            }
        }
    }
}

/// كل المنتجات اللي عليها عرض أو خيار شراء أوفر
struct OffersView: View {
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let index = catalog.index {
                    if index.offers.isEmpty {
                        ContentUnavailableView("ما فيه عروض الحين", systemImage: "tag",
                                               description: Text("ارجع لنا قريب، العروض تتجدد."))
                            .padding(.top, 60)
                    } else {
                        Text("\(index.offers.count) عرض")
                            .font(.ui(size: 13)).foregroundStyle(Theme.muted)
                            .padding(.horizontal, 16).padding(.vertical, 10)
                        ProductGrid(products: index.offers, showCategory: true)
                    }
                } else {
                    LoadingGrid().padding(.top, 16)
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Color.white)
        .navigationTitle("العروض")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await catalog.refresh() }
    }
}
