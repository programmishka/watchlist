import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK, UNKNOWN_STOCK } from './fixtures/stocks';
import {
	mockAddStock,
	mockCalculateInvestmentAllocation,
	mockRemoveStock,
	mockSetTargetPrice,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';
import { distanceValue, stockRow, stockRows, symbolTexts } from './support/stockLocators';
import { STOCK_CARD_PRESENTATION_BREAKPOINT_PX } from '../../src/lib/client/watchlistPresentation';
import type { WatchlistStock } from '../../src/lib/client/watchlistApi';

const WATCHLIST_ID = 'wl-1';
const STOCKS = [SAP_DE_STOCK, AAPL_STOCK, GAW_L_STOCK, UNKNOWN_STOCK];

async function mockSingleWatchlist(
	page: Page,
	stocks: WatchlistStock[] = STOCKS,
	watchlistId = WATCHLIST_ID,
	name = 'Main'
): Promise<void> {
	await mockWatchlistsMetadata(page, {
		activeWatchlistId: watchlistId,
		watchlists: [{ id: watchlistId, name }]
	});
	await mockWatchlistView(page, watchlistId, { id: watchlistId, name, stocks, warnings: [] });
}

function sortColumnSelect(page: Page) {
	return page.getByLabel('Sort by');
}

function sortDirectionButton(page: Page) {
	return page.getByRole('button', { name: /^Sort direction:/ });
}

/**
 * Every test in this file forces a viewport comfortably below the
 * empirically selected Table/Card breakpoint (TASK-036 §5-7), rather than
 * relying on the `chromium-mobile` project's fixed 375px viewport, so this
 * spec also exercises the wider (two-cards-per-row) end of Card mode
 * (§34-36). It runs once, not per-project.
 */
test.beforeEach(async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium-desktop', 'run once, not per-project');
	await page.setViewportSize({ width: 900, height: 1000 });
});

test.describe('Stock Cards: presentation and content', () => {
	test('Card mode is exclusively active below the breakpoint: no table in the accessibility tree', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await page.goto('/');

		await expect(page.getByRole('table')).toHaveCount(0);
		await expect(stockRows(page)).toHaveCount(4);
	});

	test('renders Symbol prominently with the associated Company Name', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		const card = stockRow(page, 'SAP.DE');
		await expect(card.locator('.symbol')).toHaveText('SAP.DE');
		await expect(card).toContainText('SAP SE');
	});

	test('shows the missing-value placeholder for a stock with no Company Name, never the Symbol', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [UNKNOWN_STOCK]);
		await page.goto('/');

		const card = stockRow(page, 'UNKNOWN');
		await expect(card.locator('.card-name')).toHaveText('—');
	});

	test('groups Price and Currency into one value', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		await expect(stockRow(page, 'SAP.DE')).toContainText('180.50 EUR');
	});

	test('shows the placeholder alone for a missing Price, never a misleading currency-only value', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [UNKNOWN_STOCK]);
		await page.goto('/');

		const card = stockRow(page, 'UNKNOWN');
		await expect(card).not.toContainText('— USD');
		await expect(card).not.toContainText('— EUR');
	});

	test('shows Market Cap and Dividend Yield with two-decimal formatting', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		const card = stockRow(page, 'SAP.DE');
		await expect(card).toContainText('180.00');
		await expect(card).toContainText('3.20%');
	});

	test('Target Price input is present and stock-specific', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, AAPL_STOCK]);
		await page.goto('/');

		await expect(page.getByLabel('Target price for SAP.DE')).toHaveValue('150');
		await expect(page.getByLabel('Target price for AAPL')).toHaveValue('');
	});

	test('applies favorable presentation to a negative Distance to Target', async ({ page }) => {
		await mockSingleWatchlist(page, [GAW_L_STOCK]);
		await page.goto('/');

		const cell = distanceValue(page, 'GAW.L');
		await expect(cell).toContainText('-5.00%');
		await expect(cell).toHaveClass(/distance-favorable/);
	});

	test('applies unfavorable presentation to a positive Distance to Target', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		const cell = distanceValue(page, 'SAP.DE');
		await expect(cell).toContainText('+20.33%');
		await expect(cell).toHaveClass(/distance-unfavorable/);
	});

	test('shows a real zero Distance to Target neutrally', async ({ page }) => {
		const EQUAL: WatchlistStock = {
			symbol: 'EQUAL',
			name: 'Equal Price Co.',
			price: 100,
			currency: 'USD',
			targetPrice: 100,
			distanceToTarget: 0,
			dividendYield: 0,
			marketCapBillionsUsd: 10
		};
		await mockSingleWatchlist(page, [EQUAL]);
		await page.goto('/');

		const cell = distanceValue(page, 'EQUAL');
		await expect(cell).toHaveText('0.00%');
		await expect(cell).not.toHaveClass(/distance-favorable|distance-unfavorable/);
	});

	test('shows the missing-value placeholder for an unavailable Distance to Target', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [UNKNOWN_STOCK]);
		await page.goto('/');

		const cell = distanceValue(page, 'UNKNOWN');
		await expect(cell).toHaveText('—');
		await expect(cell).not.toHaveClass(/distance-favorable|distance-unfavorable/);
	});

	test('shows the Savings Amount placeholder before allocation and the whole-Euro value after', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => ({
			totalSavings: 1000,
			invested: 1000,
			allocations: [{ symbol: 'SAP.DE', factor: 1, savingsAmount: 1000 }]
		}));

		await page.goto('/');
		const card = stockRow(page, 'SAP.DE');
		await expect(card.locator('.savings-value')).toHaveText('—');

		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		await expect(card.locator('.savings-value')).toHaveText('€1,000');
	});

	test('a long exchange-suffixed symbol and a long company name remain readable without breaking the Card', async ({
		page
	}) => {
		const HEXA: WatchlistStock = {
			symbol: 'HEXA-B.ST',
			name: 'Hexagon Aktiebolag Group International Holding Company',
			price: 120.5,
			currency: 'SEK',
			targetPrice: 100,
			distanceToTarget: 0.205,
			dividendYield: 0.01,
			marketCapBillionsUsd: 45
		};
		await mockSingleWatchlist(page, [HEXA]);
		await page.goto('/');

		const card = stockRow(page, 'HEXA-B.ST');
		await expect(card.locator('.symbol')).toHaveText('HEXA-B.ST');
		await expect(card).toContainText('Hexagon Aktiebolag Group International Holding Company');

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});

	test('a very large Distance to Target percentage remains readable without overflow', async ({
		page
	}) => {
		const EXTREME: WatchlistStock = {
			symbol: 'EXTREME',
			name: 'Extreme Distance Co.',
			price: 18342.5,
			currency: 'USD',
			targetPrice: 100,
			distanceToTarget: 182.425,
			dividendYield: 0,
			marketCapBillionsUsd: 1
		};
		await mockSingleWatchlist(page, [EXTREME]);
		await page.goto('/');

		await expect(distanceValue(page, 'EXTREME')).toContainText('+18,242.50%');

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});
});

