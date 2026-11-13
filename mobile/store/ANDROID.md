# Android release: status and checklist (Google Play)

Android app = the Capacitor wrapper in `mobile/` (same site code as the web store and iPhone app; `mobile/android`).
App ID `sa.ohod.store` (cannot change after publishing). minSdk 24, target/compile SDK 36.

## Status (12 Nov 2026)
- [x] Android project builds in the cloud: GitHub Actions `mobile-build` (job `android`) produced a debug APK successfully on commit `2bda68a`.
- [x] Release signing wired in `mobile/android/app/build.gradle` (reads secrets from env vars or an ignored `keystore.properties`; nothing secret in the repo). Version code/name come from `ANDROID_VERSION_CODE` / `ANDROID_VERSION_NAME`.
- [x] Signed bundle workflow: `.github/workflows/android-release.yml` (manual run, uploads the `.aab` as an artifact).
- [x] Unsigned `bundleRelease` added to `mobile-build` so every push proves the Play bundle compiles.
- [x] Key generator script: `mobile/scripts/make-upload-key.sh` (run on your own machine).
- [x] Store text: `mobile/store/listing-ar.md` (Play section). Play graphics: `play-assets.zip` (5 phone screenshots 1080x1920, feature graphic 1024x500, icon 512). Regenerate if prices/offers change (`mobile/store/screenshots/`).
- [x] Privacy policy is live: https://1097mbnalll-ui.github.io/Super/privacy.html
- [ ] **Not tested on a real Android phone yet** (only built). First debug APK test is the next real milestone.

## What the owner must do (nobody else can)
1. **Google Play developer account** (one-time $25, ID verification, 2-step verification). Decide personal vs organization:
   personal accounts must run a closed test with **12+ testers for 14 continuous days** before production; organization accounts are exempt (needs a D-U-N-S number). Re-check current rules in Play Console.
2. **Create the upload key** on your own machine: `bash mobile/scripts/make-upload-key.sh`. Back the `.jks` up in two places. Never share it or its password in chat or the repo.
3. **Add 4 GitHub repo secrets** (Settings > Secrets and variables > Actions): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (the script prints exactly what to put in each).
4. **Cloudflare:** the Worker `ALLOWED_ORIGIN` must include `capacitor://localhost` and `https://localhost`, otherwise the app cannot place orders. Confirm it is set (the iPhone app may already need the same).
5. **Support email** for the Play listing, and confirm the claims in the listing (delivery 15-30 min, free-delivery wording, store hours 12 noon - 1 AM as the server enforces).
6. **An Android phone** to test the debug APK, plus (personal account) **12+ tester Gmail addresses**.
7. **(Optional, for Android push)** Firebase project: add Android app `sa.ohod.store`, give the upload key's SHA-256 (the script prints it), save `google-services.json` as the GitHub secret `GOOGLE_SERVICES_JSON`; create a service account key and store it as `FCM_SERVICE_ACCOUNT` in Cloudflare (entered by you, never in chat). Without it the app works and Android notifications stay hidden.

## First release flow
1. Phone test: Actions > `mobile-build` > latest run > artifact `ohod-store-android-debug` (APK). Install, place a test order, check back button, map pin, tel/WhatsApp links, order tracking.
2. Actions > `android-release` > Run workflow (version name e.g. `1.0`) > download artifact `ohod-store-android-release-aab`.
3. Play Console: create app (name «متاجر أحد», Arabic, free), upload the `.aab` to **Internal testing**, then **Closed testing** (add testers; start the 14-day clock if personal).
4. Fill declarations (drafts in `listing-ar.md`): Data safety, content rating, target audience 18+, ads: none, app access: no login, privacy URL, contact email.
5. After the closed test: apply for production access, then release. Each upload needs a higher version code (the workflow uses the run number).

## Known gaps and risks
- Google Play review can flag "website in a wrapper" less often than Apple, but keep native touches (back button, haptics, notifications) and test them on a device.
- The store only accepts orders 12 noon - 1 AM Riyadh time; reviewers outside that window see "closed". Keep it open during review and cancel reviewer test orders.
- Catalog must stay free of tobacco/alcohol (Play policy).
- The language toggle (EN) is still visible in the app header; the owner paused English work, decision pending whether to hide it.

## Auto-update (Android loads the live site)
- After `npm run sync`, `scripts/android-remote.mjs` sets `server.url` to `https://1097mbnalll-ui.github.io/Super/?app=android` (plus `&fcm=1` when Firebase is configured). Any website change (photos, prices, sections, design) reaches the Android app right away, with no new Play upload.
- If there is no internet, the app shows `offline.html` with a retry button.
- `ANDROID_LOCAL=1 npm run sync` builds from the branch files instead. The emulator test uses this.
- **Before the first Play release:** the live site must already include the `mobile-app` changes to index.html (`?app=android` detection, `--sa-*` safe areas, delete-data.html). Otherwise the app shows the plain website. That deploy needs the owner's explicit «نزّله».
- Data deletion: `delete-data.html` (also linked from the account page and privacy.html). Use this URL in Play Console → Data safety → "Delete account URL / data deletion".
- Emulator check: workflow `android-emulator` (API 35) uploads screenshots, a scroll-smoothness report, gfxinfo, and logcat.

## Handoff checklist (ANDROID-DESIGN.md, 13 Nov)
- ✅ 1. System bars: `--sky` #DDF2EE, dark icons (StatusBar LIGHT, SystemBars css insets); content padded by `--sa-*`; verified on Android 15 emulator (edge-to-edge).
- ✅ 2. Splash #0E9F7B + adaptive icon (already in project).
- ✅ 3. Back button: goes back inside the site; on Home press twice to exit (hint shown).
- ✅ 4. offline.html in site identity (sky gradient, teal button «جرّب مرة ثانية»).
- ✅ 5. Haptics on add to cart and a success haptic when an order is sent.
- ⏳ 6. FCM push: waiting for `google-services.json` from the owner.
- ✅ 7. External links: `tel:` / `wa.me` / maps leave the app (Capacitor opens non-allowlisted hosts externally); the site itself stays inside.
- ⏳ 8. Emulator: Home/Categories/Account/Delete-data/Cart opened OK, no crash. NOT yet tested on a real phone: banners animation, order placing, order tracking, offline mode, frame rate (the emulator has no GPU).
- ⏳ 9. Performance: no `no-cache` forced by the wrapper; WebView cache default. Not measured on a real device.
- Cloud builds (`mobile-build`, `android-emulator`) are now manual only, they cost the owner minutes.
