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

/**
 * A numeric distance is only meaningful when both inputs are present,
 * finite, and strictly positive (TASK-031 §4). Missing/zero/negative/
 * non-finite inputs, or a non-finite result, produce `undefined` rather than
 * a fabricated `0` — `0` is reserved for a real calculated distance (current
 * price exactly equals Target Price).
 */
export function calculateTargetPriceDistance(
	regularMarketPrice: RegularMarketPrice,
	targetPrice: TargetPrice
): number | undefined {
	if (
		regularMarketPrice === undefined ||
		targetPrice === undefined ||
		!Number.isFinite(regularMarketPrice) ||
		!Number.isFinite(targetPrice) ||
		regularMarketPrice <= 0 ||
		targetPrice <= 0
	) {
		return undefined;
	}

	const distance = regularMarketPrice / targetPrice - 1;
	return Number.isFinite(distance) ? distance : undefined;
}

/**
 * A missing distance (cannot participate in allocation, TASK-031 §24) and a
 * real zero distance (current price exactly equals Target Price) are
 * distinct input states that happen to both yield factor `0` under this
 * existing formula — `!targetPriceDistance` is true for both `undefined` and
 * `0`. This is intentional legacy behavior for the zero case, preserved
 * as-is; only the meaning of the missing case changed (TASK-031 supersedes
 * TASK-003's use of `0` as a missing-data sentinel upstream of this
 * function).
 */
export function calculateInvestmentFactor(targetPriceDistance: number | undefined): number {
	if (!targetPriceDistance) {
		return 0;
	}

	return sanitizeFactor(1 / (1 + targetPriceDistance));
}

export function calculateFactorSum(factors: number[]): number {
	return factors.reduce((sum, factor) => sum + sanitizeFactor(factor), 0);
}

/**
 * Exported so callers (e.g. the HTTP layer) can reject an obviously invalid
 * `totalSavings` before doing unnecessary work — the exact same rule
 * `calculateSavingsAllocation` applies internally, not a second/conflicting
 * one.
 */
export function assertValidTotalSavings(totalSavings: number): void {
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
