import SwiftUI
import MapKit

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
                            .font(.ui(size: 40, weight: .bold))
                            .foregroundStyle(.white)
                            .symbolEffect(.bounce, value: appeared)
                    }
                    .scaleEffect(appeared ? 1 : 0.6)
                    .opacity(appeared ? 1 : 0)
                    .padding(.top, 36)

                    VStack(spacing: 6) {
                        Text("وصلنا طلبك! 🎉").font(.kufi(24, .bold, relativeTo: .title))
                        Text(verbatim: "طلب \(order.no) · بنبدأ نجهّزه الحين")
                            .font(.ui(size: 15)).foregroundStyle(Theme.muted)
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
                    .font(.ui(size: 15))
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
                        .font(.ui(size: 16, weight: .semibold))
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

/// بطاقة الطلب الحالي في «حسابي»: خريطة المندوب والدقايق، المراحل، الأغراض مصغرة والإجمالي
struct CurrentOrderCard: View {
    let order: SavedOrder
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @Environment(\.openURL) private var openURL
    @State private var confirmCancel = false
    @State private var cancelling = false
    @State private var errorText: String?
    @State private var showDetails = false

    var body: some View {
        let step = OrderStatus.step(order.status)
        let driver = orders.drivers[order.no]
        VStack(alignment: .leading, spacing: 0) {
            if let driver, order.status == "onway" {
                DriverMap(driver: driver, home: order.lat.flatMap { la in order.lng.map { CLLocationCoordinate2D(latitude: la, longitude: $0) } })
                    .frame(height: 190)
                    .overlay(alignment: .topTrailing) {
                        if let eta = driver.eta {
                            VStack(spacing: 0) {
                                Text(verbatim: "\(max(1, eta))").font(.kufi(26, .bold)).foregroundStyle(Theme.brandDeep)
                                    .contentTransition(.numericText(value: Double(eta)))
                                Text("دقايق").font(.ui(size: 12, weight: .semibold)).foregroundStyle(Theme.muted)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 6)
                            .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
                            .padding(12)
                        }
                    }
                    .transition(.opacity)
            }
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(verbatim: "طلبك الحالي · \(order.no)").font(.ui(size: 13)).foregroundStyle(Theme.muted)
                    Text(driver?.near == true ? "المندوب قريب منك 🛵" : OrderStatus.title(order.status))
                        .font(.kufi(19, .bold, relativeTo: .title3))
                        .contentTransition(.opacity)
                    Text(detailLine(driver)).font(.ui(size: 13.5)).foregroundStyle(Theme.muted)
                }
                ForEach(orders.subs[order.no] ?? []) { SubOfferCard(offer: $0, order: order) }
                VStack(spacing: 5) {
                    HStack(spacing: 6) {
                        ForEach(1...4, id: \.self) { i in
                            Capsule().fill(i < step ? Theme.brand : i == step ? Theme.copper : Theme.line).frame(height: 7)
                        }
                    }
                    HStack(spacing: 6) {
                        ForEach(Array(["وصلنا", "نجهّزه", "في الطريق", "وصلك"].enumerated()), id: \.offset) { i, t in
                            Text(t).font(.ui(size: 11.5, weight: .semibold))
                                .foregroundStyle(i + 1 == step ? Theme.copperInk : Theme.muted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .animation(.smooth, value: step)
                HStack(spacing: 6) {
                    ForEach(order.keys.prefix(4), id: \.self) { key in
                        if let p = catalog.resolve(key)?.product {
                            RemoteImage(url: p.imageURL, maxPixel: 120)
                                .padding(4)
                                .frame(width: 44, height: 44)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    if order.keys.count > 4 {
                        Text(verbatim: "+\(order.keys.count - 4)")
                            .font(.ui(size: 14, weight: .bold)).foregroundStyle(Theme.muted)
                            .frame(width: 44, height: 44)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    Spacer(minLength: 0)
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(verbatim: "\(order.count) أغراض").font(.ui(size: 12)).foregroundStyle(Theme.muted)
                        Text(Money.sar(order.total)).font(.kufi(18, .bold)).foregroundStyle(Theme.ink)
                            .lineLimit(1).fixedSize()
                    }
                    .layoutPriority(1)
                }
                HStack(spacing: 8) {
                    Button {
                        let digits = CatalogParser.latinDigits(catalog.store.phone).filter { $0.isNumber || $0 == "+" }
                        if let url = URL(string: "tel:\(digits)") { openURL(url) }
                    } label: {
                        Label("اتصل بالمحل", systemImage: "phone.fill")
                            .font(.ui(size: 14.5, weight: .bold))
                            .foregroundStyle(Theme.ink)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    Button { showDetails = true } label: {
                        Text("تفاصيل الطلب")
                            .font(.kufi(14.5, .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(Theme.brand, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
                .buttonStyle(PressableStyle(scale: 0.97))
                if orders.canCancel(order, policy: catalog.store.custCancel) {
                    Button(role: .destructive) { confirmCancel = true } label: {
                        HStack(spacing: 6) {
                            if cancelling { ProgressView().controlSize(.small) }
                            Text("إلغاء الطلب")
                        }
                        .font(.ui(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.copperInk)
                        .frame(maxWidth: .infinity, minHeight: 40)
                    }
                    .disabled(cancelling)
                }
            }
            .padding(16)
        }
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Theme.line))
        .shadow(color: .black.opacity(0.08), radius: 14, y: 5)
        .animation(.smooth, value: driver)
        .animation(.smooth, value: orders.subs[order.no])
        .sheet(isPresented: $showDetails) { OrderDetailView(order: order) }
        .confirmationDialog("ليش تبي تلغي طلب \(order.no)؟", isPresented: $confirmCancel, titleVisibility: .visible) {
            // نفس أسباب الموقع، والسبب يوصل للمحل
            ForEach(["طلبته بالغلط", "أبي أعدّل الطلب", "تأخر", "سبب ثاني"], id: \.self) { reason in
                Button(reason, role: .destructive) {
                    cancelling = true
                    Task {
                        errorText = await orders.cancel(order, reason: reason, catalog: catalog)
                        cancelling = false
                    }
                }
            }
            Button("لا، خلّه", role: .cancel) {}
        } message: {
            Text(order.status == "new" ? "تقدر تلغي الطلب قبل ما يبدأ المندوب التجهيز." : "تقدر تلغي الطلب قبل ما يطلع المندوب.")
        }
        .alert("ما انلغى الطلب", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("تمام", role: .cancel) {}
        } message: {
            Text(errorText ?? "")
        }
    }

    private func detailLine(_ driver: DriverInfo?) -> String {
        guard order.status == "onway", let driver else { return OrderStatus.detail(order.status) }
        var parts: [String] = []
        if let m = driver.meters, m > 0 { parts.append(m < 1000 ? "يبعد \(Int(m.rounded())) م" : "يبعد \(Money.plain((m / 100).rounded() / 10)) كم") }
        if driver.before > 0 { parts.append(driver.before == 1 ? "قبلك توصيلة وحدة" : "قبلك \(driver.before) توصيلات") }
        if let at = driver.at {
            let sec = Int(Date().timeIntervalSince(at))
            parts.append(sec < 30 ? "مباشر" : sec < 120 ? "قبل \(sec) ثانية" : "قبل \(sec / 60) دقيقة")
        }
        if let eta = driver.eta {
            let at = Date().addingTimeInterval(Double(max(1, eta)) * 60)
            parts.append("يوصلك تقريباً \(at.formatted(.dateTime.hour().minute().locale(Locale(identifier: "ar_SA@numbers=latn"))))")
        }
        return parts.isEmpty ? OrderStatus.detail(order.status) : parts.joined(separator: " · ")
    }
}

/// خريطة صغيرة: المندوب والبيت (بدون تفاعل، تتحرك لحالها)
private struct DriverMap: View {
    let driver: DriverInfo
    let home: CLLocationCoordinate2D?
    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $position, interactionModes: []) {
            Annotation("المندوب", coordinate: driver.coordinate) {
                Text("🛵").font(.ui(size: 20))
                    .frame(width: 40, height: 40)
                    .background(Theme.copper, in: Circle())
                    .overlay(Circle().strokeBorder(.white, lineWidth: 3))
                    .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            }
            if let home {
                Annotation("البيت", coordinate: home) {
                    Image(systemName: "house.fill").font(.ui(size: 15)).foregroundStyle(.white)
                        .frame(width: 34, height: 34)
                        .background(Theme.brand, in: Circle())
                        .overlay(Circle().strokeBorder(.white, lineWidth: 3))
                }
            }
        }
        .mapStyle(.standard(emphasis: .muted, pointsOfInterest: .excludingAll))
        .onAppear(perform: fit)
        .onChange(of: driver) { _, _ in withAnimation(.smooth(duration: 0.8)) { fit() } }
        .allowsHitTesting(false)
    }

    private func fit() {
        guard let home else {
            position = .region(MKCoordinateRegion(center: driver.coordinate, latitudinalMeters: 900, longitudinalMeters: 900)); return
        }
        let c = CLLocationCoordinate2D(latitude: (home.latitude + driver.lat) / 2, longitude: (home.longitude + driver.lng) / 2)
        let dLat = max(abs(home.latitude - driver.lat) * 1.8, 0.004), dLng = max(abs(home.longitude - driver.lng) * 1.8, 0.004)
        position = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(latitudeDelta: dLat, longitudeDelta: dLng)))
    }
}

/// تفاصيل الطلب: كل غرض وسعره، المجموع، الدفع والعنوان
struct OrderDetailView: View {
    let order: SavedOrder
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if order.isActive {
                        let eta = orders.drivers[order.no]?.eta
                        Label(order.status == "onway" && eta != nil ? "في الطريق · يوصلك خلال \(max(1, eta!)) دقايق" : OrderStatus.title(order.status),
                              systemImage: order.status == "onway" ? "scooter" : "clock")
                            .font(.ui(size: 14.5, weight: .bold))
                            .foregroundStyle(Theme.copperInk)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(Theme.copperSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    ForEach(orders.subs[order.no] ?? []) { SubOfferCard(offer: $0, order: order) }
                    VStack(spacing: 0) {
                        ForEach(rows) { line in
                            HStack(spacing: 10) {
                                RemoteImage(url: catalog.resolve(line.key)?.product.imageURL, maxPixel: 140)
                                    .padding(4)
                                    .frame(width: 50, height: 50)
                                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(line.name).font(.ui(size: 14.5, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2)
                                    Text(verbatim: "\(line.unit) · \(line.qty) × \(Money.plain(line.price))")
                                        .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                                }
                                Spacer(minLength: 6)
                                VStack(alignment: .trailing, spacing: 0) {
                                    Text(Money.plain(line.total)).font(.kufi(15.5, .bold)).foregroundStyle(Theme.ink)
                                    if let old = line.old, old > line.price {
                                        Text(Money.plain(old * Double(line.qty))).font(.ui(size: 11.5)).strikethrough().foregroundStyle(Theme.muted)
                                    }
                                }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 9)
                            if line.id != rows.last?.id { Divider().padding(.trailing, 72) }
                        }
                    }
                    .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))

                    VStack(spacing: 10) {
                        if let st = order.subtotal { row("المنتجات (\(order.count))", Money.sar(st)) }
                        if let fee = order.fee { row("التوصيل", fee == 0 ? "مجاني" : Money.sar(fee), color: fee == 0 ? Theme.brandDeep : Theme.ink) }
                        if let sv = order.savings, sv > 0.009 { row("وفّرت", Money.sar(sv), color: Theme.copperInk) }
                        Divider()
                        HStack {
                            Text("الإجمالي").font(.kufi(16, .bold))
                            Spacer()
                            Text(Money.sar(order.total)).font(.kufi(18, .bold))
                        }
                    }
                    .padding(14)
                    .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))

                    VStack(spacing: 10) {
                        row("الدفع", order.pay == "card" ? "💳 شبكة عند الاستلام" : "💵 كاش عند الاستلام")
                        if let d = order.details, !d.isEmpty { row("التوصيل إلى", d) }
                        if let sub = order.sub {
                            row("لو منتج ناقص", ["swap": "بدّلوه بمشابه", "remove": "شيلوه", "call": "اتصلوا علي"][sub] ?? "")
                        }
                    }
                    .padding(14)
                    .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))

                    Text("الأسعار وقت الطلب. لو المندوب بدّل أو شال منتج، الإجمالي النهائي يوصلك مع الفاتورة.")
                        .font(.ui(size: 12)).foregroundStyle(Theme.muted)
                }
                .padding(16)
            }
            .background(Color.white)
            .navigationTitle("تفاصيل الطلب")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text("تفاصيل الطلب").font(.kufi(16, .bold))
                        Text(verbatim: "\(order.no) · \(order.at.formatted(.dateTime.weekday(.wide).hour().minute().locale(Locale(identifier: "ar_SA@numbers=latn"))))")
                            .font(.ui(size: 11.5)).foregroundStyle(Theme.muted)
                    }
                }
                ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() } }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    /// الطلبات القديمة (قبل هالتحديث) ما فيها نسخة: نعرضها بأسعار المتجر الحالية
    private var rows: [SavedLine] {
        if let lines = order.lines, !lines.isEmpty { return lines }
        return order.keys.compactMap { key in
            guard let q = order.items[key], let r = catalog.resolve(key) else { return nil }
            return SavedLine(key: key, name: r.product.name, unit: r.pack?.unit ?? r.product.unit, qty: q,
                             price: r.pack?.price ?? r.product.price, old: nil)
        }
    }

    private func row(_ title: String, _ value: String, color: Color = Theme.ink) -> some View {
        HStack(alignment: .top) {
            Text(title).foregroundStyle(Theme.muted)
            Spacer(minLength: 12)
            Text(value).fontWeight(.semibold).foregroundStyle(color).multilineTextAlignment(.trailing)
        }
        .font(.ui(size: 14.5))
    }
}
