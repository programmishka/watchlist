import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_SAVINGS } from '../../shared/investmentSavings';
import { InvalidTotalSavingsError } from '../domain/investmentAllocation';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import type { InvestmentAllocation } from '../investment-allocation/InvestmentAllocation';
import type { InvestmentAllocationService } from '../investment-allocation/InvestmentAllocationService';
import { WatchlistNotFoundError } from '../watchlist/WatchlistServiceErrors';
import { InvalidRequestError } from './errors';
import {
	calculateInvestmentAllocation,
	requireValidTotalSavings
} from './investmentAllocationHandlers';

describe('requireValidTotalSavings', () => {
	it.each([0, 1, 500, 1000])('accepts %j', (totalSavings) => {
		expect(requireValidTotalSavings({ totalSavings })).toBe(totalSavings);
	});

	it('throws InvalidRequestError for a missing field', () => {
		expect(() => requireValidTotalSavings({})).toThrow(InvalidRequestError);
	});

	it('throws InvalidRequestError for a numeric string, without coercing it', () => {
		expect(() => requireValidTotalSavings({ totalSavings: '1000' })).toThrow(InvalidRequestError);
	});

	it.each([
		['negative', -1],
		['fractional', 12.5],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY],
		['above the maximum', MAX_TOTAL_SAVINGS + 1],
		['an unsafe integer', Number.MAX_SAFE_INTEGER + 2]
	])('throws InvalidTotalSavingsError for a %s value', (_label, totalSavings) => {
		expect(() => requireValidTotalSavings({ totalSavings })).toThrow(InvalidTotalSavingsError);
	});

	it('accepts the maximum value', () => {
		expect(requireValidTotalSavings({ totalSavings: MAX_TOTAL_SAVINGS })).toBe(MAX_TOTAL_SAVINGS);
	});
});

function fakeAllocationService(
	resolver: (
		userId: string,
		watchlistId: string,
		totalSavings: number
	) => Promise<InvestmentAllocation>
): Pick<InvestmentAllocationService, 'calculateAllocation'> & {
	calls: { userId: string; watchlistId: string; totalSavings: number }[];
} {
	const calls: { userId: string; watchlistId: string; totalSavings: number }[] = [];
	return {
		calls,
		async calculateAllocation(userId: string, watchlistId: string, totalSavings: number) {
			calls.push({ userId, watchlistId, totalSavings });
			return resolver(userId, watchlistId, totalSavings);
		}
	};
}

describe('calculateInvestmentAllocation', () => {
	it('maps a successful allocation to the API DTO, preserving order and values exactly', async () => {
		const allocationService = fakeAllocationService(async () => ({
			totalSavings: 300,
			invested: 300,
			allocations: [
				{ symbol: 'AAPL', factor: 0.5, savingsAmount: 50 },
				{ symbol: 'SAP.DE', factor: 2, savingsAmount: 200 },
				{ symbol: 'GAW.L', factor: 0.5, savingsAmount: 50 }
			]
		}));

		const response = await calculateInvestmentAllocation('user-1', 'wl-1', 300, allocationService);
		const body = (await response.json()) as unknown;

		expect(response.status).toBe(200);
		expect(body).toEqual({
			totalSavings: 300,
			invested: 300,
			allocations: [
				{ symbol: 'AAPL', factor: 0.5, savingsAmount: 50 },
				{ symbol: 'SAP.DE', factor: 2, savingsAmount: 200 },
				{ symbol: 'GAW.L', factor: 0.5, savingsAmount: 50 }
			]
		});
	});

	it('passes userId, watchlistId, and totalSavings through unchanged', async () => {
		const allocationService = fakeAllocationService(async () => ({
			totalSavings: 0,
			invested: 0,
			allocations: []
		}));

		await calculateInvestmentAllocation('user-1', 'wl-1', 0, allocationService);

		expect(allocationService.calls).toEqual([
			{ userId: 'user-1', watchlistId: 'wl-1', totalSavings: 0 }
		]);
	});

	it('returns a successful empty allocation for an empty Watchlist', async () => {
		const allocationService = fakeAllocationService(async () => ({
			totalSavings: 1000,
			invested: 0,
			allocations: []
		}));

		const response = await calculateInvestmentAllocation('user-1', 'wl-1', 1000, allocationService);
		const body = (await response.json()) as unknown;

		expect(response.status).toBe(200);
		expect(body).toEqual({ totalSavings: 1000, invested: 0, allocations: [] });
	});

	it('propagates WatchlistNotFoundError rather than mapping it to a response', async () => {
		const allocationService = fakeAllocationService(async () => {
			throw new WatchlistNotFoundError('wl-missing');
		});

		await expect(
			calculateInvestmentAllocation('user-1', 'wl-missing', 100, allocationService)
		).rejects.toThrow(WatchlistNotFoundError);
	});

	it('propagates MarketDataProviderError rather than mapping it to a response', async () => {
		const allocationService = fakeAllocationService(async () => {
			throw new MarketDataProviderError('provider outage');
		});

		await expect(
			calculateInvestmentAllocation('user-1', 'wl-1', 100, allocationService)
		).rejects.toThrow(MarketDataProviderError);
	});
});
