#!/usr/bin/env node
/**
 * Build NyumbaSearch Investor Deck PPTX from structured slide data.
 * Output: docs/investor-package/NyumbaSearch-Investor-Deck.pptx
 */
import PptxGenJS from 'pptxgenjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../docs/investor-package/NyumbaSearch-Investor-Deck.pptx');

const GREEN = '086B2E';
const LIME = '16A34A';
const COCOA = '4A2713';
const GOLD = 'FFD54F';
const INK = '0F172A';
const SLATE = '64748B';
const WHITE = 'FFFFFF';

function addFooter(slide, num, label) {
  slide.addText('NyumbaSearch · Confidential', {
    x: 0.5, y: 5.2, w: 4, h: 0.3, fontSize: 8, color: SLATE,
  });
  slide.addText(`${num} / ${label}`, {
    x: 8.5, y: 5.2, w: 1.5, h: 0.3, fontSize: 8, color: SLATE, align: 'right',
  });
}

function titleSlide(pptx) {
  const s = pptx.addSlide();
  s.background = { color: GREEN };
  s.addText('NYUMBASEARCH', { x: 0.6, y: 1.8, w: 9, h: 1, fontSize: 40, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText('Investor Deck · Pre-Series A', { x: 0.6, y: 2.7, w: 9, h: 0.4, fontSize: 14, color: 'D1FAE5' });
  s.addText('Building the trusted operating layer for home discovery,\ntenancy and home services in Africa.', {
    x: 0.6, y: 3.2, w: 8, h: 0.8, fontSize: 16, color: WHITE,
  });
  s.addText('PROPTECH  ·  HOUSING  ·  DIGITAL SERVICES', { x: 0.6, y: 4.2, w: 8, h: 0.4, fontSize: 10, color: 'A7F3D0', bold: true });
  s.addText('nyumbasearch.com · Nairobi, Kenya · August 2026', { x: 0.6, y: 4.7, w: 8, h: 0.3, fontSize: 10, color: 'D1FAE5' });
  addFooter(s, '01', 'Cover');
}

function bulletSlide(pptx, { kicker, title, bullets, num, label, sub }) {
  const s = pptx.addSlide();
  s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.35, w: 9, h: 0.3, fontSize: 10, color: LIME, bold: true });
  s.addText(title, { x: 0.6, y: 0.7, w: 9, h: 0.7, fontSize: 22, bold: true, color: INK, fontFace: 'Arial' });
  if (sub) s.addText(sub, { x: 0.6, y: 1.35, w: 9, h: 0.4, fontSize: 11, color: SLATE });
  const startY = sub ? 1.85 : 1.55;
  s.addText(bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })), {
    x: 0.6, y: startY, w: 8.8, h: 3.2, fontSize: 12, color: INK, valign: 'top',
  });
  addFooter(s, num, label);
}

function metricSlide(pptx) {
  const s = pptx.addSlide();
  s.addText('TRACTION', { x: 0.6, y: 0.35, w: 9, h: 0.3, fontSize: 10, color: LIME, bold: true });
  s.addText('Early traction with growing supply-side network', { x: 0.6, y: 0.7, w: 9, h: 0.6, fontSize: 22, bold: true, color: INK });
  const metrics = [
    ['263+', 'Verified homes'], ['182+', 'Neighbourhoods'], ['214+', 'Service providers'],
    ['132+', 'Users / tenants'], ['24+', 'Listing accounts'], ['109+', 'Lead actions'],
  ];
  metrics.forEach(([num, label], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 3.1;
    const y = 1.6 + row * 1.5;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.8, h: 1.2, fill: { color: 'F0FDF4' }, line: { color: 'A7F3D0', width: 1 }, rectRadius: 0.1 });
    s.addText(num, { x, y: y + 0.15, w: 2.8, h: 0.5, fontSize: 28, bold: true, color: GREEN, align: 'center' });
    s.addText(label, { x, y: y + 0.65, w: 2.8, h: 0.35, fontSize: 10, color: SLATE, align: 'center' });
  });
  addFooter(s, '06', 'Traction');
}

