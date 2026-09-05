import { describe, expect, it } from 'vitest';
import { allocationBySymbol } from './investmentAllocation';
import type { InvestmentAllocationResponse } from './watchlistApi';

describe('allocationBySymbol', () => {
	it('returns undefined when no allocation has been calculated yet', () => {
		expect(allocationBySymbol(undefined)).toBeUndefined();
	});

	it('associates each allocation entry with its symbol regardless of response order', () => {
		// Deliberately in a different order than a displayed/sorted table (TASK-024 §64/§74).
		const allocation: InvestmentAllocationResponse = {
			totalSavings: 1000,
			invested: 997,
			allocations: [
				{ symbol: 'SAP.DE', factor: 1.2, savingsAmount: 427 },
				{ symbol: 'AAPL', factor: 0.8, savingsAmount: 320 },
				{ symbol: 'GAW.L', factor: 0.6, savingsAmount: 250 }
			]
		};

		const bySymbol = allocationBySymbol(allocation);

		expect(bySymbol?.get('AAPL')).toEqual({ symbol: 'AAPL', factor: 0.8, savingsAmount: 320 });
		expect(bySymbol?.get('SAP.DE')).toEqual({ symbol: 'SAP.DE', factor: 1.2, savingsAmount: 427 });
		expect(bySymbol?.get('GAW.L')).toEqual({ symbol: 'GAW.L', factor: 0.6, savingsAmount: 250 });
	});

	it('returns undefined for a symbol missing from the response rather than inventing zero', () => {
		const allocation: InvestmentAllocationResponse = {
			totalSavings: 1000,
			invested: 320,
			allocations: [{ symbol: 'AAPL', factor: 0.8, savingsAmount: 320 }]
		};

		expect(allocationBySymbol(allocation)?.get('SAP.DE')).toBeUndefined();
	});

	it('preserves a real calculated zero savings amount', () => {
		const allocation: InvestmentAllocationResponse = {
			totalSavings: 0,
			invested: 0,
			allocations: [{ symbol: 'AAPL', factor: 0.8, savingsAmount: 0 }]
		};

		expect(allocationBySymbol(allocation)?.get('AAPL')?.savingsAmount).toBe(0);
	});
});
