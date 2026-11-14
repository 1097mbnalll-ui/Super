#!/usr/bin/env bash
# يشتغل داخل المحاكي: يثبّت تطبيق المالك ويشغّله ويتأكد إن شاشة كلمة السر انفتحت
set -uo pipefail
OUT=owner-out; mkdir -p "$OUT"
APK=$(ls android/app/build/outputs/apk/debug/*.apk | head -1)
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -W -n sa.ohod.owner/sa.ohod.store.OwnerActivity | tee "$OUT/start.txt"
sleep 8
PID=$(adb shell pidof sa.ohod.owner | tr -d '\r'); echo "pid=$PID"
[ -z "$PID" ] && { echo "APP NOT RUNNING"; adb logcat -d | grep -E "FATAL|AndroidRuntime" -A12 | head -40 > "$OUT/crash.txt"; cat "$OUT/crash.txt"; exit 1; }
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID"
node scripts/owner-check.cjs "$OUT"; RC=$?
adb logcat -d > "$OUT/logcat.txt"
grep -E "FATAL EXCEPTION|ANR in sa.ohod.owner" "$OUT/logcat.txt" | head -5 > "$OUT/crashes.txt"; [ -s "$OUT/crashes.txt" ] && { cat "$OUT/crashes.txt"; RC=1; }
exit $RC
