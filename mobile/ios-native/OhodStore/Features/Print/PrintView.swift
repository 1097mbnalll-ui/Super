import SwiftUI

/// خدمة الطباعة (قسم print): نوع الطباعة وعدد الصفحات والنسخ ← تنضاف للسلة، وبعد الطلب يرسل الملف على واتساب. نفس الموقع
struct PrintCalculator: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Cart.self) private var cart
    @Environment(\.dismiss) private var dismiss
    @State private var type = "bw"
    @State private var pages = ""
    @State private var copies = 1
    @State private var sides = 1
    @State private var message: String?

    private func product(_ t: String) -> Product? { catalog.product(t == "bw" ? "print_bw" : "print_color") }
    private var qty: Int { (Int(CatalogParser.latinDigits(pages).filter(\.isNumber).prefix(5)) ?? 0) * max(1, copies) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("اختر نوع الطباعة وعدد الصفحات، وبعد ما تكمّل الطلب ترسل الملف على واتساب المحل برقم طلبك، ونطبعه ونوصّله لك.")
                .font(.ui(size: 14)).foregroundStyle(Theme.muted)
            HStack(spacing: 10) {
                ForEach([("bw", "أبيض وأسود"), ("color", "ألوان")], id: \.0) { t, label in
                    if let p = product(t) {
                        Button { type = t } label: {
                            VStack(spacing: 2) {
                                Text(label).font(.kufi(15, .bold))
                                Text("\(Money.sar(p.price)) / صفحة").font(.ui(size: 12.5))
                            }
                            .foregroundStyle(type == t ? .white : Theme.ink)
                            .frame(maxWidth: .infinity, minHeight: 60)
                            .background(type == t ? Theme.brand : .white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line))
                        }
                        .buttonStyle(PressableStyle(scale: 0.97))
                    }
                }
            }
            TextField("عدد صفحات الملف (مثلاً 24)", text: $pages)
                .keyboardType(.numberPad)
                .padding(12)
                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line))
            HStack {
                Text("عدد النسخ").font(.ui(size: 14, weight: .semibold))
                Spacer()
                StepperCapsule(qty: copies, compact: true, onPlus: { copies = min(copies + 1, 99) }, onMinus: { copies = max(1, copies - 1) })
            }
            Picker("الطباعة", selection: $sides) {
                Text("وجه").tag(1)
                Text("وجهين").tag(2)
            }
            .pickerStyle(.segmented)
            if let p = product(type), qty > 0 {
                Text("المجموع: \(Money.sar((p.price * Double(qty) * 100).rounded() / 100)) (\(qty / max(1, copies)) صفحة × \(copies) نسخة)")
                    .font(.ui(size: 14, weight: .semibold))
            } else {
                Text("اكتب عدد صفحات الملف وبيطلع لك السعر").font(.ui(size: 13)).foregroundStyle(Theme.muted)
            }
            Button(action: add) {
                Text("أضف للسلة").font(.kufi(15, .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Theme.brand, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            if let message { Text(message).font(.ui(size: 13, weight: .semibold)).foregroundStyle(Theme.brandDeep) }
            let inCart = [("bw", "أبيض وأسود"), ("color", "ألوان")].compactMap { t, l -> String? in
                guard let p = product(t) else { return nil }
                let q = cart.line(p.id).qty
                return q > 0 ? "\(q) صفحة \(l)" : nil
            }
            if !inCart.isEmpty {
                Text("في سلتك: " + inCart.joined(separator: " · ")).font(.ui(size: 13)).foregroundStyle(Theme.muted)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("١. أضف للسلة وكمّل الطلب (الدفع عند الاستلام)")
                Text("٢. بعد الطلب يطلع لك زر «أرسل الملف على واتساب»")
                Text("٣. نطبع ونوصّل لك بأسرع وقت")
            }
            .font(.ui(size: 13)).foregroundStyle(Theme.muted)
        }
        .padding(16)
    }

    private func add() {
        guard let p = product(type), catalog.isAvailable(p) else { message = "الطباعة مو متاحة الحين"; return }
        let pg = Int(CatalogParser.latinDigits(pages).filter(\.isNumber).prefix(5)) ?? 0
        guard pg > 0 else { message = "اكتب عدد صفحات الملف"; return }
        guard qty <= 5000 else { message = "الحد الأقصى ٥٠٠٠ صفحة في الطلب (الصفحات × النسخ)"; return }
        cart.set(p.id, qty)
        cart.printJobs[type] = ["pages": pg, "copies": copies, "sides": sides]
        message = "انضافت للسلة. كمّل الطلب وبعدها ارسل الملف على واتساب"
    }
}

/// بعد الطلب: «أرسل ملف الطباعة على واتساب» برقم الطلب
struct PrintWhatsAppCard: View {
    let order: SavedOrder
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.openURL) private var openURL

    var body: some View {
        let wa = CatalogParser.latinDigits(catalog.store.whatsapp).filter(\.isNumber)
        if let text = order.printText, !wa.isEmpty, order.status != "canceled" {
            VStack(alignment: .leading, spacing: 8) {
                Text("باقي خطوة: أرسل ملف الطباعة").font(.kufi(15, .bold))
                Text("أرسل الملف على واتساب المحل برقم طلبك ونبدأ نطبعه.").font(.ui(size: 13)).foregroundStyle(Theme.muted)
                Button {
                    var c = URLComponents(string: "https://wa.me/\(wa)")!
                    c.queryItems = [URLQueryItem(name: "text", value: "السلام عليكم، طلب طباعة رقم \(order.no)\n\(text)\nالملف مرفق 👇")]
                    if let u = c.url { openURL(u) }
                } label: {
                    Label("أرسل الملف على واتساب", systemImage: "paperplane.fill")
                        .font(.kufi(14, .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(Color(hex: 0x1FA855), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .padding(14)
            .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line))
        }
    }
}
