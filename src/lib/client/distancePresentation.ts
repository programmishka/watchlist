export type DistanceToTargetState = 'favorable' | 'unfavorable' | 'neutral';

/**
 * Value-oriented Distance-to-Target classification (TASK-033 §28-33, shared
 * between `WatchlistTable` and `WatchlistCards` as of TASK-036 §84): a
 * negative distance means the market price is below Target Price, which is
 * presentationally favorable; positive is unfavorable. This is deliberately
 * not named after mathematical sign to avoid ambiguity. Zero and missing
 * distances are both neutral, but for distinct reasons (a real equal-price
 * result vs. no calculable value at all).
 */
export function distanceStateFor(distanceToTarget: number | undefined): DistanceToTargetState {
	if (distanceToTarget === undefined || distanceToTarget === 0) {
		return 'neutral';
	}
	return distanceToTarget < 0 ? 'favorable' : 'unfavorable';
}
