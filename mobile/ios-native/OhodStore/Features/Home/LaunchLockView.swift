import SwiftUI

/// شاشة القفل لين الإطلاق الرسمي (المالك ١٨ نوفمبر ٢٠٢٦): واجهة المحل والرولة نازلة وعليها العدّاد.
/// تتحكم فيها store.app.launch = {at, msg, sub} في ملف المتجر، وتختفي لحالها أول ما يجي الموعد.
struct LaunchLockView: View {
    let at: Date
    let msg: String
    let sub: String

    private static let cream = Color(hex: 0xFBF3E8)
    private static let night = Color(hex: 0x1B1430)
    private static let amber = Color(hex: 0xFFB25E)
    private static let green = Color(hex: 0x0E8A6A)
    private static let greenDark = Color(hex: 0x0B6B53)
    private static let brown = Color(hex: 0x5A2D0C)

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let left = at.timeIntervalSince(ctx.date)
            if left > 0 {
                content(left: left)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.8), value: at > Date())
    }

    private func parts(_ left: TimeInterval) -> [Int] {
        let t = max(0, Int(left))
        return [t / 86400, (t / 3600) % 24, (t / 60) % 60, t % 60]
    }

    @ViewBuilder
    private func content(left: TimeInterval) -> some View {
        let p = parts(left)
        ZStack {
            LinearGradient(colors: [Self.cream, Color(hex: 0xF3E3CC)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer(minLength: 20)
                // اللوحة
                HStack(spacing: 10) {
                    Text("متاجر أحد").font(.kufi(24, .bold)).foregroundStyle(Self.amber)
                        .shadow(color: Self.amber.opacity(0.8), radius: 5)
                    Image("Logo").resizable().scaledToFit().frame(width: 40, height: 40)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .padding(.horizontal, 18).padding(.vertical, 10)
                .background(Self.night, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.bottom, 14)
                // المظلة
                HStack(spacing: 0) {
                    ForEach(0..<9, id: \.self) { i in
                        Rectangle().fill(i % 2 == 0 ? Self.green : Color.white.opacity(0.92))
                    }
                }
                .frame(height: 30)
                .overlay(alignment: .top) { Rectangle().fill(Self.greenDark).frame(height: 10) }
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .padding(.horizontal, 22)
                // الباب والرولة والعدّاد
                ZStack {
                    VStack(spacing: 3) {
                        ForEach(0..<26, id: \.self) { _ in
                            Rectangle().fill(Color(hex: 0xBAC3CA)).frame(height: 7)
                        }
                    }
                    .background(Color(hex: 0x97A2AB))
                    .clipped()
                    VStack(spacing: 10) {
                        Text("باقي على الفتح").font(.ui(size: 14, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 4)
                            .background(Self.night, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        HStack(spacing: 6) {
                            box(p[0], "يوم")
                            box(p[1], "ساعة")
                            box(p[2], "دقيقة")
                            box(p[3], "ثانية")
                        }
                        .environment(\.layoutDirection, .rightToLeft)
                    }
                }
                .frame(height: 230)
                .padding(8)
                .background(Color(hex: 0x3A2A1E), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                .padding(.horizontal, 34)
                Rectangle().fill(Color(hex: 0xC9AE88)).frame(height: 8).padding(.horizontal, 10)
                // الكلام
                VStack(spacing: 8) {
                    Text(tv: msg.isEmpty ? "يفتح المحل يوم الخميس الساعة ٦ المغرب" : msg)
                        .font(.kufi(20, .bold)).foregroundStyle(Self.brown)
                        .multilineTextAlignment(.center)
                    Text(tv: sub.isEmpty ? "نشوفك يوم الإطلاق 🎉" : sub)
                        .font(.ui(size: 15, weight: .semibold)).foregroundStyle(Color(hex: 0x7A4A12))
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24).padding(.top, 22)
                Spacer(minLength: 20)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func box(_ v: Int, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(verbatim: v < 10 ? "0\(v)" : "\(v)")
                .font(.system(size: 26, weight: .heavy, design: .rounded)).monospacedDigit()
                .foregroundStyle(Self.amber)
            Text(tv: label).font(.ui(size: 11, weight: .bold)).foregroundStyle(.white.opacity(0.85))
        }
        .frame(width: 58, height: 64)
        .background(Self.night, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.25), radius: 5, y: 3)
    }
}
