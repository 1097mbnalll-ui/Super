import SwiftUI

/// نافذة «عرض الرجعة» (نفس offerSheet في الموقع): سلتك محفوظة وعليها خصم / المنتج اللي عجبك صار أرخص لك / عجلة الهدايا.
struct ReturnOfferSheet: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(\.dismiss) private var dismiss
    let offer: OfferCenter.Offer
    var onCart: () -> Void
    @State private var angle: Double = 0
    @State private var spun = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                switch offer.src {
                case "cart": cartBody
                case "view": viewBody
                default: wheelBody
                }
                Text("⏳ باقي \(offer.hoursLeft) ساعة · لهالجوال بس")
                    .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                if offer.src != "wheel" || spun {
                    Button { go() } label: { Text(offer.src == "view" ? "أضفه للسلة" : offer.src == "cart" ? "كمّل طلبك" : "تسوّق الحين").frame(maxWidth: .infinity) }
                        .buttonStyle(PrimaryButtonStyle())
                }
            }
            .padding(20)
            .multilineTextAlignment(.center)
        }
        .onAppear { spun = offer.spun; if spun, let pi = offer.pi { angle = target(pi) } ; OfferCenter.shared.markSeen() }
    }

    private var cartBody: some View {
        VStack(spacing: 10) {
            Text("رجعت؟ سلتك محفوظة 🛒").font(.kufi(20, .bold))
            Text("وعليها خصم \(Money.plain(offer.value))٪ لك أنت بس" + (offer.cap > 0 ? " (لين \(Money.plain(offer.cap)) ر.س)" : ""))
                .font(.ui(size: 15, weight: .semibold)).foregroundStyle(Theme.copperInk)
            HStack(spacing: 8) {
                ForEach((offer.ids ?? []).prefix(5), id: \.self) { id in
                    RemoteImage(url: catalog.product(id)?.imageURL, maxPixel: 160)
                        .frame(width: 60, height: 60)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.line))
                }
            }
        }
    }

    @ViewBuilder private var viewBody: some View {
        let p = offer.need.flatMap { catalog.product($0) }
        VStack(spacing: 10) {
            Text("المنتج اللي عجبك صار أرخص لك 👀").font(.kufi(20, .bold))
            if let p {
                HStack(spacing: 12) {
                    RemoteImage(url: p.imageURL, maxPixel: 240).frame(width: 88, height: 88)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(tv: p.name).font(.ui(size: 15, weight: .semibold)).multilineTextAlignment(.leading)
                        HStack(spacing: 6) {
                            Text(Money.sar(offer.price ?? p.price)).strikethrough().foregroundStyle(Theme.muted).font(.ui(size: 13))
                            Text(Money.sar(offer.newPrice ?? (p.price - offer.value))).font(.ui(size: 19, weight: .bold)).foregroundStyle(Theme.copperInk)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(10).background(Theme.line.opacity(0.35), in: RoundedRectangle(cornerRadius: 16))
            }
            if let why = why { Text(why).font(.ui(size: 13.5, weight: .semibold)).foregroundStyle(Theme.copperInk) }
        }
    }

    private var why: String? {
        var w: [String] = []
        if let v = offer.views, v > 1 { w.append("شفته \(v) مرات") }
        if let a = offer.adds, a > 0 { w.append(a > 1 ? "أضفته للسلة \(a) مرات" : "أضفته للسلة قبل") }
        return w.isEmpty ? nil : w.joined(separator: " و") + "، فخصّصنا لك سعر أقل 💛"
    }

    // MARK: عجلة الهدايا (الجائزة من الخادم، والعجلة توقف عليها)
    private var prizes: [OfferCenter.Prize] { offer.prizes ?? [] }
    private func target(_ pi: Int) -> Double { let seg = 360.0 / Double(max(1, prizes.count)); return 360 * 6 - (Double(pi) + 0.5) * seg }

    private var wheelBody: some View {
        VStack(spacing: 12) {
            Text("عجلة الهدايا 🎁").font(.kufi(20, .bold))
            Text("لأنك تزورنا كثير، لفّ العجلة وخذ هديتك").font(.ui(size: 14)).foregroundStyle(Theme.muted)
            ZStack(alignment: .top) {
                wheel.rotationEffect(.degrees(angle)).frame(width: 250, height: 250)
                Image(systemName: "arrowtriangle.down.fill").font(.system(size: 26)).foregroundStyle(Color.red).offset(y: -12)
            }
            if spun {
                let z = OfferCenter.Prize(kind: offer.kind, value: offer.value, cap: offer.cap, min: offer.min)
                VStack(spacing: 4) {
                    Text("مبروك! \(OfferCenter.prizeText(z))").font(.kufi(18, .bold)).foregroundStyle(Theme.copperInk)
                    if offer.min > 0 || offer.cap > 0 {
                        Text([offer.kind == "percent" && offer.cap > 0 ? "لين \(Money.plain(offer.cap)) ر.س" : "", offer.min > 0 ? "على طلب \(Money.plain(offer.min)) ر.س وفوق" : ""].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                    }
                    Text("ينطبق تلقائي في السلة").font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                }
                .padding(12).frame(maxWidth: .infinity).background(Color(hex: 0xFFF4E5), in: RoundedRectangle(cornerRadius: 16))
            } else {
                Button { spin() } label: { Text("لفّ العجلة").frame(maxWidth: .infinity) }.buttonStyle(PrimaryButtonStyle())
            }
        }
    }

    private var wheel: some View {
        let n = max(1, prizes.count), seg = 360.0 / Double(n)
        let cols: [Color] = [Color(hex: 0xFFE3C7), Color(hex: 0xDDF1EA), Color(hex: 0xFFF4CC), Color(hex: 0xE9E4FF), Color(hex: 0xFFDDE6), Color(hex: 0xDDEBFF), Color(hex: 0xF1F5D7), Color(hex: 0xFCE7D6)]
        return GeometryReader { g in
            let r = min(g.size.width, g.size.height) / 2, c = CGPoint(x: g.size.width / 2, y: g.size.height / 2)
            ZStack {
                ForEach(0..<n, id: \.self) { i in
                    Path { p in
                        p.move(to: c)
                        p.addArc(center: c, radius: r, startAngle: .degrees(Double(i) * seg - 90), endAngle: .degrees(Double(i + 1) * seg - 90), clockwise: false)
                        p.closeSubpath()
                    }
                    .fill(cols[i % cols.count])
                    Text(i < prizes.count ? OfferCenter.prizeText(prizes[i]) : "")
                        .font(.ui(size: 12, weight: .bold)).foregroundStyle(Color(hex: 0x2B1300))
                        .frame(width: 80)
                        .position(x: c.x + r * 0.62 * cos((Double(i) + 0.5) * seg * .pi / 180 - .pi / 2),
                                  y: c.y + r * 0.62 * sin((Double(i) + 0.5) * seg * .pi / 180 - .pi / 2))
                }
                Circle().stroke(.white, lineWidth: 6)
                Circle().fill(.white).frame(width: r * 0.3, height: r * 0.3).shadow(radius: 2)
            }
        }
    }

    private func spin() {
        guard let pi = offer.pi else { spun = true; return }
        withAnimation(.timingCurve(0.17, 0.67, 0.12, 1, duration: 4.2)) { angle = target(pi) }
        Task {
            try? await Task.sleep(for: .seconds(4.3))
            spun = true
            OfferCenter.shared.markSpun()
            Haptics.added()
        }
    }

    private func go() {
        if offer.src == "view", let id = offer.need, let p = catalog.product(id), catalog.isAvailable(p) {
            if cart.line(id).qty == 0 { cart.set(id, 1) }
        } else if offer.src == "cart", cart.isEmpty {
            for id in offer.ids ?? [] { if let p = catalog.product(id), catalog.isAvailable(p) { cart.set(id, 1) } }
        }
        cart.promoCode = offer.code
        dismiss()
        onCart()
    }
}
