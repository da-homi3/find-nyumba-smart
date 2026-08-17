# NyumbaSearch — Property Manager Tutorial (Production Kit)

Onboarding video for new property managers, recorded from the **live website**.

**Source:** https://nyumbasearch.com only  
**Voice:** Kenyan English — `en-KE-ChilembaNeural`  
**Formats:** 16:9 (YouTube / onboarding) · 9:16 (social)

---

## Quick start

```bash
npm run tutorial:record   # Playwright against nyumbasearch.com
npm run tutorial:build    # VO + ffmpeg masters
npm run tutorial:all
```

**Outputs:**

| File | Description |
|------|-------------|
| `FOR-LAPTOP/01-MASTER-16x9-VO.mp4` | Primary tutorial master |
| `FOR-LAPTOP/02-MASTER-9x16-VO.mp4` | Vertical social cut |
| `voiceover/VO-Chilemba-tutorial.mp3` | Narration track |
| `footage/*.webm` | Raw live recordings |

---

## Live pages recorded

1. Homepage  
2. `/manager` — Property Manager Portal  
3. `/auth` — create manager account (fields filled, not submitted)  
4. `/auth` — sign in after approval  
5. `/pricing` — manager plans  
6. `/tenant` — marketplace (what uploaded listings look like)  
7. A live property detail page  
8. `/tenant/map`  
9. `/landlord`  
10. `/contact` → back to `/manager`

Authenticated dashboard and the listing wizard require an approved account. The video shows the **real sign-in gate** on those URLs, then the live marketplace tenants use after you publish.

---

## Brand

- Cream `#F7F1E8` · Cocoa `#4A2713` · Green `#0a8f3d` · Gold `#D4A84B`
- Tagline: **Find. Connect. Move in.**
- Contact: nyumbasearch101@gmail.com · https://nyumbasearch.com/manager
