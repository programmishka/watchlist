import { json } from '@sveltejs/kit';
import { parseStockSymbol } from '../../shared/stockSymbol';
import { calculateTargetPriceDistance } from '../domain/investmentAllocation';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import type { MarketDataProvider } from '../market-data/MarketDataProvider';
import type { TargetPriceService } from '../target-price/TargetPriceService';
import { MARKET_DATA_UNAVAILABLE_WARNING, type ApiWarning } from './apiWarnings';

export interface TargetPriceMutationResponse {
	symbol: string;
	targetPrice: number;
	distanceToTarget?: number;
	warnings: ApiWarning[];
}

/**
 * Persists the Target Price first, then attempts a market-data refresh for
 * `distanceToTarget`. A failed/unavailable refresh never rolls back the
 * already-successful save (TASK-013 §19) — it's reported as a warning on an
 * otherwise-successful response.
 */
export async function setTargetPrice(
	userId: string,
	symbol: string,
	targetPrice: number,
	targetPriceService: TargetPriceService,
	marketDataProvider: MarketDataProvider
): Promise<Response> {
	const persisted = await targetPriceService.setTargetPrice(userId, symbol, targetPrice);
	// TargetPriceService already rejected an invalid symbol above, so this
	// mirrors the exact canonical (trim -> uppercase) key it persisted under
	// (TASK-038) — using plain `.trim()` here would drift from that key for a
	// mixed-case path symbol.
	const normalizedSymbol = parseStockSymbol(symbol).symbol;
	const persistedTargetPrice = persisted[normalizedSymbol];

	let distanceToTarget: number | undefined;
	const warnings: ApiWarning[] = [];
	try {
		const marketData = await marketDataProvider.getQuote(normalizedSymbol);
		if (marketData) {
			distanceToTarget = calculateTargetPriceDistance(marketData.price, persistedTargetPrice);
		} else {
			warnings.push(MARKET_DATA_UNAVAILABLE_WARNING);
		}
	} catch (error) {
		if (!(error instanceof MarketDataProviderError)) {
			throw error;
		}
		warnings.push(MARKET_DATA_UNAVAILABLE_WARNING);
	}

	const body: TargetPriceMutationResponse = {
		symbol: normalizedSymbol,
		targetPrice: persistedTargetPrice,
		distanceToTarget,
		warnings
	};
	return json(body);
}
