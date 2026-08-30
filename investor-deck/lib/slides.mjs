import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, FONT, REVENUE, ASK, FUTURE } from './theme.mjs';
import { tractionMetrics, barHeights } from './analytics.mjs';
import {
  footer, kicker, title, body, darkSlide, lightSlide, offWhiteSlide,
  tag, metricCard, phoneMock, arrowRight, footnote,
} from './helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '../assets');
const CROPS = join(__dirname, '../../docs/investor-package/assets/crops');

export function slide01Cover(pptx, t) {
  const s = pptx.addSlide();
  darkSlide(s);
  t.track(0, 0, 10, 5.625, 'bg');
  s.addImage({ path: join(ASSETS, 'cover-skyline.svg'), x: 4.8, y: 0.35, w: 5.0, h: 3.1 });
  s.addShape('rect', { x: 0, y: 0, w: 5.2, h: 5.625, fill: { color: C.navy, transparency: 15 } });
  title(s, 'NYUMBASEARCH', 1.1, 4.6, 34, C.white, t, 'cover-title');
  body(s, 'INVESTOR DECK', 0.55, 1.72, 4.5, 0.28, { size: 12, color: C.lime, bold: true }, t, 'cover-sub');
  body(s, 'Building the trusted operating layer for home discovery, tenancy and home services in Africa.', 0.55, 2.05, 4.5, 0.85, { size: 13, color: C.offWhite }, t, 'cover-tagline');
  tag(s, 'PROPTECH', 0.55, 3.05, t);
  tag(s, 'HOUSING', 1.5, 3.05, t);
  tag(s, 'DIGITAL SERVICES', 2.35, 3.05, t);
  body(s, 'nyumbasearch.com  ·  August 2026', 0.55, 3.5, 4.5, 0.25, { size: 10, color: C.muted }, t, 'cover-meta');
  footer(s, 1, t);
}

export function slide02ExecSummary(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Executive summary', 0.42, t);
  title(s, 'One platform. The complete home journey.', 0.68, 8.9, 28, C.text, t);
  body(s, 'NyumbaSearch connects people to homes while helping property businesses acquire tenants, manage properties and access trusted home services.', 0.55, 1.22, 8.9, 0.4, { size: 10 }, t, 'exec-intro');

  const layers = [
    { n: '01', name: 'DISCOVER', desc: 'Map · location · budget · property type · neighbourhood' },
    { n: '02', name: 'VERIFY', desc: 'Owner/listing verification · property validation · reviews · risk signals' },
    { n: '03', name: 'MANAGE', desc: 'Tenant portal · rent tracking · payments · leases · invoices · maintenance' },
    { n: '04', name: 'SERVE', desc: 'Movers · cleaners · repairs · security · solar · interior services' },
  ];
  layers.forEach((l, i) => {
    const y = 1.95 + i * 0.72;
    t.track(0.55, y, 5.2, 0.62, `layer-${i}`);
    s.addShape('roundRect', { x: 0.55, y, w: 5.2, h: 0.62, fill: { color: C.lightGreen }, line: { color: 'C5E8D4', width: 0.5 }, rectRadius: 0.06 });
    s.addText(l.n, { x: 0.7, y: y + 0.12, w: 0.35, h: 0.35, fontSize: 11, bold: true, color: C.green, fontFace: FONT });
    s.addText(l.name, { x: 1.1, y: y + 0.08, w: 1.2, h: 0.25, fontSize: 10, bold: true, color: C.navy, fontFace: FONT });
    s.addText(l.desc, { x: 1.1, y: y + 0.3, w: 4.5, h: 0.28, fontSize: 8, color: C.muted, fontFace: FONT });
  });

  s.addImage({ path: join(ASSETS, 'ecosystem-flow.svg'), x: 6.0, y: 1.85, w: 3.45, h: 2.55 });
  t.track(6.0, 1.85, 3.45, 2.55, 'ecosystem-diagram');
  body(s, 'From discovery to move-in and beyond.', 6.0, 4.55, 3.45, 0.25, { size: 9, bold: true, color: C.green, align: 'center' }, t, 'exec-bottom');
  footer(s, 2, t);
}

