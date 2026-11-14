import SwiftUI

/// «عناويني» (addrsHTML في الموقع): العناوين المحفوظة على الجوال، اختيار عنوان الطلب، تعديل، حذف، وإضافة.
/// من «حسابي» تنفتح كصفحة، ومن السلة كنافذة لاختيار «وين نوصلك؟» (picking)
struct AddressBookView: View {
    /// من السلة: اختيار العنوان يقفل النافذة
    var picking = false
    var onPicked: () -> Void = {}

    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @Environment(\.dismiss) private var dismiss
    @State private var editor: Editor?
    @State private var confirmDelete: DeliveryAddress?

    private enum Editor: Identifiable {
        case new
        case edit(String)
        var id: String { if case .edit(let s) = self { return s }; return "new" }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("احفظ أكثر من عنوان (البيت، الدوام…) واختار وقت الطلب وين نوصلك.")
                    .font(.ui(size: 13.5)).foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if orders.addresses.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 30)).foregroundStyle(Theme.brandDeep)
                        Text("ما حفظت عنوان للحين").font(.kufi(15, .bold))
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
                }
                ForEach(orders.addresses) { a in row(a) }
                if orders.addresses.count < OrderCenter.maxAddresses {
                    Button { editor = .new } label: {
                        Label("أضف عنوان", systemImage: "plus")
                            .font(.ui(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.brandDeep)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(Theme.mint, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(PressableStyle(scale: 0.97))
                    .padding(.top, 4)
                }
            }
            .padding(16)
        }
        .scrollIndicators(.hidden)
        .background(Theme.pageBG)
        .navigationTitle(picking ? "وين نوصلك؟" : "عناويني")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if picking {
                ToolbarItem(placement: .cancellationAction) { Button("تم") { dismiss() } }
            }
        }
        .sheet(item: $editor) { e in
            switch e {
            case .new: AddressView(startNew: true)   // ينحفظ ويصير المختار
            case .edit(let id): AddressView(addressID: id)
            }
        }
        .confirmationDialog("تحذف هالعنوان؟", isPresented: Binding(get: { confirmDelete != nil }, set: { if !$0 { confirmDelete = nil } }),
                            titleVisibility: .visible, presenting: confirmDelete) { a in
            Button("احذف «\(a.title)»", role: .destructive) {
                withAnimation(.snappy) { orders.deleteAddress(a.id) }
                Haptics.removed()
            }
            Button("إلغاء", role: .cancel) {}
        }
    }

    private func row(_ a: DeliveryAddress) -> some View {
        let on = orders.address?.id == a.id
        let outside = OrderCenter.outside(a, catalog.store)
        return VStack(alignment: .leading, spacing: 10) {
            Button {
                orders.selectAddress(a.id)
                Haptics.selected()
                if picking { onPicked(); dismiss() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: a.title == "الدوام" ? "briefcase.fill" : a.title == "البيت" ? "house.fill" : "mappin.and.ellipse")
                        .font(.ui(size: 16, weight: .semibold))
                        .foregroundStyle(on ? .white : Theme.brandDeep)
                        .frame(width: 40, height: 40)
                        .background(on ? Theme.brand : Theme.mint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tv: a.title).font(.ui(size: 15.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(tv: a.details.isEmpty ? "على الموقع المحدد في الخريطة" : a.details)
                            .font(.ui(size: 13)).foregroundStyle(Theme.muted).lineLimit(1)
                        if outside {
                            Text("برّا منطقة التوصيل").font(.ui(size: 12.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
                        }
                    }
                    Spacer(minLength: 4)
                    if on {
                        Image(systemName: "checkmark.circle.fill").font(.ui(size: 20)).foregroundStyle(Theme.brand)
                            .accessibilityLabel("المختار")
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle(scale: 0.98))
            .accessibilityAddTraits(on ? .isSelected : [])
            .accessibilityHint(picking ? "يوصل الطلب على هالعنوان" : "يختاره لطلبك الجاي")

            HStack(spacing: 8) {
                if !on && !picking {
                    small("وصّلوا هنا") { orders.selectAddress(a.id); Haptics.selected() }
                }
                small("عدّل") { editor = .edit(a.id) }
                small("احذف", destructive: true) { confirmDelete = a }
            }
        }
        .padding(12)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(on ? Theme.brand.opacity(0.5) : Theme.line, lineWidth: on ? 1.5 : 1))
    }

    private func small(_ title: String, destructive: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(tv: title)
                .font(.ui(size: 13, weight: .semibold))
                .foregroundStyle(destructive ? Theme.copperInk : Theme.ink)
                .padding(.horizontal, 14).frame(minHeight: 36)
                .background(.white, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(Theme.line))
        }
        .buttonStyle(PressableStyle(scale: 0.95))
    }
}
