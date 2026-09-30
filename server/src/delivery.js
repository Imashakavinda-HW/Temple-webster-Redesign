// Delivery estimation: turns a postcode + the items in the cart into a delivery fee and
// real calendar dates ("Wed 8 Oct – Mon 13 Oct") instead of a vague "5–8 business days".
//
// Why: the most common complaints about the real Temple & Webster site are that delivery
// cost and timing are unclear until checkout, that a postcode can be rejected late in
// checkout, and that multi-item orders arrive on different days. Here the customer sees
// the fee, the dates and any postcode problem on the product page, before checkout.
//
// The postcode → zone table is a simplified model of Australian postcode ranges, good
// enough for a prototype. A real shop would use its carrier's zone file or API.

export const ZONES = {
  metro:    { label: 'Metro',    extraDays: 0, surchargeCents: 0 },
  regional: { label: 'Regional', extraDays: 2, surchargeCents: 0 },
  remote:   { label: 'Remote',   extraDays: 5, surchargeCents: 4900, noExpress: true },
};

// Delivery options. `days: null` means "use each product's own estimate".
export const DELIVERY_OPTIONS = {
  standard:   { label: 'Standard',               cents: 0,    days: null },
  express:    { label: 'Express',                cents: 2900, days: [2, 3] },
  whiteglove: { label: 'White-glove + assembly', cents: 7900, days: [7, 10] },
};

const METRO = [
  [800, 832],                                                   // Darwin
  [1000, 2249], [2555, 2574], [2740, 2786],                     // Sydney
  [2600, 2620], [2900, 2920],                                   // Canberra
  [3000, 3207], [3335, 3341], [3427, 3442], [3750, 3810], [3910, 3920], [3926, 3944], [3975, 3978], // Melbourne
  [4000, 4207], [4300, 4305], [4500, 4519],                     // Brisbane
  [5000, 5199],                                                 // Adelaide
  [6000, 6199],                                                 // Perth
  [7000, 7099],                                                 // Hobart
];
const REMOTE = [
  [833, 999],     // NT outside Darwin
  [4824, 4895],   // outback & far-north QLD
  [5720, 5799],   // outback SA
  [6700, 6799],   // Pilbara & Kimberley WA
];

const inRanges = (n, ranges) => ranges.some(([a, b]) => n >= a && n <= b);

function stateFor(n) {
  if (n >= 800 && n <= 999) return 'NT';
  if ((n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return 'ACT';
  if (n >= 1000 && n <= 2999) return 'NSW';
  if (n >= 3000 && n <= 3999) return 'VIC';
  if (n >= 4000 && n <= 4999) return 'QLD';
  if (n >= 5000 && n <= 5999) return 'SA';
  if (n >= 6000 && n <= 6999) return 'WA';
  if (n >= 7000 && n <= 7999) return 'TAS';
  return null;
}

// Returns { postcode, state, zone } or null if it isn't a deliverable Australian postcode.
export function lookupPostcode(value) {
  const pc = String(value ?? '').trim();
  if (!/^\d{4}$/.test(pc)) return null;
  const n = Number(pc);
  const state = stateFor(n);
  if (!state) return null;
  const zone = inRanges(n, REMOTE) ? 'remote' : inRanges(n, METRO) ? 'metro' : 'regional';
  return { postcode: pc, state, zone };
}

// Adds business days (Mon–Fri). Public holidays are ignored in this prototype.
export function addBusinessDays(start, days) {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * lines: [{ product: { id, eta_min, eta_max }, qty }]
 * Returns the fee and date window for every delivery option, plus per-item windows for
 * the chosen option, so the customer can see when each piece will arrive.
 */
export function estimateDelivery({ postcode, lines, option = 'standard', today = new Date() }) {
  const place = lookupPostcode(postcode);
  if (!place) return null;
  const zone = ZONES[place.zone];

  const windowFor = (opt, product) => {
    const [min, max] = DELIVERY_OPTIONS[opt].days || [product.eta_min, product.eta_max];
    return [min + zone.extraDays, max + zone.extraDays];
  };

  const options = {};
  for (const [key, opt] of Object.entries(DELIVERY_OPTIONS)) {
    const available = !(key === 'express' && zone.noExpress);
    // The whole order has arrived once the slowest item has arrived.
    const min = Math.max(...lines.map((l) => windowFor(key, l.product)[0]));
    const max = Math.max(...lines.map((l) => windowFor(key, l.product)[1]));
    options[key] = {
      label: opt.label,
      available,
      cents: opt.cents + zone.surchargeCents,
      from: iso(addBusinessDays(today, min)),
      to: iso(addBusinessDays(today, max)),
    };
  }

  const opt = Object.hasOwn(DELIVERY_OPTIONS, option) ? option : 'standard';
  const items = lines.map((l) => {
    const [min, max] = windowFor(opt, l.product);
    return { productId: l.product.id, from: iso(addBusinessDays(today, min)), to: iso(addBusinessDays(today, max)) };
  });
  // Items arrive separately if their windows differ; offer to consolidate them.
  const splitShipment = new Set(items.map((i) => i.from + i.to)).size > 1;

  return { ...place, zoneLabel: zone.label, surchargeCents: zone.surchargeCents, options, items, splitShipment };
}
