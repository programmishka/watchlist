import type { InvestmentAllocationResponse, StockAllocationResponse } from './watchlistApi';

/**
 * Builds a symbol-keyed lookup of the current allocation result (TASK-024
 * §51-52). Association with table rows MUST use this lookup rather than
 * response array position, because the allocation response order may differ
 * from the displayed (filtered/sorted) row order. Returns `undefined` when
 * no allocation has been calculated yet, distinguishing "not calculated" from
 * "calculated but this symbol has no entry" — both render as the missing-
 * value placeholder in the table, but only the latter is a per-row lookup
 * miss.
 */
export function allocationBySymbol(
	allocation: InvestmentAllocationResponse | undefined
): Map<string, StockAllocationResponse> | undefined {
	if (!allocation) {
		return undefined;
	}

	return new Map(allocation.allocations.map((entry) => [entry.symbol, entry]));
}
