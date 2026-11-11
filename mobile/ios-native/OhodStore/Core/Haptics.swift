import UIKit

/// الاهتزاز حسب دليل آبل: قليل وله معنى ثابت. يطفى من «حسابي».
@MainActor
enum Haptics {
    nonisolated static var enabled: Bool {
        get { UserDefaults.standard.object(forKey: "haptics") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "haptics") }
    }

    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let soft = UIImpactFeedbackGenerator(style: .soft)
    private static let selection = UISelectionFeedbackGenerator()
    private static let notify = UINotificationFeedbackGenerator()

    /// أول ما ينضاف المنتج للسلة (٠ → ١)
    static func added() { guard enabled else { return }; light.impactOccurred() }
    /// لما ينشال من السلة (→ ٠)
    static func removed() { guard enabled else { return }; soft.impactOccurred(intensity: 0.7) }
    /// تبديل اختيار: قسم فرعي، حبة/شدّة، طريقة الدفع
    static func selected() { guard enabled else { return }; selection.selectionChanged() }
    static func success() { guard enabled else { return }; notify.notificationOccurred(.success) }
    /// وصل الحد الأقصى أو خطأ
    static func warning() { guard enabled else { return }; notify.notificationOccurred(.warning) }
}
