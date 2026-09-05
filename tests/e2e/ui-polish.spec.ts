import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK, UNKNOWN_STOCK } from './fixtures/stocks';
import {
	mockAddStock,
	mockCalculateInvestmentAllocation,
	mockWatchlistView,
	mockWatchlistsMetadata
} from './support/watchlistRoutes';

/**
 * TASK-025 §45: cross-feature UI-state regression coverage that does not
 * naturally belong to one existing feature spec. This intentionally does not
 * duplicate the focused feature specs (watchlist-tabs, stock-management,
 * target-price, investment-allocation, watchlist-filtering/sorting,
 * responsive-layout) which remain the primary behavioral suite.
 */

const WATCHLIST_ID = 'wl-1';
const OTHER_WATCHLIST_ID = 'wl-2';
const STOCKS = [SAP_DE_STOCK, AAPL_STOCK, GAW_L_STOCK, UNKNOWN_STOCK];

async function mockPopulatedApplication(page: Page): Promise<void> {
	await mockWatchlistsMetadata(page, {
		activeWatchlistId: WATCHLIST_ID,
		watchlists: [
			{ id: WATCHLIST_ID, name: 'Main' },
			{ id: OTHER_WATCHLIST_ID, name: 'Dividend' }
		]
	});
	await mockWatchlistView(page, WATCHLIST_ID, {
		id: WATCHLIST_ID,
		name: 'Main',
		stocks: STOCKS,
		warnings: []
	});
}

function pageOverflowsHorizontally(page: Page): Promise<boolean> {
	return page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
}

test.describe('UI polish: complete populated page', () => {
	test('renders every V1 region together and reflects a calculated allocation', async ({
		page
	}) => {
		await mockPopulatedApplication(page);
		await mockCalculateInvestmentAllocation(page, WATCHLIST_ID, (totalSavings) => ({
			totalSavings,
			invested: 997,
			allocations: [
				{ symbol: 'SAP.DE', factor: 0.83, savingsAmount: 550 },
				{ symbol: 'AAPL', factor: 1, savingsAmount: 300 },
				{ symbol: 'GAW.L', factor: 1.05, savingsAmount: 147 },
				{ symbol: 'UNKNOWN', factor: 0, savingsAmount: 0 }
			]
		}));

		await page.goto('/');

		// Application shell / navigation / content hierarchy.
		await expect(page.getByRole('heading', { name: 'Watchlist', level: 1 })).toBeVisible();
		await expect(page.getByRole('tablist')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Dividend' })).toHaveAttribute(
			'aria-selected',
			'false'
		);
		await expect(page.getByRole('heading', { name: 'Main', level: 2 })).toBeVisible();

		// Watchlist management controls.
		await expect(page.getByLabel('Watchlist name')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add watchlist' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Delete current watchlist' })).toBeEnabled();

		// Stock management + filter controls.
		await expect(page.getByLabel('Stock symbol')).toBeVisible();
		await expect(page.getByLabel('Filter by company name')).toBeVisible();

		// Investment allocation controls, before calculation.
		await expect(page.getByLabel('Total savings')).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Calculate investment allocation' })
		).toBeVisible();
		await expect(page.getByText('Invested:')).toHaveCount(0);

		await page.getByLabel('Total savings').fill('1000');
		await page.getByRole('button', { name: 'Calculate investment allocation' }).click();
		await expect(page.getByText('Invested: €997')).toBeVisible();

		// Table content: positive distance, negative distance, and a
		// calculated (non-placeholder) savings amount coexist with a
		// pre-calculation placeholder for a stock the allocation omitted.
		const rows = page.getByRole('table').locator('tbody tr');
		await expect(rows).toHaveCount(4);

		const sapRow = rows.filter({ hasText: 'SAP.DE' });
		await expect(sapRow.getByRole('cell').nth(7)).toContainText('%');
		await expect(sapRow.getByRole('cell').nth(7)).not.toContainText('-');
		await expect(sapRow.getByRole('cell').nth(8)).toContainText('550');

		const gawRow = rows.filter({ hasText: 'GAW.L' });
		await expect(gawRow.getByRole('cell').nth(7)).toContainText('-');

		// Stock counts.
		await expect(page.getByText('4 stocks')).toBeVisible();
	});
});

test.describe('UI polish: warnings vs errors', () => {
	test('a data warning and a mutation error are semantically and visually distinct', async ({
		page
	}) => {
		await mockWatchlistsMetadata(page, {
			activeWatchlistId: WATCHLIST_ID,
			watchlists: [{ id: WATCHLIST_ID, name: 'Main' }]
		});
		await mockWatchlistView(page, WATCHLIST_ID, {
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [AAPL_STOCK],
			warnings: [
				{
					code: 'FX_PROVIDER_UNAVAILABLE',
					message: 'Currency conversion is currently unavailable.'
				}
			]
		});
		await mockAddStock(page, WATCHLIST_ID, () => ({
			status: 404,
			body: { error: { code: 'UNKNOWN_STOCK_SYMBOL', message: 'The symbol could not be found.' } }
		}));

		await page.goto('/');

		// Warning: visible, associated with a non-assertive live region, not
		// an `alert`, and remains alongside otherwise-usable content.
		const warning = page.getByText('Currency conversion is currently unavailable.');
		await expect(warning).toBeVisible();
		await expect(warning).toHaveAttribute('role', 'status');
		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(0);

		// Error: triggered by a failing mutation, uses `role="alert"`, and is
		// visually distinguished from the warning above (different class).
		await page.getByLabel('Stock symbol').fill('BOGUS');
		await page.getByRole('button', { name: 'Add stock' }).click();

		const error = page.getByRole('alert');
		await expect(error).toContainText('The symbol could not be found.');
		await expect(warning).toHaveAttribute('role', 'status');

		const warningClass = await warning.getAttribute('class');
		const errorClass = await error.getAttribute('class');
		expect(warningClass).not.toEqual(errorClass);
		expect(warningClass).toContain('status-warning');
		expect(errorClass).toContain('status-error');
	});
});

