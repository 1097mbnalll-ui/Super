# صور App Store / Play
1. من جذر المستودع: `python3 -m http.server 8765 --bind 127.0.0.1`
2. `node mobile/store/screenshots/capture.cjs /tmp/raw` (صور خام ١٢٩٠×٢٧٩٦ من وضع التطبيق)
3. `node mobile/store/screenshots/design.cjs /tmp/raw /tmp/out` (الصور المصممة: عنوان + جوال، بهوية المتجر)

النصوص في `design.cjs` (`slides`). لا تكتب ادعاء غير صحيح (التوصيل المجاني فوق `store.freeOver` فقط). الصور الناتجة ما تنحفظ بالمستودع.