export function slide03Problem(pptx, t) {
  const s = pptx.addSlide();
  offWhiteSlide(s);
  kicker(s, 'The problem', 0.42, t);
  title(s, 'Housing discovery is fragmented. Trust is expensive.', 0.68, 8.9, 26, C.text, t);

  const problems = [
    { n: '01', title: 'Discovery is fragmented', lines: ['Agents · social media · classifieds · WhatsApp · property sites', 'Information is inconsistent across channels'] },
    { n: '02', title: 'Trust is expensive', lines: ['Time · transport · effort visiting unavailable listings', 'Inaccurate or poorly represented properties'] },
    { n: '03', title: 'The journey ends too early', lines: ['Most platforms stop at the listing', 'Tenancy · rent · management · services not connected'] },
    { n: '04', title: 'Owners lack modern tools', lines: ['Lead management · tenant records · rent tracking', 'Maintenance workflows · portfolio visibility'] },
  ];
  problems.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 4.55;
    const y = 1.55 + row * 1.55;
    t.track(x, y, 4.25, 1.35, `problem-${i}`);
    s.addShape('roundRect', { x, y, w: 4.25, h: 1.35, fill: { color: C.white }, line: { color: 'D8E3DC', width: 0.75 }, rectRadius: 0.08 });
    s.addText(p.n, { x: x + 0.12, y: y + 0.1, w: 0.35, h: 0.25, fontSize: 10, bold: true, color: C.green, fontFace: FONT });
    s.addText(p.title, { x: x + 0.45, y: y + 0.08, w: 3.6, h: 0.28, fontSize: 11, bold: true, color: C.text, fontFace: FONT });
    s.addText(p.lines.map((l) => ({ text: l, options: { bullet: true, breakLine: true } })), {
      x: x + 0.2, y: y + 0.42, w: 3.9, h: 0.85, fontSize: 8, color: C.muted, fontFace: FONT,
    });
  });

  t.track(0.55, 4.65, 8.9, 0.35, 'opportunity');
  s.addShape('roundRect', { x: 0.55, y: 4.65, w: 8.9, h: 0.35, fill: { color: C.navy }, rectRadius: 0.06 });
  s.addText('Own the user relationship before, during and after the move.', {
    x: 0.55, y: 4.7, w: 8.9, h: 0.28, fontSize: 10, bold: true, color: C.white, align: 'center', fontFace: FONT,
  });
  footer(s, 3, t);
}

export function slide04Solution(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Our solution', 0.42, t);
  title(s, 'A trusted operating layer for the entire home journey.', 0.68, 8.9, 26, C.text, t);

  const steps = [
    { name: 'SEARCH', desc: 'Map-first discovery\nNeighbourhood + budget + type' },
    { name: 'VERIFY', desc: 'Owner/listing verification\nProperty signals · reviews' },
    { name: 'MANAGE', desc: 'Rent tracking · leases\nInvoices · tenant management' },
    { name: 'SERVE', desc: 'Verified home services\nMoving · cleaning · repairs' },
  ];
  steps.forEach((st, i) => {
    const x = 0.55 + i * 2.35;
    const fill = i === 3 ? C.green : C.lightGreen;
    const tc = i === 3 ? C.white : C.green;
    t.track(x, 1.45, 2.1, 1.15, `step-${i}`);
    s.addShape('roundRect', { x, y: 1.45, w: 2.1, h: 1.15, fill: { color: fill }, line: { color: C.green2, width: 0.5 }, rectRadius: 0.08 });
    s.addText(st.name, { x, y: 1.55, w: 2.1, h: 0.28, fontSize: 11, bold: true, color: tc, align: 'center', fontFace: FONT });
    s.addText(st.desc, { x: x + 0.1, y: 1.85, w: 1.9, h: 0.65, fontSize: 8, color: i === 3 ? C.offWhite : C.muted, align: 'center', fontFace: FONT });
    if (i < 3) arrowRight(s, x + 2.15, 1.95, t);
  });

  body(s, 'One relationship. Multiple high-value touchpoints.', 0.55, 2.75, 8.9, 0.25, { size: 10, bold: true, color: C.navy, align: 'center' }, t, 'solution-tag');

  const actors = [
    { name: 'TENANTS', desc: 'Find the right home.' },
    { name: 'PROPERTY OWNERS', desc: 'Acquire and manage tenants.' },
    { name: 'SERVICE PROVIDERS', desc: 'Access verified demand.' },
  ];
  actors.forEach((a, i) => {
    const x = 0.55 + i * 3.05;
    t.track(x, 3.15, 2.85, 0.95, `actor-${i}`);
    s.addShape('roundRect', { x, y: 3.15, w: 2.85, h: 0.95, fill: { color: C.offWhite }, line: { color: 'D8E3DC', width: 0.5 }, rectRadius: 0.08 });
    s.addText(a.name, { x, y: 3.28, w: 2.85, h: 0.28, fontSize: 9, bold: true, color: C.green, align: 'center', fontFace: FONT });
    s.addText(a.desc, { x, y: 3.58, w: 2.85, h: 0.35, fontSize: 9, color: C.muted, align: 'center', fontFace: FONT });
  });
  footer(s, 4, t);
}

export function slide05Product(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Product', 0.42, t);
  title(s, 'One product. Multiple high-value touchpoints.', 0.68, 8.9, 26, C.text, t);

  const phones = [
    { cap: 'Home discovery', img: join(CROPS, 'map.jpg') },
    { cap: 'Property listing', img: join(CROPS, 'property.jpg') },
    { cap: 'Property management', img: join(CROPS, 'landlord.jpg') },
    { cap: 'Rent & payments', img: join(CROPS, 'mobile.jpg') },
    { cap: 'Home services', img: join(CROPS, 'services.jpg') },
  ];
  phones.forEach((p, i) => {
    phoneMock(s, {
      x: 0.45 + i * 1.88, y: 1.45, w: 1.72, h: 2.55, title: p.cap, imagePath: p.img,
      tracker: t, name: `phone-${i}`,
    });
  });
  body(s, 'Discovery → verification → tenancy → services.', 0.55, 4.35, 8.9, 0.25, { size: 10, bold: true, color: C.navy, align: 'center' }, t, 'product-caption');
  footnote(s, 'UI from live nyumbasearch.com product surfaces · August 2026', 4.65, t);
  footer(s, 5, t);
}

