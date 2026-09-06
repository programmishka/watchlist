import type { Locator, Page } from '@playwright/test';

/**
 * Presentation-agnostic locators for the per-stock information shared by
 * `WatchlistTable` and `WatchlistCards` (TASK-036 §11-14): both components
 * render one `.stock-row` per stock (a `<tr>` in Table mode, an `<li>` in
 * Card mode), each containing a `.symbol` element and, where applicable, a
 * `.distance-value`/`.savings-value` element. Using these shared class names
 * lets most existing behavioral specs verify identical outcomes regardless
 * of which presentation the current viewport renders, instead of needing a
 * separate assertion path per presentation.
 */
export function stockRows(page: Page): Locator {
	return page.locator('.stock-row');
}

export function stockRow(page: Page, symbol: string): Locator {
	return stockRows(page).filter({ hasText: symbol });
}

export function distanceValue(page: Page, symbol: string): Locator {
	return stockRow(page, symbol).locator('.distance-value');
}

export function savingsValue(page: Page, symbol: string): Locator {
	return stockRow(page, symbol).locator('.savings-value');
}

/**
 * `allTextContents()` reads immediately with no built-in retry, unlike
 * `expect(...).toHaveText(...)`. Waiting for the first match first avoids a
 * race against the initial Watchlist load/a same-Watchlist mutation.
 */
export async function symbolTexts(page: Page): Promise<string[]> {
	const symbols = page.locator('.stock-row .symbol');
	await symbols.first().waitFor();
	return symbols.allTextContents();
}
