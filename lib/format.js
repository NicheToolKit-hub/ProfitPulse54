// Money is stored as integer minor units (cents). Helpers keep UI + API consistent.
export const toCents = (dollars) => Math.round(Number(dollars || 0) * 100);
export const fromCents = (cents) => Number(cents || 0) / 100;

export function money(cents, opts = {}) {
  const v = fromCents(cents);
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'usd',
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
  });
}

export function pct(n) {
  return `${(Number(n || 0) * 100).toFixed(1)}%`;
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
