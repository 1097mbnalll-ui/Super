import SwiftUI

/// البحث: يتجاهل الهمزات والتشكيل، كل كلمة لازم تنوجد، ويقبل الباركود
struct SearchView: View {
    @Environment(CatalogStore.self) private var catalog
    @State private var query = ""
    @State private var results: [Product] = []
    @State private var presented = true
    @AppStorage("search.recent") private var recentRaw = ""
    private var recent: [String] { recentRaw.split(separator: "\n").map(String.init) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if query.trimmingCharacters(in: .whitespaces).isEmpty {
                    if !recent.isEmpty {
                        HStack {
                            Text("عمليات البحث الأخيرة").font(.kufi(15, .bold))
                            Spacer()
                            Button("مسح الكل") { recentRaw = "" }.font(.ui(size: 13, weight: .semibold))
                        }
                        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
                        WrapChips(items: recent) { query = $0 }.padding(.horizontal, 16)
                    }
                    let sugg = Array((catalog.index?.featured ?? []).filter { catalog.isAvailable($0) }.prefix(8).map(\.name))
                    if !sugg.isEmpty {
                        Text("مقترحات ذكية").font(.kufi(15, .bold)).padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 8)
                        WrapChips(items: sugg, icon: "magnifyingglass") { query = $0 }.padding(.horizontal, 16)
                    }
                    SectionHeader(title: "تصفّح الأقسام").padding(.top, 12).padding(.bottom, 10)
                    FlowChips()
                        .padding(.horizontal, 16)
                } else if results.isEmpty {
                    ContentUnavailableView {
                        Label("ما لقينا «\(query)»", systemImage: "magnifyingglass")
                    } description: {
                        Text("اتصل علينا على \(catalog.store.phone) ونجيبه لك")
                    }
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
        .background(Theme.pageBG)
        .navigationTitle("البحث")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, isPresented: $presented, placement: .navigationBarDrawer(displayMode: .always), prompt: "اسم المنتج أو الباركود")
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(150))
            guard !Task.isCancelled else { return }
            results = catalog.search(query)
            // بعد ما يوقف الكتابة ثانية ونص: نسجّل البحث للتحليل (بدون بيانات شخصية)
            try? await Task.sleep(for: .milliseconds(1350))
            guard !Task.isCancelled else { return }
            Analytics.shared.search(query, found: results.count)
            // نحفظه في «الأخيرة» (٨ بالأكثر) مثل الموقع
            let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
            if q.count > 1 { recentRaw = ([q] + recent.filter { $0 != q }).prefix(8).joined(separator: "\n") }
        }
    }
}

/// شرائح نصية تلتف على أكثر من سطر
private struct WrapChips: View {
    let items: [String]
    var icon: String? = nil
    let tap: (String) -> Void
    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 110), spacing: 8, alignment: .leading)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { t in
                Button { tap(t) } label: {
                    Label { Text(tv: t).lineLimit(1) } icon: { Image(systemName: icon ?? "clock.arrow.circlepath") }
                        .font(.ui(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                        .padding(.horizontal, 10).padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line))
                }
                .buttonStyle(PressableStyle())
            }
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
        .background(Theme.pageBG)
        .navigationTitle("العروض")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await catalog.refresh() }
    }
}
