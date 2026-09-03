import { describe, expect, it, vi } from 'vitest';
import { ExchangeRateProviderError } from './ExchangeRateProvider';
import { FrankfurterAdapter, type HttpFetch, type HttpResponseLike } from './FrankfurterAdapter';

function jsonResponse(body: unknown, status = 200): HttpResponseLike {
	return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('FrankfurterAdapter', () => {
	it('maps a successful multi-currency response into rates to USD', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () =>
			jsonResponse({
				amount: 1,
				base: 'USD',
				date: '2026-09-02',
				rates: { EUR: 0.86371, CHF: 0.81396, GBP: 0.74167 }
			})
		);
		const adapter = new FrankfurterAdapter(fetchImpl);

		const result = await adapter.getRatesToUsd(['EUR', 'CHF', 'GBP']);

		expect(result.ratesToUsd.EUR).toBeCloseTo(1 / 0.86371);
		expect(result.ratesToUsd.CHF).toBeCloseTo(1 / 0.81396);
		expect(result.ratesToUsd.GBP).toBeCloseTo(1 / 0.74167);
		expect(result.missing).toEqual([]);
	});

	it('issues a single request for multiple distinct currencies', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () =>
			jsonResponse({ amount: 1, base: 'USD', date: '2026-09-02', rates: { EUR: 0.86, CHF: 0.81 } })
		);
		const adapter = new FrankfurterAdapter(fetchImpl);

		await adapter.getRatesToUsd(['EUR', 'CHF', 'EUR', 'CHF']);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url] = fetchImpl.mock.calls[0];
		expect(url).toContain('base=USD');
		expect(url).toContain('symbols=EUR,CHF');
	});

	it('resolves USD to 1 without an external request', async () => {
		const fetchImpl = vi.fn<HttpFetch>();
		const adapter = new FrankfurterAdapter(fetchImpl);

		const result = await adapter.getRatesToUsd(['USD']);

		expect(result).toEqual({ ratesToUsd: { USD: 1 }, missing: [] });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('includes USD alongside fetched rates without sending USD to the provider', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () =>
			jsonResponse({ amount: 1, base: 'USD', date: '2026-09-02', rates: { EUR: 0.86 } })
		);
		const adapter = new FrankfurterAdapter(fetchImpl);

		const result = await adapter.getRatesToUsd(['USD', 'EUR']);

		expect(result.ratesToUsd.USD).toBe(1);
		expect(result.ratesToUsd.EUR).toBeCloseTo(1 / 0.86);
		const [url] = fetchImpl.mock.calls[0];
		expect(url).not.toContain('USD,');
		expect(url).not.toContain(',USD');
	});

	it('avoids any request for an empty currency list', async () => {
		const fetchImpl = vi.fn<HttpFetch>();
		const adapter = new FrankfurterAdapter(fetchImpl);

		const result = await adapter.getRatesToUsd([]);

		expect(result).toEqual({ ratesToUsd: {}, missing: [] });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('identifies a requested currency the response omits', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () =>
			jsonResponse({ amount: 1, base: 'USD', date: '2026-09-02', rates: { EUR: 0.86 } })
		);
		const adapter = new FrankfurterAdapter(fetchImpl);

		const result = await adapter.getRatesToUsd(['EUR', 'NOTACURRENCY']);

		expect(Object.keys(result.ratesToUsd)).toEqual(['EUR']);
		expect(result.missing).toEqual(['NOTACURRENCY']);
	});

	it('treats a non-positive or non-finite provider rate as missing rather than inverting it', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () =>
			jsonResponse({
				amount: 1,
				base: 'USD',
				date: '2026-09-02',
				rates: { EUR: 0, CHF: -1, GBP: Number.NaN }
			})
		);
		const adapter = new FrankfurterAdapter(fetchImpl);

		const result = await adapter.getRatesToUsd(['EUR', 'CHF', 'GBP']);

		expect(result.ratesToUsd).toEqual({});
		expect(result.missing.sort()).toEqual(['CHF', 'EUR', 'GBP']);
	});

	it('throws ExchangeRateProviderError when the network request fails, preserving the cause', async () => {
		const originalError = new Error('network down');
		const fetchImpl = vi.fn<HttpFetch>(async () => {
			throw originalError;
		});
		const adapter = new FrankfurterAdapter(fetchImpl);

		await expect(adapter.getRatesToUsd(['EUR'])).rejects.toThrow(ExchangeRateProviderError);
		try {
			await adapter.getRatesToUsd(['EUR']);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(ExchangeRateProviderError);
			expect((error as ExchangeRateProviderError).cause).toBe(originalError);
		}
	});

	it('throws ExchangeRateProviderError for a non-OK HTTP status', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () => jsonResponse({ message: 'error' }, 500));
		const adapter = new FrankfurterAdapter(fetchImpl);

		await expect(adapter.getRatesToUsd(['EUR'])).rejects.toThrow(ExchangeRateProviderError);
	});

	it('throws ExchangeRateProviderError for an unexpected response shape', async () => {
		const fetchImpl = vi.fn<HttpFetch>(async () => jsonResponse({ unexpected: true }));
		const adapter = new FrankfurterAdapter(fetchImpl);

		await expect(adapter.getRatesToUsd(['EUR'])).rejects.toThrow(ExchangeRateProviderError);
	});
});
