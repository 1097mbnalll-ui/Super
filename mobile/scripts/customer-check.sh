#!/usr/bin/env bash
# داخل المحاكي: يثبّت تطبيق الزبون (يفتح الموقع الحي) ويفحص صفحة العروض
set -uo pipefail
OUT=cust-out; mkdir -p "$OUT"
APK=$(ls android/app/build/outputs/apk/debug/*.apk | head -1)
adb install -r "$APK" || exit 1
adb shell am start -W -n sa.ohod.store/.MainActivity | tee "$OUT/start.txt"
sleep 12
PID=$(adb shell pidof sa.ohod.store | tr -d '\r'); echo "pid=$PID"
[ -z "$PID" ] && { echo "APP NOT RUNNING"; exit 1; }
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID"
node scripts/customer-check.cjs "$OUT"; RC=$?
adb logcat -d | grep -E "FATAL EXCEPTION|ANR in sa.ohod.store" | head -5 > "$OUT/crashes.txt"; [ -s "$OUT/crashes.txt" ] && { cat "$OUT/crashes.txt"; RC=1; }
exit $RC
