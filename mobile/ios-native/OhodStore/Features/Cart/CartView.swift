import SwiftUI

/// السلة (design/mix-06-cart.webp) + إرسال الطلب
struct CartView: View {
    @Binding var tab: AppTab
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(OrderCenter.self) private var orders
    @Environment(WalletCenter.self) private var wallet
    @State private var confirmClear = false
    @State private var showAddress = false
    @State private var sendAfterAddress = false
    @State private var errorText: String?
    @State private var placed: SavedOrder?
    @State private var fixAddress = false
    @State private var offerWhatsApp = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        let totals = cart.totals(catalog)
        Group {
            if totals.rows.isEmpty {
                ContentUnavailableView {
                    Label("سلتك فاضية", systemImage: "bag")
                } description: {
                    Text("أضف اللي تحتاجه، ويوصلك خلال \(catalog.store.eta).")
                } actions: {
                    Button("ابدأ التسوّق") { tab = .home }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        DeliveryCard(eta: catalog.store.eta, area: catalog.store.area, address: orders.address) { sendAfterAddress = false; showAddress = true }
                        if totals.freeOver > 0 {
                            FreeDeliveryBar(remaining: totals.freeRemaining, progress: totals.freeProgress)
                        }
                        if catalog.store.isClosedNow {
                            ClosedNotice(message: catalog.store.closedNowMessage)
                        }
                        if !catalog.dealProducts.isEmpty {
                            NavigationLink(value: Route.deals) { DealLockBox(totals: totals) }
                                .buttonStyle(PressableStyle(scale: 0.98))
                        }
                        VStack(spacing: 0) {
                            ForEach(totals.rows) { row in
                                CartRowView(row: row)
                                if row.id != totals.rows.last?.id {
                                    Divider().padding(.leading, 0).padding(.trailing, 88)
                                }
                            }
                        }
                        .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))

                        if totals.savings > 0.009 {
                            HStack {
                                Label("وفّرت على هالطلب", systemImage: "percent")
                                Spacer()
                                Text(Money.sar(totals.savings)).font(.kufi(14, .bold))
                            }
                            .font(.ui(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.copperInk)
                            .padding(14)
                            .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }

                        SubstitutionPicker()

                        CheckoutWalletBox(total: totals.total)

                        SummaryCard(totals: totals)
                    }
                    .padding(16)
                    .padding(.bottom, 8)
                }
                .scrollIndicators(.hidden)
                .background(Theme.pageBG)
                .safeAreaInset(edge: .bottom) {
                    CheckoutBar(totals: totals, sending: orders.sending, closed: catalog.store.isClosedNow) { checkout() }
                }
            }
        }
        .navigationTitle(totals.count > 0 ? "السلة (\(totals.count))" : "السلة")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !totals.rows.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(role: .destructive) { confirmClear = true } label: {
                        Label("حذف الكل", systemImage: "trash")
                    }
                }
            }
        }
        .confirmationDialog("تحذف كل المنتجات من السلة؟", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("حذف الكل", role: .destructive) { withAnimation(.snappy) { cart.clear() } }
            Button("إلغاء", role: .cancel) {}
        }
        .sheet(isPresented: $showAddress) {
            AddressView(confirmTitle: sendAfterAddress ? "احفظ وأرسل الطلب" : "احفظ العنوان") {
                if sendAfterAddress { sendAfterAddress = false; send() }
            }
            .interactiveDismissDisabled(orders.sending)
        }
        .alert("ما انرسل الطلب", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            if fixAddress {
                Button("عدّل العنوان") { fixAddress = false; sendAfterAddress = true; showAddress = true }
                Button("إلغاء", role: .cancel) { fixAddress = false }
            } else if offerWhatsApp, !waDigits.isEmpty {
                Button("أرسل الطلب على واتساب بدلها") {
                    offerWhatsApp = false
                    var c = URLComponents(string: "https://wa.me/\(waDigits)")!
                    c.queryItems = [URLQueryItem(name: "text", value: orders.whatsappText(cart: cart, catalog: catalog))]
                    if let u = c.url { openURL(u) }
                }
                Button("تمام", role: .cancel) { offerWhatsApp = false }
            } else {
                Button("تمام", role: .cancel) {}
            }
        } message: {
            Text(tv: errorText ?? "")
        }
        .fullScreenCover(item: $placed) { order in
            OrderPlacedView(order: order,
                            onTrack: { placed = nil; tab = .account },
                            onShop: { placed = nil; tab = .home })
        }
    }

    private var waDigits: String { CatalogParser.latinDigits(catalog.store.whatsapp).filter(\.isNumber) }

    private func checkout() {
        Analytics.shared.checkoutStarted()
        if orders.address == nil || OrderCenter.normalizedPhone(orders.phone) == nil {
            sendAfterAddress = true
            showAddress = true
            return
        }
        send()
    }

    private func send() {
        Task {
            switch await orders.place(cart: cart, catalog: catalog, wallet: wallet) {
            case .success(let order):
                placed = order
            case .failure(.address(let msg)), .failure(.phone(let msg)):
                fixAddress = true
                errorText = msg
            case .failure(.message(let msg)):
                errorText = msg
            case .failure(.whatsapp(let msg)):
                offerWhatsApp = true
                errorText = msg
            }
        }
    }
}

