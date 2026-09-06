/**
 * Single application rule for stock-symbol normalization and syntax
 * validation (TASK-029). Pure and dependency-free — no `MarketDataProvider`,
 * network access, SvelteKit request objects, or persistence — so it can be
 * imported unchanged by both server application code and browser code.
 *
 * This is an application input grammar tailored to the Yahoo-style equity
 * identifiers this application accepts, not a claim about every ticker
 * format used worldwide.
 */
const STOCK_SYMBOL_PATTERN = /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/;

/** Trims surrounding whitespace and uppercases. Order is mandatory: trim, then uppercase. */
export function normalizeStockSymbol(input: string): string {
	return input.trim().toUpperCase();
}

/** Expects an already-normalized symbol; validates the input grammar only. */
export function isValidStockSymbol(symbol: string): boolean {
	return STOCK_SYMBOL_PATTERN.test(symbol);
}

export interface StockSymbolParseResult {
	readonly valid: boolean;
	/**
	 * The trimmed, uppercased representation of the input, always populated
	 * regardless of `valid` — an invalid result still lets callers redisplay
	 * the normalized text for the user to correct.
	 */
	readonly symbol: string;
}

/** Normalizes then validates, guaranteeing callers can never validate before normalizing. */
export function parseStockSymbol(input: string): StockSymbolParseResult {
	const symbol = normalizeStockSymbol(input);
	return { valid: isValidStockSymbol(symbol), symbol };
}
