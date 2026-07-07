# Build a signed AAB on Windows (Android Studio)

Step-by-step for producing `app-release.aab` for Play Console upload.

---

## Prerequisites

1. [Android Studio](https://developer.android.com/studio) installed
2. JDK 17 (bundled with Android Studio)
3. Release keystore file (create once — see below)

---

## Step 1 — Open the project

1. Launch **Android Studio**
2. **File → Open**
3. Select folder: `find-nyumba-smart\android`
4. Wait for Gradle sync to finish (first time: 5–15 minutes)

If sync fails with missing SDK:

- **Tools → SDK Manager → SDK Platforms** → install **Android 15 (API 35)**
- **SDK Tools** → install **Android SDK Build-Tools 35**

---

## Step 2 — Create release keystore (first time only)

Open **PowerShell** (not inside Android Studio):

```powershell
keytool -genkey -v `
  -keystore C:\secure\nyumbasearch-release.keystore `
  -alias nyumbasearch `
  -keyalg RSA -keysize 2048 -validity 10000
```

Answer the prompts (name, organisation, country **KE**, etc.).

**Back up** `C:\secure\nyumbasearch-release.keystore` and passwords to a password manager.

---

## Step 3 — Get SHA-256 for App Links

```powershell
keytool -list -v `
  -keystore C:\secure\nyumbasearch-release.keystore `
  -alias nyumbasearch
```

Copy the **SHA256** fingerprint (format `AA:BB:CC:...`).

Edit `find-nyumba-smart/public/.well-known/assetlinks.json` — replace:

```
REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT
```

with your fingerprint **without colons** or **with colons** (Google accepts both; use the format shown in Play Console → App signing).

Deploy the website so `https://nyumbasearch.com/.well-known/assetlinks.json` is live.

---

## Step 4 — Build signed bundle in Android Studio

1. **Build → Generate Signed App Bundle or APK**
2. Select **Android App Bundle** → **Next**
3. **Key store path:** browse to `C:\secure\nyumbasearch-release.keystore`
4. Enter keystore password, alias `nyumbasearch`, key password → **Next**
5. **Build variant:** `release`
6. **Signature versions:** V1 + V2 (defaults) → **Create**

Output location (Android Studio shows a link when done):

```
find-nyumba-smart\android\app\release\app-release.aab
```

or

```
find-nyumba-smart\android\app\build\outputs\bundle\release\app-release.aab
```

---

## Step 5 — Alternative: command line

After Android Studio generates `gradlew.bat`:

```powershell
cd C:\Users\ochie\OneDrive\Documents\Desktop\nyumbani\find-nyumba-smart\android

$env:NYUMBA_KEYSTORE_PATH = "C:\secure\nyumbasearch-release.keystore"
$env:NYUMBA_KEYSTORE_PASSWORD = "your-keystore-password"
$env:NYUMBA_KEY_ALIAS = "nyumbasearch"
$env:NYUMBA_KEY_PASSWORD = "your-key-password"

.\gradlew.bat bundleRelease
```

AAB path:

```
app\build\outputs\bundle\release\app-release.aab
```

---

## Step 6 — Test before upload

### On a physical phone (recommended)

1. **Build → Generate Signed App Bundle or APK** → choose **APK** for local install, or
2. Upload AAB to **Internal testing** in Play Console and install from the tester link

### Quick checks

- [ ] App opens to NyumbaSearch (not blank white screen)
- [ ] Search and open a listing
- [ ] Sign in with tenant test account (see `REVIEWER_ACCESS.md`)
- [ ] Pull down to refresh on homepage
- [ ] Back button goes back in history; exit confirm on home

---

## Step 7 — Upload to Play Console

1. [Play Console](https://play.google.com/console) → your app
2. **Testing → Internal testing** → **Create new release**
3. Upload `app-release.aab`
4. **Enrol in Play App Signing** when prompted (recommended)
5. Add release notes from `LISTING.md` → "What's new"
6. **Review release → Start rollout**

After internal testing passes, promote the same release to **Production**.

---

## Version bumps (every future upload)

Edit `android/app/build.gradle.kts`:

```kotlin
versionCode = 2        // increment by 1 every upload — never reuse
versionName = "1.0.1"  // semantic version shown to users
```

---

## Troubleshooting

| Problem                      | Fix                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Gradle sync failed           | Install SDK 35; **File → Invalidate Caches → Restart**                                      |
| `signingConfig` null         | Set `NYUMBA_KEYSTORE_PATH` env vars or use Android Studio signed bundle wizard              |
| Upload rejected: target API  | Already set to `targetSdk = 35` in this project                                             |
| App Links not opening in app | Verify `assetlinks.json` SHA-256 matches **upload** or **app signing** cert in Play Console |
| White screen on open         | Check internet; verify https://nyumbasearch.com loads in Chrome on the device               |

---

## File checklist before production submit

```
[ ] app-release.aab (signed)
[ ] assetlinks.json deployed with correct SHA-256
[ ] Privacy policy URL live
[ ] Data deletion URL live
[ ] Store listing copy (LISTING.md)
[ ] Data safety form (DATA_SAFETY.md)
[ ] Reviewer login (REVIEWER_ACCESS.md)
[ ] Screenshots (2+ phone)
[ ] 512×512 icon + 1024×500 feature graphic
```
