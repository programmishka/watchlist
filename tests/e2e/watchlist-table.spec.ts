import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK, UNKNOWN_STOCK } from './fixtures/stocks';
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
	'Distance to Target'
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
		await expect(page.getByRole('columnheader', { name: 'Savings Amount' })).toHaveCount(0);
		await expect(page.getByRole('columnheader', { name: 'Delete' })).toHaveCount(0);
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
		await expect(cells.nth(6)).toHaveText('100'); // target price still present
	});

	test('presents dividend yield and target-price distance as percentages', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK, UNKNOWN_STOCK]);
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

		const unknownRow = rows.filter({ hasText: 'UNKNOWN' });
		const unknownDistanceCell = unknownRow.getByRole('cell').nth(7);
		await expect(unknownDistanceCell).toContainText('%');
		await expect(unknownDistanceCell).toContainText('0');
	});
});
