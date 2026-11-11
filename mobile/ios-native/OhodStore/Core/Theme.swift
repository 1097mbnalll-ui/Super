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
    static let brand = Color(hex: 0x3F9A82)       // أخ ٤
    static let brandDeep = Color(hex: 0x2E7D69)
    static let copper = Color(hex: 0xD8843C)      // نح ٤
    static let copperInk = Color(hex: 0xC26A22)
    static let copperSoft = Color(hex: 0xFCF1E6)
    static let olive = Color(hex: 0xB5AC70)       // خل ٧
    static let oliveInk = Color(hex: 0x7A7238)
    static let oliveSoft = Color(hex: 0xF2F0E3)
    static let mint = Color(hex: 0xE3F5EF)        // خف ١
    static let mintSoft = Color(hex: 0xF3FAF7)
    static let ink = Color(hex: 0x1A2233)
    static let muted = Color(hex: 0x7C8290)
    static let line = Color(hex: 0xE6E8EC)
    static let surface = Color(hex: 0xF7F8FA)

    static let bannerGradient = LinearGradient(colors: [brand, olive, copper], startPoint: .trailing, endPoint: .leading)
    static let headerGradient = LinearGradient(colors: [mint, mintSoft, .white], startPoint: .top, endPoint: .bottom)
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
        .custom(weight.rawValue, size: size, relativeTo: style)
    }
}

enum Money {
    /// أرقام إنجليزية بخانتين (قرار المالك): 2.00
    static func plain(_ value: Double) -> String { String(format: "%.2f", value) }
    static func sar(_ value: Double) -> String { "\(plain(value)) ر.س" }
    /// للنصوص (حد التوصيل المجاني، أقل طلب): 30 ر.س بدل 30.00
    static func short(_ value: Double) -> String {
        value == value.rounded() ? "\(Int(value)) ر.س" : sar(value)
    }
}
