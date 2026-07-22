# NyumbaSearch — Play Store submission kit

Everything you need to publish `ke.co.nyumbasearch.app` on Google Play.

| Document                                   | Use in Play Console                                  |
| ------------------------------------------ | ---------------------------------------------------- |
| [WINDOWS_BUILD.md](./WINDOWS_BUILD.md)     | Build signed `app-release.aab` on your PC            |
| [LISTING.md](./LISTING.md)                 | App name, short/full description, what's new         |
| [SCREENSHOTS.md](./SCREENSHOTS.md)         | Which screens to capture                             |
| [DATA_SAFETY.md](./DATA_SAFETY.md)         | Data safety questionnaire                            |
| [REVIEWER_ACCESS.md](./REVIEWER_ACCESS.md) | App access → login instructions for Google reviewers |

## Order of operations

1. **WINDOWS_BUILD.md** — keystore + AAB
2. Update **assetlinks.json** with SHA-256 → deploy site
3. **LISTING.md** + **SCREENSHOTS.md** — store listing
4. **DATA_SAFETY.md** — app content forms
5. **REVIEWER_ACCESS.md** — reviewer login
6. Upload AAB to **Internal testing** → then **Production**

## Package details

- **Application ID:** `ke.co.nyumbasearch.app`
- **Version:** 1.0.0 (versionCode 1)
- **Min SDK:** 24 | **Target SDK:** 35
- **Category:** House & Home
