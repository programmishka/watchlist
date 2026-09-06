import { expect, test } from '@playwright/test';
import { AAPL_STOCK, SAP_DE_STOCK } from './fixtures/stocks';
import {
	mockCreateWatchlist,
	mockSelectActiveWatchlist,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';
import type { WatchlistMetadata } from '../../src/lib/client/watchlistApi';

/** `count` watchlists named "List 1".."List N", ids "wl-1".."wl-N" (TASK-035). */
function manyWatchlists(count: number): WatchlistMetadata[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `wl-${index + 1}`,
		name: `List ${index + 1}`
	}));
}

test.describe('Watchlist tabs', () => {
	test('loads the persisted active watchlist on initial load', async ({ page }, testInfo) => {
		// Both watchlists fit directly within desktop capacity (TASK-035); at
		// mobile capacity (1) the inactive watchlist moves to overflow, which
		// is covered by the "Responsive watchlist navigation" tests below.
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

	test('supports duplicate watchlist names distinguished by id', async ({ page }, testInfo) => {
		test.skip(
			testInfo.project.name !== 'chromium-desktop',
			'desktop-only: both tabs directly visible'
		);

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
	}, testInfo) => {
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
	}, testInfo) => {
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
	}, testInfo) => {
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

/**
 * TASK-035: the active Watchlist is always directly visible in navigation;
 * inactive Watchlists beyond the current responsive capacity move into an
 * overflow disclosure. These tests use enough watchlists (13, mirroring the
 * task's own worked example) to force overflow under both the mobile (1) and
 * wide-desktop (8) direct-tab capacities, so most of them run unmodified
 * against both Playwright projects.
 */
test.describe('Responsive watchlist navigation', () => {
	test('many watchlists bound the direct tabs and expose an overflow control', async ({ page }) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('tab', { name: 'List 1' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		const directTabs = await page.getByRole('tab').count();
		expect(directTabs).toBeLessThan(13);
		await expect(page.getByRole('button', { name: /^More|^Watchlists/ })).toBeVisible();
	});

	test('the active watchlist is directly visible on load even far beyond the visible window', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-13', watchlists });
		await mockWatchlistView(page, 'wl-13', {
			id: 'wl-13',
			name: 'List 13',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		// Reproduces the Product Owner's screenshot problem (TASK-035 §67-69):
		// the active watchlist is immediately visible and selected without any
		// manual navigation, and never exists only inside the overflow menu.
		await expect(page.getByRole('tab', { name: 'List 13' })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		const overflowToggle = page.getByRole('button', { name: /^More|^Watchlists/ });
		await expect(overflowToggle).toBeVisible();
		await overflowToggle.click();
		await expect(page.getByRole('button', { name: 'List 13', exact: true })).toHaveCount(0);
	});

	test('selecting a watchlist from the overflow menu activates it through the existing selection flow', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-13', {
			id: 'wl-13',
			name: 'List 13',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		const activeCalls = await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists
		}));

		await page.goto('/');

		await page.getByRole('button', { name: /^More|^Watchlists/ }).click();
		await page.getByRole('button', { name: 'List 13', exact: true }).click();

		expect(activeCalls.calls).toEqual(['wl-13']);
		await expect(page.getByRole('tab', { name: 'List 13' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('SAP.DE')).toBeVisible();

		// The overflow menu closes after a selection is initiated (TASK-035 §39)
		// and the newly active watchlist no longer appears inside it.
		await expect(page.getByRole('button', { name: 'List 13', exact: true })).toHaveCount(0);
		const overflowToggle = page.getByRole('button', { name: /^More|^Watchlists/ });
		if (await overflowToggle.count()) {
			await overflowToggle.click();
			await expect(page.getByRole('button', { name: 'List 13', exact: true })).toHaveCount(0);
		}
	});

	test('a failed overflow selection preserves the previous active watchlist', async ({ page }) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const wl13ViewCalls = await mockWatchlistView(page, 'wl-13', {
			id: 'wl-13',
			name: 'List 13',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		await mockSelectActiveWatchlist(page, () => ({
			status: 500,
			body: { error: { code: 'INTERNAL_ERROR', message: 'Unable to switch watchlist right now.' } }
		}));

		await page.goto('/');

		await page.getByRole('button', { name: /^More|^Watchlists/ }).click();
		await page.getByRole('button', { name: 'List 13', exact: true }).click();

		// Same error semantics as a direct-tab failure (TASK-035 §9, §50):
		// the previous active watchlist stays directly visible/selected, the
		// overflow target never becomes active, and the composed watchlist for
		// the failed target is never fetched.
		await expect(page.getByRole('tab', { name: 'List 1' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('tab', { name: 'List 13' })).toHaveCount(0);
		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(page.getByRole('alert')).toContainText('Unable to switch watchlist right now.');
		expect(wl13ViewCalls.calls).toHaveLength(0);
	});

	test('duplicate watchlist names inside the overflow menu remain independently selectable by id', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13).map((watchlist, index) =>
			index === 9 || index === 10 ? { ...watchlist, name: 'Duplicate' } : watchlist
		);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-11', {
			id: 'wl-11',
			name: 'Duplicate',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		const activeCalls = await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists
		}));

		await page.goto('/');

		await page.getByRole('button', { name: /^More|^Watchlists/ }).click();
		const overflowDuplicates = page.getByRole('button', { name: 'Duplicate' });
		await expect(overflowDuplicates).toHaveCount(2);
		await overflowDuplicates.nth(1).click();

		expect(activeCalls.calls).toEqual(['wl-11']);
		await expect(page.getByText('SAP.DE')).toBeVisible();
	});

	test('the active-watchlist delete control remains directly reachable while overflow is active', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		await expect(page.getByRole('button', { name: 'Remove watchlist "List 1"' })).toBeEnabled();
	});

	test('a newly created watchlist becomes directly visible even beyond capacity', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-14',
			watchlists: [...watchlists, { id: 'wl-14', name }]
		}));
		await mockWatchlistView(page, 'wl-14', {
			id: 'wl-14',
			name: 'Fresh',
			stocks: [],
			warnings: []
		});

		await page.goto('/');
		await page.getByLabel('Watchlist name').fill('Fresh');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		await expect(page.getByRole('tab', { name: 'Fresh' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('This watchlist is empty.')).toBeVisible();
	});

	test('the overflow disclosure is keyboard reachable, operable, and dismissible with Escape', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		const overflowToggle = page.getByRole('button', { name: /^More|^Watchlists/ });
		await overflowToggle.focus();
		await expect(overflowToggle).toBeFocused();
		// Native `<summary>` disclosure activation uses Space, not Enter.
		await page.keyboard.press(' ');

		// List 13 overflows under both the mobile (1) and wide-desktop (8)
		// direct-tab capacities.
		const lateOverflowItem = page.getByRole('button', { name: 'List 13', exact: true });
		await expect(lateOverflowItem).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.locator('details.overflow')).toHaveJSProperty('open', false);
		await expect(lateOverflowItem).toHaveCount(0);
	});

	test('overflow items are not tabs and the overflow disclosure is not part of the tablist', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');

		const tablist = page.getByRole('tablist');
		const overflowToggle = page.getByRole('button', { name: /^More|^Watchlists/ });

		// The overflow disclosure is a plain button outside the tablist, not a
		// tab itself (TASK-035 §42-43).
		await expect(overflowToggle).toBeVisible();
		await expect(tablist.getByRole('button', { name: /^More|^Watchlists/ })).toHaveCount(0);

		await overflowToggle.click();
		// Its menu items are buttons, never role="tab" (TASK-035 §42). List 13
		// overflows under both the mobile (1) and wide-desktop (8) capacities.
		await expect(page.getByRole('tab', { name: 'List 13' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'List 13', exact: true })).toBeVisible();
	});

	test('the overflow control respects the existing busy state during an in-flight mutation', async ({
		page
	}) => {
		const watchlists = manyWatchlists(13);
		await mockWatchlistsMetadata(page, { activeWatchlistId: 'wl-1', watchlists });
		await mockWatchlistView(page, 'wl-1', {
			id: 'wl-1',
			name: 'List 1',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'List 2',
			stocks: [],
			warnings: []
		});

		let resolveDelete: (() => void) | undefined;
		await page.route('**/api/watchlists/active', async (route) => {
			if (route.request().method() !== 'DELETE') {
				await route.fallback();
				return;
			}
			await new Promise<void>((resolve) => {
				resolveDelete = resolve;
			});
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ activeWatchlistId: 'wl-2', watchlists: watchlists.slice(1) })
			});
		});

		await page.goto('/');

		const overflowToggle = page.getByRole('button', { name: /^More|^Watchlists/ });
		await expect(overflowToggle).toHaveAttribute('aria-disabled', 'false');

		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "List 1"' }).click();

		await expect(overflowToggle).toHaveAttribute('aria-disabled', 'true');
		// A disabled `aria-disabled="true"` control is not normally clickable;
		// `force: true` bypasses that actionability check to prove the app's
		// own guard (not just Playwright's heuristic) blocks opening it.
		await overflowToggle.click({ force: true });
		await expect(page.getByRole('button', { name: 'List 13', exact: true })).toHaveCount(0);

		resolveDelete?.();
	});
});
