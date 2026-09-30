// Prices travel as integer cents; this turns 129900 into "$1,299".
export const money = (cents) =>
  '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const stars = (p) => `★ ${p.rating} · ${p.reviewCount} reviews`;

// "2026-10-07" → "Wed 7 Oct". Parsed as a local date so it never shifts a day by timezone.
export function fmtDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
export const fmtRange = (from, to) => (from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`);

// Honest stock wording: an exact count when it's low, never "in stock" when it isn't.
export function stockInfo(stock) {
  if (stock <= 0) return { text: 'Out of stock', cls: 'out' };
  if (stock <= 5) return { text: `Only ${stock} left`, cls: 'low' };
  return { text: 'In stock · ready to dispatch', cls: 'in' };
}
