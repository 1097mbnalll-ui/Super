import SwiftUI

/// حسابي (design/09-account-new.webp قبل أول طلب، و11-account-with-order.webp بعده)
struct AccountView: View {
    @Binding var tab: AppTab
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @Environment(Cart.self) private var cart
    @State private var haptics = Haptics.enabled
    @State private var showAddress = false
    @State private var showWallet = false
    @State private var langNote = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header

                if let current = orders.current {
                    CurrentOrderCard(order: current)
                        .transition(.opacity.combined(with: .scale(scale: 0.97)))
                }

                if !pastOrders.isEmpty {
                    Text("اطلب مرة ثانية").font(.kufi(16, .bold)).padding(.top, 6)
                    ScrollView(.horizontal) {
                        HStack(spacing: 10) {
                            ForEach(pastOrders) { order in ReorderCard(order: order) { reorder(order) } }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollIndicators(.hidden)
                    .scrollTargetBehavior(.viewAligned)
                }

                if orders.orders.isEmpty {
                VStack(spacing: 10) {
                    Text("🛒").font(.ui(size: 40))
                    Text("ما طلبت شي للحين").font(.kufi(16, .bold))
                    Text(introLine)
                        .font(.ui(size: 14)).foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                    Button("ابدأ التسوّق") { tab = .home }
                        .buttonStyle(PrimaryButtonStyle())
                        .padding(.top, 4)
                }
                .padding(18)
                .frame(maxWidth: .infinity)
                .background(Theme.tileGradient, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Color(hex: 0xD7EEE6)))
                }

                Text("الإعدادات").font(.ui(size: 14)).foregroundStyle(Theme.muted).padding(.top, 8)
                VStack(spacing: 0) {
                    Button { showAddress = true } label: {
                        row("عنوانك", systemImage: "mappin.and.ellipse",
                            value: orders.address == nil ? "حدّده" : (orders.address!.details.isEmpty ? "البيت" : orders.address!.details))
                    }
                    Divider().padding(.trailing, 52)
                    Toggle(isOn: $haptics) {
                        Label("الاهتزاز", systemImage: "iphone.radiowaves.left.and.right")
                    }
                    .tint(Theme.brand)
                    .padding(.horizontal, 16).frame(minHeight: 56)
                    .onChange(of: haptics) { _, on in Haptics.enabled = on; if on { Haptics.selected() } }
                    Divider().padding(.trailing, 52)
                    Button {
                        Task {
                            if await Push.shared.enable() {
                                for o in orders.orders where o.isActive { Push.shared.register(no: o.no, phone: o.phone, api: catalog.apiBase) }
                            }
                        }
                    } label: {
                        row("الإشعارات", systemImage: "bell.badge",
                            value: Push.shared.enabled ? "مفعّلة ✓" : Push.shared.denied ? "مقفلة من الإعدادات" : "فعّلها")
                    }
                    .disabled(Push.shared.enabled)
                    Divider().padding(.trailing, 52)
                    Button {
                        AppLang.set(english: !AppLang.english)
                        langNote = true
                    } label: {
                        row("اللغة · Language", systemImage: "globe", value: AppLang.english ? "English" : "العربية")
                    }
                    Divider().padding(.trailing, 52)
                    Button { showWallet = true } label: {
                        row("محفظتي والكاش باك", systemImage: "wallet.pass")
                    }
                    Divider().padding(.trailing, 52)
                    Link(destination: URL(string: "privacy.html", relativeTo: AppConfig.site)!.absoluteURL) {
                        row("سياسة الخصوصية", systemImage: "hand.raised")
                    }
                }
                .foregroundStyle(Theme.ink)
                .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))

                Text("تحتاج شي؟").font(.ui(size: 14)).foregroundStyle(Theme.muted).padding(.top, 8)
                HStack(spacing: 10) {
                    if let call = phoneURL {
                        Link(destination: call) { contact("اتصال", "phone.fill", bg: Theme.mint, fg: Theme.brandDeep) }
                    }
                    if let wa = whatsappURL {
                        Link(destination: wa) { contact("واتساب", "message.fill", bg: Color(hex: 0xE3F7EA), fg: Color(hex: 0x1FA855)) }
                    }
                }

                // معلومات المحل (نفس «حسابي» في الموقع)
                let st = catalog.store
                VStack(spacing: 0) {
                    info("منطقة التوصيل", st.area)
                    info("مدة التوصيل", st.eta)
                    info("رسوم التوصيل", st.fee > 0 ? Money.sar(st.fee) : "مجاني")
                    if st.freeOver > 0 { info("توصيل مجاني", "فوق \(Money.sar(st.freeOver))") }
                    if st.minOrder > 0 { info("أقل طلب", Money.sar(st.minOrder)) }
                    if !st.hours.isEmpty { info("أوقات العمل", st.hours) }
                    info("الدفع", "كاش أو شبكة عند الاستلام")
                    if !st.phone.isEmpty { info("رقم المحل", st.phone, last: true) }
                }
                .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))
                .padding(.top, 4)
                Text("صور بعض الخضار والفواكه من مجموعة Fruits-360 لـ Mihai Oltean (رخصة MIT).")
                    .font(.ui(size: 10.5)).foregroundStyle(Theme.muted.opacity(0.8))
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
                Text("الإصدار \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""))")
                    .font(.ui(size: 11)).foregroundStyle(Theme.muted.opacity(0.7))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
            }
            .padding(16)
        }
        .scrollIndicators(.hidden)
        .background(Theme.pageBG)
        .navigationTitle("حسابي")
        .navigationBarTitleDisplayMode(.inline)
        .animation(.smooth, value: orders.current?.status)
        .sheet(isPresented: $showAddress) { AddressView() }
        .sheet(isPresented: $showWallet) { WalletSheet() }
        .alert(AppLang.english ? "تتغير اللغة للعربي لما تقفل التطبيق وتفتحه" : "The app switches to English when you close and reopen it",
               isPresented: $langNote) {
            Button("تمام") {}
        }
        .refreshable { await orders.refresh(catalog: catalog) }
    }

    private var pastOrders: [SavedOrder] {
        Array(orders.orders.filter { !$0.isActive && $0.status != "canceled" }.prefix(6))
    }

    private func reorder(_ order: SavedOrder) {
        cart.add(order.items, order: order.keys, catalog: catalog)
        tab = .cart
    }

    @ViewBuilder private var header: some View {
        let hasName = !orders.name.isEmpty
        HStack(spacing: 14) {
            Group {
                if hasName {
                    Text(String(orders.name.prefix(1)))
                        .font(.kufi(26, .bold))
                        .foregroundStyle(Theme.brandDeep)
                } else {
                    Image(systemName: "person")
                        .font(.ui(size: 26, weight: .regular))
                        .foregroundStyle(Theme.oliveInk)
                }
            }
            .frame(width: 64, height: 64)
            .background(hasName ? Theme.mint : Theme.oliveSoft.opacity(0.6), in: Circle())
            .overlay(Circle().strokeBorder(hasName ? Theme.brand.opacity(0.4) : Theme.olive,
                                           style: StrokeStyle(lineWidth: 1.6, dash: hasName ? [] : [4, 3])))
            VStack(alignment: .leading, spacing: 2) {
                Text(hasName ? orders.name : "حيّاك في \(catalog.store.name) 👋").font(.kufi(18, .bold, relativeTo: .title3))
                Text(orders.phone.isEmpty ? "تسوّق على راحتك، بدون تسجيل" : orders.phone)
                    .font(.ui(size: 14)).foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
        }
    }

    private var introLine: String {
        let s = catalog.store
        var line = tr("أول طلب يوصلك خلال \(s.eta)")
        if s.freeOver > 0 { line += tr("، والتوصيل مجاني فوق \(Money.short(s.freeOver))") }
        return line
    }

    private var digits: (phone: String, wa: String) {
        let clean: (String) -> String = { CatalogParser.latinDigits($0).filter { $0.isNumber || $0 == "+" } }
        return (clean(catalog.store.phone), clean(catalog.store.whatsapp).replacingOccurrences(of: "+", with: ""))
    }
    private var phoneURL: URL? { digits.phone.isEmpty ? nil : URL(string: "tel:\(digits.phone)") }
    private var whatsappURL: URL? { digits.wa.isEmpty ? nil : URL(string: "https://wa.me/\(digits.wa)") }

    private func info(_ title: String, _ value: String, last: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(tv: title).font(.ui(size: 13.5)).foregroundStyle(Theme.muted)
                Spacer(minLength: 8)
                Text(tv: value).font(.ui(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.trailing).textSelection(.enabled)
            }
            .padding(.horizontal, 16).padding(.vertical, 11)
            if !last { Divider().padding(.horizontal, 16) }
        }
    }

    private func row(_ title: String, systemImage: String, value: String? = nil) -> some View {
        HStack {
            Label(title, systemImage: systemImage)
            Spacer()
            if let value {
                Text(tv: value).font(.ui(size: 14)).foregroundStyle(Theme.muted).lineLimit(1)
            }
            Image(systemName: "chevron.forward").font(.ui(size: 12, weight: .semibold)).foregroundStyle(Theme.muted)
        }
        .padding(.horizontal, 16).frame(minHeight: 56)
        .contentShape(Rectangle())
    }

    private func contact(_ title: String, _ icon: String, bg: Color, fg: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(fg)
                .frame(width: 38, height: 38)
                .background(bg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text(tv: title).font(.ui(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
    }
}

/// «اطلب مرة ثانية»: صور أول ٣ منتجات + التاريخ والمبلغ + زر يضيف كل الطلب للسلة
private struct ReorderCard: View {
    let order: SavedOrder
    let action: () -> Void
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                ForEach(order.keys.prefix(3), id: \.self) { key in
                    if let p = catalog.resolve(key)?.product {
                        RemoteImage(url: p.imageURL, maxPixel: 120)
                            .padding(4)
                            .frame(width: 42, height: 42)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
            Text(tv: "\(order.at.formatted(.dateTime.weekday(.wide).locale(Locale(identifier: "ar_SA@numbers=latn")))) · \(Money.sar(order.total))")
                .font(.kufi(13, .bold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
            Button(action: action) {
                Label("أضفه للسلة", systemImage: "arrow.counterclockwise")
                    .font(.ui(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.brandDeep)
                    .frame(maxWidth: .infinity, minHeight: 40)
                    .background(Theme.mint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(PressableStyle(scale: 0.97))
        }
        .padding(12)
        .frame(width: 200)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
    }
}
