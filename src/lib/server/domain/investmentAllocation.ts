/**
 * Current market price for a symbol, as supplied by an external market-data
 * provider. Not persisted; distinct from the application-owned TargetPrice.
 */
export type RegularMarketPrice = number | undefined;

/**
 * User-defined target price for a symbol. Application-owned and persisted
 * independently of market data (see ARCHITECTURE.md §9.3).
 */
export type TargetPrice = number | undefined;

export class InvalidTotalSavingsError extends Error {
	constructor(totalSavings: number) {
		super(`totalSavings must be a finite, non-negative whole number. Received: ${totalSavings}`);
		this.name = 'InvalidTotalSavingsError';
	}
}

/**
 * A factor of 0 (from a falsy/zero distance, or a negative/non-finite raw
 * result) means the stock cannot participate in proportional allocation.
 */
function sanitizeFactor(factor: number): number {
	return Number.isFinite(factor) && factor > 0 ? factor : 0;
}

export function calculateTargetPriceDistance(
	regularMarketPrice: RegularMarketPrice,
	targetPrice: TargetPrice
): number {
	if (!targetPrice || !regularMarketPrice || targetPrice === 0) {
		return 0;
	}

	const distance = regularMarketPrice / targetPrice - 1;
	return Number.isFinite(distance) ? distance : 0;
}

export function calculateInvestmentFactor(targetPriceDistance: number | undefined): number {
	if (!targetPriceDistance) {
		return 0;
	}

	return sanitizeFactor(1 / (1 + targetPriceDistance));
}

export function calculateFactorSum(factors: number[]): number {
	return factors.reduce((sum, factor) => sum + sanitizeFactor(factor), 0);
}

function assertValidTotalSavings(totalSavings: number): void {
	if (!Number.isFinite(totalSavings) || !Number.isInteger(totalSavings) || totalSavings < 0) {
		throw new InvalidTotalSavingsError(totalSavings);
	}
}

/**
 * Distributes totalSavings proportionally across factors, in the same order.
 * Each amount is rounded down to a whole Euro; the rounding remainder is
 * intentionally not redistributed (see ARCHITECTURE.md §22.3/§22.4).
 */
export function calculateSavingsAllocation(factors: number[], totalSavings: number): number[] {
	assertValidTotalSavings(totalSavings);

	const sanitizedFactors = factors.map(sanitizeFactor);
	const factorSum = calculateFactorSum(sanitizedFactors);

	if (factorSum <= 0) {
		return sanitizedFactors.map(() => 0);
	}

	return sanitizedFactors.map((factor) => Math.floor((factor / factorSum) * totalSavings));
}

export function calculateInvestedTotal(savingsAmounts: number[]): number {
	return savingsAmounts.reduce((sum, amount) => sum + amount, 0);
}
