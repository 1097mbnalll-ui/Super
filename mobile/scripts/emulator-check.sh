#!/usr/bin/env bash
# يشتغل داخل محاكي أندرويد في GitHub Actions (android-emulator-runner)
set -uo pipefail
OUT=emu-out; mkdir -p "$OUT"
APK=$(ls android/app/build/outputs/apk/debug/*.apk | head -1)
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n sa.ohod.store/.MainActivity | tee "$OUT/start.txt"
sleep 15
PID=$(adb shell pidof sa.ohod.store | tr -d '\r')
echo "pid=$PID"
adb shell dumpsys gfxinfo sa.ohod.store reset > /dev/null
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID"
node scripts/emulator-check.cjs "$OUT"; RC=$?
adb shell dumpsys gfxinfo sa.ohod.store > "$OUT/gfxinfo.txt"
grep -E "Total frames|Janky frames|percentile" "$OUT/gfxinfo.txt" | head -8
adb shell dumpsys meminfo sa.ohod.store | grep -E "TOTAL PSS|TOTAL:" | head -2 > "$OUT/mem.txt"; cat "$OUT/mem.txt"
adb logcat -d > "$OUT/logcat.txt"
grep -iE "FATAL|AndroidRuntime|chromium.*Uncaught|Console.*error" "$OUT/logcat.txt" | head -20 || true
exit $RC
