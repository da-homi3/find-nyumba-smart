#!/usr/bin/env node
/** Render PPTX slides to PNG via LibreOffice for visual QC */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PPTX = join(__dirname, 'NyumbaSearch_Investor_Deck_August_2026.pptx');
const OUT = join(__dirname, 'preview');
const ARTIFACTS = '/opt/cursor/artifacts';

function main() {
  if (!existsSync(PPTX)) {
    console.error('PPTX not found — run build-deck.mjs first');
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(ARTIFACTS, { recursive: true });

  const soffice = spawnSync('which', ['soffice']);
  if (soffice.status !== 0) {
    console.log('LibreOffice not available — attempting apt install...');
    try {
      execSync('sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libreoffice-impress 2>/dev/null', { stdio: 'inherit', timeout: 180000 });
    } catch {
      console.warn('Could not install LibreOffice — skipping PNG preview render');
      process.exit(0);
    }
  }

  execSync(`soffice --headless --convert-to pdf --outdir "${OUT}" "${PPTX}"`, { stdio: 'inherit' });
  const pdf = join(OUT, 'NyumbaSearch_Investor_Deck_August_2026.pdf');
  if (existsSync(pdf)) {
    execSync(`cp "${pdf}" "${join(__dirname, 'NyumbaSearch_Investor_Deck_August_2026.pdf')}"`);
    execSync(`cp "${pdf}" "${ARTIFACTS}/nyumbasearch_investor_deck_aug2026.pdf"`);
    console.log('PDF preview:', pdf);
  }

  // pdftoppm for slide images if available
  try {
    execSync(`pdftoppm -png -r 150 "${pdf}" "${OUT}/slide"`, { stdio: 'inherit' });
    const pngs = readdirSync(OUT).filter((f) => f.startsWith('slide') && f.endsWith('.png'));
    pngs.slice(0, 6).forEach((f, i) => {
      const names = ['cover', 'exec', 'traction', 'revenue', 'ask', 'close'];
      execSync(`cp "${join(OUT, f)}" "${ARTIFACTS}/investor_pptx_${names[i] || i}.png"`);
    });
    console.log(`Rendered ${pngs.length} slide previews`);
  } catch {
    console.log('pdftoppm not available — PDF only');
  }
}

main();
