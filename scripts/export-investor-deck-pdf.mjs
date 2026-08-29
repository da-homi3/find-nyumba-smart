#!/usr/bin/env node
/**
 * Export investor deck HTML to PDF via Playwright (landscape 16:9).
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = join(__dirname, '../docs/investor-package/02-investor-deck.html');
const OUT = join(__dirname, '../docs/investor-package/NyumbaSearch-Investor-Deck.pdf');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${DECK}`, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUT,
    width: '1280px',
    height: '720px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  console.log('Wrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
