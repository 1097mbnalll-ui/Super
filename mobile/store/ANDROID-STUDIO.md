# Build the Google Play bundle in Android Studio (no GitHub login needed)

1. Install **Android Studio** and **Node.js 22 LTS** (nodejs.org).
2. Download the project: https://github.com/1097mbnalll-ui/Super/archive/refs/heads/mobile-app.zip and unzip it.
3. (Optional, for notifications) Put `google-services.json` from Firebase into `mobile/android/app/`.
4. Open a terminal in the `mobile` folder and run:
   `npm ci` then `npm run sync`
   (builds the app, connects it to the live website, and turns notifications on if the Firebase file is there).
5. Android Studio > **Open** > choose the folder `mobile/android`. Wait for "Gradle sync" to finish. Accept any SDK install prompts.
6. **Build > Generate Signed App Bundle or APK > Android App Bundle > Next.**
7. Key store path > **Create new...** — this file is your **upload key**. Pick a safe folder, set a strong password, alias `upload`, validity 25+ years. Fill your name/organization. OK.
8. Back up the `.jks` file and both passwords in two places (Google Drive + USB, or a password manager). Never post them anywhere.
9. Choose **release** > **Create**. The file appears at `mobile/android/app/release/app-release.aab`.
10. Play Console > your app > Testing > **Internal testing** > Create release > upload `app-release.aab`. Accept **Play App Signing**.

Next uploads: add a line `versionCode=2` (then 3, 4, ...) to `mobile/android/gradle.properties` before building, otherwise Play rejects it.
Firebase fingerprint (optional): Play Console > App integrity > App signing shows the SHA-1/SHA-256 to paste into Firebase.