export function slide06Traction(pptx, t) {
  const s = pptx.addSlide();
  offWhiteSlide(s);
  const A = tractionMetrics();
  kicker(s, 'Traction & current analytics', 0.42, t);
  title(s, 'Early product-market signal — with a live platform.', 0.68, 8.9, 26, C.text, t);

  const metrics = [
    [A.homes, 'VERIFIED\nHOMES', 'LIVE'],
    [A.neighbourhoods, 'NEIGHBOUR-\nHOODS', 'LIVE'],
    [A.providers, 'TRUSTED SERVICE\nPROVIDERS', 'LIVE'],
    [A.users, 'USERS /\nTENANTS', 'INTERNAL'],
    [A.accounts, 'LISTING\nACCOUNTS', 'INTERNAL'],
    [A.leads, 'LEAD\nACTIONS', 'INTERNAL'],
  ];
  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.55 + col * 3.05;
    const y = 1.42 + row * 1.32;
    metricCard(s, { x, y, w: 2.85, h: 1.12, num: m[0], label: m[1], tracker: t, name: `metric-${i}` });
    const badgeColor = m[2] === 'LIVE' ? C.green : C.gold;
    s.addShape('roundRect', {
      x: x + 1.85, y: y + 0.08, w: 0.75, h: 0.18,
      fill: { color: m[2] === 'LIVE' ? C.lightGreen : 'FFF7ED' }, rectRadius: 0.04,
    });
    s.addText(m[2], {
      x: x + 1.85, y: y + 0.09, w: 0.75, h: 0.16, fontSize: 5.5, bold: true, color: badgeColor, align: 'center', fontFace: FONT,
    });
  });

  // Live platform snapshot
  t.track(0.55, 3.95, 5.5, 0.55, 'live-snapshot');
  s.addShape('roundRect', { x: 0.55, y: 3.95, w: 5.5, h: 0.55, fill: { color: C.white }, line: { color: 'D8E3DC', width: 0.5 }, rectRadius: 0.06 });
  s.addText('Live platform snapshot (nyumbasearch.com)', { x: 0.7, y: 4.0, w: 5, h: 0.18, fontSize: 8, bold: true, color: C.text, fontFace: FONT });
  const snap = [
    A.browseHomes ? `${A.browseHomes} homes in tenant browse` : null,
    A.categories ? `${A.categories} service categories with providers` : null,
    A.sitemap ? `${A.sitemap} indexed property pages` : null,
  ].filter(Boolean).join('  ·  ');
  s.addText(snap, { x: 0.7, y: 4.2, w: 5.2, h: 0.25, fontSize: 7.5, color: C.muted, fontFace: FONT });

  const bars = barHeights();
  t.track(0.55, 4.58, 5.5, 0.42, 'dashboard');
  s.addText('Relative platform activity', { x: 0.7, y: 4.55, w: 3, h: 0.15, fontSize: 7, color: C.muted, fontFace: FONT });
  bars.forEach((b, i) => {
    const bx = 0.75 + i * 1.05;
    const h = Math.max(0.08, b.val * 0.35);
    s.addShape('rect', { x: bx, y: 4.88 - h, w: 0.55, h, fill: { color: C.green } });
    s.addText(b.label, { x: bx, y: 4.9, w: 0.55, h: 0.12, fontSize: 6, color: C.muted, align: 'center', fontFace: FONT });
  });

  t.track(6.3, 3.95, 3.15, 1.05, 'takeaway');
  s.addShape('roundRect', { x: 6.3, y: 3.95, w: 3.15, h: 1.05, fill: { color: C.navy }, rectRadius: 0.08 });
  s.addText('The product is live. Supply is being built. The next growth phase is distribution, repeat usage and monetization.', {
    x: 6.45, y: 4.1, w: 2.85, h: 0.8, fontSize: 9, color: C.white, fontFace: FONT,
  });
  footnote(s, A.label, 5.02, t);
  footer(s, 6, t);
}

