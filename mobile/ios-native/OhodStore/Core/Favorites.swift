import Foundation
import Observation

/// المفضلة: على الجوال بس (UserDefaults) وما تنرسل لأحد، مثل ohod-fav في الموقع. الأحدث أول، وأقصى ٣٠٠ منتج.
/// الصفحات الحية من الموقع تاخذها بالرابط (fav=…) وترد بـ {t: "fav", id, on} (LiveBridge)
@MainActor
@Observable
final class Favorites {
    static let key = "favorites"

    private(set) var ids: [String] = UserDefaults.standard.stringArray(forKey: "favorites") ?? [] {
        didSet { UserDefaults.standard.set(ids, forKey: Self.key) }
    }

    func contains(_ id: String) -> Bool { ids.contains(id) }

    /// يرجع true لو صار مفضّل
    @discardableResult
    func toggle(_ id: String) -> Bool {
        let on = !contains(id)
        set(id, on: on)
        return on
    }

    func set(_ id: String, on: Bool) {
        guard !id.isEmpty else { return }
        var list = ids.filter { $0 != id }
        if on { list.insert(id, at: 0) }
        if list.count > 300 { list = Array(list.prefix(300)) }
        if list != ids { ids = list }
    }

    /// للصفحات الحية: قراءة مباشرة بدون مراقبة، عشان الصفحة ما تنعاد تحميلها مع كل ضغطة قلب
    static var stored: [String] { UserDefaults.standard.stringArray(forKey: key) ?? [] }
}
