# NyumbaSearch — Social Creative Intelligence Engine

Operational guide for the creative director system in `src/lib/social/creative/`.

## What it does

Before any post is written, the engine:

1. Reads **performance memory** (`docs/social-creative-memory.json`)
2. Detects **content fatigue** (catalogue tours, repeated hooks/formats)
3. Scores concept bank **A–H** (attention + relevance + lead potential…)
4. Runs a **quality gate** (share-worthy + reason to use NyumbaSearch)
5. Emits a **brief** (hook, script, shot list, CTA, UTM destination)

It **never invents** views, leads, rents, or inventory. Null metrics stay null until you paste Analytics.

## Generate today’s brief

```bash
cd find-nyumba-smart
npm run social:brief
npm run social:brief -- --audience=property_owner
npm run social:brief -- --objective=owner_acquisition
npm run social:brief -- --listing=https://nyumbasearch.com/tenant/property/UUID --listing-label="2BR Spring Valley"
```

Writes:

- `docs/creative-briefs/YYYY-MM-DD-<concept-id>.md`
- `docs/creative-briefs/YYYY-MM-DD-<concept-id>.json`

## After you publish

Update `docs/social-creative-memory.json`:

- Set `status` to `published`
- Fill only **measured** fields (`views`, `link_clicks`, `leads`, …)
- Add a `learnings[]` line: what worked / what to repeat

## Inspiration rules

- Study global mechanisms (POV, checklist, reveal, product demo)
- **Do not** copy scripts, footage, logos, or distinctive campaigns
- Localise for Kenya only when authentic
- Prefer business outcomes over vanity views

## Mix guideline (rolling window)

| Share | Pillar |
|------:|--------|
| 40% | Kenyan relevance |
| 30% | Global mechanisms adapted |
| 20% | Real NyumbaSearch inventory/product |
| 10% | Experiments |

Experiment ratio: ~70% proven · 20% adapted trends · 10% experimental (adjust from memory).
