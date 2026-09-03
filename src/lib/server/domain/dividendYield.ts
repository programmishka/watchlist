/**
 * Yahoo reports GBp-quoted stocks with `price` in pence while treating
 * `annualDividend` as GBP for this calculation (1 GBP = 100 pence). This is
 * a fixed unit relationship, not an FX conversion — see ARCHITECTURE.md
 * §19.1. It applies only to dividend-yield calculation, never to
 * `StockMarketData.marketCap` (that is a separate, FX-based rule; see
 * TASK-005 / ARCHITECTURE.md §18).
 */
export function normalizeAnnualDividendForYield(
	annualDividend: number,
	currency: string | undefined
): number {
	return currency === 'GBp' ? annualDividend * 100 : annualDividend;
}

export function calculateDividendYield(
	annualDividend: number | undefined,
	price: number | undefined,
	currency: string | undefined
): number {
	if (annualDividend === undefined) {
		return 0;
	}
	if (!Number.isFinite(annualDividend) || annualDividend < 0) {
		return 0;
	}
	if (price === undefined || !Number.isFinite(price) || price <= 0) {
		return 0;
	}

	const normalizedAnnualDividend = normalizeAnnualDividendForYield(annualDividend, currency);
	const dividendYield = normalizedAnnualDividend / price;

	return Number.isFinite(dividendYield) && dividendYield >= 0 ? dividendYield : 0;
}
