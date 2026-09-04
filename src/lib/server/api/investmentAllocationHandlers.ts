import { json } from '@sveltejs/kit';
import { assertValidTotalSavings } from '../domain/investmentAllocation';
import type { InvestmentAllocationService } from '../investment-allocation/InvestmentAllocationService';
import { requireNumberField } from './requestBody';

export interface StockAllocationResponse {
	symbol: string;
	factor: number;
	savingsAmount: number;
}

export interface InvestmentAllocationResponse {
	totalSavings: number;
	invested: number;
	allocations: StockAllocationResponse[];
}

/**
 * Validates `totalSavings` at the HTTP boundary before any Watchlist/
 * provider work happens. Reuses the exact domain rule (`assertValidTotalSavings`)
 * that `calculateSavingsAllocation` also applies internally — not a second,
 * potentially conflicting rule; just invoked earlier.
 */
export function requireValidTotalSavings(body: unknown): number {
	const totalSavings = requireNumberField(body, 'totalSavings');
	assertValidTotalSavings(totalSavings);
	return totalSavings;
}

export async function calculateInvestmentAllocation(
	userId: string,
	watchlistId: string,
	totalSavings: number,
	investmentAllocationService: Pick<InvestmentAllocationService, 'calculateAllocation'>
): Promise<Response> {
	const allocation = await investmentAllocationService.calculateAllocation(
		userId,
		watchlistId,
		totalSavings
	);

	const body: InvestmentAllocationResponse = {
		totalSavings: allocation.totalSavings,
		invested: allocation.invested,
		allocations: allocation.allocations.map((allocationEntry) => ({
			symbol: allocationEntry.symbol,
			factor: allocationEntry.factor,
			savingsAmount: allocationEntry.savingsAmount
		}))
	};
	return json(body);
}
