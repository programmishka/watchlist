import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK, UNKNOWN_STOCK } from './fixtures/stocks';
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
const FOUR_STOCKS = [AAPL_STOCK, SAP_DE_STOCK, GAW_L_STOCK, UNKNOWN_STOCK];

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

function filterInput(page: Page) {
	return page.getByLabel('Filter by company name');
}

test.describe('Watchlist filtering', () => {
	test('shows the total count and all rows with no filter', async ({ page }) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(4);
		await expect(page.getByText('Total: 4 stocks')).toBeVisible();
	});

	test('filters immediately on a company-name substring without a submit action', async ({
		page
	}) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		await filterInput(page).fill('shop');

		const rows = page.getByRole('table').locator('tbody tr');
		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0)).toContainText('GAW.L');
		await expect(page.getByText('Total: 4 stocks · Filtered: 1 stock')).toBeVisible();
	});

	test('matches case-insensitively', async ({ page }) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		await filterInput(page).fill('APPLE');

		const rows = page.getByRole('table').locator('tbody tr');
		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0)).toContainText('AAPL');
	});

	test('matches a substring that is not a prefix of the company name', async ({ page }) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		await filterInput(page).fill('work');

		const rows = page.getByRole('table').locator('tbody tr');
		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0)).toContainText('GAW.L');
	});

	test('clearing the filter restores all rows and the total count without pressing Enter', async ({
		page
	}) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		const input = filterInput(page);
		await input.fill('shop');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		await input.fill('');

		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(4);
		await expect(page.getByText('Total: 4 stocks')).toBeVisible();
	});

	test('shows an explicit no-match state and a zero count instead of the empty-watchlist message', async ({
		page
	}) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		await filterInput(page).fill('nonexistent-company-xyz');

		await expect(page.getByText('No stocks match the current filter.')).toBeVisible();
		await expect(page.getByText('This watchlist is empty.')).toHaveCount(0);
		await expect(page.getByRole('table')).toHaveCount(0);
		await expect(page.getByText('Total: 4 stocks · Filtered: 0 stocks')).toBeVisible();
	});

	test('a missing-name stock is visible without a filter but never matches a non-empty filter', async ({
		page
	}) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		await expect(
			page.getByRole('table').locator('tbody tr').filter({ hasText: 'UNKNOWN' })
		).toBeVisible();

		await filterInput(page).fill('UNKNOWN');

		await expect(
			page.getByRole('table').locator('tbody tr').filter({ hasText: 'UNKNOWN' })
		).toHaveCount(0);
		await expect(page.getByText('No stocks match the current filter.')).toBeVisible();
	});

	test('resets the filter when switching to another watchlist', async ({ page }, testInfo) => {
		// Both tabs fit directly at desktop capacity (TASK-035); this test
		// exercises tab-click switching mechanics, not responsive navigation.
		test.skip(
			testInfo.project.name !== 'chromium-desktop',
			'desktop-only: both tabs directly visible'
		);

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
			stocks: FOUR_STOCKS,
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
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
		await filterInput(page).fill('shop');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		await page.getByRole('tab', { name: 'Dividend' }).click();

		await expect(filterInput(page)).toHaveValue('');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
		await expect(page.getByText('Total: 1 stock', { exact: true })).toBeVisible();
	});

	test('starts with an empty filter after creating a new watchlist', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: FOUR_STOCKS,
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', { id: 'wl-2', name: 'New', stocks: [], warnings: [] });
		const createCalls = await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name }
			]
		}));

		await page.goto('/');
		await filterInput(page).fill('shop');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		await page.getByLabel('Watchlist name').fill('New');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		await expect(page.getByText('This watchlist is empty.')).toBeVisible();
		expect(createCalls.calls).toEqual(['New']);
	});

	test('starts with an empty filter on the replacement watchlist after deletion', async ({
		page
	}) => {
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
			stocks: FOUR_STOCKS,
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		await mockDeleteActiveWatchlist(page, {
			activeWatchlistId: 'wl-2',
			watchlists: [{ id: 'wl-2', name: 'Dividend' }]
		});

		await page.goto('/');
		await filterInput(page).fill('shop');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		page.on('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		await expect(filterInput(page)).toHaveValue('');
		await expect(page.getByText('SAP.DE')).toBeVisible();
	});

	test('preserves the filter and shows the updated target price after a same-watchlist edit', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK]);
		await mockSetTargetPrice(page, () => ({
			symbol: 'SAP.DE',
			targetPrice: 200,
			distanceToTarget: 180.5 / 200 - 1,
			warnings: []
		}));

		await page.goto('/');
		await filterInput(page).fill('SAP');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		const targetPriceInput = page.getByLabel('Target price for SAP.DE');
		await targetPriceInput.fill('200');
		await targetPriceInput.blur();

		await expect(filterInput(page)).toHaveValue('SAP');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
		await expect(targetPriceInput).toHaveValue('200');
	});

	test('preserves the filter and shows a newly added matching stock', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		await filterInput(page).fill('games');
		await expect(page.getByText('No stocks match the current filter.')).toBeVisible();

		await page.getByLabel('Stock symbol').fill('GAW.L');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(filterInput(page)).toHaveValue('games');
		const rows = page.getByRole('table').locator('tbody tr');
		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0)).toContainText('GAW.L');
		await expect(page.getByText('Total: 2 stocks · Filtered: 1 stock')).toBeVisible();
	});

	test('shows the filtered-empty state and updated counts after removing the only matching stock', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK]);
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		await filterInput(page).fill('SAP');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		await page.getByRole('button', { name: 'Remove SAP.DE' }).click();

		await expect(filterInput(page)).toHaveValue('SAP');
		await expect(page.getByText('No stocks match the current filter.')).toBeVisible();
		await expect(
			page.getByText('Total: 1 stock · Filtered: 0 stocks', { exact: true })
		).toBeVisible();
	});

	test('mobile layout keeps the filter reachable, readable, and free of page overflow', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockSingleWatchlist(page, FOUR_STOCKS);
		await page.goto('/');

		const input = filterInput(page);
		await input.scrollIntoViewIfNeeded();
		await expect(input).toBeVisible();
		await input.fill('shop');

		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
		await expect(page.getByText('Total: 4 stocks · Filtered: 1 stock')).toBeVisible();

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});

	test('typing in the filter causes no application API requests', async ({ page }) => {
		await mockSingleWatchlist(page, FOUR_STOCKS);

		const apiRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/')) {
				apiRequests.push(request.url());
			}
		});

		await page.goto('/');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(4);
		apiRequests.length = 0;

		await filterInput(page).pressSequentially('games workshop');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		expect(apiRequests).toHaveLength(0);
	});
});
