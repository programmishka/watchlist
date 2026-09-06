import { expect, test } from '@playwright/test';
import { AAPL_STOCK, SAP_DE_STOCK } from './fixtures/stocks';
import {
	mockCreateWatchlist,
	mockDeleteActiveWatchlist,
	mockSelectActiveWatchlist,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';

test.describe('Watchlist management', () => {
	test('creates the first watchlist and loads its empty state', async ({ page }) => {
		await mockWatchlistsMetadata(page, { watchlists: [] });
		const createCalls = await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name }]
		}));
		await mockWatchlistView(page, 'wl-1', { id: 'wl-1', name: 'Main', stocks: [], warnings: [] });

		await page.goto('/');
		await expect(page.getByText('No watchlist has been created yet.')).toBeVisible();

		const input = page.getByLabel('Watchlist name');
		await input.fill('Main');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		expect(createCalls.calls).toEqual(['Main']);
		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('This watchlist is empty.')).toBeVisible();
		await expect(input).toHaveValue('');
	});

	test('creates an additional watchlist and activates it without a separate active-watchlist PUT', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const createCalls = await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name }
			]
		}));
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
		await page.getByLabel('Watchlist name').fill('Dividend');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		expect(createCalls.calls).toEqual(['Dividend']);
		await expect(page.getByRole('tab', { name: 'Main' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('SAP.DE')).toBeVisible();
		expect(activeCalls.calls).toHaveLength(0);
	});

	test('allows duplicate watchlist names distinguished by the server-selected active id', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Dividend' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Dividend',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Dividend' },
				{ id: 'wl-2', name }
			]
		}));
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});

		await page.goto('/');
		await page.getByLabel('Watchlist name').fill('Dividend');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		const tabs = page.getByRole('tab', { name: 'Dividend' });
		await expect(tabs).toHaveCount(2);
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	});

	test('submits the create form exactly once on Enter', async ({ page }) => {
		await mockWatchlistsMetadata(page, { watchlists: [] });
		const createCalls = await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name }]
		}));
		await mockWatchlistView(page, 'wl-1', { id: 'wl-1', name: 'Main', stocks: [], warnings: [] });

		await page.goto('/');
		const input = page.getByLabel('Watchlist name');
		await input.fill('Main');
		await input.press('Enter');

		await expect(page.getByRole('tab', { name: 'Main' })).toBeVisible();
		expect(createCalls.calls).toEqual(['Main']);
	});

	test('does not send a request for an empty or whitespace-only name', async ({ page }) => {
		await mockWatchlistsMetadata(page, { watchlists: [] });
		const createCalls = await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name }]
		}));

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Add watchlist' })).toBeDisabled();

		const input = page.getByLabel('Watchlist name');
		await input.fill('   ');
		await expect(page.getByRole('button', { name: 'Add watchlist' })).toBeDisabled();
		await input.press('Enter');

		expect(createCalls.calls).toHaveLength(0);
	});

	test('keeps the existing watchlist and preserves the input on create failure', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockCreateWatchlist(page, () => ({
			status: 500,
			body: { error: { code: 'INTERNAL_ERROR', message: 'Unable to create watchlist right now.' } }
		}));

		await page.goto('/');
		const input = page.getByLabel('Watchlist name');
		await input.fill('Dividend');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveCount(0);
		await expect(input).toHaveValue('Dividend');
		await expect(page.getByRole('alert')).toContainText('Unable to create watchlist right now.');
	});

	test('keeps the new tab active and shows a content error when the load fails after a successful create', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name }
			]
		}));
		await mockWatchlistView(page, 'wl-2', {
			status: 502,
			body: {
				error: {
					code: 'MARKET_DATA_UNAVAILABLE',
					message: 'Unable to load this watchlist right now.'
				}
			}
		});

		await page.goto('/');
		const input = page.getByLabel('Watchlist name');
		await input.fill('Dividend');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(input).toHaveValue('');
		await expect(page.getByText('Unable to load this watchlist right now.')).toBeVisible();
	});

	test('cancelling the delete confirmation sends no request and leaves state unchanged', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const deleteCalls = await mockDeleteActiveWatchlist(page, { watchlists: [] });

		await page.goto('/');
		page.once('dialog', (dialog) => {
			expect(dialog.message()).toContain('Main');
			void dialog.dismiss();
		});
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		expect(deleteCalls.calls).toHaveLength(0);
		await expect(page.getByRole('tab', { name: 'Main' })).toBeVisible();
		await expect(page.getByText('AAPL')).toBeVisible();
	});

	test('confirmed deletion loads the server-selected replacement watchlist', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' },
				{ id: 'wl-3', name: 'Tech' }
			]
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		const deleteCalls = await mockDeleteActiveWatchlist(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-3', name: 'Tech' }
			]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Dividend"' }).click();

		expect(deleteCalls.calls).toHaveLength(1);
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveCount(0);
		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('AAPL')).toBeVisible();
	});

	test('deleting the first watchlist follows the server-selected new first watchlist', async ({
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
		const deleteCalls = await mockDeleteActiveWatchlist(page, {
			activeWatchlistId: 'wl-2',
			watchlists: [{ id: 'wl-2', name: 'Dividend' }]
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});

		await page.goto('/');
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		expect(deleteCalls.calls).toHaveLength(1);
		await expect(page.getByRole('tab', { name: 'Main' })).toHaveCount(0);
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('SAP.DE')).toBeVisible();
	});

	test('deleting the final watchlist shows the no-watchlists state and removes the delete control', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		const wl1ViewCalls = await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const deleteCalls = await mockDeleteActiveWatchlist(page, { watchlists: [] });

		await page.goto('/');
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		expect(deleteCalls.calls).toHaveLength(1);
		await expect(page.getByText('No watchlist has been created yet.')).toBeVisible();
		await expect(page.getByRole('tablist')).toHaveCount(0);
		// No watchlists remain, so there is no active tab to attach a delete control to (TASK-034 §15).
		await expect(page.getByRole('button', { name: /Remove watchlist/ })).toHaveCount(0);
		// The composed watchlist GET recorded from initial load only; no follow-up GET after deletion.
		expect(wl1ViewCalls.calls).toEqual(['wl-1']);
	});

	test('keeps the current tab and content when delete fails', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockDeleteActiveWatchlist(page, {
			status: 500,
			body: { error: { code: 'INTERNAL_ERROR', message: 'Unable to delete watchlist right now.' } }
		});

		await page.goto('/');
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(page.getByRole('alert')).toContainText('Unable to delete watchlist right now.');
	});

	test('keeps the replacement tab active and shows a content error when the replacement load fails', async ({
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
		await mockDeleteActiveWatchlist(page, {
			activeWatchlistId: 'wl-2',
			watchlists: [{ id: 'wl-2', name: 'Dividend' }]
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

		await page.goto('/');
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		await expect(page.getByRole('tab', { name: 'Main' })).toHaveCount(0);
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('Unable to load this watchlist right now.')).toBeVisible();
	});

	test('only the active tab exposes a delete control, named after that watchlist (TASK-034)', async ({
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

		await page.goto('/');

		await expect(page.getByRole('button', { name: 'Remove watchlist "Main"' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Remove watchlist "Dividend"' })).toHaveCount(0);
	});

	test('mobile layout keeps create/delete controls and tabs usable without page overflow', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockWatchlistsMetadata(page, {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByLabel('Watchlist name')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add watchlist' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Remove watchlist "Main"' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Main' })).toBeVisible();

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});
});
