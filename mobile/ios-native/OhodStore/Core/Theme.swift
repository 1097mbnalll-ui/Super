import SwiftUI

// الألوان المعتمدة (mobile/ios-native/DESIGN.md): أخضر الشعار، النحاسي، الزيتوني، والخلفية النعناعية
extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }

    /// لون من نص مثل "#FFEBD6" (ألوان الأقسام في data.json)
    init?(hexString: String?) {
        guard let raw = hexString?.trimmingCharacters(in: .whitespaces), raw.hasPrefix("#"),
              let value = UInt32(raw.dropFirst(), radix: 16), raw.count == 7 else { return nil }
        self.init(hex: value)
    }
}

enum Theme {
    // نسخة ٢ (اعتمدها المالك ١١ نوفمبر). الأساسي ولون العروض يتغيرون من «شكل التطبيق» في الإدارة
    static var brand: Color { Color(hexString: AppLook.current.brand) ?? Color(hex: 0x0E8A6A) }
    static var brandDeep: Color { AppLook.current.brand == nil ? Color(hex: 0x086650) : brand }
    static var copper: Color { Color(hexString: AppLook.current.accent) ?? Color(hex: 0xEE7417) }
    static var copperInk: Color { AppLook.current.accent == nil ? Color(hex: 0xC4560A) : copper }
    static let copperSoft = Color(hex: 0xFFF1E4)
    static let olive = Color(hex: 0xB5AC70)
    static let oliveInk = Color(hex: 0x6E6420)
    static let oliveSoft = Color(hex: 0xEFEACB)
    static let mint = Color(hex: 0xDDF1EA)
    static let mintSoft = Color(hex: 0xF0F8F5)
    static let ink = Color(hex: 0x0D1420)
    static let muted = Color(hex: 0x596171)
    static let line = Color(hex: 0xE3E8E6)
    static let surface = Color(hex: 0xF3F6F5)

    static var bannerGradient: LinearGradient {
        AppLook.current.accent == nil
            ? LinearGradient(colors: [Color(hex: 0xF08A2A), Color(hex: 0xE2661A), Color(hex: 0xC9501A)], startPoint: .topTrailing, endPoint: .bottomLeading)
            : LinearGradient(colors: [copper, copper.opacity(0.8)], startPoint: .topTrailing, endPoint: .bottomLeading)
    }
    static var headerGradient: LinearGradient {
        AppLook.current.brand == nil
            ? LinearGradient(colors: [Color(hex: 0x12A07C), Color(hex: 0x0B7A5E), Color(hex: 0x07604A)], startPoint: .topTrailing, endPoint: .bottomLeading)
            : LinearGradient(colors: [brand, brand.opacity(0.82)], startPoint: .topTrailing, endPoint: .bottomLeading)
    }
    /// خلفية الصفحات من «شكل التطبيق»
    static var pageBG: Color { AppLook.current.background == "gray" ? Color(hex: 0xF3F5F4) : .white }
    /// حواف الكروت من «شكل التطبيق»
    static var cardRadius: CGFloat { ["soft": 12, "square": 6][AppLook.current.radius] ?? 18 }
    /// حجم زر الإضافة والعداد يكبر ويصغر مع الخط
    static var controlScale: CGFloat { CGFloat(AppLook.current.textScale) }
    /// خلفية فاتحة لأعلى الصفحات (الأقسام وصفحة المنتج)
    static let softGradient = LinearGradient(colors: [mint, mintSoft, .white], startPoint: .top, endPoint: .bottom)
    static let tileGradient = LinearGradient(colors: [mint, Color(hex: 0xF5FBF9)], startPoint: .top, endPoint: .bottom)
}

/// ثمانية (Noto Kufi Arabic) للعناوين والأسعار والأزرار الرئيسية؛ الباقي خط آبل (system)
enum Kufi: String {
    case medium = "NotoKufiArabic-Medium"
    case semibold = "NotoKufiArabic-SemiBold"
    case bold = "NotoKufiArabic-Bold"
}

extension Font {
    static func kufi(_ size: CGFloat, _ weight: Kufi = .bold, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(weight.rawValue, size: size * AppLook.current.textScale, relativeTo: style)
    }
    /// خط آبل بحجم يتكبّر ويتصغّر من «شكل التطبيق» في الإدارة
    static func ui(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size * AppLook.current.textScale, weight: weight)
    }
}

enum Money {
    /// أرقام إنجليزية بخانتين (قرار المالك): 2.00
    static func plain(_ value: Double) -> String { String(format: "%.2f", value) }
    static func sar(_ value: Double) -> String { "\(plain(value)) \(AppLang.english ? "SAR" : "ر.س")" }
    /// للنصوص (حد التوصيل المجاني، أقل طلب): 30 ر.س بدل 30.00
    static func short(_ value: Double) -> String {
        value == value.rounded() ? "\(Int(value)) \(AppLang.english ? "SAR" : "ر.س")" : sar(value)
    }
}