export function slide07Market(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Market & timing', 0.42, t);
  title(s, 'Kenya is digitally connected while housing demand keeps rising.', 0.68, 8.9, 24, C.text, t);

  const stats = [
    { num: '~2M', label: 'Nairobi houses projected required by 2030', src: 'Reference material market statistic' },
    { num: '85.2%', label: 'Smartphone penetration in Kenya', src: 'Sep 2025 · reference material' },
    { num: '48.6M', label: 'Mobile-money subscriptions', src: 'Sep 2025 · reference material' },
  ];
  stats.forEach((st, i) => {
    const x = 0.55 + i * 3.05;
    t.track(x, 1.45, 2.85, 1.25, `stat-${i}`);
    s.addShape('roundRect', { x, y: 1.45, w: 2.85, h: 1.25, fill: { color: C.lightGreen }, rectRadius: 0.08 });
    s.addText(st.num, { x, y: 1.58, w: 2.85, h: 0.45, fontSize: 30, bold: true, color: C.navy, align: 'center', fontFace: FONT });
    s.addText(st.label, { x: x + 0.12, y: 2.05, w: 2.6, h: 0.4, fontSize: 9, color: C.text, align: 'center', fontFace: FONT });
    s.addText(st.src, { x: x + 0.12, y: 2.45, w: 2.6, h: 0.2, fontSize: 7, italic: true, color: C.muted, align: 'center', fontFace: FONT });
  });

  body(s, 'WHY NOW?', 0.55, 2.95, 2, 0.22, { size: 9, bold: true, color: C.green }, t, 'why-now');
  const why = [
    'Consumers discover through mobile products',
    'Housing remains frequent and locally fragmented',
    'Mobile money enables digital transactions',
    'Trust remains a major issue',
    'Property operations remain underserved',
  ];
  s.addText(why.map((w) => ({ text: w, options: { bullet: true, breakLine: true } })), {
    x: 0.55, y: 3.2, w: 5.2, h: 1.2, fontSize: 9, color: C.muted, fontFace: FONT,
  });
  t.track(0.55, 3.2, 5.2, 1.2, 'why-list');

  const phases = [
    { phase: 'PHASE 1', geo: 'Nairobi' },
    { phase: 'PHASE 2', geo: 'Kenya' },
    { phase: 'PHASE 3', geo: 'Selected African urban markets' },
  ];
  phases.forEach((p, i) => {
    const x = 6.0 + i * 1.25;
    t.track(x, 3.0, 1.1, 0.85, `phase-${i}`);
    s.addShape('roundRect', { x, y: 3.0, w: 1.1, h: 0.85, fill: { color: i === 0 ? C.green : C.offWhite }, line: { color: C.green2, width: 0.5 }, rectRadius: 0.06 });
    s.addText(p.phase, { x, y: 3.1, w: 1.1, h: 0.2, fontSize: 7, bold: true, color: i === 0 ? C.white : C.green, align: 'center', fontFace: FONT });
    s.addText(p.geo, { x, y: 3.35, w: 1.1, h: 0.4, fontSize: 7.5, color: i === 0 ? C.white : C.text, align: 'center', fontFace: FONT });
    if (i < 2) arrowRight(s, x + 1.12, 3.35, t);
  });
  footer(s, 7, t);
}

export function slide08TargetMarket(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Target market', 0.42, t);
  title(s, 'Three sides of the ecosystem. One network effect.', 0.68, 8.9, 26, C.text, t);

  const segments = [
    {
      title: 'TENANTS & HOME SEEKERS',
      who: 'Students · young professionals · families · relocators',
      needs: 'Trustworthy listings · easy discovery · verification · convenience',
    },
    {
      title: 'PROPERTY OWNERS & MANAGERS',
      who: 'Landlords · managers · agencies · developers · institutions',
      needs: 'Tenant acquisition · portfolio visibility · rent & tenant management',
    },
    {
      title: 'HOME SERVICE PROVIDERS',
      who: 'Movers · cleaners · repairs · security · solar · interior',
      needs: 'Qualified demand · customer acquisition · repeat business · visibility',
    },
  ];
  segments.forEach((seg, i) => {
    const x = 0.55 + i * 3.05;
    t.track(x, 1.45, 2.85, 3.0, `segment-${i}`);
    s.addShape('roundRect', { x, y: 1.45, w: 2.85, h: 3.0, fill: { color: C.white }, line: { color: C.green2, width: 1 }, rectRadius: 0.1 });
    s.addShape('rect', { x, y: 1.45, w: 2.85, h: 0.08, fill: { color: C.green } });
    s.addText(seg.title, { x: x + 0.12, y: 1.62, w: 2.6, h: 0.45, fontSize: 9, bold: true, color: C.navy, fontFace: FONT });
    s.addText('Includes:', { x: x + 0.12, y: 2.15, w: 2.6, h: 0.18, fontSize: 7, bold: true, color: C.green, fontFace: FONT });
    s.addText(seg.who, { x: x + 0.12, y: 2.35, w: 2.6, h: 0.55, fontSize: 8, color: C.muted, fontFace: FONT });
    s.addText('Needs:', { x: x + 0.12, y: 2.95, w: 2.6, h: 0.18, fontSize: 7, bold: true, color: C.green, fontFace: FONT });
    s.addText(seg.needs, { x: x + 0.12, y: 3.15, w: 2.6, h: 0.9, fontSize: 8, color: C.muted, fontFace: FONT });
  });

  s.addImage({ path: join(ASSETS, 'flywheel.svg'), x: 3.2, y: 4.55, w: 3.6, h: 0.55 });
  footer(s, 8, t);
}

