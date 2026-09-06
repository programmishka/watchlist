import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK, UNKNOWN_STOCK } from './fixtures/stocks';
import { mockWatchlistView, mockWatchlistsMetadata } from './support/watchlistRoutes';

const WATCHLIST_ID = 'wl-1';
const STOCKS = [SAP_DE_STOCK, AAPL_STOCK, GAW_L_STOCK, UNKNOWN_STOCK];

async function pageOverflowsHorizontally(page: Page): Promise<boolean> {
	return page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
}

test.describe('Responsive layout', () => {
	test('desktop viewport shows tabs and the full table without page overflow', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop-only assertion');

		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: STOCKS,
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('tablist')).toBeVisible();
		await expect(page.getByRole('table')).toBeVisible();
		for (const header of [
			'Symbol',
			'Name',
			'Market Cap (USD bn)',
			'Price',
			'Currency',
			'Dividend Yield',
			'Target Price',
			'Distance to Target'
		]) {
			await expect(
				page.getByRole('columnheader', { name: `Sort by ${header}`, exact: true })
			).toBeVisible();
		}

		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});

	test('mobile viewport does not cause page-level horizontal overflow', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: STOCKS,
			warnings: []
		});

		await page.goto('/');
		await expect(page.getByRole('table')).toBeVisible();

		expect(await pageOverflowsHorizontally(page)).toBe(false);

		// Distance-to-Target highlighting and the count footer remain visible
		// and reachable on mobile (TASK-033 §85), not just on desktop.
		const sapRow = page.getByRole('table').locator('tbody tr').filter({ hasText: 'SAP.DE' });
		const distanceCell = sapRow.getByRole('cell').nth(7);
		await distanceCell.scrollIntoViewIfNeeded();
		await expect(distanceCell).toBeVisible();
		await expect(distanceCell).toHaveClass(/distance-unfavorable/);
		await expect(page.getByText('Total: 4 stocks')).toBeVisible();
	});

	test('mobile viewport makes the table container horizontally scrollable', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: STOCKS,
			warnings: []
		});

		await page.goto('/');
		await expect(page.getByRole('table')).toBeVisible();

		const { scrollWidth, clientWidth } = await page.evaluate(() => {
			const container = document.querySelector('table')?.parentElement;
			return { scrollWidth: container?.scrollWidth ?? 0, clientWidth: container?.clientWidth ?? 0 };
		});
		expect(scrollWidth).toBeGreaterThan(clientWidth);
	});

	test('tabs remain usable on mobile without causing page overflow', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		const watchlists = [
			{ id: 'wl-1', name: 'Main' },
			{ id: 'wl-2', name: 'Dividend' },
			{ id: 'wl-3', name: 'Growth' },
			{ id: 'wl-4', name: 'Value' },
			{ id: 'wl-5', name: 'Speculative' }
		];
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: STOCKS,
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('tab', { name: 'Speculative' })).toBeVisible();
		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});
});