private struct DeliveryCard: View {
    let eta: String
    let area: String
    let address: DeliveryAddress?
    let action: () -> Void
    var body: some View {
        Button(action: action) {
        HStack(spacing: 12) {
            Image(systemName: "mappin.and.ellipse")
                .font(.ui(size: 18, weight: .semibold))
                .foregroundStyle(Theme.brandDeep)
                .frame(width: 40, height: 40)
                .background(Theme.mint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(address == nil ? "التوصيل إلى \(area)" : "التوصيل إلى البيت")
                    .font(.ui(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(address.map { $0.details.isEmpty ? "على الموقع المحدد في الخريطة" : $0.details } ?? "حدد بيتك على الخريطة")
                    .font(.ui(size: 13)).foregroundStyle(address == nil ? Theme.copperInk : Theme.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 4) {
                Label(eta, systemImage: "bolt")
                    .font(.kufi(11.5, .semibold))
                    .foregroundStyle(Theme.oliveInk)
                    .lineLimit(1)
                Text(address == nil ? "حدّد" : "غيّر")
                    .font(.ui(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.brandDeep)
            }
        }
        .padding(12)
        .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))
        .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle(scale: 0.98))
        .accessibilityHint("يفتح الخريطة لتحديد عنوان التوصيل")
    }
}

private struct FreeDeliveryBar: View {
    let remaining: Double
    let progress: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if remaining > 0 {
                (Text("🚚 باقي ") + Text(Money.sar(remaining)).font(.kufi(13, .bold)).foregroundColor(Theme.copperInk) + Text(" وتوصيلك مجاني"))
                    .font(.ui(size: 14, weight: .semibold))
            } else {
                Text("🎉 توصيلك مجاني").font(.ui(size: 14, weight: .semibold)).foregroundStyle(Theme.brandDeep)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(hex: 0xF3DCC6))
                    Capsule().fill(remaining > 0 ? Theme.copper : Theme.brand)
                        .frame(width: max(8, geo.size.width * progress))
                }
            }
            .frame(height: 6)
            .animation(.smooth, value: progress)
        }
        .padding(14)
        .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Color(hex: 0xE8B07E), style: StrokeStyle(lineWidth: 1.2, dash: [5, 4])))
        .accessibilityElement(children: .combine)
    }
}