export function slide09BusinessModel(pptx, t) {
  const s = pptx.addSlide();
  offWhiteSlide(s);
  kicker(s, 'Business model', 0.42, t);
  title(s, 'Multiple monetization layers, with recurring revenue at the core.', 0.68, 8.9, 24, C.text, t);

  const engines = [
    { n: '01', name: 'Landlord & listing plans', price: 'KSh 999–4,999/month', items: 'Premium listings · visibility · lead mgmt · verification' },
    { n: '02', name: 'Property management SaaS', price: 'KSh 2,000–10,000/month', items: 'Rent collection · leases · invoices · tenant records' },
    { n: '03', name: 'Service provider monetization', price: 'KSh 1,500–5,000/month', items: 'Subscriptions · premium placement · qualified leads' },
    { n: '04', name: 'Financial & protection referrals', price: 'Revenue-share model', items: 'Mortgages · insurance · savings · rent-related products' },
  ];
  engines.forEach((e, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 4.55;
    const y = 1.45 + row * 1.55;
    t.track(x, y, 4.25, 1.4, `engine-${i}`);
    s.addShape('roundRect', { x, y, w: 4.25, h: 1.4, fill: { color: C.white }, line: { color: 'D8E3DC', width: 0.75 }, rectRadius: 0.08 });
    s.addText(e.n, { x: x + 0.12, y: y + 0.1, w: 0.3, h: 0.25, fontSize: 10, bold: true, color: C.green, fontFace: FONT });
    s.addText(e.name, { x: x + 0.4, y: y + 0.08, w: 3.7, h: 0.28, fontSize: 10, bold: true, color: C.text, fontFace: FONT });
    s.addText(e.price, { x: x + 0.4, y: y + 0.38, w: 3.7, h: 0.22, fontSize: 9, bold: true, color: C.navy, fontFace: FONT });
    s.addText(e.items, { x: x + 0.4, y: y + 0.62, w: 3.7, h: 0.65, fontSize: 8, color: C.muted, fontFace: FONT });
  });
  footnote(s, 'Illustrative pricing assumptions — subject to validation. Full-sector activation estimate: ' + REVENUE.fullActivation + ' annually. Current revenue: not disclosed.', 4.75, t);
  footer(s, 9, t);
}

export function slide10Revenue(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Revenue potential · Estimate', 0.42, t);
  title(s, 'Illustrative revenue as all sectors activate.', 0.68, 8.9, 24, C.text, t);
  body(s, 'FUTURE REVENUE POTENTIAL — not current revenue', 0.55, 1.48, 8.9, 0.22, { size: 8, bold: true, color: C.gold }, t, 'rev-label');

  t.track(0.55, 1.72, 5.2, 2.65, 'bar-chart');
  s.addChart(pptx.charts.BAR, [{
    name: 'Revenue (USD M)',
    labels: REVENUE.years,
    values: REVENUE.values,
  }], {
    x: 0.55, y: 1.72, w: 5.2, h: 2.65,
    barDir: 'col',
    chartColors: [C.green],
    showLegend: false,
    showTitle: false,
    valAxisMaxVal: 5.5,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    dataLabelFontSize: 8,
    dataLabelPosition: 'outEnd',
    showValue: true,
  });

  // Pie chart
  t.track(6.0, 1.72, 3.5, 2.4, 'pie-chart');
  s.addChart(pptx.charts.PIE, [{
    name: 'Year 5 mix',
    labels: REVENUE.mix.map((m) => m.name),
    values: REVENUE.mix.map((m) => m.pct),
  }], {
    x: 6.0, y: 1.72, w: 3.5, h: 2.4,
    chartColors: REVENUE.mix.map((m) => m.color),
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 7,
    showPercent: true,
    dataLabelFontSize: 7,
  });

  t.track(6.0, 4.15, 3.5, 0.55, 'y5-hero');
  s.addShape('roundRect', { x: 6.0, y: 4.15, w: 3.5, h: 0.55, fill: { color: C.navy }, rectRadius: 0.08 });
  s.addText('Year 5 illustrative annual revenue', { x: 6.1, y: 4.2, w: 3.3, h: 0.2, fontSize: 8, color: C.lime, align: 'center', fontFace: FONT });
  s.addText('USD 4.8M', { x: 6.1, y: 4.38, w: 3.3, h: 0.3, fontSize: 22, bold: true, color: C.white, align: 'center', fontFace: FONT });

  footnote(s, REVENUE.footnote, 4.85, t);
  footer(s, 10, t);
}

