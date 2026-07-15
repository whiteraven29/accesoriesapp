export const roundMoney = (value: number): number =>
  Number.isFinite(value) ? Math.round(value) : 0;

export const clampPercentage = (value: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export const discountedUnitPrice = (price: number, discount = 0): number =>
  roundMoney(price * (1 - clampPercentage(discount) / 100));

export const lineTotal = (unitPrice: number, quantity: number): number =>
  roundMoney(unitPrice) * Math.max(0, Math.trunc(quantity));

export const grossProfit = (revenue: number, cost: number): number =>
  roundMoney(revenue - cost);

export const grossMarginPercentage = (revenue: number, cost: number): number =>
  revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
