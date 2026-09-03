import {
	ExchangeRateProviderError,
	type ExchangeRateBatchResult,
	type ExchangeRateProvider
} from './ExchangeRateProvider';

const FRANKFURTER_LATEST_URL = 'https://api.frankfurter.dev/v1/latest';

/** The minimal HTTP response shape this adapter needs, so tests can supply a fake without a full Response polyfill. */
export interface HttpResponseLike {
	ok: boolean;
	status: number;
	json(): Promise<unknown>;
}

export type HttpFetch = (url: string) => Promise<HttpResponseLike>;

/** Frankfurter-specific response shape. Stays local to this adapter. */
interface FrankfurterLatestResponse {
	amount: number;
	base: string;
	date: string;
	rates: Record<string, unknown>;
}

function isFrankfurterLatestResponse(value: unknown): value is FrankfurterLatestResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'rates' in value &&
		typeof (value as { rates: unknown }).rates === 'object' &&
		(value as { rates: unknown }).rates !== null
	);
}

export class FrankfurterAdapter implements ExchangeRateProvider {
	constructor(private readonly fetchImpl: HttpFetch = globalThis.fetch) {}

	async getRatesToUsd(currencies: string[]): Promise<ExchangeRateBatchResult> {
		const requested = new Set(currencies);
		const wantsUsd = requested.has('USD');
		const nonUsdCurrencies = [...requested].filter((currency) => currency !== 'USD');

		const ratesToUsd: Record<string, number> = {};
		if (wantsUsd) {
			ratesToUsd.USD = 1;
		}

		if (nonUsdCurrencies.length === 0) {
			return { ratesToUsd, missing: [] };
		}

		const url = `${FRANKFURTER_LATEST_URL}?base=USD&symbols=${nonUsdCurrencies.join(',')}`;

		let response: HttpResponseLike;
		try {
			response = await this.fetchImpl(url);
		} catch (error) {
			throw new ExchangeRateProviderError('Failed to reach the exchange-rate provider', {
				cause: error
			});
		}

		if (!response.ok) {
			throw new ExchangeRateProviderError(
				`Exchange-rate provider returned an unexpected status: ${response.status}`
			);
		}

		let body: unknown;
		try {
			body = await response.json();
		} catch (error) {
			throw new ExchangeRateProviderError('Exchange-rate provider returned an invalid response', {
				cause: error
			});
		}

		if (!isFrankfurterLatestResponse(body)) {
			throw new ExchangeRateProviderError('Exchange-rate provider returned an unexpected shape');
		}

		const missing: string[] = [];
		for (const currency of nonUsdCurrencies) {
			const usdToCurrency = body.rates[currency];
			if (
				typeof usdToCurrency !== 'number' ||
				!Number.isFinite(usdToCurrency) ||
				usdToCurrency <= 0
			) {
				missing.push(currency);
				continue;
			}
			ratesToUsd[currency] = 1 / usdToCurrency;
		}

		return { ratesToUsd, missing };
	}
}
