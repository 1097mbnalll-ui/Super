import SwiftUI

/// «محفظتي والكاش باك»: دخول بالجوال ورقم المحفظة السري، والرصيد وسجل الحركات (نفس الموقع)
struct WalletSheet: View {
    @Environment(WalletCenter.self) private var wallet
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @Environment(\.dismiss) private var dismiss
    @State private var phone = ""
    @State private var password = ""
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                if wallet.loggedIn {
                    Section {
                        LabeledContent("الجوال") { Text(wallet.phone ?? "").environment(\.layoutDirection, .leftToRight) }
                        LabeledContent("المتاح") { Text(Money.sar(wallet.balance)).font(.kufi(17, .bold)).foregroundStyle(Theme.brandDeep) }
                    }
                    Section("سجل الرصيد") {
                        if wallet.history.isEmpty {
                            Text("ما فيه حركات للحين").foregroundStyle(Theme.muted)
                        }
                        ForEach(wallet.history) { e in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(e.title).font(.ui(size: 14, weight: .semibold))
                                    Text(e.at.formatted(.dateTime.day().month().hour().minute().locale(Locale(identifier: "ar_SA@numbers=latn"))))
                                        .font(.ui(size: 12)).foregroundStyle(Theme.muted)
                                }
                                Spacer()
                                Text(verbatim: (e.deltaCents >= 0 ? "+" : "−") + Money.sar(Double(abs(e.deltaCents)) / 100))
                                    .font(.kufi(14, .bold))
                                    .foregroundStyle(e.deltaCents >= 0 ? Theme.brandDeep : Theme.copperInk)
                            }
                        }
                    }
                    Section {
                        Button("تسجيل الخروج من المحفظة", role: .destructive) {
                            Task { message = await wallet.logout(api: catalog.apiBase) }
                        }
                        .disabled(wallet.busy)
                    }
                } else {
                    Section {
                        Text("اكتب جوالك ورقم المحفظة السري. إذا ما فعّلت محفظتك أو نسيت الرقم، تواصل مع المتجر.")
                            .font(.ui(size: 13.5)).foregroundStyle(Theme.muted)
                        TextField("رقم الجوال", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                        SecureField("الرقم السري للمحفظة", text: $password).keyboardType(.numberPad).textContentType(.password)
                        Button {
                            Task {
                                message = await wallet.login(phone: phone, password: password, api: catalog.apiBase)
                                if message == nil { password = "" }
                            }
                        } label: {
                            HStack { Text("دخول"); if wallet.busy { Spacer(); ProgressView() } }
                        }
                        .disabled(wallet.busy || phone.isEmpty || password.count < 6)
                    }
                }
                if let message {
                    Text(message).font(.ui(size: 13, weight: .semibold)).foregroundStyle(Theme.copperInk)
                }
            }
            .navigationTitle(wallet.loggedIn ? "محفظتي" : "دخول المحفظة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() } } }
            .task {
                if phone.isEmpty { phone = orders.phone }
                await wallet.refresh(api: catalog.apiBase)
            }
        }
    }
}

/// الدفع من المحفظة في السلة: جزء بالمحفظة والباقي عند الاستلام (walletCheckoutHTML)
struct CheckoutWalletBox: View {
    let total: Double
    @Environment(WalletCenter.self) private var wallet
    @State private var showWallet = false
    @State private var amountText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("الدفع من المحفظة").font(.kufi(14, .bold))
            Text("تقدر تدفع جزء بالمحفظة والباقي بالطريقة المختارة عند الاستلام.")
                .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
            if wallet.loggedIn {
                Text("محفظة \(wallet.phone ?? "") · المتاح \(Money.sar(wallet.balance))").font(.ui(size: 13, weight: .semibold))
                HStack {
                    TextField("المبلغ المستخدم", text: $amountText)
                        .keyboardType(.decimalPad)
                        .padding(10)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line))
                        .onChange(of: amountText) { _, v in
                            let n = Double(CatalogParser.latinDigits(v).replacingOccurrences(of: ",", with: ".")) ?? 0
                            wallet.useAmount = max(0, n)
                        }
                    Button("الكل") {
                        let v = min(wallet.balance, total)
                        amountText = Money.plain(v)
                    }
                    .font(.ui(size: 13, weight: .semibold))
                }
                if wallet.useAmount > min(wallet.balance, total) + 0.001 {
                    Text("المبلغ أكبر من المتاح أو من الإجمالي").font(.ui(size: 12)).foregroundStyle(Theme.copperInk)
                }
            } else {
                Text("سجّل دخول محفظتك لاستخدام الرصيد.").font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
            }
            Button(wallet.loggedIn ? "عرض المحفظة" : "دخول المحفظة") { showWallet = true }
                .font(.ui(size: 13.5, weight: .semibold))
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
        .sheet(isPresented: $showWallet) { WalletSheet() }
        .onAppear { if wallet.useAmount > 0 { amountText = Money.plain(wallet.useAmount) } }
    }
}
