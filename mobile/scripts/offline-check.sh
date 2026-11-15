#!/usr/bin/env bash
# داخل المحاكي: نفتح التطبيقين والنت مقطوع (وضع الطيران) ونصوّر ونقرأ الصفحة
set -uo pipefail
OUT=offline-out; mkdir -p "$OUT"
snap(){ adb exec-out screencap -p | node scripts/snap.cjs "$OUT/$1.png"; }
dom(){ local P; P=$(adb shell pidof "$1" | tr -d '\r'); [ -z "$P" ] && { echo "$2 APP NOT RUNNING" | tee -a "$OUT/dom.txt"; return; }; adb forward --remove-all; adb forward tcp:9222 "localabstract:webview_devtools_remote_$P" >/dev/null; node scripts/offline-check.cjs "$OUT" "$2"; }
adb install -r apk/customer.apk; adb install -r apk/owner.apk
for APP in "sa.ohod.store/.MainActivity:customer" "sa.ohod.owner/sa.ohod.store.OwnerActivity:owner"; do
  CMP=${APP%%:*}; NAME=${APP##*:}; PKG=${CMP%%/*}
  adb shell cmd connectivity airplane-mode enable; adb shell svc wifi disable; adb shell svc data disable; sleep 4
  adb logcat -c
  adb shell am force-stop $PKG; adb shell am start -W -n $CMP > /dev/null
  sleep 6;  snap "$NAME-offline-6s";  dom $PKG "$NAME@6s"
  sleep 14; snap "$NAME-offline-20s"; dom $PKG "$NAME@20s"
  adb logcat -d | grep -iE "Capacitor|chromium|net::ERR|errorPath|WebView" | grep -iE "err|fail|offline|load" | head -25 > "$OUT/$NAME-logcat.txt"
  # back online: it should come back by itself
  adb shell cmd connectivity airplane-mode disable; adb shell svc wifi enable; adb shell svc data enable; sleep 20
  snap "$NAME-back-online"; dom $PKG "$NAME@online"
  adb shell am force-stop $PKG
done
cat "$OUT/dom.txt"
