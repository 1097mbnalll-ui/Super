import SwiftUI

/// زر القلب (المفضلة) على كرت المنتج وفي صفحة المنتج، مثل data-fav في الموقع
struct FavoriteButton: View {
    let productID: String
    /// صفحة المنتج: زر أكبر بدون دائرة (في شريط التنقل)
    var large = false
    @Environment(Favorites.self) private var favorites
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        // المفضلة تنطفي من ملف المتجر (store.app.off فيه "favorites")
        if !catalog.store.isOff("favorites") { heart }
    }

    private var heart: some View {
        let on = favorites.contains(productID)
        return Button {
            withAnimation(.snappy(duration: 0.25)) { favorites.toggle(productID) }
            Haptics.selected()
        } label: {
            Image(systemName: on ? "heart.fill" : "heart")
                .font(.system(size: (large ? 19 : 14) * (large ? 1 : Theme.controlScale), weight: .semibold))
                .foregroundStyle(on ? Color(hex: 0xE8394F) : (large ? Theme.ink : Theme.muted))
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce, value: on)
                .frame(width: large ? 36 : 28 * Theme.controlScale, height: large ? 36 : 28 * Theme.controlScale)
                .background { if !large { Circle().fill(Color.white.opacity(0.94)).shadow(color: .black.opacity(0.12), radius: 2, y: 1) } }
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle(scale: 0.88))
        .accessibilityLabel(on ? "شيل من المفضلة" : "أضف للمفضلة")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