test.describe('Stock Cards: sorting', () => {
	test('defaults to Name ascending', async ({ page }) => {
		await mockSingleWatchlist(page);
		await page.goto('/');

		expect(await symbolTexts(page)).toEqual(['AAPL', 'GAW.L', 'SAP.DE', 'UNKNOWN']);
		await expect(sortColumnSelect(page)).toHaveValue('name');
		await expect(sortDirectionButton(page)).toHaveAccessibleName('Sort direction: ascending');
	});

	test('selecting a different column sorts ascending, raw-value based, with missing values last', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await page.goto('/');

		await sortColumnSelect(page).selectOption({ label: 'Price' });

		expect(await symbolTexts(page)).toEqual(['SAP.DE', 'AAPL', 'GAW.L', 'UNKNOWN']);
		await expect(sortDirectionButton(page)).toHaveAccessibleName('Sort direction: ascending');
	});

	test('the direction control reverses the current column, keeping missing values last', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await page.goto('/');

		await sortColumnSelect(page).selectOption({ label: 'Price' });
		await sortDirectionButton(page).click();

		expect(await symbolTexts(page)).toEqual(['GAW.L', 'AAPL', 'SAP.DE', 'UNKNOWN']);
		await expect(sortDirectionButton(page)).toHaveAccessibleName('Sort direction: descending');
	});

	test('sorts Distance to Target numerically, including negative, and keeps missing values last', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await page.goto('/');

		await sortColumnSelect(page).selectOption({ label: 'Distance to Target' });

		expect(await symbolTexts(page)).toEqual(['GAW.L', 'SAP.DE', 'AAPL', 'UNKNOWN']);
	});

	test('causes no application API request when sorting', async ({ page }) => {
		await mockSingleWatchlist(page);

		const apiRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/')) {
				apiRequests.push(request.url());
			}
		});

		await page.goto('/');
		await expect(stockRows(page)).toHaveCount(4);
		apiRequests.length = 0;

		await sortColumnSelect(page).selectOption({ label: 'Price' });
		await sortDirectionButton(page).click();

		expect(apiRequests).toHaveLength(0);
	});
});