private struct CartRowView: View {
    let row: CartRow
    @Environment(Cart.self) private var cart
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        HStack(spacing: 12) {
            RemoteImage(url: row.product.imageURL, maxPixel: 200)
                .padding(6)
                .frame(width: 62, height: 62)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(row.product.name).font(.ui(size: 14)).foregroundStyle(Theme.ink).lineLimit(2)
                Text(row.unitLabel).font(.ui(size: 12)).foregroundStyle(Theme.muted)
                if let tag = promoTag {
                    Text(tv: tag).font(.ui(size: 11.5, weight: .bold))
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .foregroundStyle(row.locked ? Theme.copperInk : Theme.brandDeep)
                        .background(row.locked ? Theme.copperSoft : Theme.mint, in: Capsule())
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                if row.available {
                    if let o = row.offer {
                        Group {
                            if row.bundles > 0 {
                                Text("✓ عرض \(o.count) بـ \(Money.plain(o.price)) انطبق")
                                    .padding(.horizontal, 7).padding(.vertical, 2).foregroundStyle(Theme.brandDeep).background(Theme.mint, in: Capsule())
                            } else if let miss = row.missingForOffer {
                                Text("زود \(miss) وتحصل على عرض \(o.count) بـ \(Money.plain(o.price))")
                                    .padding(.horizontal, 7).padding(.vertical, 2).foregroundStyle(Theme.copperInk).background(Theme.copperSoft, in: Capsule())
                            }
                        }
                        .font(.ui(size: 11.5, weight: .bold))
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .padding(.vertical, 1)
                    }
                    PriceLabel(price: row.lineTotal,
                               old: row.promo != nil ? row.product.price * Double(row.qty)
                                   : row.offerSaving > 0.009 ? row.regularTotal : (row.pack == nil && row.product.old != nil ? (row.product.old ?? 0) * Double(row.qty) : nil),
                               size: 14)
                        .opacity(row.locked ? 0.45 : 1)
                } else {
                    Text("نفد، ما ينحسب").font(.ui(size: 12, weight: .semibold)).foregroundStyle(Theme.copperInk)
                }
            }
            Spacer(minLength: 4)
            if row.available, row.promo == .bundle, let bid = row.bannerID {
                // الباقة تزيد وتنقص كاملة
                let n = cart.bundleCount(bid, catalog: catalog)
                StepperCapsule(qty: n, compact: true,
                               onPlus: { withAnimation(.snappy) { _ = cart.setBundle(bid, n + 1, catalog: catalog) } },
                               onMinus: { withAnimation(.snappy) { _ = cart.setBundle(bid, n - 1, catalog: catalog) } })
            } else if row.available {
                let cap = cart.limit(for: row.key, in: catalog) ?? row.product.max
                StepperCapsule(qty: row.qty, atLimit: cap.map { row.qty >= $0 } ?? false, compact: true,
                               onPlus: { withAnimation(.snappy) { cart.increment(row.key, limit: cap) } },
                               onMinus: { withAnimation(.snappy) { cart.decrement(row.key) } })
            } else {
                Button { withAnimation(.snappy) { cart.set(row.key, 0) } } label: {
                    Image(systemName: "trash").frame(width: 44, height: 44)
                }
                .foregroundStyle(Theme.muted)
                .accessibilityLabel("شيل")
            }
        }
        .padding(12)
    }
}

extension CartRowView {
    var promoTag: String? {
        switch row.promo {
        case .deal: return row.locked ? "🔒 مقفول: يفتح لطلبك فوق \(Money.plain(catalog.store.deal95.min)) ر.س" : "🔓 عرض \(Money.plain(catalog.store.deal95.price)) ر.س"
        case .daily: return "🔥 عرض اليوم"
        case .bundle: return "🎁 ضمن باقة \(row.bannerID.flatMap { catalog.banner($0)?.title.replacingOccurrences(of: "\n", with: " ") } ?? "")"
        default: return nil
        }
    }
}

