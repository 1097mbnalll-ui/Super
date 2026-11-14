import SwiftUI

/// تعريف أول فتحة (نفس بطاقات الموقع openIntro): المحل ومنطقة التوصيل، اطلب في دقيقة، الدفع عند الاستلام.
/// مرة وحدة بس (intro.seen)، فيه «تخطّي»، وسؤال آبل للإشعارات ينتظر لين يقفل (RootView)
struct IntroView: View {
    let done: () -> Void
    @Environment(CatalogStore.self) private var catalog
    @State private var page = 0

    /// يطلع لأول فتحة بس: مو للي فتح التطبيق قبل (سؤال الإشعارات انسأل) أو عنده طلبات، ولا مع التصوير الآلي (-screen، -seed…، -no-push)
    static func shouldShow(hasOrders: Bool) -> Bool {
        let args = ProcessInfo.processInfo.arguments, d = UserDefaults.standard
        if args.contains("-intro") { return true }
        if d.bool(forKey: "intro.seen") || d.bool(forKey: "push.asked") || hasOrders || d.string(forKey: "push.go") != nil { return false }
        return !args.contains { $0 == "-screen" || $0 == "-no-intro" || $0 == "-no-push" || $0.hasPrefix("-seed") }
    }

    private var cards: [(icon: String?, title: String, text: String)] {
        let s = catalog.store
        return [
            (nil, "حيّاك في \(s.name)", "بقالة ومخبز الحي، نوصل طلبك لين باب بيتك داخل \(s.area)" + (s.eta.isEmpty ? "." : " خلال \(s.eta).")),
            ("cart.fill", "اطلب في دقيقة", "اختر أغراضك، وحدد بيتك على الخريطة، وأرسل. بدون تسجيل ولا كلمة سر."),
            ("box.truck.fill", "ادفع عند الاستلام", "كاش أو شبكة لما يوصلك المندوب، وتتابعه على الخريطة لحظة بلحظة."),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button(action: finish) {
                    Text("تخطّي")
                        .font(.ui(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                        .padding(.horizontal, 16).frame(minHeight: 36)
                        .background(Theme.surface, in: Capsule())
                }
                .buttonStyle(PressableStyle(scale: 0.95))
            }
            .padding(.horizontal, 20).padding(.top, 8)

            TabView(selection: $page) {
                ForEach(Array(cards.enumerated()), id: \.offset) { i, c in
                    VStack(spacing: 18) {
                        ZStack {
                            Circle().fill(Theme.mint).frame(width: 150, height: 150)
                            if let icon = c.icon {
                                Image(systemName: icon).font(.ui(size: 58, weight: .semibold)).foregroundStyle(Theme.brandDeep)
                            } else {
                                Image("Logo").resizable().scaledToFit().frame(width: 112, height: 112)
                            }
                        }
                        Text(tv: c.title).font(.kufi(24, .bold, relativeTo: .title)).multilineTextAlignment(.center)
                        Text(tv: c.text).font(.ui(size: 16)).foregroundStyle(Theme.muted)
                            .multilineTextAlignment(.center).lineSpacing(4)
                            .frame(maxWidth: 320)
                    }
                    .padding(.horizontal, 28)
                    .tag(i)
                    .accessibilityElement(children: .combine)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            HStack(spacing: 6) {
                ForEach(0..<cards.count, id: \.self) { i in
                    Capsule().fill(i == page ? Theme.brand : Theme.line).frame(width: i == page ? 22 : 7, height: 7)
                }
            }
            .animation(.smooth, value: page)
            .accessibilityHidden(true)
            .padding(.bottom, 18)

            Button {
                if page >= cards.count - 1 { finish() } else { withAnimation(.smooth) { page += 1 } }
            } label: {
                Text(tv: page >= cards.count - 1 ? "يلا نتسوّق" : "التالي").frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryButtonStyle())
            .padding(.horizontal, 20).padding(.bottom, 16)
        }
        .background(LinearGradient(colors: [Theme.mint.opacity(0.6), .white], startPoint: .top, endPoint: .center).ignoresSafeArea())
        .onAppear { UserDefaults.standard.set(true, forKey: "intro.seen") }
    }

    private func finish() {
        UserDefaults.standard.set(true, forKey: "intro.seen")
        Haptics.selected()
        done()
    }
}
