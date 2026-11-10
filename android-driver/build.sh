#!/usr/bin/env bash
# بناء تطبيق المندوب (APK) بدون Android Studio.
# المتطلبات (Ubuntu/Debian):  apt install openjdk-17-jdk-headless aapt dalvik-exchange apksigner zipalign python3-pil
# التشغيل:  ./build.sh        الناتج: out/ohod-driver.apk
set -euo pipefail
cd "$(dirname "$0")"

# مكتبة أندرويد (واجهات الإصدار ٣٤) للترجمة فقط؛ تنزل مرة وحدة من Maven Central
AJ="${ANDROID_JAR:-$HOME/.cache/ohod-android/android-all-34.jar}"
if [ ! -f "$AJ" ]; then
  mkdir -p "$(dirname "$AJ")"
  curl -fL -o "$AJ" https://repo.maven.apache.org/maven2/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar
fi

# مفتاح التوقيع: لازم تحتفظ فيه، لأن أي تحديث للتطبيق لازم ينوقّع بنفس المفتاح
KS="${KEYSTORE:-keystore/ohod-driver.jks}"; KP="${KEYSTORE_PASS_FILE:-keystore/ohod-driver.pass}"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20 > "$KP"
  keytool -genkeypair -keystore "$KS" -storepass "$(cat "$KP")" -keypass "$(cat "$KP")" -alias ohod \
    -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Matajer Ohod Driver, O=Matajer Ohod, C=SA" >/dev/null 2>&1
  echo "تم إنشاء مفتاح توقيع جديد في $KS (احفظه)"
fi

rm -rf build; mkdir -p build/gen build/classes out
# ١) الموارد والـ manifest (يولّد R.java)
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -I "$AJ" -0 arsc \
  --min-sdk-version 24 --target-sdk-version 34 -F build/res.apk
# ٢) ترجمة الجافا
javac -encoding UTF-8 --release 8 -Xlint:-options -classpath "$AJ" -d build/classes \
  $(find src build/gen -name '*.java')
# ٣) تحويل لصيغة أندرويد (dex)
DX="$(command -v dx || command -v dalvik-exchange)"
"$DX" --dex --min-sdk-version=24 --output=build/classes.dex build/classes
# ٤) التجميع والمحاذاة والتوقيع
cp build/res.apk build/app.apk
(cd build && aapt add app.apk classes.dex >/dev/null)
zipalign -f -p 4 build/app.apk build/aligned.apk
apksigner sign --ks "$KS" --ks-pass "pass:$(cat "$KP")" --key-pass "pass:$(cat "$KP")" --ks-key-alias ohod \
  --out out/ohod-driver.apk build/aligned.apk
# ملف الإصدار: التطبيق يقرأه من الموقع ويعرض «حدّث الآن». انسخه بجنب driver-app.apk
VC=$(aapt dump badging out/ohod-driver.apk | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p" | head -1)
VN=$(aapt dump badging out/ohod-driver.apk | sed -n "s/.*versionName='\([^']*\)'.*/\1/p" | head -1)
printf '{"code":%s,"name":"%s","url":"driver-app.apk","sha256":"%s","min":0,"note":"نزل إصدار أحدث من التطبيق فيه تحسينات."}\n' "$VC" "$VN" "$(sha256sum out/ohod-driver.apk | cut -d' ' -f1)" > out/driver-app.json
apksigner verify out/ohod-driver.apk && echo "OK: out/ohod-driver.apk ($(du -h out/ohod-driver.apk | cut -f1))"
