import { describe, expect, it, vi } from 'vitest';
import { MarketDataProviderError } from './MarketDataProvider';
import { YahooFinanceAdapter, type YahooQuoteClient } from './YahooFinanceAdapter';

function fakeClient(quote: (query: string | string[]) => Promise<unknown>): YahooQuoteClient {
	return { quote: vi.fn(quote) } as unknown as YahooQuoteClient;
}

const AAPL_QUOTE = {
	symbol: 'AAPL',
	longName: 'Apple Inc.',
	regularMarketPrice: 324.96,
	currency: 'USD',
	trailingAnnualDividendRate: 1.05,
	marketCap: 4_742_524_698_624
};

describe('YahooFinanceAdapter mapping', () => {
	it('maps all required Yahoo fields to the application-owned shape', async () => {
		const client = fakeClient(async () => AAPL_QUOTE);
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuote('AAPL');

		expect(result).toEqual({
			symbol: 'AAPL',
			name: 'Apple Inc.',
			price: 324.96,
			currency: 'USD',
			annualDividend: 1.05,
			marketCap: 4_742_524_698_624
		});
	});

	it('maps missing optional Yahoo fields to undefined rather than inventing values', async () => {
		const client = fakeClient(async () => ({ symbol: 'RELIANCE.NS' }));
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuote('RELIANCE.NS');

		expect(result).toEqual({
			symbol: 'RELIANCE.NS',
			name: undefined,
			price: undefined,
			currency: undefined,
			annualDividend: undefined,
			marketCap: undefined
		});
	});

	it('does not apply GBp or dividend-correction business rules to raw values', async () => {
		const client = fakeClient(async () => ({
			symbol: 'SHEL.L',
			longName: 'Shell plc',
			regularMarketPrice: 3412,
			currency: 'GBp',
			trailingAnnualDividendRate: 1.511,
			marketCap: 187_662_401_536
		}));
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuote('SHEL.L');

		expect(result?.currency).toBe('GBp');
		expect(result?.price).toBe(3412);
		expect(result?.annualDividend).toBe(1.511);
		expect(result?.marketCap).toBe(187_662_401_536);
	});
});

describe('YahooFinanceAdapter.getQuote', () => {
	it('returns mapped data for a valid symbol', async () => {
		const client = fakeClient(async () => AAPL_QUOTE);
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuote('AAPL');

		expect(result?.symbol).toBe('AAPL');
	});

	it('returns undefined for an unknown symbol without throwing', async () => {
		const client = fakeClient(async () => undefined);
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuote('NOTAREALSYMBOL123');

		expect(result).toBeUndefined();
	});

	it('throws MarketDataProviderError, preserving the cause, when the client fails', async () => {
		const originalError = new Error('network down');
		const client = fakeClient(async () => {
			throw originalError;
		});
		const adapter = new YahooFinanceAdapter(client);

		await expect(adapter.getQuote('AAPL')).rejects.toThrow(MarketDataProviderError);
		try {
			await adapter.getQuote('AAPL');
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(MarketDataProviderError);
			expect((error as MarketDataProviderError).cause).toBe(originalError);
		}
	});
});

describe('YahooFinanceAdapter.getQuotes', () => {
	it('returns mapped data for multiple successful symbols', async () => {
		const client = fakeClient(async () => [
			AAPL_QUOTE,
			{
				symbol: 'SAP.DE',
				longName: 'SAP SE',
				regularMarketPrice: 184.94,
				currency: 'EUR',
				trailingAnnualDividendRate: 2.5,
				marketCap: 213_458_550_784
			}
		]);
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuotes(['AAPL', 'SAP.DE']);

		expect(result.found.map((quote) => quote.symbol)).toEqual(['AAPL', 'SAP.DE']);
		expect(result.missing).toEqual([]);
	});

	it('uses the batch capability instead of one call per symbol', async () => {
		const quote = vi.fn(async () => [AAPL_QUOTE]);
		const client = { quote } as unknown as YahooQuoteClient;
		const adapter = new YahooFinanceAdapter(client);

		await adapter.getQuotes(['AAPL', 'SAP.DE', 'TOM.OL']);

		expect(quote).toHaveBeenCalledTimes(1);
		expect(quote).toHaveBeenCalledWith(['AAPL', 'SAP.DE', 'TOM.OL']);
	});

	it('identifies a symbol Yahoo silently omitted from a batch result', async () => {
		const client = fakeClient(async () => [
			AAPL_QUOTE,
			{ symbol: 'SAP.DE', longName: 'SAP SE' },
			{ symbol: 'TOM.OL', longName: 'Tomra Systems ASA' }
		]);
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuotes([
			'AAPL',
			'SAP.DE',
			'THIS-SYMBOL-DOES-NOT-EXIST',
			'TOM.OL'
		]);

		expect(result.found.map((quote) => quote.symbol)).toEqual(['AAPL', 'SAP.DE', 'TOM.OL']);
		expect(result.missing).toEqual(['THIS-SYMBOL-DOES-NOT-EXIST']);
	});

	it('returns an empty result for an empty symbol list without calling the client', async () => {
		const quote = vi.fn();
		const client = { quote } as unknown as YahooQuoteClient;
		const adapter = new YahooFinanceAdapter(client);

		const result = await adapter.getQuotes([]);

		expect(result).toEqual({ found: [], missing: [] });
		expect(quote).not.toHaveBeenCalled();
	});

	it('throws MarketDataProviderError when the batch request fails globally, not per-symbol', async () => {
		const originalError = new Error('provider unavailable');
		const client = fakeClient(async () => {
			throw originalError;
		});
		const adapter = new YahooFinanceAdapter(client);

		await expect(adapter.getQuotes(['AAPL', 'SAP.DE'])).rejects.toThrow(MarketDataProviderError);
		try {
			await adapter.getQuotes(['AAPL', 'SAP.DE']);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(MarketDataProviderError);
			expect((error as MarketDataProviderError).cause).toBe(originalError);
		}
	});
});
