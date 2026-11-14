import SwiftUI

/// تقييم الطلب بعد التوصيل: نجوم ١–٥ + اختيارات سريعة + ملاحظة قصيرة (/rate). نفس الموقع (rateHTML):
/// تقييم واحد لكل طلب، ويتعدل خلال ٢٤ ساعة. يقرأ الطلب من OrderCenter برقمه عشان يتحدث لحاله
struct RateOrderCard: View {
    let orderNo: String
    /// «بعدين»: يقفل التذكير (يطلع بس قبل أول تقييم)
    var onSkip: (() -> Void)? = nil
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @State private var stars = 0
    @State private var tags: [String] = []
    @State private var note = ""
    @State private var editing = false
    @State private var busy = false
    @State private var errorText: String?
    @FocusState private var noteFocused: Bool

    private var order: SavedOrder? { orders.orders.first { $0.no == orderNo } }

    var body: some View {
        if let order, order.status == "delivered", order.rating != nil || order.canRate == true {
            VStack(spacing: 12) {
                if let r = order.rating, !editing { done(r, order: order) } else { form(order) }
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .background(.white, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.line))
            .shadow(color: .black.opacity(0.06), radius: 10, y: 4)
            .animation(.smooth, value: stars)
            .animation(.smooth, value: editing)
        }
    }

    // MARK: قبل التقييم (أو تعديله)