export function slide11Progress(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  const A = tractionMetrics();
  kicker(s, 'Progress vs. potential', 0.42, t);
  title(s, 'From early traction to a scaled housing network.', 0.68, 8.9, 26, C.text, t);

  t.track(0.55, 1.45, 4.0, 3.0, 'today-box');
  s.addShape('roundRect', { x: 0.55, y: 1.45, w: 4.0, h: 3.0, fill: { color: C.offWhite }, line: { color: 'D8E3DC', width: 0.75 }, rectRadius: 0.1 });
  s.addText('WHERE WE ARE TODAY', { x: 0.7, y: 1.58, w: 3.7, h: 0.25, fontSize: 10, bold: true, color: C.text, fontFace: FONT });
  s.addText('August 2026 · CURRENT', { x: 0.7, y: 1.82, w: 3.7, h: 0.2, fontSize: 8, color: C.green, fontFace: FONT });
  const today = [
    `${A.homes} verified homes`, `${A.neighbourhoods} neighbourhoods`,
    `${A.providers} service providers`, `${A.users} users / tenants`,
    `${A.accounts} listing accounts`, `${A.leads} lead actions`,
    'Live product · manager portal · services marketplace',
  ];
  s.addText(today.map((l) => ({ text: l, options: { bullet: true, breakLine: true } })), {
    x: 0.75, y: 2.1, w: 3.6, h: 2.2, fontSize: 9, color: C.muted, fontFace: FONT,
  });

  arrowRight(s, 4.65, 2.85, t);

  t.track(5.15, 1.45, 4.3, 3.0, 'future-box');
  s.addShape('roundRect', { x: 5.15, y: 1.45, w: 4.3, h: 3.0, fill: { color: C.lightGreen }, line: { color: C.green2, width: 1 }, rectRadius: 0.1 });
  s.addText('WHERE WE ARE HEADED', { x: 5.3, y: 1.58, w: 4.0, h: 0.25, fontSize: 10, bold: true, color: C.navy, fontFace: FONT });
  s.addText('3–5 year potential · TARGET', { x: 5.3, y: 1.82, w: 4.0, h: 0.2, fontSize: 8, color: C.green, fontFace: FONT });
  const future = [
    `${FUTURE.homes} verified homes`, `${FUTURE.users} active users`,
    `${FUTURE.accounts} property owners/managers`, `${FUTURE.providers} service providers`,
    `${FUTURE.revenue} illustrative annual revenue`, 'Regional expansion across Africa',
  ];
  s.addText(future.map((l) => ({ text: l, options: { bullet: true, breakLine: true } })), {
    x: 5.35, y: 2.1, w: 3.95, h: 2.2, fontSize: 9, color: C.text, fontFace: FONT,
  });

  const journey = ['EARLY TRACTION', 'DISTRIBUTION', 'NETWORK EFFECT', 'MARKET LEADERSHIP'];
  journey.forEach((j, i) => {
    const x = 0.85 + i * 2.35;
    t.track(x, 4.65, 2.0, 0.3, `journey-${i}`);
    s.addText(j, { x, y: 4.68, w: 2.0, h: 0.25, fontSize: 7.5, bold: true, color: C.navy, align: 'center', fontFace: FONT });
    if (i < 3) arrowRight(s, x + 2.05, 4.7, t);
  });
  footer(s, 11, t);
}

export function slide12Competition(pptx, t) {
  const s = pptx.addSlide();
  const A = tractionMetrics();
  lightSlide(s);
  kicker(s, 'Competitive landscape', 0.42, t);
  title(s, 'We compete with discovery channels — but our ambition is broader.', 0.68, 8.9, 24, C.text, t);

  const headers = ['Capability', 'Property24', 'Lamudi', 'Jiji', 'Social / WhatsApp', 'NyumbaSearch'];
  const rows = [
    ['Listing discovery', 'Strong', 'Strong', 'Partial', 'Partial', 'Core'],
    ['Verified listings / owners', 'Varies', 'Varies', 'Limited', 'Limited', 'Productized'],
    ['Property risk signals', 'Limited', 'Limited', 'Limited', 'Limited', 'Built-in'],
    ['End-to-end tenancy tools', 'Limited', 'Limited', 'Limited', 'No', 'In-platform'],
    ['Rent collection', 'Limited', 'Limited', 'No', 'No', 'Productized'],
    ['Property management SaaS', 'No', 'No', 'No', 'No', 'In-platform'],
    ['Home services', 'Limited', 'Partial', 'Partial', 'Ad hoc', `${A.providers} live`],
    ['Financial integration', 'Limited', 'Limited', 'No', 'No', 'Referral paths'],
    ['All-in-one ecosystem', 'Listing-led', 'Listing-led', 'Classifieds', 'Informal', 'Combined'],
  ];

  const tableRows = [
    headers.map((h) => ({ text: h, options: { bold: true, fill: { color: C.lightGreen } } })),
    ...rows.map((row) => row.map((cell, ci) => ({
      text: cell,
      options: {
        bold: ci === 5,
        fill: ci === 5 ? { color: C.lightGreen } : { color: C.white },
        color: ci === 5 ? C.navy : C.text,
      },
    }))),
  ];

  t.track(0.45, 1.55, 9.1, 3.2, 'comp-table');
  s.addTable(tableRows, {
    x: 0.45, y: 1.55, w: 9.1,
    fontSize: 7,
    fontFace: FONT,
    border: { type: 'solid', color: 'D8E3DC', pt: 0.5 },
    colW: [1.55, 0.95, 0.95, 0.85, 1.15, 1.25],
  });

  body(s, 'Most alternatives help users FIND a property. NyumbaSearch aims to help users FIND, VERIFY, MANAGE and SERVE the entire home journey.', 0.55, 4.85, 8.9, 0.35, { size: 9, bold: true, color: C.navy }, t, 'comp-msg');
  footer(s, 12, t);
}

