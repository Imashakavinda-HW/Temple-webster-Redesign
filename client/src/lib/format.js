// Prices travel as integer cents; this turns 129900 into "$1,299".
export const money = (cents) =>
  '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const stars = (p) => `★ ${p.rating} · ${p.reviewCount} reviews`;
