/**
 * Standard amortization: given a monthly payment, APR (as %), and term in
 * months, return the principal — i.e. the maximum car price they can afford.
 *
 *   maxPrice = M × (1 - (1 + r)^(-n)) / r
 *
 * where r = APR/100/12, n = term months. Ayan's max term is 60 months.
 */
export function computeMaxPrice(input: {
  monthly: number;
  apr: number;
  termMonths?: number;
}): number {
  const n = input.termMonths ?? 60;
  const r = input.apr / 100 / 12;
  if (r === 0) return Math.round(input.monthly * n);
  const principal =
    (input.monthly * (1 - Math.pow(1 + r, -n))) / r;
  return Math.round(principal);
}

/** Reverse: given a price and APR, what's the monthly over 60 months? */
export function computeMonthly(input: {
  price: number;
  apr: number;
  termMonths?: number;
}): number {
  const n = input.termMonths ?? 60;
  const r = input.apr / 100 / 12;
  if (r === 0) return Math.round(input.price / n);
  const monthly =
    (input.price * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(monthly);
}
