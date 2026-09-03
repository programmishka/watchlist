import type { WatchlistQueryWarning } from '../watchlist/WatchlistView';

export interface ApiWarning {
	code: 'FX_PROVIDER_UNAVAILABLE' | 'MARKET_DATA_UNAVAILABLE';
	message: string;
}

const FX_PROVIDER_UNAVAILABLE_WARNING: ApiWarning = {
	code: 'FX_PROVIDER_UNAVAILABLE',
	message: 'Currency conversion is currently unavailable.'
};

/** Exported for direct use by routes that detect market-data unavailability themselves (e.g. Target Price distance refresh). */
export const MARKET_DATA_UNAVAILABLE_WARNING: ApiWarning = {
	code: 'MARKET_DATA_UNAVAILABLE',
	message: 'Current market data is temporarily unavailable.'
};

export function toApiWarnings(warnings: WatchlistQueryWarning[]): ApiWarning[] {
	return warnings.map((warning) => {
		switch (warning) {
			case 'fx-provider-unavailable':
				return FX_PROVIDER_UNAVAILABLE_WARNING;
		}
	});
}
