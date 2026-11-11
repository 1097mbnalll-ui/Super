import SwiftUI

/// حسابي قبل أول طلب (design/09-account-new.webp). الطلبات وتتبعها تنضاف في المرحلة ٣
struct AccountView: View {
    @Binding var tab: AppTab
    @Environment(CatalogStore.self) private var catalog
    @State private var haptics = Haptics.enabled

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 14) {
                    Image(systemName: "person")
                        .font(.system(size: 26, weight: .regular))
                        .foregroundStyle(Theme.oliveInk)
                        .frame(width: 64, height: 64)
                        .background(Theme.oliveSoft.opacity(0.6), in: Circle())
                        .overlay(Circle().strokeBorder(Theme.olive, style: StrokeStyle(lineWidth: 1.6, dash: [4, 3])))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("حيّاك في \(catalog.store.name) 👋").font(.kufi(18, .bold, relativeTo: .title3))
                        Text("تسوّق على راحتك، بدون تسجيل").font(.system(size: 14)).foregroundStyle(Theme.muted)
                    }
                    Spacer(minLength: 0)
                }

                VStack(spacing: 10) {
                    Text("🛒").font(.system(size: 40))
                    Text("ما طلبت شي للحين").font(.kufi(16, .bold))
                    Text(introLine)
                        .font(.system(size: 14)).foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                    Button("ابدأ التسوّق") { tab = .home }
                        .buttonStyle(PrimaryButtonStyle())
                        .padding(.top, 4)
                }
                .padding(18)
                .frame(maxWidth: .infinity)
                .background(Theme.tileGradient, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Color(hex: 0xD7EEE6)))

                Text("الإعدادات").font(.system(size: 14)).foregroundStyle(Theme.muted).padding(.top, 8)
                VStack(spacing: 0) {
                    Toggle(isOn: $haptics) {
                        Label("الاهتزاز", systemImage: "iphone.radiowaves.left.and.right")
                    }
                    .tint(Theme.brand)
                    .padding(.horizontal, 16).frame(minHeight: 56)
                    .onChange(of: haptics) { _, on in Haptics.enabled = on; if on { Haptics.selected() } }
                    Divider().padding(.trailing, 52)
                    Link(destination: URL(string: "privacy.html", relativeTo: AppConfig.site)!.absoluteURL) {
                        row("سياسة الخصوصية", systemImage: "hand.raised")
                    }
                }
                .foregroundStyle(Theme.ink)
                .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line))

                Text("تحتاج شي؟").font(.system(size: 14)).foregroundStyle(Theme.muted).padding(.top, 8)
                HStack(spacing: 10) {
                    if let call = phoneURL {
                        Link(destination: call) { contact("اتصال", "phone.fill", bg: Theme.mint, fg: Theme.brandDeep) }
                    }
                    if let wa = whatsappURL {
                        Link(destination: wa) { contact("واتساب", "message.fill", bg: Color(hex: 0xE3F7EA), fg: Color(hex: 0x1FA855)) }
                    }
                }

                if !catalog.store.hours.isEmpty {
                    Label("أوقات العمل: \(catalog.store.hours)", systemImage: "clock")
                        .font(.system(size: 13)).foregroundStyle(Theme.muted)
                        .padding(.top, 4)
                }
                Text("الإصدار \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""))")
                    .font(.system(size: 11)).foregroundStyle(Theme.muted.opacity(0.7))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
            }
            .padding(16)
        }
        .scrollIndicators(.hidden)
        .background(Color.white)
        .navigationTitle("حسابي")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var introLine: String {
        let s = catalog.store
        var line = "أول طلب يوصلك خلال \(s.eta)"
        if s.freeOver > 0 { line += "، والتوصيل مجاني فوق \(Money.sar(s.freeOver))" }
        return line
    }

    private var digits: (phone: String, wa: String) {
        let clean: (String) -> String = { CatalogParser.latinDigits($0).filter { $0.isNumber || $0 == "+" } }
        return (clean(catalog.store.phone), clean(catalog.store.whatsapp).replacingOccurrences(of: "+", with: ""))
    }
    private var phoneURL: URL? { digits.phone.isEmpty ? nil : URL(string: "tel:\(digits.phone)") }
    private var whatsappURL: URL? { digits.wa.isEmpty ? nil : URL(string: "https://wa.me/\(digits.wa)") }

    private func row(_ title: String, systemImage: String) -> some View {
        HStack {
            Label(title, systemImage: systemImage)
            Spacer()
            Image(systemName: "chevron.forward").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted)
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
            Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
    }
}
