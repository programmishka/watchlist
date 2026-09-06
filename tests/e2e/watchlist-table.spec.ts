import { expect, test, type Page } from '@playwright/test';
import {
	AAPL_STOCK,
	EQUAL_PRICE_TARGET_STOCK,
	GAW_L_STOCK,
	MISSING_PRICE_STOCK,
	SAP_DE_STOCK,
	UNKNOWN_STOCK
} from './fixtures/stocks';
import { mockWatchlistView, mockWatchlistsMetadata } from './support/watchlistRoutes';
import type { WatchlistStock } from '../../src/lib/client/watchlistApi';

const WATCHLIST_ID = 'wl-1';
const EXPECTED_COLUMNS = [
	'Symbol',
	'Name',
	'Cap (USD)',
	'Price',
	'Div',
	'Currency',
	'Target Price',
	'Distance to Target',
	'Savings Amount',
	'Delete'
];

async function mockSingleWatchlist(page: Page, stocks: WatchlistStock[]): Promise<void> {
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

test.describe('Watchlist table', () => {
	test('renders exactly the expected columns in order', async ({ page }) => {
		await mockSingleWatchlist(page, [AAPL_STOCK]);
		await page.goto('/');

		const table = page.getByRole('table');
		await expect(table).toBeVisible();
		await expect(table.getByRole('columnheader')).toHaveText(EXPECTED_COLUMNS);
	});

	test('renders representative rows in the order returned by the server', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, AAPL_STOCK, GAW_L_STOCK, UNKNOWN_STOCK]);
		await page.goto('/');

		const rows = page.getByRole('table').locator('tbody tr');
		await expect(rows).toHaveCount(4);
		await expect(rows.nth(0)).toContainText('SAP.DE');
		await expect(rows.nth(1)).toContainText('AAPL');
		await expect(rows.nth(2)).toContainText('GAW.L');
		await expect(rows.nth(3)).toContainText('UNKNOWN');
	});

	test('displays GBp rather than GBP for pence-quoted stocks', async ({ page }) => {
		await mockSingleWatchlist(page, [GAW_L_STOCK]);
		await page.goto('/');

		const row = page.getByRole('table').locator('tbody tr').filter({ hasText: 'GAW.L' });
		const currencyCell = row.getByRole('cell').nth(5);
		await expect(currencyCell).toHaveText('GBp');
		await expect(currencyCell).not.toHaveText('GBP');
	});

	test('shows missing-value placeholders for a stock with no market data', async ({ page }) => {
		await mockSingleWatchlist(page, [UNKNOWN_STOCK]);
		await page.goto('/');

		const row = page.getByRole('table').locator('tbody tr').filter({ hasText: 'UNKNOWN' });
		await expect(row).toBeVisible();
		const cells = row.getByRole('cell');
		await expect(cells.nth(1)).toHaveText('—'); // name
		await expect(cells.nth(2)).toHaveText('—'); // market cap
		await expect(cells.nth(3)).toHaveText('—'); // price
		await expect(cells.nth(5)).toHaveText('—'); // currency
		await expect(page.getByLabel('Target price for UNKNOWN')).toHaveValue('100'); // target price still present
		await expect(cells.nth(7)).toHaveText('—'); // distance to target: unavailable, never a fabricated 0% (TASK-031)
	});

	test('presents dividend yield and target-price distance as percentages', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK]);
		await page.goto('/');

		const rows = page.getByRole('table').locator('tbody tr');

		const sapRow = rows.filter({ hasText: 'SAP.DE' });
		const sapDistanceCell = sapRow.getByRole('cell').nth(7);
		await expect(sapDistanceCell).toContainText('%');
		await expect(sapDistanceCell).not.toContainText('-');

		const gawRow = rows.filter({ hasText: 'GAW.L' });
		const gawDistanceCell = gawRow.getByRole('cell').nth(7);
		await expect(gawDistanceCell).toContainText('%');
		await expect(gawDistanceCell).toContainText('-');
	});

	test('reports no numeric Target Price distance when the market price is unavailable (TASK-031 production regression)', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [MISSING_PRICE_STOCK]);
		await page.goto('/');

		const row = page.getByRole('table').locator('tbody tr').filter({ hasText: 'NOPRICE' });
		const cells = row.getByRole('cell');
		await expect(cells.nth(3)).toHaveText('—'); // price
		await expect(page.getByLabel('Target price for NOPRICE')).toHaveValue('1');
		const distanceCell = cells.nth(7);
		await expect(distanceCell).toHaveText('—');
		await expect(distanceCell).not.toContainText('%');
	});

	test('displays a real zero Target Price distance as 0%, not the missing-value placeholder', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [EQUAL_PRICE_TARGET_STOCK]);
		await page.goto('/');

		const row = page.getByRole('table').locator('tbody tr').filter({ hasText: 'EQUAL' });
		const distanceCell = row.getByRole('cell').nth(7);
		await expect(distanceCell).toHaveText('0%');
		await expect(distanceCell).not.toHaveText('—');
	});
});
