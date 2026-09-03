import { describe, expect, it, vi } from 'vitest';
import type { ExchangeRateProvider } from './ExchangeRateProvider';
import {
	calculateMarketCapInBillionsUsd,
	calculateMarketCapsInBillionsUsd,
	mapMarketCurrencyToFxCurrency
} from './marketCapConversion';

describe('mapMarketCurrencyToFxCurrency', () => {
	it('maps GBp to GBP', () => {
		expect(mapMarketCurrencyToFxCurrency('GBp')).toBe('GBP');
	});

	it('passes normal ISO currencies through unchanged', () => {
		expect(mapMarketCurrencyToFxCurrency('EUR')).toBe('EUR');
		expect(mapMarketCurrencyToFxCurrency('USD')).toBe('USD');
		expect(mapMarketCurrencyToFxCurrency('INR')).toBe('INR');
	});
});

describe('calculateMarketCapInBillionsUsd', () => {
	it('converts a USD market cap without needing a rate lookup beyond the identity', () => {
		const result = calculateMarketCapInBillionsUsd(2_500_000_000, 'USD', { USD: 1 });
		expect(result).toEqual({ status: 'converted', billionsUsd: 2.5 });
	});

	it('converts a EUR market cap using the supplied rate', () => {
		const result = calculateMarketCapInBillionsUsd(10_000_000_000, 'EUR', { EUR: 1.2 });
		expect(result).toEqual({ status: 'converted', billionsUsd: 12 });
	});

	it('maps GBp to GBP and applies the rate directly, without dividing by 100', () => {
		const result = calculateMarketCapInBillionsUsd(187_662_401_536, 'GBp', { GBP: 1 / 0.74167 });
		expect(result.status).toBe('converted');
		if (result.status === 'converted') {
			expect(result.billionsUsd).toBeCloseTo(187.662401536 / 0.74167, 5);
		}
	});

	it('is unavailable with reason missing-market-cap when marketCap is undefined', () => {
		expect(calculateMarketCapInBillionsUsd(undefined, 'USD', { USD: 1 })).toEqual({
			status: 'unavailable',
			reason: 'missing-market-cap'
		});
	});

	it('is unavailable with reason missing-currency when currency is undefined', () => {
		expect(calculateMarketCapInBillionsUsd(1_000_000_000, undefined, { USD: 1 })).toEqual({
			status: 'unavailable',
			reason: 'missing-currency'
		});
	});

	it('preserves a genuine market cap of zero as converted, not unavailable', () => {
		expect(calculateMarketCapInBillionsUsd(0, 'USD', { USD: 1 })).toEqual({
			status: 'converted',
			billionsUsd: 0
		});
	});

	it.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY]
	])('is unavailable with reason invalid-market-cap for %s marketCap', (_label, marketCap) => {
		expect(calculateMarketCapInBillionsUsd(marketCap, 'USD', { USD: 1 })).toEqual({
			status: 'unavailable',
			reason: 'invalid-market-cap'
		});
	});

	it('is unavailable with reason unsupported-currency when no rate was supplied', () => {
		expect(calculateMarketCapInBillionsUsd(1_000_000_000, 'XAU', {})).toEqual({
			status: 'unavailable',
			reason: 'unsupported-currency'
		});
	});

	it.each([
		['zero', 0],
		['negative', -1.2],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY]
	])('is unavailable with reason invalid-exchange-rate for a %s rate', (_label, rate) => {
		expect(calculateMarketCapInBillionsUsd(1_000_000_000, 'EUR', { EUR: rate })).toEqual({
			status: 'unavailable',
			reason: 'invalid-exchange-rate'
		});
	});
});

describe('calculateMarketCapsInBillionsUsd', () => {
	it('requests each distinct currency exactly once, mapping GBp to GBP', async () => {
		const getRatesToUsd = vi.fn<ExchangeRateProvider['getRatesToUsd']>(async () => ({
			ratesToUsd: { USD: 1, EUR: 1.2, GBP: 1.35 },
			missing: []
		}));
		const provider: ExchangeRateProvider = { getRatesToUsd };

		const stocks = [
			{ symbol: 'AAPL', marketCap: 1_000_000_000, currency: 'USD' },
			{ symbol: 'SAP.DE', marketCap: 2_000_000_000, currency: 'EUR' },
			{ symbol: 'SHEL.L', marketCap: 3_000_000_000, currency: 'GBp' },
			{ symbol: 'BP.L', marketCap: 4_000_000_000, currency: 'GBp' }
		];

		const results = await calculateMarketCapsInBillionsUsd(stocks, provider);

		expect(getRatesToUsd).toHaveBeenCalledTimes(1);
		const [requestedCurrencies] = getRatesToUsd.mock.calls[0];
		expect(new Set(requestedCurrencies)).toEqual(new Set(['USD', 'EUR', 'GBP']));

		expect(results.map((r) => r.symbol)).toEqual(['AAPL', 'SAP.DE', 'SHEL.L', 'BP.L']);
		const billionsUsd = (symbol: string) => {
			const marketCap = results.find((r) => r.symbol === symbol)?.marketCap;
			expect(marketCap?.status).toBe('converted');
			return marketCap?.status === 'converted' ? marketCap.billionsUsd : NaN;
		};
		expect(billionsUsd('AAPL')).toBeCloseTo(1);
		expect(billionsUsd('SAP.DE')).toBeCloseTo(2.4);
		expect(billionsUsd('SHEL.L')).toBeCloseTo(4.05);
		expect(billionsUsd('BP.L')).toBeCloseTo(5.4);
	});

	it('propagates a provider failure rather than inventing rates', async () => {
		class BoomError extends Error {}
		const provider: ExchangeRateProvider = {
			getRatesToUsd: vi.fn(async () => {
				throw new BoomError('provider unavailable');
			})
		};

		await expect(
			calculateMarketCapsInBillionsUsd(
				[{ symbol: 'SAP.DE', marketCap: 1_000_000_000, currency: 'EUR' }],
				provider
			)
		).rejects.toThrow(BoomError);
	});
});