    @ViewBuilder private func form(_ order: SavedOrder) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("كيف كانت تجربتك مع طلبك؟").font(.kufi(16, .bold, relativeTo: .headline))
                Text(tv: "طلب \(order.no)").font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 8)
            if let onSkip, order.rating == nil {
                Button("بعدين", action: onSkip)
                    .font(.ui(size: 13, weight: .semibold)).foregroundStyle(Theme.muted)
            }
        }
        HStack(spacing: 6) {
            ForEach(1...5, id: \.self) { i in
                Button {
                    stars = i
                    let ok = RateTag.forStars(i).map(\.id)
                    tags = tags.filter { ok.contains($0) }
                    Haptics.selected()
                } label: {
                    Image(systemName: i <= stars ? "star.fill" : "star")
                        .font(.ui(size: 32, weight: .semibold))
                        .foregroundStyle(i <= stars ? Color(hex: 0xF5A524) : Color(hex: 0xC9CFD6))
                        .frame(width: 48, height: 48)
                        .contentShape(Rectangle())
                        .symbolEffect(.bounce, value: stars == i)
                }
                .buttonStyle(PressableStyle(scale: 0.85))
                .accessibilityLabel(tr("\(i) نجوم"))
                .accessibilityAddTraits(i == stars ? .isSelected : [])
            }
        }
        Text(tv: RateTag.word(stars)).font(.ui(size: 13)).foregroundStyle(Theme.muted)
        if stars > 0 {
            FlowChips(items: RateTag.forStars(stars).map { ($0.id, $0.title) }, selected: tags) { id in
                if let k = tags.firstIndex(of: id) { tags.remove(at: k) } else { tags.append(id) }
                Haptics.selected()
            }
            TextField(tr("ملاحظة قصيرة (اختياري)"), text: $note, axis: .vertical)
                .lineLimit(2...4)
                .font(.ui(size: 14))
                .focused($noteFocused)
                .padding(12)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .onChange(of: note) { _, v in if v.count > 300 { note = String(v.prefix(300)) } }
            HStack(spacing: 8) {
                Button { send(order) } label: {
                    HStack(spacing: 6) {
                        if busy { ProgressView().tint(.white) }
                        Text(tv: order.rating == nil ? "أرسل التقييم" : "احفظ التعديل")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy)
                if order.rating != nil {
                    Button { editing = false; errorText = nil } label: {
                        Text("رجوع")
                            .font(.ui(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                            .frame(minWidth: 80, minHeight: 54)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(PressableStyle(scale: 0.97))
                }
            }
        }
        if let errorText {
            Text(tv: errorText).font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
        }
    }

    // MARK: بعد التقييم

    @ViewBuilder private func done(_ r: OrderRating, order: SavedOrder) -> some View {
        Text(tv: r.stars <= 2 ? "آسفين على تجربتك" : "شكراً لتقييمك!").font(.kufi(16, .bold, relativeTo: .headline))
        HStack(spacing: 4) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: i <= r.stars ? "star.fill" : "star")
                    .font(.ui(size: 22, weight: .semibold))
                    .foregroundStyle(i <= r.stars ? Color(hex: 0xF5A524) : Color(hex: 0xC9CFD6))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(tr("\(r.stars) من ٥"))
        if !r.tags.isEmpty {
            Text(tv: r.tags.map { tr(RateTag.title($0)) }.filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.ui(size: 13)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
        }
        if !r.note.isEmpty {
            Text(tv: "«\(r.note)»").font(.ui(size: 13)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
        }
        if r.stars <= 2 {
            Text("وصلت ملاحظتك للمحل وبنهتم فيها. لو تبي تكلمنا اتصل على المحل.")
                .font(.ui(size: 12.5)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
        }
        if r.editable, order.canRate != false {
            Button {
                stars = r.stars; tags = r.tags; note = r.note; errorText = nil; editing = true
            } label: {
                Text("عدّل تقييمك")
                    .font(.ui(size: 14, weight: .semibold)).foregroundStyle(Theme.brandDeep)
                    .padding(.horizontal, 18).frame(minHeight: 40)
                    .background(Theme.mint, in: Capsule())
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            Text("تقدر تعدّله خلال ٢٤ ساعة من التقييم").font(.ui(size: 11.5)).foregroundStyle(Theme.muted)
        }
    }

    private func send(_ order: SavedOrder) {
        guard stars > 0, !busy else { return }
        busy = true; errorText = nil; noteFocused = false
        let ok = RateTag.forStars(stars).map(\.id)
        Task {
            errorText = await orders.rate(order, stars: stars, tags: tags.filter { ok.contains($0) }, note: note, catalog: catalog)
            busy = false
            if errorText == nil { editing = false }
        }
    }
}

/// اختيارات صغيرة تلتف لسطر ثاني (مثل kq-chip في الموقع)
private struct FlowChips: View {
    let items: [(String, String)]
    let selected: [String]
    let toggle: (String) -> Void

    var body: some View {
        WrapLayout(spacing: 6) {
            ForEach(items, id: \.0) { id, title in
                let on = selected.contains(id)
                Button { toggle(id) } label: {
                    Text(tv: title)
                        .font(.ui(size: 13, weight: .semibold))
                        .foregroundStyle(on ? Theme.brandDeep : Theme.ink)
                        .padding(.horizontal, 12).frame(minHeight: 36)
                        .background(on ? Theme.mint : .white, in: Capsule())
                        .overlay(Capsule().strokeBorder(on ? Theme.brand : Theme.line, lineWidth: on ? 1.5 : 1))
                }
                .buttonStyle(PressableStyle(scale: 0.95))
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

/// صفوف تلتف حسب العرض، وكل صف في الوسط
private struct WrapLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = makeRows(proposal.width ?? .infinity, subviews)
        let h = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: h)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in makeRows(bounds.width, subviews) {
            var x = bounds.midX - row.width / 2
            for i in row.items {
                let s = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: y + (row.height - s.height) / 2), proposal: ProposedViewSize(s))
                x += s.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var items: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }
    private func makeRows(_ maxW: CGFloat, _ subviews: Subviews) -> [Row] {
        var out: [Row] = [], cur = Row()
        for i in subviews.indices {
            let s = subviews[i].sizeThatFits(.unspecified)
            let w = cur.items.isEmpty ? s.width : cur.width + spacing + s.width
            if w > maxW, !cur.items.isEmpty { out.append(cur); cur = Row(items: [i], width: s.width, height: s.height) }
            else { cur.items.append(i); cur.width = w; cur.height = max(cur.height, s.height) }
        }
        if !cur.items.isEmpty { out.append(cur) }
        return out
    }
}
