import Foundation
import SwiftUI

/// لغة التطبيق (زر EN في الموقع): العربي الأساس، والإنجليزي يقلب الاتجاه ويترجم النصوص ويستخدم أسماء المنتجات الإنجليزية (name_en)
enum AppLang {
    /// الاختيار محفوظ، ويطبق كامل لما ينفتح التطبيق (نصوص الواجهة من ملف الترجمة)
    static let english: Bool = UserDefaults.standard.string(forKey: "app.lang") == "en"

    static func set(english on: Bool) {
        UserDefaults.standard.set(on ? "en" : "ar", forKey: "app.lang")
        UserDefaults.standard.set(on ? ["en"] : ["ar"], forKey: "AppleLanguages")
    }

    static var direction: LayoutDirection { english ? .leftToRight : .rightToLeft }
    static var locale: Locale { Locale(identifier: english ? "en_US" : "ar_SA@numbers=latn") }
}

/// ترجمة نص مبني وقت التشغيل (رسائل، عناوين): يطابق القالب العربي ويعبّي القيم في القالب الإنجليزي
func tr(_ s: String) -> String {
    guard AppLang.english, !s.isEmpty else { return s }
    return Translator.shared.translate(s)
}

final class Translator: @unchecked Sendable {
    static let shared = Translator()
    private var exact: [String: String] = [:]
    private var patterns: [(NSRegularExpression, String)] = []
    private var cache: [String: String] = [:]
    private let lock = NSLock()

    private init() {
        for (ar, en) in EnglishTable {
            if ar.contains("{}") {
                let parts = ar.components(separatedBy: "{}").map(NSRegularExpression.escapedPattern(for:))
                if let re = try? NSRegularExpression(pattern: "^" + parts.joined(separator: "(.+?)") + "$", options: [.dotMatchesLineSeparators]) {
                    patterns.append((re, en))
                }
            } else {
                exact[ar] = en
            }
        }
    }

    func translate(_ s: String) -> String {
        lock.lock(); defer { lock.unlock() }
        if let c = cache[s] { return c }
        var out = s
        if let e = exact[s] { out = e }
        else {
            let range = NSRange(s.startIndex..., in: s)
            for (re, en) in patterns {
                guard let m = re.firstMatch(in: s, range: range) else { continue }
                var r = en
                for i in 1..<m.numberOfRanges {
                    let v = Range(m.range(at: i), in: s).map { String(s[$0]) } ?? ""
                    if let p = r.range(of: "{}") { r.replaceSubrange(p, with: translate0(v)) }
                }
                out = r
                break
            }
        }
        cache[s] = out
        return out
    }

    /// القيم داخل القالب (مثل «ر.س» أو اسم حالة) تترجم لو كانت نص معروف
    private func translate0(_ v: String) -> String {
        if let e = exact[v] { return e }
        return v.replacingOccurrences(of: "ر.س", with: "SAR")
    }
}

extension Text {
    /// نص مبني وقت التشغيل (بدل Text(tv:)) ويترجم للإنجليزي
    init(tv s: String) { let t = tr(s); self.init(verbatim: Money.sym == "ر.س" ? t : t.replacingOccurrences(of: "ر.س", with: Money.sym)) }
}
