import SwiftUI

/// المندوب اقترح بديل لمنتج ناقص: الزبون يوافق (ينبدل) أو يرفض (ينشال من الطلب). نفس الموقع (subsHTML)
struct SubOfferCard: View {
    let offer: SubOffer
    let order: SavedOrder
    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @State private var busy = false
    @State private var errorText: String?
    @State private var doneText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label {
                Text(tv: "«\(offer.name)» مو متوفر").font(.kufi(15.5, .bold))
            } icon: {
                Image(systemName: "arrow.triangle.2.circlepath").foregroundStyle(Theme.copper)
            }
            Text("نقترح بداله:").font(.ui(size: 13.5)).foregroundStyle(Theme.muted)
            HStack(spacing: 10) {
                RemoteImage(url: offer.toImageURL, maxPixel: 160)
                    .padding(4)
                    .frame(width: 58, height: 58)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(tv: offer.toName).font(.ui(size: 14.5, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(2)
                    Text(tv: [offer.toUnit, Money.sar(offer.toPrice) + (offer.qty > 1 ? " × \(offer.qty)" : "")]
                        .filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.ui(size: 12.5)).foregroundStyle(Theme.muted)
                    Text(tv: diffText).font(.ui(size: 12.5, weight: .semibold))
                        .foregroundStyle(offer.diff > 0.009 ? Theme.copperInk : Theme.brandDeep)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 8) {
                Button { send(true) } label: {
                    Text("موافق على البديل")
                        .font(.kufi(14, .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Theme.brand, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                Button { send(false) } label: {
                    Text("لا، شيله من طلبي")
                        .font(.ui(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .buttonStyle(PressableStyle(scale: 0.97))
            .disabled(busy)
            .overlay { if busy { ProgressView() } }
            if let errorText {
                Text(tv: errorText).font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
            }
        }
        .padding(14)
        .background(Theme.copper.opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.copper.opacity(0.35)))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("بديل مقترح")
    }

    private var diffText: String {
        if abs(offer.diff) < 0.01 { return "بنفس السعر" }
        return (offer.diff > 0 ? "+" : "−") + Money.sar(abs(offer.diff)) + " على الإجمالي"
    }

    private func send(_ yes: Bool) {
        busy = true; errorText = nil
        Task {
            errorText = await orders.answer(offer, accept: yes, order: order, catalog: catalog)
            busy = false
        }
    }
}
