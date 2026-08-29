#!/usr/bin/env node
/**
 * Build NyumbaSearch Investor Deck — 16-slide VC-ready PPTX
 * Output: investor-deck/NyumbaSearch_Investor_Deck_August_2026.pptx
 */
import PptxGenJS from 'pptxgenjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BboxTracker } from './lib/helpers.mjs';
import { ALL_SLIDES } from './lib/slides.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'NyumbaSearch_Investor_Deck_August_2026.pptx');
const QC_REPORT = join(__dirname, 'qc-report.json');

async function main() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'NyumbaSearch';
  pptx.title = 'NyumbaSearch Investor Deck — August 2026';
  pptx.subject = 'Pre-Series A Investor Presentation';

  const tracker = new BboxTracker();

  for (const buildSlide of ALL_SLIDES) {
    buildSlide(pptx, tracker);
    tracker.nextSlide();
  }

  const overlaps = tracker.findOverlaps();
  writeFileSync(QC_REPORT, JSON.stringify({ slideCount: ALL_SLIDES.length, overlaps }, null, 2));

  if (overlaps.length) {
    console.warn(`QC: ${overlaps.length} potential overlap(s) detected — see ${QC_REPORT}`);
    for (const o of overlaps) {
      console.warn(`  Slide ${o.slide}: "${o.a}" ∩ "${o.b}" (area ${o.area})`);
    }
  } else {
    console.log('QC: No significant overlaps detected.');
  }

  await pptx.writeFile({ fileName: OUT });
  console.log(`Wrote ${OUT} (${ALL_SLIDES.length} slides)`);
  process.exit(overlaps.some((o) => o.area > 0.5) ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