export function slide13Partnerships(pptx, t) {
  const s = pptx.addSlide();
  const A = tractionMetrics();
  offWhiteSlide(s);
  kicker(s, 'Partnership strategy', 0.42, t);
  title(s, 'Distribution is the next growth engine.', 0.68, 8.9, 28, C.text, t);

  const partners = [
    { n: '01', title: 'Student residences & universities', desc: 'Exclusive student inventory · acquisition · verified discovery · digital tenancy workflows', tag: 'Pipeline / strategic target' },
    { n: '02', title: 'Banks & financial institutions', desc: 'Rent payments · savings · insurance · mortgages · customer acquisition', tag: 'Pipeline / strategic target' },
    { n: '03', title: 'Property owners & managers', desc: 'Portfolio onboarding · lead generation · PM SaaS · rent collection', tag: 'Active supply channel' },
    { n: '04', title: 'Corporate & housing partners', desc: 'Employee housing · relocation · institutional accommodation', tag: 'Future opportunity' },
    { n: '05', title: 'Service providers', desc: 'Movers · cleaners · repairs · security · solar · interior', tag: `${A.providers} live today` },
  ];
  partners.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const w = 4.25;
    const h = 0.88;
    const x = i === 4 ? 2.7 : 0.55 + col * 4.55;
    const y = 1.52 + row * 0.98;
    t.track(x, y, w, h, `partner-${i}`);
    s.addShape('roundRect', { x, y, w, h, fill: { color: C.white }, line: { color: 'D8E3DC', width: 0.5 }, rectRadius: 0.06 });
    s.addText(p.n, { x: x + 0.1, y: y + 0.08, w: 0.25, h: 0.2, fontSize: 9, bold: true, color: C.green, fontFace: FONT });
    s.addText(p.title, { x: x + 0.35, y: y + 0.06, w: 3.7, h: 0.25, fontSize: 9, bold: true, color: C.text, fontFace: FONT });
    s.addText(p.desc, { x: x + 0.35, y: y + 0.3, w: 3.7, h: 0.35, fontSize: 7.5, color: C.muted, fontFace: FONT });
    s.addText(p.tag, { x: x + 0.35, y: y + 0.65, w: 3.7, h: 0.18, fontSize: 6.5, italic: true, color: C.green, fontFace: FONT });
  });

  t.track(0.55, 4.62, 8.9, 0.32, 'flywheel');
  s.addShape('roundRect', { x: 0.55, y: 4.62, w: 8.9, h: 0.32, fill: { color: C.navy }, rectRadius: 0.06 });
  s.addText('Partners → Supply → Users → Transactions → Data & trust → More partners', {
    x: 0.55, y: 4.66, w: 8.9, h: 0.25, fontSize: 9, bold: true, color: C.white, align: 'center', fontFace: FONT,
  });
  footer(s, 13, t);
}

export function slide14Ask(pptx, t) {
  const s = pptx.addSlide();
  darkSlide(s);
  kicker(s, 'Investment ask', 0.42, t);
  title(s, 'USD 1.5M Pre-Series A', 0.68, 5.2, 30, C.white, t);
  body(s, 'Capital to convert early product traction into repeatable distribution, stronger infrastructure and regional scale.', 0.55, 1.42, 4.8, 0.5, { size: 9.5, color: C.offWhite }, t, 'ask-sub');

  t.track(0.55, 2.0, 4.5, 0.5, 'ask-hero');
  s.addText('USD 1,500,000', { x: 0.55, y: 2.0, w: 4.5, h: 0.5, fontSize: 34, bold: true, color: C.lime, fontFace: FONT });

  t.track(5.35, 1.42, 4.1, 3.15, 'funds-pie');
  s.addChart(pptx.charts.PIE, [{
    name: 'Use of funds',
    labels: ASK.items.map((i) => i.name),
    values: ASK.items.map((i) => i.pct),
  }], {
    x: 5.35, y: 1.42, w: 4.1, h: 3.15,
    chartColors: [C.green, C.green2, C.gold, C.navy2, C.lime, C.muted],
    showLegend: true,
    legendPos: 'r',
    legendFontSize: 7,
    showPercent: true,
    dataLabelFontSize: 7,
  });

  ASK.items.forEach((item, i) => {
    const y = 2.65 + i * 0.36;
    t.track(0.55, y, 4.8, 0.32, `fund-${i}`);
    s.addText(item.name, { x: 0.55, y, w: 2.8, h: 0.32, fontSize: 9, color: C.offWhite, fontFace: FONT });
    s.addText(`${item.pct}%`, { x: 3.4, y, w: 0.5, h: 0.32, fontSize: 9, bold: true, color: C.lime, align: 'right', fontFace: FONT });
    s.addText(`USD ${item.usd.toLocaleString()}`, { x: 3.95, y, w: 1.2, h: 0.32, fontSize: 8, color: C.muted, align: 'right', fontFace: FONT });
  });

  footer(s, 14, t);
}

