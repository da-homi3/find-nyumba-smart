/** NyumbaSearch investor deck design tokens */
export const C = {
  navy: '08192B',
  navy2: '0F2A44',
  green: '19995C',
  green2: '3AB570',
  lime: '91D64D',
  offWhite: 'F4F7F5',
  white: 'FAFCFA',
  text: '1B2B36',
  muted: '5B6C77',
  lightGreen: 'E1F4E9',
  gold: 'E0AA3E',
  red: 'DC2626',
};

export const FONT = 'Arial';
export const FOOTER = 'NYUMBASEARCH • INVESTOR DECK • AUGUST 2026';

export const SLIDE = { w: 10, h: 5.625 };
export const MARGIN = { l: 0.55, r: 0.55, t: 0.45, b: 0.42 };

export const TRACTION = {
  homes: '263+',
  neighbourhoods: '182+',
  providers: '214+',
  users: '132+',
  accounts: '24+',
  leads: '109+',
  label: 'Current figures from supplied materials — August 2026',
};

export const REVENUE = {
  years: ['2026', '2027', '2028', '2029', '2030'],
  values: [0.35, 0.9, 1.9, 3.2, 4.8],
  mix: [
    { name: 'Property mgmt SaaS', pct: 35, color: C.navy },
    { name: 'Landlord & listing', pct: 25, color: C.green },
    { name: 'Service providers', pct: 20, color: C.green2 },
    { name: 'Financial / referrals', pct: 15, color: C.gold },
    { name: 'Data / ads', pct: 5, color: C.muted },
  ],
  footnote: 'Illustrative planning scenario based on assumptions; actual results may differ.',
};

export const ASK = {
  total: 1_500_000,
  items: [
    { name: 'Product development', pct: 30, usd: 450_000 },
    { name: 'Team & talent', pct: 20, usd: 300_000 },
    { name: 'Marketing & growth', pct: 20, usd: 300_000 },
    { name: 'Operations & support', pct: 15, usd: 225_000 },
    { name: 'Partnerships & integrations', pct: 10, usd: 150_000 },
    { name: 'Legal & compliance', pct: 5, usd: 75_000 },
  ],
};
