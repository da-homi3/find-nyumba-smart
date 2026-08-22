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
2. `/manager/dashboard` — real signed-in overview (KPIs, tools, listings, viewings)  
3. `/manager/properties`  
4. `/manager/properties/new` — listing wizard (details → media → map → review)  
5. `/manager/manage` — tenants & rent  
6. `/manager/team`  
7. `/manager/analytics`  
8. Back to dashboard CTA  

Sign-in is off-camera. Emails on screen are masked. Credentials come from `TUTORIAL_EMAIL` / `TUTORIAL_PASSWORD` environment variables and are **never committed**.

---

## Brand

- Cream `#F7F1E8` · Cocoa `#4A2713` · Green `#0a8f3d` · Gold `#D4A84B`
- Tagline: **Find. Connect. Move in.**
- Contact: nyumbasearch101@gmail.com · https://nyumbasearch.com/manager
