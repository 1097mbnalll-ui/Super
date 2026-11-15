#!/usr/bin/env bash
# يفتح التطبيق والنت مقطوع (وضع الطيران) ويتأكد إن صفحة «ما فيه نت» طلعت، وبعدين يرجع النت ويتأكد إن المتجر رجع لحاله
# الاستخدام: app-offline.sh <package> <component> <out-dir>
PKG=$1; CMP=$2; OUT=$3; mkdir -p "$OUT"; RC=0
snap(){ adb exec-out screencap -p | node scripts/snap.cjs "$OUT/$1.png"; }
dom(){ local P; P=$(adb shell pidof "$PKG" | tr -d '\r'); [ -z "$P" ] && { echo "$1 APP NOT RUNNING" | tee -a "$OUT/dom.txt"; return 2; }
  adb forward --remove-all; adb forward tcp:9222 "localabstract:webview_devtools_remote_$P" >/dev/null; timeout 40 node scripts/offline-check.cjs "$OUT" "$1" "$2"; }
adb shell cmd connectivity airplane-mode enable; adb shell svc wifi disable; adb shell svc data disable; sleep 4
adb shell am force-stop $PKG; adb shell am start -W -n $CMP > /dev/null; sleep 8
snap offline; dom "offline@8s" offline || RC=1
sleep 10; snap offline-18s; dom "offline@18s" offline || RC=1
adb shell cmd connectivity airplane-mode disable; adb shell svc wifi enable; adb shell svc data enable; sleep 25
snap back-online; dom "online-again" online || RC=1
exit $RC
