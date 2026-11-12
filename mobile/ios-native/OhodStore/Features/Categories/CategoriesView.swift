import SwiftUI

/// الأقسام مجمّعة بعناوين (design/mix-02-categories.webp)
struct CategoriesView: View {
    @Binding var path: NavigationPath
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.dynamicTypeSize) private var typeSize

    private static let groups: [(emoji: String, title: String, ids: [String])] = [
        ("🍞", "الطازج والمخبز", ["bakery", "dairy", "cheese", "veg", "meat"]),
        ("🧺", "المقاضي والمشروبات", ["pantry", "drinks", "cartons", "sweets", "roast"]),
        ("🧴", "البيت والعناية", ["clean", "care", "misc", "print"]),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Button { path.append(Route.search) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").font(.ui(size: 17, weight: .medium))
                        Text("ابحث في كل الأقسام").font(.ui(size: 15))
                        Spacer()
                    }
                    .foregroundStyle(Theme.muted)
                    .padding(.horizontal, 16)
                    .frame(height: 48)
                    .background(.white, in: Capsule())
                    .overlay(Capsule().strokeBorder(Color(hex: 0xD9DEE4), lineWidth: 1.3))
                }
                .buttonStyle(PressableStyle(scale: 0.98))
                .padding(.horizontal, 16)
                .padding(.top, 8)

                if catalog.index == nil {
                    LoadingGrid().padding(.top, 20)
                }
                ForEach(sections) { section in
                    SectionHeader(title: section.title, emoji: section.emoji)
                        .padding(.top, 24).padding(.bottom, 12)
                    let columns = Array(repeating: GridItem(.flexible(), spacing: 10, alignment: .top),
                                        count: typeSize >= .accessibility1 ? 3 : 4)
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(section.categories) { c in
                            Button { path.append(Route.category(c.id)) } label: { CategoryTile(category: c) }
                                .buttonStyle(PressableStyle())
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(alignment: .top) { Theme.softGradient.frame(height: 220).ignoresSafeArea(edges: .top) }
        .navigationTitle("الأقسام")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var sections: [CategorySection] {
        let all = catalog.categories
        guard !all.isEmpty else { return [] }
        var used = Set<String>()
        var result: [CategorySection] = []
        for g in Self.groups {
            let cats = g.ids.compactMap { id in all.first { $0.id == id } }
            used.formUnion(cats.map(\.id))
            if !cats.isEmpty { result.append(CategorySection(emoji: g.emoji, title: g.title, categories: cats)) }
        }
        let rest = all.filter { !used.contains($0.id) }
        if !rest.isEmpty {
            if result.isEmpty { result.append(CategorySection(emoji: "🛒", title: "كل الأقسام", categories: rest)) }
            else { result[result.count - 1].categories += rest }
        }
        return result
    }
}

struct CategorySection: Identifiable {
    let emoji: String
    let title: String
    var categories: [Category]
    var id: String { title }
}

struct CategoryTile: View {
    let category: Category
    @Environment(CatalogStore.self) private var catalog
    /// صورة القسم، وإلا صورة أول منتج متوفر فيه (catPhoto في الموقع)
    private var picture: URL? {
        AppConfig.asset(category.image) ?? catalog.products(in: category.id).first { $0.hasPhoto && catalog.isAvailable($0) }?.imageURL
    }
    var body: some View {
        VStack(spacing: 7) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.tileGradient)
                RemoteImage(url: picture, maxPixel: 260, contentMode: category.image == nil ? .fit : .fill, blendWhite: category.image == nil)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(6)
                    .padding(.top, 4)
                if category.soon {
                    Text("قريباً")
                        .font(.kufi(10, .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Theme.copper, in: Capsule())
                        .padding(5)
                }
            }
            .aspectRatio(1, contentMode: .fit)
            Text(tv: category.name)
                .font(.ui(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2, reservesSpace: true)
        }
        .accessibilityElement(children: .combine)
    }
}

/// منتجات قسم واحد + أقسامه الفرعية
struct CategoryView: View {
    let categoryID: String
    @Environment(CatalogStore.self) private var catalog
    @State private var sub: String? = nil

    var body: some View {
        let category = catalog.category(categoryID)
        let all = catalog.products(in: categoryID)
        // نفس الموقع: عدد كل فرعي، والفرعي الفاضي ينخفي، و«أخرى» للمنتجات اللي فرعها مو معروف
        let subs = category?.subs ?? []
        let known = Set(subs.map(\.id))
        let counts = Dictionary(grouping: all, by: { p -> String in p.sub.flatMap { known.contains($0) ? $0 : nil } ?? "_other" }).mapValues(\.count)
        let products = sub.map { s in s == "_other" ? all.filter { $0.sub.map { !known.contains($0) } ?? true } : all.filter { $0.sub == s } } ?? all
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let category, category.soon {
                    ContentUnavailableView("قريباً", systemImage: "clock",
                                           description: Text("نجهّز قسم \(category.name)، ويوصلك قريب إن شاء الله."))
                        .padding(.top, 60)
                } else if categoryID == "print", catalog.product("print_bw")?.isPrint == true, catalog.product("print_color")?.isPrint == true {
                    PrintCalculator()
                } else {
                    if !subs.isEmpty {
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                Button { select(nil) } label: { Chip(title: "الكل (\(all.count))", selected: sub == nil) }
                                ForEach(subs.filter { (counts[$0.id] ?? 0) > 0 }) { s in
                                    Button { select(s.id) } label: { Chip(title: "\(s.name) (\(counts[s.id] ?? 0))", selected: sub == s.id) }
                                }
                                if let n = counts["_other"], n > 0, n < all.count {
                                    Button { select("_other") } label: { Chip(title: "أخرى (\(n))", selected: sub == "_other") }
                                }
                            }
                            .buttonStyle(PressableStyle())
                            .padding(.horizontal, 16)
                        }
                        .scrollIndicators(.hidden)
                        .padding(.top, 8)
                    }
                    Text("\(products.count) منتج")
                        .font(.ui(size: 13))
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 16)
                        .padding(.top, 12).padding(.bottom, 10)
                    ProductGrid(products: products)
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Theme.pageBG)
        .navigationTitle(tr(category?.name ?? ""))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func select(_ id: String?) {
        guard sub != id else { return }
        Haptics.selected()
        withAnimation(.snappy) { sub = id }
    }
}