/// اختيار واحد عام فوق السلة (دراسة Baymard: البدائل لكل منتج تلخبط ٧٦٪)
private struct SubstitutionPicker: View {
    @Environment(Cart.self) private var cart
    var body: some View {
        @Bindable var cart = cart
        VStack(alignment: .leading, spacing: 8) {
            Text("لو منتج ناقص وقت التجهيز").font(.kufi(14, .bold))
            Picker("لو منتج ناقص", selection: $cart.substitution) {
                Text("بدّلوه بمشابه").tag("swap")
                Text("شيلوه").tag("remove")
                Text("اتصلوا علي").tag("call")
            }
            .pickerStyle(.segmented)
            .onChange(of: cart.substitution) { _, _ in Haptics.selected() }
            Text(cart.substitution == "swap" ? "المندوب يبدّله بمنتج مشابه."
                 : cart.substitution == "remove" ? "ينشال من طلبك وما تدفع قيمته."
                 : "نتصل عليك، ولو اقترح المندوب بديل توافق عليه من جوالك.")
                .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
            TextField("ملاحظات (اختياري): مثلاً الخبز يكون حار", text: $cart.note, axis: .vertical)
                .lineLimit(1...3)
                .font(.ui(size: 14))
                .padding(10)
                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line))
                .padding(.top, 4)
        }
    }
}

private struct SummaryCard: View {
    let totals: CartTotals
    var body: some View {
        VStack(spacing: 10) {
            row("المنتجات", Money.sar(totals.subtotal))
            row("التوصيل", totals.fee == 0 ? "مجاني" : Money.sar(totals.fee), highlight: totals.fee == 0)
            Divider()
            HStack {
                Text("الإجمالي").font(.kufi(15, .bold))
                Spacer()
                Text(Money.sar(totals.total)).font(.kufi(17, .bold))
                    .contentTransition(.numericText(value: totals.total))
            }
            if let short = totals.belowMinimum {
                Label("أقل مبلغ للطلب \(Money.short(totals.minOrder))، باقي لك \(Money.sar(short))", systemImage: "info.circle")
                    .font(.ui(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.copperInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))
        .animation(.snappy, value: totals.total)
    }

    private func row(_ title: String, _ value: String, highlight: Bool = false) -> some View {
        HStack {
            Text(tv: title).foregroundStyle(Theme.muted)
            Spacer()
            Text(tv: value).fontWeight(.semibold).foregroundStyle(highlight ? Theme.brandDeep : Theme.ink)
        }
        .font(.ui(size: 15))
    }
}

private struct CheckoutBar: View {
    let totals: CartTotals
    let sending: Bool
    let closed: Bool
    let action: () -> Void
    @Environment(Cart.self) private var cart

    var body: some View {
        @Bindable var cart = cart
        VStack(spacing: 8) {
            HStack {
                Text(tv: totals.fee == 0 ? "المنتجات \(Money.plain(totals.subtotal)) + توصيل مجاني"
                          : "المنتجات \(Money.plain(totals.subtotal)) + التوصيل \(Money.plain(totals.fee))")
                    .font(.ui(size: 13)).foregroundStyle(Theme.muted)
                Spacer()
                Menu {
                    Picker("الدفع", selection: $cart.payment) {
                        Label("كاش عند الاستلام", systemImage: "banknote").tag("cash")
                        Label("شبكة عند الاستلام", systemImage: "creditcard").tag("card")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: cart.payment == "card" ? "creditcard" : "banknote")
                        Text(cart.payment == "card" ? "شبكة عند الاستلام" : "كاش عند الاستلام")
                        Image(systemName: "chevron.down").font(.ui(size: 10, weight: .bold))
                    }
                    .font(.ui(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .frame(minHeight: 44)
                }
            }
            Button(action: action) {
                HStack {
                    if sending {
                        ProgressView().tint(.white)
                        Text("جاري الإرسال…")
                    } else {
                        Text(closed ? "المحل مقفل الحين" : "أرسل الطلب")
                    }
                    Spacer()
                    Text(Money.sar(totals.total)).contentTransition(.numericText(value: totals.total))
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(blocked || sending)
            .opacity(blocked ? 0.5 : 1)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(.bar)
    }

    private var blocked: Bool { totals.belowMinimum != nil || totals.count == 0 || closed }
}
