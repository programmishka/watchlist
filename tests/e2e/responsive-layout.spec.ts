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

	test('mobile navigation shows only the active watchlist directly, others via disclosure', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		// Mobile direct-tab capacity is 1 (TASK-035 §11, §27-29): the tab strip
		// is no longer a horizontally scrollable row of many tabs; inactive
		// watchlists move into the "Watchlists ▾" overflow disclosure instead.
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

		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab')).toHaveCount(1);
		await expect(page.getByRole('tab', { name: 'Speculative' })).toHaveCount(0);

		const overflowToggle = page.getByRole('button', { name: 'Watchlists' });
		await expect(overflowToggle).toBeVisible();
		await overflowToggle.click();
		await expect(page.getByRole('button', { name: 'Speculative', exact: true })).toBeVisible();

		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});

	test('many watchlists produce a bounded, non-scrolling navigation strip at 768px', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'run once, not per-project');
		await page.setViewportSize({ width: 768, height: 1000 });

		const watchlists = Array.from({ length: 10 }, (_, index) => ({
			id: `wl-${index + 1}`,
			name: `List ${index + 1}`
		}));
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: STOCKS,
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('tab', { name: 'List 1' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('button', { name: /^More|^Watchlists/ })).toBeVisible();
		expect(await pageOverflowsHorizontally(page)).toBe(false);

		const navigationScroll = await page.evaluate(() => {
			const nav = document.querySelector('[role="tablist"]')?.parentElement;
			return { scrollWidth: nav?.scrollWidth ?? 0, clientWidth: nav?.clientWidth ?? 0 };
		});
		expect(navigationScroll.scrollWidth).toBeLessThanOrEqual(navigationScroll.clientWidth + 1);
	});

	test('many watchlists produce a bounded, non-scrolling navigation strip at 1600px', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'run once, not per-project');
		await page.setViewportSize({ width: 1600, height: 900 });

		const watchlists = Array.from({ length: 13 }, (_, index) => ({
			id: `wl-${index + 1}`,
			name: `List ${index + 1}`
		}));
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: STOCKS,
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('tab', { name: 'List 1' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByLabel('Watchlist name')).toBeVisible();
		await expect(page.getByRole('button', { name: /^More|^Watchlists/ })).toBeVisible();
		expect(await pageOverflowsHorizontally(page)).toBe(false);

		const navigationScroll = await page.evaluate(() => {
			const nav = document.querySelector('[role="tablist"]')?.parentElement;
			return { scrollWidth: nav?.scrollWidth ?? 0, clientWidth: nav?.clientWidth ?? 0 };
		});
		expect(navigationScroll.scrollWidth).toBeLessThanOrEqual(navigationScroll.clientWidth + 1);
	});

	test('resizing the viewport recomputes navigation capacity without any additional server request', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'run once, not per-project');

		const watchlists = Array.from({ length: 13 }, (_, index) => ({
			id: `wl-${index + 1}`,
			name: `List ${index + 1}`
		}));
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		const wl1ViewCalls = await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: STOCKS,
			warnings: []
		});

		const apiRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/')) {
				apiRequests.push(request.url());
			}
		});

		await page.goto('/');
		await expect(page.getByRole('tab', { name: 'List 1' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		const requestCountBeforeResize = apiRequests.length;

		// wide desktop -> mobile -> medium -> wide desktop again.
		await page.setViewportSize({ width: 375, height: 812 });
		await expect(page.getByRole('tab')).toHaveCount(1);
		await page.setViewportSize({ width: 900, height: 900 });
		await expect(page.getByRole('tab')).toHaveCount(5);
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(page.getByRole('tab')).toHaveCount(8);

		expect(apiRequests.length).toBe(requestCountBeforeResize);
		expect(wl1ViewCalls.calls).toEqual(['wl-1']);
	});
});