test.describe('Stock Cards: mutation and filtering', () => {
	test('removes a stock from a Card using the existing remove flow', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK]);
		const removeCalls = await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		await page.getByRole('button', { name: 'Remove SAP.DE' }).click();

		expect(removeCalls.calls).toEqual(['SAP.DE']);
		await expect(stockRow(page, 'SAP.DE')).toHaveCount(0);
		await expect(stockRow(page, 'GAW.L')).toBeVisible();
	});

	test('removing the final stock shows the existing empty-Watchlist state, not an empty Card grid', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [AAPL_STOCK]);
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [],
			warnings: []
		}));

		await page.goto('/');
		await page.getByRole('button', { name: 'Remove AAPL' }).click();

		await expect(page.getByText('This watchlist is empty.')).toBeVisible();
		await expect(stockRows(page)).toHaveCount(0);
	});

	test('filters Cards by company name and shows the no-match state, not an empty Card grid underneath it', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await page.goto('/');

		await page.getByLabel('Filter by company name').fill('nonexistent-company-xyz');

		await expect(page.getByText('No stocks match the current filter.')).toBeVisible();
		await expect(stockRows(page)).toHaveCount(0);
		await expect(page.getByText('Total: 4 stocks · Filtered: 0 stocks')).toBeVisible();
	});

	test('a successful Target Price save from a Card updates the value and Distance', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await mockSetTargetPrice(page, () => ({
			symbol: 'SAP.DE',
			targetPrice: 200,
			distanceToTarget: 180.5 / 200 - 1,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('200');
		await input.blur();

		await expect(input).toHaveValue('200');
		await expect(distanceValue(page, 'SAP.DE')).toContainText('-9.75%');
	});

	test('a successful add with a warning still adds the Card', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: [
				{
					code: 'FX_PROVIDER_UNAVAILABLE',
					message: 'Currency conversion is currently unavailable.'
				}
			]
		}));

		await page.goto('/');
		await page.getByLabel('Stock symbol').fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(stockRow(page, 'AAPL')).toBeVisible();
		await expect(page.getByText('Currency conversion is currently unavailable.')).toBeVisible();
	});
});

test.describe('Stock Cards: cross-presentation state preservation', () => {
	test('Card→Table: filter, non-default sort, and a calculated allocation survive resizing above the breakpoint', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => ({
			totalSavings: 1000,
			invested: 900,
			allocations: [{ symbol: 'GAW.L', factor: 1, savingsAmount: 900 }]
		}));

		await page.goto('/');
		await page.getByLabel('Filter by company name').fill('Workshop');
		await expect(stockRows(page)).toHaveCount(1);

		await sortColumnSelect(page).selectOption({ label: 'Price' });
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €900')).toBeVisible();

		await page.setViewportSize({ width: STOCK_CARD_PRESENTATION_BREAKPOINT_PX, height: 1000 });

		await expect(page.getByRole('table')).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Sort by Price' })).toHaveAttribute(
			'aria-sort',
			'ascending'
		);
		await expect(page.getByLabel('Filter by company name')).toHaveValue('Workshop');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
		await expect(page.getByText('Allocated savings: €900')).toBeVisible();
	});

	test('Table→Card: a non-default sort selected via the Table header survives resizing below the breakpoint', async ({
		page
	}) => {
		await page.setViewportSize({ width: STOCK_CARD_PRESENTATION_BREAKPOINT_PX, height: 1000 });
		await mockSingleWatchlist(page);
		await page.goto('/');

		await page.getByRole('button', { name: 'Sort by Price' }).click();
		await page.getByRole('button', { name: 'Sort by Price' }).click();
		await expect(page.getByRole('columnheader', { name: 'Sort by Price' })).toHaveAttribute(
			'aria-sort',
			'descending'
		);

		await page.setViewportSize({ width: 900, height: 1000 });

		await expect(page.getByRole('table')).toHaveCount(0);
		await expect(sortColumnSelect(page)).toHaveValue('price');
		await expect(sortDirectionButton(page)).toHaveAccessibleName('Sort direction: descending');
		expect(await symbolTexts(page)).toEqual(['GAW.L', 'AAPL', 'SAP.DE', 'UNKNOWN']);
	});

	test('resizing across the breakpoint causes no application API request', async ({ page }) => {
		await mockSingleWatchlist(page);

		const apiRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/')) {
				apiRequests.push(request.url());
			}
		});

		await page.goto('/');
		await expect(stockRows(page)).toHaveCount(4);
		apiRequests.length = 0;

		await page.setViewportSize({ width: STOCK_CARD_PRESENTATION_BREAKPOINT_PX, height: 1000 });
		await expect(page.getByRole('table')).toBeVisible();
		await page.setViewportSize({ width: 900, height: 1000 });
		await expect(stockRows(page)).toHaveCount(4);

		expect(apiRequests).toHaveLength(0);
	});
});
