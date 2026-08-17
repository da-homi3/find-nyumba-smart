# NyumbaSearch — Property Manager Tutorial (Production Kit)

High-quality onboarding video for new property managers: dashboard walkthrough + property upload guide.

**Target runtime:** ~8 minutes  
**Formats:** 16:9 (YouTube / onboarding) · 9:16 (social)  
**Voice:** Kenyan English — `en-KE-ChilembaNeural`

---

## Quick start

```bash
# 1. Record screen footage (live site + tutorial capture studio)
npm run tutorial:record

# 2. Generate VO + compile master videos
npm run tutorial:build

# Or both:
npm run tutorial:all
```

**Outputs:**

| File | Description |
|------|-------------|
| `FOR-LAPTOP/01-MASTER-16x9-VO.mp4` | Primary tutorial master |
| `FOR-LAPTOP/02-MASTER-9x16-VO.mp4` | Vertical social cut |
| `voiceover/VO-Chilemba-tutorial.mp3` | Narration track |
| `footage/*.webm` | Raw screen recordings |

---

## What's covered

1. Applying and signing in at `/manager`
2. Dashboard KPIs, tools, properties, viewing requests
3. Full sidebar navigation tour
4. Listing upload wizard — Details → Photos → Map → Review
5. Property Management module (tenants & rent)
6. Team access and wrap-up CTA

---

## UI fidelity notes

| Segment | Source |
|---------|--------|
| Manager portal landing, signup, pricing | **Live** nyumbasearch.com |
| Dashboard, wizard, PM portfolio, team | **Tutorial capture studio** (`capture-studio.html`) — pixel-faithful UI with **sample data only** |

Authenticated manager dashboards are not publicly scrapable. The capture studio is built from the live product component structure and design tokens — clearly watermarked "Tutorial preview · Sample data".

---

## Files

| Path | Purpose |
|------|---------|
| `SCRIPT.md` | Full narration + chapter map |
| `capture-studio.html` | Auto-advancing UI scenes for signed-in flows |
| `voiceover/VO-TTS.txt` | Plain text for TTS (auto-generated from SCRIPT) |
| `scripts/record-manager-tutorial.mjs` | Playwright recorder |
| `scripts/build-manager-tutorial.mjs` | ffmpeg assembly + chapter titles |

---

## Brand

- Cream `#F7F1E8` · Cocoa `#4A2713` · Green `#0a8f3d` · Gold `#D4A84B`
- Tagline: **Find. Connect. Move in.**
- Contact: nyumbasearch101@gmail.com · nyumbasearch.com/manager
