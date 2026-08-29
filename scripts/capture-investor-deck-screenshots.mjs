#!/usr/bin/env node
/** Capture key investor deck slides for QA */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = `file://${join(__dirname, '../docs/investor-package/02-investor-deck.html')}`;
const OUT = '/opt/cursor/artifacts';

const slides = [
  'slide-1', 'slide-6', 'slide-10', 'slide-12', 'slide-13', 'slide-17', 'slide-20',
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(DECK, { waitUntil: 'networkidle' });

  for (const id of slides) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await el.screenshot({ path: join(OUT, `investor_deck_${id}.png`) });
    console.log('Captured', id);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
