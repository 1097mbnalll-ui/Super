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
import json,sys,re
d=json.load(sys.stdin)["devices"]
best=None
for rt,devs in d.items():
    if "iOS" not in rt: continue
    v=tuple(int(x) for x in re.findall(r"(\d+)", rt.split("iOS")[-1])[:2])
    for dev in devs:
        n=dev["name"]
        if n.startswith("iPhone") and "Pro" in n and "Max" not in n:
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

shot() {  # shot <name> <args...>
  local name="$1"; shift
  xcrun simctl terminate "$DEVICE" sa.ohod.store >/dev/null 2>&1 || true
  xcrun simctl launch "$DEVICE" sa.ohod.store "$@" >/dev/null
  sleep "${WAIT:-9}"
  xcrun simctl io "$DEVICE" screenshot --type=png "$OUT/$name.png" >/dev/null
  echo "shot $name"
}
WAIT=14 shot 01-home -seed-cart
shot 02-categories -screen categories
shot 03-category -screen category:dairy
shot 04-product -screen product:first
shot 05-cart -screen cart
shot 06-offers -screen offers
shot 07-account -screen account
WAIT=12 shot 08-address -screen address
shot 09-placed -seed-order -screen placed
shot 10-account-order -screen account
shot 11-order-details -screen orderdetails
shot 12-home-order -screen home
ls -la "$OUT"
