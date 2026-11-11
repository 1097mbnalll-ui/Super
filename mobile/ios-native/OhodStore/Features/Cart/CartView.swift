import SwiftUI

/// السلة (design/mix-06-cart.webp). إرسال الطلب (العنوان والخريطة) في المرحلة ٢
struct CartView: View {
    @Binding var tab: AppTab
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @State private var confirmClear = false
    @State private var showCheckoutSoon = false

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
                        DeliveryCard(eta: catalog.store.eta, area: catalog.store.area)
                        if totals.freeOver > 0 {
                            FreeDeliveryBar(remaining: totals.freeRemaining, progress: totals.freeProgress)
                        }
                        if catalog.store.closed {
                            ClosedNotice(message: catalog.store.closedMessage)
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
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.copperInk)
                            .padding(14)
                            .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }

                        SubstitutionPicker()

                        SummaryCard(totals: totals)
                    }
                    .padding(16)
                    .padding(.bottom, 8)
                }
                .scrollIndicators(.hidden)
                .background(Color.white)
                .safeAreaInset(edge: .bottom) {
                    CheckoutBar(totals: totals) { showCheckoutSoon = true }
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
        .alert("قريب جداً", isPresented: $showCheckoutSoon) {
            Button("تمام", role: .cancel) {}
        } message: {
            Text("تحديد العنوان على الخريطة وإرسال الطلب ينضافون في التحديث الجاي من التطبيق. تقدر الحين تجهّز سلتك.")
        }
    }
}

private struct DeliveryCard: View {
    let eta: String
    let area: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.brandDeep)
                .frame(width: 40, height: 40)
                .background(Theme.mint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text("التوصيل إلى \(area)").font(.system(size: 15, weight: .semibold))
                Text("تحدد بيتك على الخريطة وقت الطلب").font(.system(size: 13)).foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 4)
            Label(eta, systemImage: "bolt")
                .font(.kufi(11.5, .semibold))
                .foregroundStyle(Theme.oliveInk)
                .lineLimit(1)
        }
        .padding(12)
        .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))
    }
}

private struct FreeDeliveryBar: View {
    let remaining: Double
    let progress: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if remaining > 0 {
                (Text("🚚 باقي ") + Text(Money.sar(remaining)).font(.kufi(13, .bold)).foregroundColor(Theme.copperInk) + Text(" وتوصيلك مجاني"))
                    .font(.system(size: 14, weight: .semibold))
            } else {
                Text("🎉 توصيلك مجاني").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.brandDeep)
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
                Text(row.product.name).font(.system(size: 14)).foregroundStyle(Theme.ink).lineLimit(2)
                Text(row.unitLabel).font(.system(size: 12)).foregroundStyle(Theme.muted)
                if row.available {
                    PriceLabel(price: row.lineTotal, old: row.pack == nil && row.product.old != nil ? (row.product.old ?? 0) * Double(row.qty) : nil, size: 14)
                } else {
                    Text("نفد، ما ينحسب").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.copperInk)
                }
            }
            Spacer(minLength: 4)
            if row.available {
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
            if cart.substitution == "swap" {
                Text("نرسل لك البديل وتوافق عليه من جوالك قبل لا نضيفه.")
                    .font(.system(size: 12.5)).foregroundStyle(Theme.muted)
            }
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
                Label("أقل مبلغ للطلب \(Money.sar(totals.minOrder))، باقي لك \(Money.sar(short))", systemImage: "info.circle")
                    .font(.system(size: 13, weight: .semibold))
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
            Text(title).foregroundStyle(Theme.muted)
            Spacer()
            Text(value).fontWeight(.semibold).foregroundStyle(highlight ? Theme.brandDeep : Theme.ink)
        }
        .font(.system(size: 15))
    }
}

private struct CheckoutBar: View {
    let totals: CartTotals
    let action: () -> Void
    @Environment(Cart.self) private var cart

    var body: some View {
        @Bindable var cart = cart
        VStack(spacing: 8) {
            HStack {
                Text("المنتجات \(Money.plain(totals.subtotal)) + التوصيل \(Money.plain(totals.fee))")
                    .font(.system(size: 13)).foregroundStyle(Theme.muted)
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
                        Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold))
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .frame(minHeight: 44)
                }
            }
            Button(action: action) {
                HStack {
                    Text("أرسل الطلب")
                    Spacer()
                    Text(Money.sar(totals.total)).contentTransition(.numericText(value: totals.total))
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(totals.belowMinimum != nil || totals.count == 0)
            .opacity(totals.belowMinimum != nil ? 0.5 : 1)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(.bar)
    }
}
