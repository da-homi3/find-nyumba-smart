# NyumbaSearch Investor Deck — August 2026

Professional 16-slide Pre-Series A investor presentation for NyumbaSearch.

## Files

| File | Description |
|------|-------------|
| `NyumbaSearch_Investor_Deck_August_2026.pptx` | **Primary deliverable** — editable PowerPoint |
| `NyumbaSearch_Investor_Deck_August_2026.pdf` | PDF preview (generated after render) |
| `build-deck.mjs` | Build script (PptxGenJS) |
| `render-preview.mjs` | PDF/PNG preview export |
| `qc-report.json` | Automated overlap detection report |
| `lib/` | Theme, helpers, slide definitions |
| `assets/` | SVG illustrations (not reference photo collages) |

## Build

```bash
npm run investor:deck          # Generate PPTX
npm run investor:deck:preview  # PPTX + PDF preview
```

Or directly:

```bash
node investor-deck/build-deck.mjs
node investor-deck/render-preview.mjs
```

## Design system

- **Colors:** Navy `#08192B`, Green `#19995C`, Lime `#91D64D`, Gold `#E0AA3E`
- **Format:** 16:9 widescreen, 16 slides
- **Typography:** Arial (editable in PowerPoint)

## Data integrity

### Current traction (August 2026 — from supplied materials)

| Metric | Value | Status |
|--------|-------|--------|
| Verified homes | 263+ | Current |
| Neighbourhoods | 182+ | Current |
| Service providers | 214+ | Current (also verified live on nyumbasearch.com /services) |
| Users / tenants | 132+ | Current (internal — requires confirmation) |
| Listing accounts | 24+ | Current (internal) |
| Lead actions | 109+ | Current (internal) |

**Current revenue:** Not disclosed / early monetization stage.

### Illustrative projections (NOT current revenue)

| Year | USD (illustrative) |
|------|-------------------|
| 2026 | 0.35M |
| 2027 | 0.90M |
| 2028 | 1.90M |
| 2029 | 3.20M |
| 2030 | 4.80M |

All projections labeled: *"Illustrative planning scenario based on assumptions; actual results may differ."*

### Investment ask

**USD 1.5M Pre-Series A** — use of funds: Product 30% · Team 20% · Marketing 20% · Operations 15% · Partnerships 10% · Legal 5%

### Future targets (NOT current traction)

- 50,000+ verified homes
- 250,000+ active users
- 5,000+ property owners/managers
- 10,000+ service providers

### Partnerships

All partnership categories labeled as pipeline / strategic target unless explicitly verified. No signed bank or university contracts are claimed.

## Product UI

Slide 5 uses **live product screenshots** from `docs/investor-package/assets/crops/` (captured from nyumbasearch.com), displayed in phone frames — not the submitted reference collages.

## Assumptions

- Pricing ranges align with live `/pricing` surfaces on nyumbasearch.com
- Market statistics (~2M houses, 85.2% smartphone, 48.6M mobile money) from reference materials
- Competitor matrix uses "Limited / varies" where capabilities are uncertain

## Contact

nyumbasearch.com · nyumbasearch101@gmail.com · Nairobi, Kenya
