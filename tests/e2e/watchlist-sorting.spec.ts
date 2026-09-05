import { expect, test, type Page } from '@playwright/test';
import {
	mockAddStock,
	mockCreateWatchlist,
	mockDeleteActiveWatchlist,
	mockRemoveStock,
	mockSelectActiveWatchlist,
	mockSetTargetPrice,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';
import type { WatchlistStock } from '../../src/lib/client/watchlistApi';

const WATCHLIST_ID = 'wl-1';

/**
 * Deliberately unsorted fixture (TASK-023 §64): the "API order" below is not
 * already ascending/descending on any single column, and it exercises
 * different symbols, names, market caps, prices, dividend yields,
 * currencies, and negative/zero/positive/missing Target Price and Distance
 * values.
 */
const SAP_DE: WatchlistStock = {
	symbol: 'SAP.DE',
	name: 'SAP SE',
	price: 180.5,
	currency: 'EUR',
	targetPrice: 180.5,
	distanceToTarget: 0,
	dividendYield: 0.032,
	marketCapBillionsUsd: 180
};

const MSFT: WatchlistStock = {
	symbol: 'MSFT',
	name: 'Microsoft Corp',
	price: 400,
	currency: 'USD',
	targetPrice: 350,
	distanceToTarget: 400 / 350 - 1,
	dividendYield: 0.008,
	marketCapBillionsUsd: 3000
};

const AAPL: WatchlistStock = {
	symbol: 'AAPL',
	name: 'Apple Inc.',
	price: 200,
	currency: 'USD',
	targetPrice: undefined,
	distanceToTarget: undefined,
	dividendYield: 0.005,
	marketCapBillionsUsd: 3000
};

const GAW_L: WatchlistStock = {
	symbol: 'GAW.L',
	name: 'Games Workshop Group PLC',
	price: 9500,
	currency: 'GBp',
	targetPrice: 10000,
	distanceToTarget: 9500 / 10000 - 1,
	dividendYield: 0.041,
	marketCapBillionsUsd: 5
};

const UNKNOWN: WatchlistStock = {
	symbol: 'UNKNOWN',
	name: undefined,
	price: undefined,
	currency: undefined,
	targetPrice: 100,
	distanceToTarget: 0.05,
	dividendYield: 0,
	marketCapBillionsUsd: undefined
};

const API_ORDER = [SAP_DE, MSFT, AAPL, GAW_L, UNKNOWN];

async function mockSingleWatchlist(
	page: Page,
	stocks: WatchlistStock[],
	watchlistId = WATCHLIST_ID,
	name = 'Main'
): Promise<void> {
	await mockWatchlistsMetadata(page, {
		activeWatchlistId: watchlistId,
		watchlists: [{ id: watchlistId, name }]
	});
	await mockWatchlistView(page, watchlistId, { id: watchlistId, name, stocks, warnings: [] });
}

function sortButton(page: Page, label: string) {
	return page.getByRole('button', { name: `Sort by ${label}` });
}

function columnHeader(page: Page, label: string) {
	return page.getByRole('columnheader', { name: `Sort by ${label}` });
}

function symbolColumnLocator(page: Page) {
	return page.getByRole('table').locator('tbody tr td:first-child');
}

async function symbolColumn(page: Page): Promise<string[]> {
	return symbolColumnLocator(page).allTextContents();
}

test.describe('Watchlist table sorting', () => {
	test('renders rows in API/Watchlist order before any header is activated', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(5);
		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'MSFT', 'AAPL', 'GAW.L', 'UNKNOWN']);
		await expect(columnHeader(page, 'Symbol')).toHaveAttribute('aria-sort', 'none');
	});

	test('first click sorts Price ascending', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Price').click();

		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'AAPL', 'MSFT', 'GAW.L', 'UNKNOWN']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');
	});

	test('second click sorts Price descending', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Price').click();
		await sortButton(page, 'Price').click();

		expect(await symbolColumn(page)).toEqual(['GAW.L', 'MSFT', 'AAPL', 'SAP.DE', 'UNKNOWN']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'descending');
	});

	test('a third click returns to ascending rather than an unsorted state', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		const priceButton = sortButton(page, 'Price');
		await priceButton.click();
		await priceButton.click();
		await priceButton.click();

		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'AAPL', 'MSFT', 'GAW.L', 'UNKNOWN']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');
	});

	test('switching to another column starts ascending and clears the previous column state', async ({
		page
	}) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Price').click();
		await sortButton(page, 'Price').click();
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'descending');

		await sortButton(page, 'Name').click();

		await expect(columnHeader(page, 'Name')).toHaveAttribute('aria-sort', 'ascending');
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'none');
		expect(await symbolColumn(page)).toEqual(['AAPL', 'GAW.L', 'MSFT', 'SAP.DE', 'UNKNOWN']);
	});

	test('sorts Symbol as the complete string without splitting exchange suffixes', async ({
		page
	}) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Symbol').click();

		expect(await symbolColumn(page)).toEqual(['AAPL', 'GAW.L', 'MSFT', 'SAP.DE', 'UNKNOWN']);
	});

	test('keeps missing Target Price values last in both directions', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		const targetPriceButton = sortButton(page, 'Target Price');
		await targetPriceButton.click();
		expect(await symbolColumn(page)).toEqual(['UNKNOWN', 'SAP.DE', 'MSFT', 'GAW.L', 'AAPL']);

		await targetPriceButton.click();
		expect(await symbolColumn(page)).toEqual(['GAW.L', 'MSFT', 'SAP.DE', 'UNKNOWN', 'AAPL']);
	});

	test('sorts Distance to Target numerically including negative, zero, and missing values', async ({
		page
	}) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Distance to Target').click();

		expect(await symbolColumn(page)).toEqual(['GAW.L', 'SAP.DE', 'UNKNOWN', 'MSFT', 'AAPL']);
	});

	test('sorts only the filtered rows and keeps the filtered count', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await page.getByLabel('Filter by company name').fill('o');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);

		await sortButton(page, 'Price').click();

		expect(await symbolColumn(page)).toEqual(['MSFT', 'GAW.L']);
		await expect(page.getByText('2 of 5 stocks')).toBeVisible();
	});

	test('keeps the active sort applied as the filtered subset changes', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Price').click();
		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'AAPL', 'MSFT', 'GAW.L', 'UNKNOWN']);

		await page.getByLabel('Filter by company name').fill('o');

		expect(await symbolColumn(page)).toEqual(['MSFT', 'GAW.L']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');
	});

	test('preserves the active sort when the filter is cleared', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		await sortButton(page, 'Price').click();
		const filterInput = page.getByLabel('Filter by company name');
		await filterInput.fill('o');
		expect(await symbolColumn(page)).toEqual(['MSFT', 'GAW.L']);

		await filterInput.fill('');

		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'AAPL', 'MSFT', 'GAW.L', 'UNKNOWN']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');
	});

	test('resets sorting when switching to another watchlist', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: API_ORDER,
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [GAW_L, SAP_DE],
			warnings: []
		});
		await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		}));

		await page.goto('/');
		await sortButton(page, 'Price').click();
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');

		await page.getByRole('tab', { name: 'Dividend' }).click();

		await expect(symbolColumnLocator(page)).toHaveText(['GAW.L', 'SAP.DE']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'none');
	});

	test('resets sorting after creating a new active watchlist', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: API_ORDER,
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'New',
			stocks: [GAW_L, SAP_DE],
			warnings: []
		});
		await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name }
			]
		}));

		await page.goto('/');
		await sortButton(page, 'Price').click();
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');

		await page.getByLabel('Watchlist name').fill('New');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		await expect(symbolColumnLocator(page)).toHaveText(['GAW.L', 'SAP.DE']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'none');
	});

	test('resets sorting on the replacement watchlist after deletion', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: API_ORDER,
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [GAW_L, SAP_DE],
			warnings: []
		});
		await mockDeleteActiveWatchlist(page, {
			activeWatchlistId: 'wl-2',
			watchlists: [{ id: 'wl-2', name: 'Dividend' }]
		});

		await page.goto('/');
		await sortButton(page, 'Price').click();
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');

		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Delete current watchlist' }).click();

		await expect(symbolColumnLocator(page)).toHaveText(['GAW.L', 'SAP.DE']);
		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'none');
	});

	test('preserves sort and repositions the row after a same-watchlist Target Price update', async ({
		page
	}) => {
		const stocks: WatchlistStock[] = [
			{
				symbol: 'AAPL',
				name: 'Apple Inc.',
				price: 310,
				currency: 'USD',
				targetPrice: 200,
				distanceToTarget: 0.55,
				dividendYield: 0.005,
				marketCapBillionsUsd: 3000
			},
			{
				symbol: 'SAP.DE',
				name: 'SAP SE',
				price: 180,
				currency: 'EUR',
				targetPrice: 250,
				distanceToTarget: -0.28,
				dividendYield: 0.03,
				marketCapBillionsUsd: 180
			}
		];
		await mockSingleWatchlist(page, stocks);
		await mockSetTargetPrice(page, () => ({
			symbol: 'AAPL',
			targetPrice: 300,
			distanceToTarget: 310 / 300 - 1,
			warnings: []
		}));

		await page.goto('/');
		await sortButton(page, 'Target Price').click();
		expect(await symbolColumn(page)).toEqual(['AAPL', 'SAP.DE']);

		const targetPriceInput = page.getByLabel('Target price for AAPL');
		await targetPriceInput.fill('300');
		await targetPriceInput.blur();

		await expect(columnHeader(page, 'Target Price')).toHaveAttribute('aria-sort', 'ascending');
		await expect(symbolColumnLocator(page)).toHaveText(['SAP.DE', 'AAPL']);
	});

	test('preserves sort and inserts a newly added stock at its sorted position', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE, GAW_L]);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE, GAW_L, MSFT],
			warnings: []
		}));

		await page.goto('/');
		await sortButton(page, 'Price').click();
		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'GAW.L']);

		await page.getByLabel('Stock symbol').fill('MSFT');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');
		await expect(symbolColumnLocator(page)).toHaveText(['SAP.DE', 'MSFT', 'GAW.L']);
	});

	test('preserves sort after removing a stock', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE, MSFT, GAW_L]);
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE, GAW_L],
			warnings: []
		}));

		await page.goto('/');
		await sortButton(page, 'Price').click();
		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'MSFT', 'GAW.L']);

		await page.getByRole('button', { name: 'Remove MSFT' }).click();

		await expect(columnHeader(page, 'Price')).toHaveAttribute('aria-sort', 'ascending');
		await expect(symbolColumnLocator(page)).toHaveText(['SAP.DE', 'GAW.L']);
	});

	test('causes no application API request when sorting', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);

		const apiRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/')) {
				apiRequests.push(request.url());
			}
		});

		await page.goto('/');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(5);
		apiRequests.length = 0;

		await sortButton(page, 'Price').click();
		await sortButton(page, 'Price').click();
		await sortButton(page, 'Name').click();

		expect(apiRequests).toHaveLength(0);
	});

	test('Delete header has no sort control and no sort semantics', async ({ page }) => {
		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		const deleteHeader = page.getByRole('columnheader', { name: 'Delete', exact: true });
		await expect(deleteHeader).toBeVisible();
		await expect(deleteHeader.getByRole('button')).toHaveCount(0);
		await expect(deleteHeader).not.toHaveAttribute('aria-sort');
	});

	test('mobile layout allows sorting without page overflow', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockSingleWatchlist(page, API_ORDER);
		await page.goto('/');

		const priceButton = sortButton(page, 'Price');
		await priceButton.scrollIntoViewIfNeeded();
		await priceButton.click();

		expect(await symbolColumn(page)).toEqual(['SAP.DE', 'AAPL', 'MSFT', 'GAW.L', 'UNKNOWN']);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});
});
