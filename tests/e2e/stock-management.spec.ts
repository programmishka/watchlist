import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK } from './fixtures/stocks';
import {
	mockAddStock,
	mockRemoveStock,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';
import { stockRows } from './support/stockLocators';

const WATCHLIST_ID = 'wl-1';

async function mockSingleWatchlist(page: Page): Promise<void> {
	await mockWatchlistsMetadata(page, {
		activeWatchlistId: WATCHLIST_ID,
		watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
	});
	await mockWatchlistView(page, WATCHLIST_ID, {
		id: WATCHLIST_ID,
		name: 'Main',
		stocks: [SAP_DE_STOCK, GAW_L_STOCK],
		warnings: []
	});
}

test.describe('Stock management', () => {
	test('adding a stock replaces the view from the mutation response with no follow-up GET', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const viewCalls = await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK],
			warnings: []
		});
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['AAPL']);
		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(input).toHaveValue('');
		// Only the initial load GET; adding a stock issues no follow-up composed-Watchlist GET.
		expect(viewCalls.calls).toEqual([WATCHLIST_ID]);
	});

	test('submits the add-stock form exactly once on Enter', async ({ page }) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL');
		await input.press('Enter');

		await expect(page.getByText('AAPL')).toBeVisible();
		expect(addCalls.calls).toEqual(['AAPL']);
	});

	test('does not send a request for an empty or whitespace-only symbol', async ({ page }) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Add stock' })).toBeDisabled();

		const input = page.getByLabel('Stock symbol');
		await input.fill('   ');
		await expect(page.getByRole('button', { name: 'Add stock' })).toBeDisabled();
		await input.press('Enter');

		expect(addCalls.calls).toHaveLength(0);
	});

	test('displays the stable error and preserves state for an unknown symbol', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 422,
			body: { error: { code: 'UNKNOWN_STOCK_SYMBOL', message: 'The symbol could not be found.' } }
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('BOGUS');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText('The symbol could not be found.');
		await expect(input).toHaveValue('BOGUS');
		await expect(page.getByText('SAP.DE')).toBeVisible();
		await expect(page.getByText('GAW.L')).toBeVisible();
	});

	test('displays the stable error and preserves state for a duplicate symbol', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 409,
			body: { error: { code: 'DUPLICATE_SYMBOL', message: 'The symbol already exists.' } }
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('SAP.DE');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText('The symbol already exists.');
		await expect(input).toHaveValue('SAP.DE');
		await expect(stockRows(page)).toHaveCount(2);
	});

	test('displays the stable error and preserves state when the provider is unavailable', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 503,
			body: {
				error: { code: 'MARKET_DATA_UNAVAILABLE', message: 'Market data is currently unavailable.' }
			}
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText('Market data is currently unavailable.');
		await expect(input).toHaveValue('AAPL');
		await expect(stockRows(page)).toHaveCount(2);
	});

	test('a successful add with a warning still adds the row', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: [
				{
					code: 'FX_PROVIDER_UNAVAILABLE',
					message: 'Currency conversion is currently unavailable.'
				}
			]
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(input).toHaveValue('');
		await expect(page.getByText('Currency conversion is currently unavailable.')).toBeVisible();
	});

	test('removing a stock replaces the view from the mutation response with no follow-up GET', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const viewCalls = await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK],
			warnings: []
		});
		const removeCalls = await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		await page.getByRole('button', { name: 'Remove SAP.DE' }).click();

		expect(removeCalls.calls).toEqual(['SAP.DE']);
		await expect(page.getByText('SAP.DE')).toHaveCount(0);
		await expect(page.getByText('GAW.L')).toBeVisible();
		expect(viewCalls.calls).toEqual([WATCHLIST_ID]);
	});

	test('removes exactly the row for a punctuated symbol using a correctly encoded DELETE URL', async ({
		page
	}) => {
		const HEXA_STOCK = { ...GAW_L_STOCK, symbol: 'HEXA-B.ST', name: 'Hexagon AB' };
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, HEXA_STOCK],
			warnings: []
		});
		const removeCalls = await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK],
			warnings: []
		}));

		await page.goto('/');
		await page.getByRole('button', { name: 'Remove HEXA-B.ST' }).click();

		expect(removeCalls.calls).toEqual(['HEXA-B.ST']);
		await expect(page.getByText('HEXA-B.ST')).toHaveCount(0);
		await expect(page.getByText('SAP.DE')).toBeVisible();
	});

	test('keeps the row and view when removal fails', async ({ page }) => {
		await mockSingleWatchlist(page);
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			status: 404,
			body: { error: { code: 'SYMBOL_NOT_FOUND', message: 'The symbol is not in this watchlist.' } }
		}));

		await page.goto('/');
		await page.getByRole('button', { name: 'Remove SAP.DE' }).click();

		await expect(page.getByRole('alert')).toContainText('The symbol is not in this watchlist.');
		await expect(page.getByText('SAP.DE')).toBeVisible();
		await expect(page.getByText('GAW.L')).toBeVisible();
	});

	test('removing the final stock shows the existing empty-watchlist state', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		await mockRemoveStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [],
			warnings: []
		}));

		await page.goto('/');
		await page.getByRole('button', { name: 'Remove AAPL' }).click();

		await expect(page.getByText('This watchlist is empty.')).toBeVisible();
		await expect(stockRows(page)).toHaveCount(0);
	});

	test('no add-stock form or stock table is shown when there are no watchlists', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, { watchlists: [] });

		await page.goto('/');

		await expect(page.getByText('No watchlist has been created yet.')).toBeVisible();
		await expect(page.getByLabel('Stock symbol')).toHaveCount(0);
		await expect(stockRows(page)).toHaveCount(0);
	});

	test('normalizes lowercase input to uppercase as it is typed and submits the uppercase symbol', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('aapl');

		await expect(input).toHaveValue('AAPL');

		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['AAPL']);
		await expect(page.getByText('AAPL')).toBeVisible();
	});

	test('normalizes a lowercase exchange-suffix symbol to uppercase', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [GAW_L_STOCK],
			warnings: []
		});
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [GAW_L_STOCK, { ...SAP_DE_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('sap.de');
		await expect(input).toHaveValue('SAP.DE');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['SAP.DE']);
	});

	test('normalizes a lowercase hyphenated symbol to uppercase', async ({ page }) => {
		const HEXA_STOCK = { ...GAW_L_STOCK, symbol: 'HEXA-B.ST', name: 'Hexagon AB' };
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK],
			warnings: []
		});
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, { ...HEXA_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('hexa-b.st');
		await expect(input).toHaveValue('HEXA-B.ST');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['HEXA-B.ST']);
	});

	test('accepts a numeric symbol with an exchange suffix', async ({ page }) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol, name: 'Tencent' }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('0700.hk');
		await expect(input).toHaveValue('0700.HK');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['0700.HK']);
		await expect(page.getByText('0700.HK')).toBeVisible();
	});

	test('rejects an invalid character locally without sending a request', async ({ page }) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL!');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText('Use letters, numbers, dots, or hyphens.');
		await expect(input).toHaveValue('AAPL!');
		expect(addCalls.calls).toHaveLength(0);
	});

	test('rejects an invalid repeated separator locally without sending a request', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, () => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('SAP..DE');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText('Use letters, numbers, dots, or hyphens.');
		expect(addCalls.calls).toHaveLength(0);
	});

	test('shows the unknown-symbol message, not local syntax validation, for a syntactically valid unknown symbol', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 422,
			body: { error: { code: 'UNKNOWN_STOCK_SYMBOL', message: 'The symbol could not be found.' } }
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('ZZZZZZ');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['ZZZZZZ']);
		await expect(page.getByRole('alert')).toContainText('The symbol could not be found.');
		await expect(page.getByRole('alert')).not.toContainText(
			'Use letters, numbers, dots, or hyphens.'
		);
	});

	test('distinguishes a provider failure from both syntax-invalid and unknown-symbol errors', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 503,
			body: {
				error: { code: 'MARKET_DATA_UNAVAILABLE', message: 'Market data is currently unavailable.' }
			}
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		const alert = page.getByRole('alert');
		await expect(alert).toContainText('Market data is currently unavailable.');
		await expect(alert).not.toContainText('Use letters, numbers, dots, or hyphens.');
		await expect(alert).not.toContainText('could not be found');
	});

	test('submits the canonical uppercase symbol for a case-only duplicate', async ({ page }) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: []
		});
		const addCalls = await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 409,
			body: { error: { code: 'DUPLICATE_SYMBOL', message: 'The symbol already exists.' } }
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('aapl');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['AAPL']);
		await expect(page.getByRole('alert')).toContainText('The symbol already exists.');
	});

	test('the stock-symbol input has maxlength=20 and normal typing is unaffected (TASK-038)', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		const addCalls = await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, GAW_L_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await expect(input).toHaveAttribute('maxlength', '20');

		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		expect(addCalls.calls).toEqual(['AAPL']);
	});

	test('displays the capacity error and leaves the watchlist unchanged when the server reports WATCHLIST_STOCK_LIMIT_REACHED (TASK-038)', async ({
		page
	}) => {
		await mockSingleWatchlist(page);
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 409,
			body: {
				error: {
					code: 'WATCHLIST_STOCK_LIMIT_REACHED',
					message: 'This watchlist can contain up to 1,000 stocks.'
				}
			}
		}));

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');
		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByRole('alert')).toContainText(
			'This watchlist can contain up to 1,000 stocks.'
		);
		await expect(input).toHaveValue('AAPL');
		await expect(stockRows(page)).toHaveCount(2);
	});

	test('mobile layout keeps the add-stock form usable and the remove action reachable via Cards', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockSingleWatchlist(page);

		await page.goto('/');

		await expect(page.getByLabel('Stock symbol')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add stock' })).toBeVisible();
		// Below the Table/Card breakpoint (TASK-036 §5-7), Cards replace the
		// table rather than requiring horizontal table scrolling (§62, §131).
		await expect(page.getByRole('table')).toHaveCount(0);
		await expect(stockRows(page)).toHaveCount(2);
		await expect(page.getByRole('button', { name: 'Remove SAP.DE' })).toBeAttached();

		const input = page.getByLabel('Stock symbol');
		await input.fill('aapl');
		await expect(input).toHaveValue('AAPL');
		await input.fill('AAPL!');
		await page.getByRole('button', { name: 'Add stock' }).click();
		await expect(page.getByRole('alert')).toContainText('Use letters, numbers, dots, or hyphens.');

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});
});
