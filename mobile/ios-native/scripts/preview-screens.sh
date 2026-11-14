#!/bin/bash
# يبني التطبيق للمحاكي ويصوّر الشاشات (للمراجعة قبل TestFlight). يشتغل على Codemagic (ماك).
# الصور تنحفظ في $OUT (افتراضياً screenshots/ في جذر المستودع).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT:-$PWD/../../screenshots}"
mkdir -p "$OUT"
export OHOD_BUILD_NUMBER="${OHOD_BUILD_NUMBER:-1}"

xcodegen generate
xcodebuild -project OhodStore.xcodeproj -scheme OhodStore -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build 2>&1 | tee "$OUT/build.log" | grep -E "error:|warning: .*deprecated|BUILD (SUCCEEDED|FAILED)" || true
grep -q "BUILD SUCCEEDED" "$OUT/build.log" || { echo "BUILD FAILED"; grep -E "error:" "$OUT/build.log" | head -60; exit 1; }

APP="build/Build/Products/Debug-iphonesimulator/OhodStore.app"

# أحدث آيفون Pro متوفر في المحاكي
DEVICE=$(xcrun simctl list devices available -j | python3 -c '
import json,sys,re,os
d=json.load(sys.stdin)["devices"]
best=None
for rt,devs in d.items():
    if "iOS" not in rt: continue
    v=tuple(int(x) for x in re.findall(r"(\d+)", rt.split("iOS")[-1])[:2])
    for dev in devs:
        n=dev["name"]
        want_max = os.environ.get("SIM_MAX") == "1"   # صور المتجر: Pro Max (مقاس ٦٫٩ اللي تطلبه آبل)
        if n.startswith("iPhone") and "Pro" in n and (("Max" in n) == want_max):
            key=(v, n)
            if best is None or key>best[0]: best=(key, dev["udid"])
print(best[1] if best else "")')
[ -n "$DEVICE" ] || { echo "no simulator"; xcrun simctl list devices available; exit 1; }
echo "Simulator: $DEVICE"
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b
# عربي + الساعة 9:41 مثل صور آبل
xcrun simctl spawn "$DEVICE" defaults write -g AppleLanguages -array ar
xcrun simctl spawn "$DEVICE" defaults write -g AppleLocale -string ar_SA
xcrun simctl status_bar "$DEVICE" override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 || true
xcrun simctl install "$DEVICE" "$APP"
[ -f "$APP/PrivacyInfo.xcprivacy" ] && echo "privacy manifest: OK" || echo "privacy manifest: MISSING"

shot() {  # shot <name> <args...>
  local name="$1"; shift
  xcrun simctl terminate "$DEVICE" sa.ohod.store >/dev/null 2>&1 || true
  xcrun simctl launch "$DEVICE" sa.ohod.store ${NP:-} "$@" >/dev/null
  sleep "${WAIT:-9}"
  xcrun simctl io "$DEVICE" screenshot --type=png "$OUT/$name.png" >/dev/null
  echo "shot $name"
}
if [ "${CHECK:-}" = "full" ]; then
  # فحص شامل (طلب المالك ١٤ نوفمبر ٢٠٢٦): كل شاشات الزبون بالعربي (الإنجليزي موقوف)
  # سؤال الإشعارات آخر شي: لو انسأل أول، نافذة آبل تبقى فوق كل الصور (المحاكي ما يضغط «سماح»)
  NP=-no-push
  WAIT=3 shot f02-home-3s
  WAIT=14 shot f03-home
  shot f04-categories -screen categories
  for c in dairy drinks sweets pantry meat cartons clean care misc bakery cheese veg roast print; do shot "f05-cat-$c" -screen "category:$c"; done
  shot f06-product-sale -screen product:x6281057001408
  shot f07-product-qty -screen product:x6287000260922
  shot f08-product-carton -screen product:x6271002205159
  shot f09-product-deemah -screen product:x6285602019306
  shot f10-product-soon -screen product:v_orange
  WAIT=12 shot f11-deemah-picker -screen live:g:deemah:x6285602019306
  shot f12-search -screen search
  shot f13-offers -screen offers
  shot f14-deals -screen deals
  shot f15-daily -screen daily
  WAIT=3 shot f16-cart-group-3s -seed-group -screen cart
  shot f17-cart-group -seed-group -screen cart
  shot f18-cart -seed-cart -screen cart
  WAIT=12 shot f19-address -seed-cart -screen address
  shot f20-account -screen account
  shot f21-placed -seed-order -screen placed
  shot f22-order-details -seed-driver -screen orderdetails
  shot f23-home-active-order -seed-driver -screen home
  shot f24-sub-offer -seed-order -seed-sub -screen account
  shot f25-promo-home -seed-promos -screen home
  shot f26-bundle -seed-promos -screen bundle
  shot f27-promo-cart -seed-promos -seed-promo-cart -screen cart
  NP=
  WAIT=5 shot f01-first-launch
  ls -la "$OUT"; exit 0
fi
if [ "${CHECK:-}" = "1" ]; then
  # فحص شكاوى المالك (١٤ نوفمبر ٢٠٢٦): طلب الإشعارات أول فتحة، أول الفتح بدون صفحة قديمة، الخضار «قريباً»، عرض ديمة
  WAIT=5 shot c01-first-launch-push
  xcrun simctl spawn "$DEVICE" defaults write sa.ohod.store push.asked -bool YES
  WAIT=2 shot c02-home-2s
  WAIT=5 shot c03-home-5s
  WAIT=14 shot c04-home-14s
  shot c05-veg -screen category:veg
  shot c06-deemah-product -screen product:x6285602019306
  WAIT=12 shot c07-deemah-picker -screen live:g:deemah:x6285602019306
  shot c08-bakery -screen category:bakery
  WAIT=12 shot c08b-deemah-page-home -screen live:g:deemah
  WAIT=12 shot c09-home-cart -seed-cart
  shot c10-cart -seed-cart -screen cart
  # عرض ديمة في السلة: السعر لازم يطلع ١١٫٩٥ من أول لحظة (حساب محلي، مو انتظار الخادم)
  WAIT=3 shot c11-cart-group-3s -seed-group -screen cart
  ls -la "$OUT"; exit 0
fi
WAIT=14 shot 01-home -seed-cart
shot 02-categories -screen categories
shot 03-category -screen category:dairy
shot 04-product -screen product:first
shot 05-cart -screen cart
shot 06-offers -screen offers
shot 07-account -screen account
WAIT=12 shot 08-address -screen address
shot 09-placed -seed-order -screen placed
shot 10-account-order -seed-driver -screen account
shot 11-order-details -seed-driver -screen orderdetails
shot 12-home-order -seed-driver -screen home
shot 13-sub-offer -seed-order -seed-sub -screen account
shot 14-promo-home -seed-promos -screen home
shot 15-deals -seed-promos -screen deals
shot 16-daily -seed-promos -screen daily
shot 17-bundle -seed-promos -screen bundle
shot 18-promo-cart -seed-promos -seed-promo-cart -screen cart
# الإنجليزي (زر اللغة في «حسابي»)
shot 19-en-home -app.lang en -AppleLanguages "(en)" -AppleLocale en_US -screen home
shot 20-en-cart -app.lang en -AppleLanguages "(en)" -AppleLocale en_US -screen cart
shot 21-en-account -app.lang en -AppleLanguages "(en)" -AppleLocale en_US -seed-driver -screen account
ls -la "$OUT"
