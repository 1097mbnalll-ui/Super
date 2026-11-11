# تطبيق متاجر أحد للآيفون (أصلي SwiftUI): دليل التصميم والسلاسة

> المرجع المعتمد من المالك (١١ نوفمبر ٢٠٢٦). أي شاشة تنبنى لازم تطابق صورتها في `design/`.
> الخادم والبيانات ما تتغير: نفس `data.json` و`ohod-admin` (المصدر `capacitor://localhost` مقبول في `ALLOWED_ORIGIN`).
> أندرويد يبقى على Capacitor (`mobile/android`).

## ١) الشاشات المعتمدة (`design/`)
| الملف | الشاشة |
|---|---|
| `01-home.webp` | الرئيسية: هيدر متدرّج، شعار، «توصيل خلال 30 دقيقة» (إطار منقّط)، العنوان، بحث كبير، بنر، أزرار سريعة (فلتر · لك · العروض · أقسام)، شبكة منتجات ٣ بالصف |
| `02-categories.webp` | الأقسام مجمّعة بعناوين وإيموجي + «عرض الكل»، مربعات ٤ بالصف |
| `03-category.webp` | داخل القسم: أزرار فرعية + شبكة ٣ |
| `04-account.webp` | حسابي: الحرف الأول، الاسم والجوال، EN، «وفّرت معنا»، مربعين (طلباتك · عنوانك)، قوائم |
| `05-product.webp` | المنتج: صورة كبيرة، شريط توفير، طريقة الشراء (حبة/شدّة)، «ممكن يعجبك»، عداد + «أضف للسلة» |
| `06-cart.webp` | السلة: العنوان، شريط التوصيل المجاني، الأسطر بالعداد، «وفّرت»، الدفع + «أرسل الطلب» |
| `07-address.webp` | العنوان: خريطة Apple Maps + منطقة التوصيل + دبوس، نافذة «وين نوصلك؟» |
| `08-order-status.webp` | حالة الطلب: المندوب على الخريطة، الدقايق، شريط المراحل، بطاقة البديل |
| `palette.webp` | لوحة الألوان المرقّمة (الاختيار تحت) |

## ٢) الألوان (معتمدة)
| الرمز | اللون | الاستخدام |
|---|---|---|
| `brand` (أخ ٤) | `#3F9A82` | الأزرار الرئيسية، العداد، التبويب المختار، الأقسام المختارة |
| `brandDeep` | `#2E7D69` | نص على خلفية فاتحة، ضغط الأزرار |
| `copper` (نح ٤) | `#D8843C` | العروض، السعر المخفّض، شريط «عرض»، شريط التوصيل المجاني، «وفّرت» |
| `olive` (خل ٧) | `#B5AC70` | إطارات/حدود مميزة (ETA، الأسماء الصغيرة)، البنر (وسط التدرّج) |
| `oliveInk` | `#7A7238` | نص بلون الزيتوني (تباين كافي) |
| `mint` (خف ١) | `#E3F5EF` | الهيدر، خلفيات المربعات، البطاقات الفاتحة |
| `ink` | `#1A2233` | النص الأساسي |
| `muted` | `#7C8290` | النص الثانوي |
| `line` | `#E6E8EC` | الحدود والفواصل |
| `surface` | `#F7F8FA` | خلفية صورة المنتج |
البنر: تدرّج `brand → olive → copper`. لا أحمر في التطبيق (التخفيض نحاسي).

## ٣) الخط والمقاسات
- الخط: **IBM Plex Sans Arabic** (OFL، يندمج في التطبيق)، مع دعم Dynamic Type (`relativeTo:`).
- المقاسات (نقطة): عنوان الصفحة 22 bold · عنوان قسم 22/17 bold · نص 15 · ثانوي 13 · صغير 11–12 · سعر 16 bold.
- هوامش الشاشة 16، المسافة بين البطاقات 8–12، زوايا البطاقات 16–22، الأزرار 54 ارتفاع وزوايا 16، أقل منطقة لمس 44×44.
- الأرقام إنجليزية (مثل المرجع): `2.00 ر.س`.

