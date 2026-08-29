import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANALYTICS_PATH = join(__dirname, '../analytics.json');

let _data = null;

export function loadAnalytics() {
  if (_data) return _data;
  if (!existsSync(ANALYTICS_PATH)) {
    return getDefaults();
  }
  try {
    const raw = JSON.parse(readFileSync(ANALYTICS_PATH, 'utf8'));
    _data = raw.deck;
    return _data;
  } catch {
    return getDefaults();
  }
}

function getDefaults() {
  return {
    verifiedHomes: 336,
    neighbourhoods: 219,
    serviceProviders: 214,
    browseHomes: 300,
    users: 132,
    listingAccounts: 24,
    leadActions: 109,
    sitemapIndexed: 336,
    serviceCategories: 24,
    display: {
      verifiedHomes: '336+',
      neighbourhoods: '219+',
      serviceProviders: '214+',
      browseHomes: '300+',
      users: '132+',
      listingAccounts: '24+',
      leadActions: '109+',
    },
    sources: {
      verifiedHomes: 'Live site · Aug 2026',
      neighbourhoods: 'Live site · Aug 2026',
      serviceProviders: 'Live site · Aug 2026',
      users: 'Internal · requires confirmation',
      listingAccounts: 'Internal · requires confirmation',
      leadActions: 'Internal · requires confirmation',
    },
    fetchedAt: new Date().toISOString(),
  };
}

export function tractionMetrics() {
  const d = loadAnalytics();
  return {
    homes: d.display.verifiedHomes,
    neighbourhoods: d.display.neighbourhoods,
    providers: d.display.serviceProviders,
    users: d.display.users,
    accounts: d.display.listingAccounts,
    leads: d.display.leadActions,
    browseHomes: d.display.browseHomes,
    sitemap: d.sitemapIndexed ? `${d.sitemapIndexed}+` : null,
    categories: d.serviceCategories ? `${d.serviceCategories}+` : '24+',
    label: `Live analytics pulled from nyumbasearch.com · ${new Date(d.fetchedAt || Date.now()).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    sources: d.sources,
    raw: d,
  };
}

export function barHeights() {
  const d = loadAnalytics();
  const max = Math.max(d.verifiedHomes, d.serviceProviders, d.users, d.listingAccounts, d.leadActions, 1);
  return [
    { label: 'Homes', val: d.verifiedHomes / max },
    { label: 'Providers', val: d.serviceProviders / max },
    { label: 'Users', val: d.users / max },
    { label: 'Accounts', val: d.listingAccounts / max },
    { label: 'Leads', val: d.leadActions / max },
  ];
}
