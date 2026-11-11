import SwiftUI

/// «وصلنا طلبك!» (design/10-order-placed.webp). إذن الإشعارات ينطلب هنا لما تجهز إشعارات آبل (المرحلة ٣)
struct OrderPlacedView: View {
    let order: SavedOrder
    var onTrack: () -> Void
    var onShop: () -> Void
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 18) {
                    ZStack {
                        Circle().fill(Theme.brand.opacity(0.10)).frame(width: 150, height: 150)
                        Circle().fill(Theme.brand.opacity(0.16)).frame(width: 122, height: 122)
                        Circle().fill(Theme.brand).frame(width: 96, height: 96)
                        Image(systemName: "checkmark")
                            .font(.system(size: 40, weight: .bold))
                            .foregroundStyle(.white)
                            .symbolEffect(.bounce, value: appeared)
                    }
                    .scaleEffect(appeared ? 1 : 0.6)
                    .opacity(appeared ? 1 : 0)
                    .padding(.top, 36)

                    VStack(spacing: 6) {
                        Text("وصلنا طلبك! 🎉").font(.kufi(24, .bold, relativeTo: .title))
                        Text(verbatim: "طلب \(order.no) · بنبدأ نجهّزه الحين")
                            .font(.system(size: 15)).foregroundStyle(Theme.muted)
                    }

                    Label("يوصلك خلال \(catalog.store.eta)", systemImage: "bolt")
                        .font(.kufi(14, .semibold))
                        .foregroundStyle(Theme.oliveInk)
                        .padding(.horizontal, 18).frame(height: 42)
                        .overlay(Capsule().strokeBorder(Theme.olive, style: StrokeStyle(lineWidth: 1.3, dash: [5, 4])))

                    VStack(spacing: 12) {
                        row("الإجمالي") { Text(Money.sar(order.total)).font(.kufi(15, .bold)) }
                        row("الدفع") { Text(order.pay == "card" ? "💳 شبكة عند الاستلام" : "💵 كاش عند الاستلام").fontWeight(.semibold) }
                        row("التوصيل إلى") {
                            Text(orders.address?.details.isEmpty == false ? orders.address!.details : catalog.store.area)
                                .fontWeight(.semibold).lineLimit(1)
                        }
                    }
                    .font(.system(size: 15))
                    .padding(16)
                    .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))
                }
                .padding(.horizontal, 20)
            }
            .scrollBounceBehavior(.basedOnSize)

            VStack(spacing: 10) {
                Button(action: onTrack) { Text("تابع طلبك").frame(maxWidth: .infinity) }
                    .buttonStyle(PrimaryButtonStyle())
                Button(action: onShop) {
                    Text("رجوع للتسوّق")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line))
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle(scale: 0.98))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
        .background(LinearGradient(colors: [Theme.mint, .white], startPoint: .top, endPoint: .center).ignoresSafeArea())
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7).delay(0.1)) { appeared = true }
        }
    }

    private func row<V: View>(_ title: String, @ViewBuilder value: () -> V) -> some View {
        HStack {
            Text(title).foregroundStyle(Theme.muted)
            Spacer(minLength: 12)
            value().foregroundStyle(Theme.ink)
        }
    }
}

/// بطاقة الطلب الحالي في «حسابي» (design/11-account-with-order.webp)
struct CurrentOrderCard: View {
    let order: SavedOrder
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @State private var confirmCancel = false
    @State private var cancelling = false
    @State private var errorText: String?

    var body: some View {
        let step = OrderStatus.step(order.status)
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: "طلبك الحالي · \(order.no)").font(.system(size: 13)).foregroundStyle(Theme.muted)
                Text(OrderStatus.title(order.status)).font(.kufi(18, .bold, relativeTo: .title3))
                    .contentTransition(.opacity)
                Text(OrderStatus.detail(order.status)).font(.system(size: 13.5)).foregroundStyle(Theme.muted)
            }
            HStack(spacing: 6) {
                ForEach(1...4, id: \.self) { i in
                    Capsule()
                        .fill(i < step ? Theme.brand : i == step ? Theme.copper : Theme.line)
                        .frame(height: 6)
                }
            }
            .animation(.smooth, value: step)
            HStack(spacing: 8) {
                ForEach(order.keys.prefix(4), id: \.self) { key in
                    if let p = catalog.resolve(key)?.product {
                        RemoteImage(url: p.imageURL, maxPixel: 120)
                            .padding(4)
                            .frame(width: 44, height: 44)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                Spacer(minLength: 0)
                Text(Money.sar(order.total)).font(.kufi(15, .bold)).foregroundStyle(Theme.ink)
            }
            if orders.canCancel(order, policy: catalog.store.custCancel) {
                Button(role: .destructive) { confirmCancel = true } label: {
                    HStack(spacing: 6) {
                        if cancelling { ProgressView().controlSize(.small) }
                        Text("إلغاء الطلب")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.copperInk)
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(cancelling)
            }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: 0xF0D9C3)))
        .shadow(color: Theme.copper.opacity(0.10), radius: 12, y: 4)
        .confirmationDialog("تلغي طلب \(order.no)؟", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("إيه، ألغِ الطلب", role: .destructive) {
                cancelling = true
                Task {
                    errorText = await orders.cancel(order, catalog: catalog)
                    cancelling = false
                }
            }
            Button("لا، خلّه", role: .cancel) {}
        }
        .alert("ما انلغى الطلب", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("تمام", role: .cancel) {}
        } message: {
            Text(errorText ?? "")
        }
    }
}