## ٤) السلاسة (من دليل آبل ومحاضرات WWDC)
**الحركة:**
- كل الحركات **نوابض (springs)** قابلة للمقاطعة: `.smooth` افتراضي، `.snappy` للضغطات والتبديل، `.bouncy(extraBounce: 0.05)` لشارة السلة لما ينضاف منتج. ما فيه `easeInOut` بمدة ثابتة.
- الحركة تبدأ من مكان العنصر الحالي لو انقاطعت (SwiftUI يتتبّع السرعة تلقائياً مع الإيماءات).
- ما نضيف حركة للأشياء المتكررة اللي النظام يحرّكها أصلاً (القوائم، التبويبات).
- **Reduce Motion:** لو مفعّل نستبدل الانزلاق والتكبير بتلاشي بسيط.

**التنقل:**
- `TabView` و`NavigationStack` الأصلية (تاخذ Liquid Glass تلقائياً مع Xcode 26) + `tabBarMinimizeBehavior(.onScrollDown)`. **ما نسوي شريط تبويب مخصّص** (يكسر Liquid Glass والسلاسة). زر العروض البرتقالي في المرجع = تبويب «العروض» بأيقونة نحاسية.
- فتح المنتج من الكرت: **zoom transition** (`matchedTransitionSource` + `navigationTransition(.zoom)`)، والرجوع بالسحب من الطرف (أصلي، ينعكس للعربي).
- الواجهة كلها `layoutDirection = .rightToLeft` واستخدام leading/trailing فقط، والأيقونات الاتجاهية `chevron.forward/backward`.

**النوافذ (sheets):** العنوان `presentationDetents([.medium, .large])` + مؤشر السحب. أثناء إرسال الطلب `interactiveDismissDisabled`.

**الاهتزاز (`sensoryFeedback`، iOS 17):**
| الحدث | النوع |
|---|---|
| إضافة منتج / زيادة / نقص | `.impact(weight: .light)` |
| تبديل قسم فرعي، طريقة شراء، طريقة دفع، «لو منتج ناقص» | `.selection` |
| الطلب انرسل، موافقة البديل | `.success` |
| وصل الحد الأقصى، خطأ في الطلب، خارج المنطقة | `.warning` / `.error` |
| السحب للتحديث | `.impact(weight: .light)` عند الإفلات |
الاهتزاز دايم مع تغيير مرئي، وما يكون هو الإشارة الوحيدة.

**الضغط:** كل زر/كرت عليه `ButtonStyle` يصغّر لـ 0.96 بـ `.snappy` وقت الضغط. العدادات والأسعار والإجمالي `contentTransition(.numericText())`. شارة السلة `symbolEffect(.bounce)`.

**الأداء (عشان ١٢٠ هرتز بدون تقطيع):**
- `LazyVGrid`/`LazyVStack` بمعرّفات ثابتة (`id` المنتج).
- الصور: تحميل غير متزامن + **تصغير بـ ImageIO** (`CGImageSourceCreateThumbnailAtIndex`) لمقاس الكرت × scale، وذاكرة `NSCache` + `URLCache` على القرص، فك الضغط خارج الـ main thread، وإلغاء التحميل لما الكرت يطلع من الشاشة. لا `AsyncImage` الخام في الشبكات.
- `data.json` (٧٬٧٠٠+ منتج) يتحلل في الخلفية ويتخزّن، وفهرس البحث يُبنى مرة وحدة. البحث بتأخير ~150ms.
- `@Observable` بحالة صغيرة لكل جزء (السلة منفصلة عن الكتالوج) عشان ما يعاد رسم الشبكة كلها مع كل ضغطة.

## ٥) التحقق
- قبل كل نسخة: Codemagic يبني ويشغّل المحاكي ويصوّر الشاشات (artifacts) وتتقارن مع `design/`.
- بعدها TestFlight على جوال المالك. Instruments (Hitches) لو حسّينا بتقطيع.

## مصادر
- Apple HIG: Motion — https://developer.apple.com/design/human-interface-guidelines/motion
- WWDC23 Animate with springs — https://developer.apple.com/videos/play/wwdc2023/10158/
- WWDC18 Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/
- WWDC22 Get it right (to left) — https://developer.apple.com/videos/play/wwdc2022/10107/
- WWDC26 Dive into lazy stacks and scrolling with SwiftUI — https://developer.apple.com/videos/play/wwdc2026/321/
- SwiftUI zoom transition — https://www.hackingwithswift.com/quick-start/swiftui/how-to-create-zoom-animations-between-views
- Sensory feedback — https://useyourloaf.com/blog/swiftui-sensory-feedback/
- Liquid Glass (system components) — https://www.donnywals.com/designing-custom-ui-with-liquid-glass-on-ios-26/
