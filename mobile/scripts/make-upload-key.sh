#!/usr/bin/env bash
# Creates the Android UPLOAD KEY for Google Play. Run this ON YOUR OWN MACHINE (needs a JDK: Android Studio ships one).
# NEVER commit the .jks file or the password, and never paste them into chat. The repo is public.
# Back the .jks up in two safe places (password manager + offline copy). Losing it means a support case with Google to reset it.
set -euo pipefail
OUT="${1:-$HOME/ohod-upload-key.jks}"
ALIAS="upload"
[ -e "$OUT" ] && { echo "Refusing to overwrite $OUT"; exit 1; }
read -rsp "Choose a keystore password (12+ characters, no spaces): " PW; echo
read -rsp "Repeat it: " PW2; echo
[ "$PW" = "$PW2" ] && [ ${#PW} -ge 12 ] || { echo "Passwords differ or are too short"; exit 1; }
keytool -genkeypair -keystore "$OUT" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" -dname "CN=Matajer Ohod, O=Matajer Ohod, L=Riyadh, C=SA"
echo
echo "Created: $OUT"
echo "SHA-256 fingerprint (safe to share, Firebase / Play need it):"
keytool -list -v -keystore "$OUT" -alias "$ALIAS" -storepass "$PW" | grep -E "SHA-?256"
echo
echo "Now add 4 GitHub secrets (repo Settings > Secrets and variables > Actions):"
echo "  ANDROID_KEYSTORE_BASE64   = output of:  base64 -w0 \"$OUT\"   (on macOS: base64 -i \"$OUT\")"
echo "  ANDROID_KEYSTORE_PASSWORD = the password you just chose"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEY_PASSWORD      = the same password"
