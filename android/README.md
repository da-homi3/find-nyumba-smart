# NyumbaSearch Android App

Production WebView-native hybrid for Kenya's low-bandwidth market. Package: `com.nyumbasearch.app`.

## Requirements

- Android Studio Ladybug (2024.2+) or newer
- JDK 17
- Android SDK 35

## Open project

```bash
cd android
# Open in Android Studio, or generate wrapper:
gradle wrapper
./gradlew assembleDebug
```

## Release AAB (Play Store)

1. Generate keystore once (store outside git):

```bash
keytool -genkey -v -keystore nyumbasearch-release.keystore \
  -alias nyumbasearch -keyalg RSA -keysize 2048 -validity 10000
```

2. Set environment variables:

```bash
export NYUMBA_KEYSTORE_PATH=/path/to/nyumbasearch-release.keystore
export NYUMBA_KEYSTORE_PASSWORD=...
export NYUMBA_KEY_ALIAS=nyumbasearch
export NYUMBA_KEY_PASSWORD=...
```

3. Build:

```bash
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

4. Update `public/.well-known/assetlinks.json` with your release keystore SHA-256:

```bash
keytool -list -v -keystore nyumbasearch-release.keystore -alias nyumbasearch
```

## Architecture

| Module | Purpose |
|--------|---------|
| `core/network` | Network tier detection, retry backoff |
| `core/cache` | Bundled app shell (instant paint on 2G) |
| `ui/main` | WebView host, pull-to-refresh, deep links |
| `features/*` | Empty shells for future native modules |
| `push/` | FCM infrastructure (inactive until Firebase configured) |

## Low-bandwidth coordination

Every request sends:

- `X-App-Client: android`
- `X-Network-Tier: POOR_2G_3G|GOOD_4G|WIFI|OFFLINE`
- `Save-Data: on` (when on poor cellular)

The Cloudflare Worker responds with `X-Serve-Mode: lite` and sets a cookie so the web app skips Three.js hero and heavy assets.

## Play Store checklist

Full copy and forms: **`play-store/`** folder (listing, data safety, reviewer access, Windows build guide).

- Privacy policy: https://nyumbasearch.com/privacy-policy
- Data deletion: https://nyumbasearch.com/data-deletion
- Target SDK 35
- Permissions: INTERNET, NETWORK_STATE, CAMERA (on use), LOCATION (on use), POST_NOTIFICATIONS (Android 13+)

## Firebase (optional)

1. Add `google-services.json` to `app/`
2. Uncomment Firebase plugin and dependencies in `app/build.gradle.kts`
3. Uncomment `FcmService` in `AndroidManifest.xml`
