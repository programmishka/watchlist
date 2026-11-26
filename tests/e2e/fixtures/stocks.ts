import type { WatchlistStock } from '../../../src/lib/client/watchlistApi';

/** USD stock with no Target Price set (TASK-018 §28); no Target Price means no calculable distance (TASK-031). */
export const AAPL_STOCK: WatchlistStock = {
	symbol: 'AAPL',
	name: 'Apple Inc.',
	price: 200,
	currency: 'USD',
	targetPrice: undefined,
	distanceToTarget: undefined,
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

/**
 * Missing-market-data stock representing the TASK-011 partial-success
 * placeholder behaviour. A missing price never produces a calculated
 * distance (TASK-031) even though a Target Price is set.
 */
export const UNKNOWN_STOCK: WatchlistStock = {
	symbol: 'UNKNOWN',
	name: undefined,
	price: undefined,
	currency: undefined,
	marketCapBillionsUsd: undefined,
	targetPrice: 100,
	distanceToTarget: undefined,
	dividendYield: 0
};

/**
 * Reproduces the exact TASK-031 production regression report: a missing
 * market price with a Target Price of `1` must never produce a numeric
 * Target Price distance.
 */
export const MISSING_PRICE_STOCK: WatchlistStock = {
	symbol: 'NOPRICE',
	name: 'No Price Inc.',
	price: undefined,
	currency: undefined,
	marketCapBillionsUsd: undefined,
	targetPrice: 1,
	distanceToTarget: undefined,
	dividendYield: 0
};

/** Current price exactly equals Target Price: a real calculated distance of 0 (TASK-031). */
export const EQUAL_PRICE_TARGET_STOCK: WatchlistStock = {
	symbol: 'EQUAL',
	name: 'Equal Price Co.',
	price: 100,
	currency: 'USD',
	targetPrice: 100,
	distanceToTarget: 0,
	dividendYield: 0,
	marketCapBillionsUsd: 10
};

/**
 * Reproduces the TASK-046 defect report directly: a JPY Price above 14,000
 * that must remain fully inspectable (full DOM text + matching native
 * title) despite the table's compact, truncating numeric columns.
 */
export const JPY_LARGE_PRICE_STOCK: WatchlistStock = {
	symbol: 'JPYBIG',
	name: 'Japan Large Cap KK',
	price: 14310.75,
	currency: 'JPY',
	targetPrice: 15000,
	distanceToTarget: 14310.75 / 15000 - 1,
	dividendYield: 0.0088,
	marketCapBillionsUsd: 523.456
};

/**
 * Reproduces the TASK-046 locale-input defect report directly: a fractional
 * Price and Target Price that must render with the same locale decimal
 * separator, with Price and Target Price exactly equal — the same scenario
 * used to reproduce the TASK-046 zero-distance allocation defect, since the
 * Product Owner's report is literally one stock exhibiting both symptoms.
 */
export const FRACTIONAL_EQUAL_PRICE_TARGET_STOCK: WatchlistStock = {
	symbol: 'FRACEQ',
	name: 'Fractional Equal Price AG',
	price: 149.3,
	currency: 'EUR',
	targetPrice: 149.3,
	distanceToTarget: 0,
	dividendYield: 0.01,
	marketCapBillionsUsd: 42.5
};
