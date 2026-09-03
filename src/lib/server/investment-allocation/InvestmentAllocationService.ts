import {
	calculateInvestedTotal,
	calculateInvestmentFactor,
	calculateSavingsAllocation
} from '../domain/investmentAllocation';
import type { WatchlistQueryService } from '../watchlist/WatchlistQueryService';
import type { InvestmentAllocation, StockAllocation } from './InvestmentAllocation';

export class InvestmentAllocationService {
	/**
	 * Depends only on `getWatchlist`, not the full `WatchlistQueryService`
	 * class, so tests can supply a minimal fake instead of reconstructing
	 * TASK-011's entire repository/provider dependency graph.
	 */
	constructor(
		private readonly watchlistQueryService: Pick<WatchlistQueryService, 'getWatchlist'>
	) {}

	async calculateAllocation(
		userId: string,
		watchlistId: string,
		totalSavings: number
	): Promise<InvestmentAllocation> {
		const watchlist = await this.watchlistQueryService.getWatchlist(userId, watchlistId);

		const factors = watchlist.stocks.map((stock) =>
			calculateInvestmentFactor(stock.distanceToTarget)
		);
		// Validates totalSavings and computes the factor sum internally; an
		// invalid totalSavings throws the existing InvalidTotalSavingsError.
		const savingsAmounts = calculateSavingsAllocation(factors, totalSavings);
		const invested = calculateInvestedTotal(savingsAmounts);

		const allocations: StockAllocation[] = watchlist.stocks.map((stock, index) => ({
			symbol: stock.symbol,
			factor: factors[index],
			savingsAmount: savingsAmounts[index]
		}));

		return { totalSavings, invested, allocations };
	}
}