export function slide15Roadmap(pptx, t) {
  const s = pptx.addSlide();
  lightSlide(s);
  kicker(s, 'Roadmap', 0.42, t);
  title(s, 'Build the network, then compound the network.', 0.68, 8.9, 26, C.text, t);

  const phases = [
    { yr: '2026', title: 'Deepen product', items: 'PM · payments · verification · leads · service network' },
    { yr: '2027', title: 'Expand distribution', items: 'Student residences · banks · property groups · corporate housing' },
    { yr: '2028', title: 'Scale transactions', items: 'Rent collection · services · subscriptions · financial referrals' },
    { yr: '2029–30', title: 'Regional scale', items: 'Selected African urban markets' },
  ];
  phases.forEach((p, i) => {
    const x = 0.55 + i * 2.35;
    t.track(x, 1.5, 2.15, 2.85, `road-${i}`);
    s.addShape('roundRect', { x, y: 1.5, w: 2.15, h: 2.85, fill: { color: i === 0 ? C.lightGreen : C.white }, line: { color: C.green2, width: 0.75 }, rectRadius: 0.08 });
    s.addText(p.yr, { x, y: 1.62, w: 2.15, h: 0.3, fontSize: 11, bold: true, color: C.green, align: 'center', fontFace: FONT });
    s.addText(p.title, { x: x + 0.1, y: 1.95, w: 1.95, h: 0.35, fontSize: 10, bold: true, color: C.navy, fontFace: FONT });
    s.addText(p.items, { x: x + 0.1, y: 2.35, w: 1.95, h: 1.8, fontSize: 8, color: C.muted, fontFace: FONT });
    if (i < 3) arrowRight(s, x + 2.18, 2.6, t);
  });

  t.track(0.55, 4.55, 8.9, 0.35, 'road-seq');
  s.addShape('roundRect', { x: 0.55, y: 4.55, w: 8.9, h: 0.35, fill: { color: C.navy }, rectRadius: 0.06 });
  s.addText('Product → Partnerships → Transactions → Recurring revenue → Regional scale', {
    x: 0.55, y: 4.6, w: 8.9, h: 0.28, fontSize: 9, bold: true, color: C.white, align: 'center', fontFace: FONT,
  });
  footer(s, 15, t);
}

export function slide16Closing(pptx, t) {
  const s = pptx.addSlide();
  const roomPath = join(ASSETS, 'closing-living-room.jpg');

  // Warm base fill
  t.track(0, 0, 10, 5.625, 'bg');
  s.addShape('rect', { x: 0, y: 0, w: 10, h: 5.625, fill: { color: C.cocoaDark } });

  // Living room photo — right side only (no baked-in text)
  t.track(4.85, 0, 5.15, 5.625, 'photo');
  s.addImage({
    path: roomPath,
    x: 4.85, y: 0, w: 5.15, h: 5.625,
    sizing: { type: 'cover', w: 5.15, h: 5.625 },
  });

  // Brown gradient panel — left text area (matches reference)
  t.track(0, 0, 6.2, 5.625, 'panel');
  s.addShape('rect', {
    x: 0, y: 0, w: 6.2, h: 5.625,
    fill: { color: C.cocoaDark, transparency: 5 },
  });
  s.addShape('rect', {
    x: 4.6, y: 0, w: 1.6, h: 5.625,
    fill: { color: C.cocoaDark, transparency: 50 },
  });

  // THANK YOU headline
  t.track(0.65, 1.05, 5.2, 0.7, 'thankyou');
  s.addText('THANK YOU!', {
    x: 0.65, y: 1.05, w: 5.2, h: 0.7,
    fontSize: 36, bold: true, color: C.white, fontFace: FONT, valign: 'top',
  });

  // Tagline
  t.track(0.65, 1.82, 5.0, 0.45, 'tagline');
  s.addText('Building the housing infrastructure\nAfrica deserves.', {
    x: 0.65, y: 1.82, w: 5.0, h: 0.45,
    fontSize: 13, color: 'E8DDD4', fontFace: FONT, valign: 'top',
  });

  // Contact rows — single layer, generous vertical spacing
  const contacts = [
    { sym: 'www', label: 'nyumbasearch.com' },
    { sym: '@', label: 'nyumbasearch101@gmail.com' },
    { sym: '+', label: '+254714725598' },
    { sym: '•', label: 'Nairobi, Kenya' },
  ];
  const startY = 2.55;
  const rowH = 0.54;

  contacts.forEach((c, i) => {
    const y = startY + i * rowH;
    t.track(0.65, y, 5.0, rowH - 0.06, `contact-${i}`);

    s.addShape('ellipse', {
      x: 0.65, y: y + 0.07, w: 0.36, h: 0.36,
      fill: { color: C.cocoaDark, transparency: 35 },
      line: { color: 'FFFFFF', width: 1.2 },
    });
    s.addText(c.sym, {
      x: 0.65, y: y + 0.1, w: 0.36, h: 0.3,
      fontSize: c.sym === 'www' ? 6.5 : 11,
      bold: c.sym === 'www',
      align: 'center', color: C.white, fontFace: FONT, valign: 'middle',
    });
    s.addText(c.label, {
      x: 1.15, y: y + 0.1, w: 4.5, h: 0.32,
      fontSize: 12, color: C.white, fontFace: FONT, valign: 'middle',
    });
  });

  footer(s, 16, t);
}

export const ALL_SLIDES = [
  slide01Cover, slide02ExecSummary, slide03Problem, slide04Solution, slide05Product,
  slide06Traction, slide07Market, slide08TargetMarket, slide09BusinessModel, slide10Revenue,
  slide11Progress, slide12Competition, slide13Partnerships, slide14Ask, slide15Roadmap, slide16Closing,
];