test.describe('UI polish: error recovery', () => {
	test('a failed stock add error clears after a successful retry', async ({ page }) => {
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

		let shouldFail = true;
		await page.route(new RegExp(`/api/watchlists/${WATCHLIST_ID}/stocks$`), async (route) => {
			if (route.request().method() !== 'POST') {
				await route.fallback();
				return;
			}
			if (shouldFail) {
				await route.fulfill({
					status: 404,
					contentType: 'application/json',
					body: JSON.stringify({
						error: { code: 'UNKNOWN_STOCK_SYMBOL', message: 'The symbol could not be found.' }
					})
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: WATCHLIST_ID,
					name: 'Main',
					stocks: [SAP_DE_STOCK, AAPL_STOCK],
					warnings: []
				})
			});
		});

		await page.goto('/');
		const input = page.getByLabel('Stock symbol');

		await input.fill('BOGUS');
		await page.getByRole('button', { name: 'Add stock' }).click();
		await expect(page.getByRole('alert')).toContainText('The symbol could not be found.');

		shouldFail = false;
		await input.fill('AAPL');
		await page.getByRole('button', { name: 'Add stock' }).click();

		await expect(page.getByText('AAPL')).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(page.getByText('The symbol could not be found.')).toHaveCount(0);
	});
});

test.describe('UI polish: keyboard smoke flow', () => {
	test('a stock can be added and the filter reached using only the keyboard', async ({ page }) => {
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
		await mockAddStock(page, WATCHLIST_ID, (symbol) => ({
			id: WATCHLIST_ID,
			name: 'Main',
			stocks: [SAP_DE_STOCK, { ...AAPL_STOCK, symbol }],
			warnings: []
		}));

		await page.goto('/');

		const symbolInput = page.getByLabel('Stock symbol');
		await symbolInput.focus();
		await expect(symbolInput).toBeFocused();

		await page.keyboard.type('AAPL');
		await page.keyboard.press('Enter');

		await expect(page.getByText('AAPL')).toBeVisible();

		// Once the mutation settles, Tab continues to move keyboard focus
		// forward through the other table-scoped controls, reaching the
		// filter input without requiring a pointer.
		const totalSavingsInput = page.getByLabel('Total savings');
		await totalSavingsInput.focus();
		await expect(totalSavingsInput).toBeFocused();
		await page.keyboard.press('Tab'); // Calculate button
		await page.keyboard.press('Tab'); // Filter by company name input
		await expect(page.getByLabel('Filter by company name')).toBeFocused();
	});
});

test.describe('UI polish: viewport regression', () => {
	test('375px complete page has no page-level overflow while the table scrolls', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockPopulatedApplication(page);
		await page.goto('/');

		await expect(page.getByRole('tablist')).toBeVisible();
		await expect(page.getByLabel('Stock symbol')).toBeVisible();
		await expect(page.getByLabel('Total savings')).toBeVisible();
		await expect(page.getByRole('table')).toBeVisible();

		expect(await pageOverflowsHorizontally(page)).toBe(false);

		const { scrollWidth, clientWidth } = await page.evaluate(() => {
			const container = document.querySelector('table')?.parentElement;
			return { scrollWidth: container?.scrollWidth ?? 0, clientWidth: container?.clientWidth ?? 0 };
		});
		expect(scrollWidth).toBeGreaterThan(clientWidth);
	});

	test('768px complete page shows all controls without page-level overflow', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'run once, not per-project');
		await page.setViewportSize({ width: 768, height: 1000 });

		await mockPopulatedApplication(page);
		await page.goto('/');

		await expect(page.getByRole('tablist')).toBeVisible();
		await expect(page.getByLabel('Watchlist name')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Delete current watchlist' })).toBeVisible();
		await expect(page.getByLabel('Stock symbol')).toBeVisible();
		await expect(page.getByLabel('Filter by company name')).toBeVisible();
		await expect(page.getByLabel('Total savings')).toBeVisible();
		await expect(page.getByRole('table')).toBeVisible();

		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});

	test('1280px complete page renders coherently', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop-only assertion');

		await mockPopulatedApplication(page);
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Watchlist', level: 1 })).toBeVisible();
		await expect(page.getByRole('tablist')).toBeVisible();
		await expect(page.getByRole('table')).toBeVisible();
		await expect(page.getByText('4 stocks')).toBeVisible();

		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});
});
