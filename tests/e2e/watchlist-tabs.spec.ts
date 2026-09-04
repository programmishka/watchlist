import { expect, test } from '@playwright/test';
import { AAPL_STOCK, SAP_DE_STOCK } from './fixtures/stocks';
import {
	mockSelectActiveWatchlist,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';

test.describe('Watchlist tabs', () => {
	test('loads the persisted active watchlist on initial load', async ({ page }) => {
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
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Watchlist', level: 1 })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'false'
		);
		await expect(page.getByRole('table')).toBeVisible();
		await expect(page.getByText('AAPL')).toBeVisible();
	});

	test('supports duplicate watchlist names distinguished by id', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Dividend' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Dividend',
			stocks: [AAPL_STOCK],
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
				{ id: 'wl-1', name: 'Dividend' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		}));

		await page.goto('/');

		const tabs = page.getByRole('tab', { name: 'Dividend' });
		await expect(tabs).toHaveCount(2);
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');

		await tabs.nth(1).click();

		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('SAP.DE')).toBeVisible();
	});

	test('shows an explicit empty state when no watchlists exist', async ({ page }) => {
		await mockWatchlistsMetadata(page, { watchlists: [] });

		await page.goto('/');

		await expect(page.getByText('No watchlist has been created yet.')).toBeVisible();
		await expect(page.getByRole('tablist')).toHaveCount(0);
		await expect(page.getByRole('table')).toHaveCount(0);
	});

	test('shows an explicit empty state for a watchlist with no stocks', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', { id: 'wl-1', name: 'Main', stocks: [], warnings: [] });

		await page.goto('/');

		await expect(page.getByText('This watchlist is empty.')).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);
	});

	test('switching tabs persists the selection before loading the new watchlist', async ({
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
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		const activeCalls = await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		}));

		await page.goto('/');
		await page.getByRole('tab', { name: 'Dividend' }).click();

		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('SAP.DE')).toBeVisible();
		expect(activeCalls.calls).toEqual(['wl-2']);
	});

	test('does not re-issue the active mutation when selecting the already active tab', async ({
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
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const activeCalls = await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists: []
		}));

		await page.goto('/');
		await page.getByRole('tab', { name: 'Main' }).click();

		await expect(page.getByText('AAPL')).toBeVisible();
		expect(activeCalls.calls).toHaveLength(0);
	});

	test('keeps the previous tab active and shows an error when the active mutation fails', async ({
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
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const wl2ViewCalls = await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		await mockSelectActiveWatchlist(page, () => ({
			status: 500,
			body: { error: { code: 'INTERNAL_ERROR', message: 'Unable to switch watchlist right now.' } }
		}));

		await page.goto('/');
		await page.getByRole('tab', { name: 'Dividend' }).click();

		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'false'
		);
		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(page.getByRole('alert')).toContainText('Unable to switch watchlist right now.');
		expect(wl2ViewCalls.calls).toHaveLength(0);
	});

	test('keeps the new tab active and shows a load error when the watchlist load fails after a successful switch', async ({
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
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			status: 502,
			body: {
				error: {
					code: 'MARKET_DATA_UNAVAILABLE',
					message: 'Unable to load this watchlist right now.'
				}
			}
		});
		await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		}));

		await page.goto('/');
		await page.getByRole('tab', { name: 'Dividend' }).click();

		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'false');
		await expect(page.getByText('Unable to load this watchlist right now.')).toBeVisible();
	});
});
