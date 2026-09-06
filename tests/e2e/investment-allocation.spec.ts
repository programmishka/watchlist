import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK, UNKNOWN_STOCK } from './fixtures/stocks';
import {
	mockAddStock,
	mockCalculateInvestmentAllocation,
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

const DETERMINISTIC_ALLOCATION = {
	totalSavings: 1000,
	invested: 997,
	allocations: [
		{ symbol: 'SAP.DE', factor: 1.2, savingsAmount: 427 },
		{ symbol: 'AAPL', factor: 0.8, savingsAmount: 320 },
		{ symbol: 'GAW.L', factor: 0.6, savingsAmount: 250 }
	]
};

async function mockSingleWatchlist(
	page: Page,
	stocks: WatchlistStock[] = [AAPL_STOCK, SAP_DE_STOCK, GAW_L_STOCK]
): Promise<void> {
	await mockWatchlistsMetadata(page, {
		activeWatchlistId: WATCHLIST_ID,
		watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
	});
	await mockWatchlistView(page, WATCHLIST_ID, {
		id: WATCHLIST_ID,
		name: 'Main',
		stocks,
		warnings: []
	});
}

function savingsCellFor(page: Page, symbol: string) {
	const row = page.getByRole('table').locator('tbody tr').filter({ hasText: symbol });
	return row.getByRole('cell').nth(8);
}

test.describe('Investment allocation', () => {
	test('shows the placeholder in every Savings Amount cell and no Allocated savings value before calculation', async ({
		page
	}) => {
		await mockSingleWatchlist(page);

		await page.goto('/');

		await expect(page.getByRole('columnheader', { name: 'Savings Amount' })).toBeVisible();
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('—');
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('—');
		await expect(savingsCellFor(page, 'GAW.L')).toHaveText('—');
		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
	});

	test('calculates and displays the allocation by symbol, independent of response order', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		expect(allocationCalls.calls).toEqual([
			{ totalSavings: 1000, rawBody: { totalSavings: 1000 } }
		]);
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('€320');
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('€427');
		await expect(savingsCellFor(page, 'GAW.L')).toHaveText('€250');
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
	});

	test('calculates exactly once on Enter in the Total Savings input', async ({ page }) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		const input = page.getByLabel('Total savings');
		await input.fill('1000');
		await input.press('Enter');

		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
		expect(allocationCalls.calls).toHaveLength(1);
	});

	test('handles an explicit zero calculation, distinct from the pre-calculation placeholder', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [AAPL_STOCK]);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => ({
			totalSavings: 0,
			invested: 0,
			allocations: [{ symbol: 'AAPL', factor: 0.8, savingsAmount: 0 }]
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('0');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		await expect(savingsCellFor(page, 'AAPL')).toHaveText('€0');
		await expect(savingsCellFor(page, 'AAPL')).not.toHaveText('—');
		await expect(page.getByText('Allocated savings: €0')).toBeVisible();
	});

	test('gives factor/savings 0 for a stock with unavailable distance without preventing other stocks from participating (TASK-031)', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, UNKNOWN_STOCK]);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => ({
			totalSavings: 500,
			invested: 500,
			allocations: [
				{ symbol: 'SAP.DE', factor: 1, savingsAmount: 500 },
				{ symbol: 'UNKNOWN', factor: 0, savingsAmount: 0 }
			]
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('500');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		await expect(page.getByText('Allocated savings: €500')).toBeVisible();
		const unknownRow = page.getByRole('table').locator('tbody tr').filter({ hasText: 'UNKNOWN' });
		await expect(unknownRow.getByRole('cell').nth(7)).toHaveText('—'); // distance to target still unavailable
		await expect(savingsCellFor(page, 'UNKNOWN')).toHaveText('€0');
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('€500');
	});

	test('rejects invalid local input, sends no request, and preserves the previous allocation', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		const input = page.getByLabel('Total savings');
		await input.fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await input.fill('-1');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		expect(allocationCalls.calls).toHaveLength(1);
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
	});

	test('shows a server allocation failure and preserves the previous allocation', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		let callCount = 0;
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => {
			callCount += 1;
			if (callCount === 1) {
				return DETERMINISTIC_ALLOCATION;
			}
			return {
				status: 400,
				body: {
					error: { code: 'INVALID_TOTAL_SAVINGS', message: 'Total savings must be a whole number.' }
				}
			};
		});

		await page.goto('/');
		const input = page.getByLabel('Total savings');
		await input.fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await input.fill('2000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		await expect(page.getByRole('alert')).toContainText('Total savings must be a whole number.');
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('€320');
	});

	test('shows a market-data failure and preserves the previous allocation', async ({ page }) => {
		await mockSingleWatchlist(page);
		let callCount = 0;
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => {
			callCount += 1;
			if (callCount === 1) {
				return DETERMINISTIC_ALLOCATION;
			}
			return {
				status: 503,
				body: {
					error: {
						code: 'MARKET_DATA_UNAVAILABLE',
						message: 'Market data is currently unavailable.'
					}
				}
			};
		});

		await page.goto('/');
		const input = page.getByLabel('Total savings');
		await input.fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await input.fill('500');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		await expect(page.getByRole('alert')).toContainText('Market data is currently unavailable.');
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
	});

	test('sends only totalSavings and ignores an active company-name filter, but still reflects the complete allocation', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		await page.getByLabel('Filter by company name').fill('Apple');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();

		expect(allocationCalls.calls).toEqual([
			{ totalSavings: 1000, rawBody: { totalSavings: 1000 } }
		]);
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('€320');
	});

	test('restores hidden allocations, with no new POST, when the filter is cleared', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		const filter = page.getByLabel('Filter by company name');
		await filter.fill('Apple');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

		await filter.fill('');
		await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('€427');
		await expect(savingsCellFor(page, 'GAW.L')).toHaveText('€250');
		expect(allocationCalls.calls).toHaveLength(1);
	});

	test('keeps Savings Amount attached to its symbol after sorting, with no new POST', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await page.getByRole('button', { name: 'Sort by Symbol' }).click();

		await expect(savingsCellFor(page, 'AAPL')).toHaveText('€320');
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('€427');
		await expect(savingsCellFor(page, 'GAW.L')).toHaveText('€250');
		expect(allocationCalls.calls).toHaveLength(1);
	});

	test('a successful Target Price change invalidates the allocation with no automatic recalculation', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);
		await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			distanceToTarget: 0,
			warnings: []
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		const targetPriceInput = page.getByLabel('Target price for SAP.DE');
		await targetPriceInput.fill('160');
		await targetPriceInput.blur();
		await expect(targetPriceInput).toHaveValue('160');

		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('—');
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('—');
		expect(allocationCalls.calls).toHaveLength(1);
	});

	test('a failed Target Price change preserves the allocation', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockSetTargetPrice(page, () => ({
			status: 400,
			body: {
				error: { code: 'INVALID_TARGET_PRICE', message: 'The target price must be greater than 0.' }
			}
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		const targetPriceInput = page.getByLabel('Target price for SAP.DE');
		await targetPriceInput.fill('999');
		await targetPriceInput.blur();

		await expect(page.getByRole('alert')).toContainText('The target price must be greater than 0.');
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('€427');
	});

	test('a Target Price save with an unavailable refreshed distance still invalidates the allocation', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockSetTargetPrice(page, () => ({
			symbol: 'SAP.DE',
			targetPrice: 160,
			warnings: [
				{
					code: 'MARKET_DATA_UNAVAILABLE',
					message: 'Current market data is temporarily unavailable.'
				}
			]
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		const targetPriceInput = page.getByLabel('Target price for SAP.DE');
		await targetPriceInput.fill('160');
		await targetPriceInput.blur();

		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('—');
	});

	test('a successful stock addition invalidates the allocation with no automatic recalculation', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK]);
		const allocationCalls = await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => ({
			totalSavings: 1000,
			invested: 990,
			allocations: [
				{ symbol: 'SAP.DE', factor: 1.2, savingsAmount: 600 },
				{ symbol: 'GAW.L', factor: 0.6, savingsAmount: 390 }
			]
		}));
		await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €990')).toBeVisible();

		await page.getByLabel('Stock symbol').fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();
		await expect(page.getByText('AAPL')).toBeVisible();

		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('—');
		expect(allocationCalls.calls).toHaveLength(1);
	});

	test('a failed stock addition preserves the allocation', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 422,
			body: { error: { code: 'UNKNOWN_STOCK_SYMBOL', message: 'The symbol could not be found.' } }
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await page.getByLabel('Stock symbol').fill('BOGUS');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText('The symbol could not be found.');
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
	});

	test('a successful stock removal invalidates the allocation', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await page.getByRole('button', { name: 'Remove AAPL' }).click();
		await expect(page.getByText('AAPL')).toHaveCount(0);

		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'SAP.DE')).toHaveText('—');
	});

	test('a failed stock removal preserves the allocation', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			status: 404,
			body: { error: { code: 'SYMBOL_NOT_FOUND', message: 'The symbol is not in this watchlist.' } }
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await page.getByRole('button', { name: 'Remove AAPL' }).click();

		await expect(page.getByRole('alert')).toContainText('The symbol is not in this watchlist.');
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
	});

	test('switching Watchlist tabs clears the allocation', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [
				{ id: WATCHLIST_ID, name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [AAPL_STOCK, SAP_DE_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [GAW_L_STOCK],
			warnings: []
		});
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockSelectActiveWatchlist(page, (watchlistId) => ({
			activeWatchlistId: watchlistId,
			watchlists: [
				{ id: WATCHLIST_ID, name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		}));

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await page.getByRole('tab', { name: 'Dividend' }).click();
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'GAW.L')).toHaveText('—');
	});

	test('creating a new Watchlist clears the allocation', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		const createCalls = await mockCreateWatchlist(page, (name) => ({
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: WATCHLIST_ID, name: 'Main' },
				{ id: 'wl-2', name }
			]
		}));
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Tech',
			stocks: [AAPL_STOCK],
			warnings: []
		});

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await page.getByLabel('Watchlist name').fill('Tech');
		await page.getByRole('button', { name: 'Add watchlist' }).click();

		expect(createCalls.calls).toEqual(['Tech']);
		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('—');
	});

	test('deleting the active Watchlist and transitioning to another clears the allocation', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [
				{ id: WATCHLIST_ID, name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [AAPL_STOCK, SAP_DE_STOCK],
			warnings: []
		});
		await mockWatchlistView(page, 'wl-2', {
			id: 'wl-2',
			name: 'Dividend',
			stocks: [GAW_L_STOCK],
			warnings: []
		});
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);
		await mockDeleteActiveWatchlist(page, {
			activeWatchlistId: 'wl-2',
			watchlists: [{ id: 'wl-2', name: 'Dividend' }]
		});

		await page.goto('/');
		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Remove watchlist "Main"' }).click();

		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('Allocated savings:')).toHaveCount(0);
		await expect(savingsCellFor(page, 'GAW.L')).toHaveText('—');
	});

	test('editing Total Savings after a successful calculation does not erase the displayed result', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const allocationCalls = await mockCalculateInvestmentAllocation(
			page,
			WATCHLIST_ID,
			() => DETERMINISTIC_ALLOCATION
		);

		await page.goto('/');
		const input = page.getByLabel('Total savings');
		await input.fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		await input.fill('2000');

		await expect(page.getByText('Allocated savings: €997')).toBeVisible();
		await expect(savingsCellFor(page, 'AAPL')).toHaveText('€320');
		expect(allocationCalls.calls).toHaveLength(1);
	});

	test('mobile layout keeps the allocation controls usable and the Savings Amount column reachable', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockSingleWatchlist(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, () => DETERMINISTIC_ALLOCATION);

		await page.goto('/');
		const input = page.getByLabel('Total savings');
		await input.scrollIntoViewIfNeeded();
		await expect(input).toBeVisible();
		await input.fill('1000');

		const button = page.getByRole('button', { name: 'Calculate investment allocation' });
		await expect(button).toBeVisible();
		await button.click();

		await expect(page.getByText('Allocated savings: €997')).toBeVisible();

		const savingsHeader = page.getByRole('columnheader', { name: 'Savings Amount' });
		await savingsHeader.scrollIntoViewIfNeeded();
		await expect(savingsHeader).toBeVisible();

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});
});