function revenueSlide(pptx) {
  const s = pptx.addSlide();
  s.addText('REVENUE FORECAST (ESTIMATE)', { x: 0.6, y: 0.35, w: 9, h: 0.3, fontSize: 10, color: LIME, bold: true });
  s.addText('Path to USD 4.8M annual revenue by Year 5', { x: 0.6, y: 0.7, w: 9, h: 0.6, fontSize: 22, bold: true, color: INK });
  const bars = [
    { yr: 'Y1 2026', val: 0.35, h: 0.7 },
    { yr: 'Y2 2027', val: 0.9, h: 1.4 },
    { yr: 'Y3 2028', val: 1.8, h: 2.2 },
    { yr: 'Y4 2029', val: 3.1, h: 3.0 },
    { yr: 'Y5 2030', val: 4.8, h: 3.8 },
  ];
  bars.forEach((b, i) => {
    const x = 0.8 + i * 1.7;
    s.addShape(pptx.ShapeType.rect, { x, y: 4.8 - b.h, w: 1.2, h: b.h, fill: { color: LIME } });
    s.addText(`$${b.val}M`, { x, y: 4.8 - b.h - 0.35, w: 1.2, h: 0.3, fontSize: 9, bold: true, color: GREEN, align: 'center' });
    s.addText(b.yr, { x, y: 4.85, w: 1.2, h: 0.25, fontSize: 8, color: SLATE, align: 'center' });
  });
  const mix = [
    'Property mgmt SaaS — 35%', 'Landlord & listing — 25%', 'Service providers — 20%',
    'Financial & referrals — 15%', 'Other & data — 5%',
  ];
  s.addText('Year 5 revenue mix', { x: 5.5, y: 1.5, w: 4, h: 0.35, fontSize: 12, bold: true, color: INK });
  s.addText(mix.map((m) => ({ text: m, options: { bullet: true, breakLine: true } })), {
    x: 5.5, y: 1.9, w: 4, h: 2.5, fontSize: 11, color: SLATE,
  });
  s.addText('At full sector activation: USD 2.5M – 4.5M+ annually', {
    x: 0.6, y: 5.0, w: 9, h: 0.3, fontSize: 10, color: GREEN, bold: true,
  });
  addFooter(s, '10', 'Revenue');
}

function compareSlide(pptx) {
  const s = pptx.addSlide();
  s.addText('PROGRESS VS. POTENTIAL', { x: 0.6, y: 0.35, w: 9, h: 0.3, fontSize: 10, color: LIME, bold: true });
  s.addText('From early traction to market leadership', { x: 0.6, y: 0.7, w: 9, h: 0.6, fontSize: 22, bold: true, color: INK });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.5, w: 4.2, h: 3.2, fill: { color: 'F1F5F9' }, line: { color: 'E2E8F0' }, rectRadius: 0.1 });
  s.addText('Today (Aug 2026)', { x: 0.7, y: 1.65, w: 4, h: 0.35, fontSize: 12, bold: true, color: INK });
  const today = ['263+ verified homes', '182+ neighbourhoods', '214+ service providers', '132+ users', '24+ listing accounts', '109+ lead actions'];
  s.addText(today.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 0.7, y: 2.05, w: 3.8, h: 2.5, fontSize: 11, color: SLATE });
  s.addText('→', { x: 4.85, y: 2.8, w: 0.5, h: 0.5, fontSize: 28, bold: true, color: GREEN, align: 'center' });
  s.addShape(pptx.ShapeType.roundRect, { x: 5.3, y: 1.5, w: 4.2, h: 3.2, fill: { color: 'F0FDF4' }, line: { color: '86EFAC' }, rectRadius: 0.1 });
  s.addText('3–5 year potential', { x: 5.5, y: 1.65, w: 4, h: 0.35, fontSize: 12, bold: true, color: GREEN });
  const future = ['10,000+ verified homes', '50,000+ active users', '2,000+ property accounts', '1,000+ service providers', '$2.5M – 4.8M annual revenue', 'Kenya → Africa expansion'];
  s.addText(future.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 5.5, y: 2.05, w: 3.8, h: 2.5, fontSize: 11, color: INK });
  addFooter(s, '12', 'Progress');
}

function askSlide(pptx) {
  const s = pptx.addSlide();
  s.addText('INVESTMENT OPPORTUNITY', { x: 0.6, y: 0.35, w: 9, h: 0.3, fontSize: 10, color: LIME, bold: true });
  s.addText('USD 1.5M', { x: 0.6, y: 0.9, w: 5, h: 0.9, fontSize: 44, bold: true, color: GREEN });
  s.addText('Pre-Series A · Strategic growth capital', { x: 0.6, y: 1.75, w: 5, h: 0.35, fontSize: 14, color: SLATE });
  const funds = [
    ['Product development', '30%', '~$450K'],
    ['Team & talent', '20%', '~$300K'],
    ['Marketing & growth', '20%', '~$300K'],
    ['Operations & support', '15%', '~$225K'],
    ['Partnerships & integrations', '10%', '~$150K'],
    ['Legal & compliance', '5%', '~$75K'],
  ];
  s.addText('Use of funds', { x: 5.2, y: 0.9, w: 4.5, h: 0.35, fontSize: 14, bold: true, color: INK });
  funds.forEach(([name, pct, amt], i) => {
    const y = 1.35 + i * 0.55;
    s.addText(name, { x: 5.2, y, w: 2.8, h: 0.4, fontSize: 10, color: INK });
    s.addText(pct, { x: 8.0, y, w: 0.6, h: 0.4, fontSize: 10, bold: true, color: GREEN, align: 'right' });
    s.addText(amt, { x: 8.7, y, w: 1.0, h: 0.4, fontSize: 9, color: SLATE, align: 'right' });
  });
  s.addText('Accelerates product, supply, partnerships and team — from 263+ homes toward 10,000+ verified inventory.', {
    x: 0.6, y: 2.3, w: 4.5, h: 1.5, fontSize: 11, color: SLATE,
  });
  addFooter(s, '17', 'The ask');
}

