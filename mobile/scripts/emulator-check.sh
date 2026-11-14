#!/usr/bin/env bash
# يشتغل داخل محاكي أندرويد في GitHub Actions (android-emulator-runner).
# ١) تشغيل بارد ٣ مرات ٢) فحص الشاشات والحواف والتمرير ٣) تدوير الشاشة ٤) اختبار ضغط عشوائي (monkey) بثلاث بذور
set -uo pipefail
OUT=emu-out; mkdir -p "$OUT"
PKG=sa.ohod.store
APK=$(ls android/app/build/outputs/apk/debug/*.apk | head -1)
FAIL=0
adb install -r "$APK" || exit 1
adb shell wm size > "$OUT/device.txt"; adb shell getprop ro.product.model >> "$OUT/device.txt"; adb shell getprop ro.build.version.release >> "$OUT/device.txt"
adb shell dumpsys webviewupdate | grep -iE "Current WebView package|versionName" | head -3 >> "$OUT/device.txt"
cat "$OUT/device.txt"
# 1) تشغيل بارد ثلاث مرات
for i in 1 2 3; do
  adb shell am force-stop $PKG; sleep 2
  adb shell am start -W -n $PKG/.MainActivity | grep -E "TotalTime|Status" | tr '\n' ' ' | tee -a "$OUT/coldstart.txt"; echo "" >> "$OUT/coldstart.txt"; echo
  sleep 6
done
adb logcat -c
adb shell am force-stop $PKG; sleep 2
adb shell am start -W -n $PKG/.MainActivity > "$OUT/start.txt"
sleep 15
PID=$(adb shell pidof $PKG | tr -d '\r')
echo "pid=$PID"
adb shell dumpsys gfxinfo $PKG reset > /dev/null
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID"
node scripts/emulator-check.cjs "$OUT" || FAIL=1
adb shell dumpsys gfxinfo $PKG > "$OUT/gfxinfo.txt"
adb shell dumpsys window | grep -iE "mCurrentFocus|InsetsSource.*(statusBars|navigationBars)" | head -6 > "$OUT/window.txt"; cat "$OUT/window.txt"
# 3) تدوير الشاشة (أفقي ثم رجوع) والتأكد إن التطبيق ما طاح
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1; sleep 4
adb exec-out screencap -p | node scripts/snap.cjs "$OUT/10-landscape.png"
adb shell settings put system user_rotation 0; sleep 4
adb exec-out screencap -p | node scripts/snap.cjs "$OUT/11-portrait-again.png"
adb shell pidof $PKG > /dev/null || { echo "APP DIED after rotation"; FAIL=1; }
# 4) ضغط عشوائي: ثلاث بذور، ٣٠٠ حدث لكل واحدة
for SEED in 11 22 33; do
  adb shell monkey -p $PKG --pct-syskeys 0 --pct-appswitch 0 --throttle 120 -s $SEED --ignore-timeouts 300 > "$OUT/monkey-$SEED.txt" 2>&1
  tail -3 "$OUT/monkey-$SEED.txt"
  grep -qE "crash|CRASH|ANR" "$OUT/monkey-$SEED.txt" && { echo "MONKEY FOUND A PROBLEM (seed $SEED)"; FAIL=1; }
  adb shell am start -n $PKG/.MainActivity > /dev/null; sleep 3
done
adb exec-out screencap -p | node scripts/snap.cjs "$OUT/12-after-monkey.png"
adb shell dumpsys meminfo $PKG | grep -E "TOTAL PSS|TOTAL:" | head -2 > "$OUT/mem.txt"; cat "$OUT/mem.txt"
adb logcat -d > "$OUT/logcat.txt"
grep -E "FATAL EXCEPTION|ANR in $PKG|Process: $PKG.*died" "$OUT/logcat.txt" | head -10 > "$OUT/crashes.txt"
if [ -s "$OUT/crashes.txt" ]; then
  echo "CRASHES:"; cat "$OUT/crashes.txt"; FAIL=1
  grep -A22 "ANR in $PKG" "$OUT/logcat.txt" | head -60 | cut -c1-220 > "$OUT/anr-context.txt"
  adb root > /dev/null 2>&1; sleep 2; adb shell 'ls -t /data/anr 2>/dev/null | head -1' > "$OUT/anr-file.txt"
  F=$(tr -d '\r' < "$OUT/anr-file.txt"); [ -n "$F" ] && adb shell "head -c 9000 /data/anr/$F" 2>/dev/null | grep -E "main|\"main\"|at |sa.ohod|webview|chromium" | head -40 > "$OUT/anr-trace.txt"
fi
grep -iE "Capacitor/Console.*(Error|Uncaught)|chromium.*Uncaught" "$OUT/logcat.txt" | sed 's/^.*Capacitor/Capacitor/' | sort | uniq -c | head -8 > "$OUT/js-errors.txt"; cat "$OUT/js-errors.txt"
exit $FAIL
