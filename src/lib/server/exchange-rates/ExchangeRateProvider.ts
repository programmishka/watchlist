export interface ExchangeRateBatchResult {
	/** Currency code (e.g. "EUR") -> rate to convert 1 unit of that currency to USD. */
	ratesToUsd: Record<string, number>;
	/** Requested currencies the provider could not supply a rate for. */
	missing: string[];
}

/**
 * Thrown when the exchange-rate provider itself fails (network, outage,
 * invalid response) — distinct from an individual unsupported/missing
 * currency, which is represented via `missing` instead of a throw.
 */
export class ExchangeRateProviderError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'ExchangeRateProviderError';
	}
}

export interface ExchangeRateProvider {
	/**
	 * Resolves rates to convert each requested currency to USD. `USD` always
	 * resolves to `1` without requiring a provider request. Requesting only
	 * `USD` (or an empty list) never triggers an external call.
	 */
	getRatesToUsd(currencies: string[]): Promise<ExchangeRateBatchResult>;
}