function closeSlide(pptx) {
  const s = pptx.addSlide();
  s.background = { color: GREEN };
  s.addText('Thank you', { x: 0.6, y: 1.5, w: 9, h: 0.8, fontSize: 36, bold: true, color: WHITE });
  s.addText("Let's explore investment, partnership and market expansion together.", {
    x: 0.6, y: 2.4, w: 8, h: 0.5, fontSize: 16, color: 'D1FAE5',
  });
  s.addText('nyumbasearch.com\nnyumbasearch101@gmail.com\n0714725598 · Nairobi, Kenya', {
    x: 0.6, y: 3.3, w: 6, h: 1.2, fontSize: 14, color: WHITE,
  });
  addFooter(s, '20', 'Close');
}

async function main() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'NyumbaSearch';
  pptx.title = 'NyumbaSearch Investor Deck';
  pptx.subject = 'Pre-Series A Investor Presentation';

  titleSlide(pptx);

  bulletSlide(pptx, {
    kicker: 'Executive summary',
    title: "Africa's full-stack proptech platform",
    sub: 'From search to move-in and beyond — one trusted ecosystem.',
    bullets: [
      'Trust layer: verified listings, owner validation, scam-risk signals',
      'Transaction layer: rent workflows, tenancy portals, service discovery',
      'Monetization layer: subscriptions, SaaS, boosts, financial referrals',
      'Expansion layer: Nairobi-first, scaling across Kenya and Africa',
    ],
    num: '02', label: 'Summary',
  });

  bulletSlide(pptx, {
    kicker: 'The problem',
    title: 'Finding a home is fragmented, costly and risky',
    bullets: [
      'Listings scattered across agents, social groups and classifieds',
      'Renters waste time on inaccurate or unavailable listings',
      'Most products stop at discovery — not tenancy or maintenance',
      'Owners lack modern lead capture and operational tools',
      'Opportunity: own the relationship before, during and after the move',
    ],
    num: '03', label: 'Problem',
  });

  bulletSlide(pptx, {
    kicker: 'Our solution',
    title: 'Search → Verify → Manage → Serve',
    bullets: [
      'Map-first discovery with neighbourhood intelligence',
      'Owner/listing verification and scam-risk validation',
      'Manager portal: properties, tenants, rent, analytics',
      '214+ verified service providers across 24+ categories',
      'Finance & insurance referral pathways at housing moments',
    ],
    num: '04', label: 'Solution',
  });

  metricSlide(pptx);

  bulletSlide(pptx, {
    kicker: 'Target market',
    title: 'Three interconnected segments — Nairobi first',
    bullets: [
      'Tenants: students, young professionals, families — Plus & unlocks',
      'Owners & managers: landlords, agencies, developers — SaaS & subscriptions',
      'Service providers: movers, cleaners, repairs — tiers & lead fees',
      'Market: ~2M houses needed in Kenya by 2030; 85% smartphone penetration',
    ],
    num: '08', label: 'Market',
  });

  bulletSlide(pptx, {
    kicker: 'Business model',
    title: 'Four revenue layers — recurring at the core',
    bullets: [
      'Landlord & listing plans: KES 999 – 4,999/month',
      'Property management SaaS: KES 2,000 – 10,000/month per portfolio',
      'Service provider monetization: KES 1,500 – 5,000/month',
      'Financial & protection referrals: revenue share model',
      'Full activation estimate: USD 2.5M – 4.5M+ annually',
    ],
    num: '09', label: 'Model',
  });

  revenueSlide(pptx);
  compareSlide(pptx);

  bulletSlide(pptx, {
    kicker: 'Future partnerships',
    title: 'Strategic partnerships accelerate scale',
    bullets: [
      'Student residences & universities — campus housing, semester bookings',
      'Banks & financial institutions — rent payments, mortgages, tenant loans',
      'Property owners & developers — verified supply, PM tooling',
      'Corporate & HR housing — relocation, expat housing, bulk placement',
      'Service provider networks — national mover/cleaner/repair networks',
      'Insurance & protection — tenant contents, landlord property, rent protection',
    ],
    num: '13', label: 'Partnerships',
  });

  bulletSlide(pptx, {
    kicker: 'Competitive landscape',
    title: 'Beyond listings — integrated housing platform',
    bullets: [
      'vs Property24, Lamudi, Jiji, social groups',
      'Only NyumbaSearch combines: verification, PM SaaS, M-Pesa rent, services, finance',
      'Advantage = trust + operations + services + local Nairobi focus',
    ],
    num: '11', label: 'Competition',
  });

  askSlide(pptx);
  closeSlide(pptx);

  await pptx.writeFile({ fileName: OUT });
  console.log('Wrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
