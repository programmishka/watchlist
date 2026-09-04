import type { WatchlistStock } from '../../../src/lib/client/watchlistApi';

/** USD stock with no Target Price set (TASK-018 §28). */
export const AAPL_STOCK: WatchlistStock = {
	symbol: 'AAPL',
	name: 'Apple Inc.',
	price: 200,
	currency: 'USD',
	targetPrice: undefined,
	distanceToTarget: 0,
	dividendYield: 0.005,
	marketCapBillionsUsd: 3000
};

/** EUR stock with a positive distance to target. */
export const SAP_DE_STOCK: WatchlistStock = {
	symbol: 'SAP.DE',
	name: 'SAP SE',
	price: 180.5,
	currency: 'EUR',
	targetPrice: 150,
	distanceToTarget: 180.5 / 150 - 1,
	dividendYield: 0.032,
	marketCapBillionsUsd: 180
};

/** GBp stock with a negative distance to target (TASK-018 §29). */
export const GAW_L_STOCK: WatchlistStock = {
	symbol: 'GAW.L',
	name: 'Games Workshop Group PLC',
	price: 9500,
	currency: 'GBp',
	targetPrice: 10000,
	distanceToTarget: 9500 / 10000 - 1,
	dividendYield: 0.041,
	marketCapBillionsUsd: 5
};

/** Missing-market-data stock representing the TASK-011 partial-success placeholder behaviour. */
export const UNKNOWN_STOCK: WatchlistStock = {
	symbol: 'UNKNOWN',
	name: undefined,
	price: undefined,
	currency: undefined,
	marketCapBillionsUsd: undefined,
	targetPrice: 100,
	distanceToTarget: 0,
	dividendYield: 0
};
