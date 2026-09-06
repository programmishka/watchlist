import { expect, test, type Page } from '@playwright/test';
import { AAPL_STOCK, GAW_L_STOCK, SAP_DE_STOCK } from './fixtures/stocks';
import {
	mockSetTargetPrice,
	mockWatchlistsMetadata,
	mockWatchlistView
} from './support/watchlistRoutes';
import { distanceValue } from './support/stockLocators';
import type { WatchlistStock } from '../../src/lib/client/watchlistApi';

const WATCHLIST_ID = 'wl-1';

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

test.describe('Target Price editing', () => {
	test('initializes the input from an existing target price', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		await expect(page.getByLabel('Target price for SAP.DE')).toHaveValue('150');
	});

	test('displays an empty input for a stock with no target price, not the missing-value placeholder', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [AAPL_STOCK]);
		await page.goto('/');

		const input = page.getByLabel('Target price for AAPL');
		await expect(input).toHaveValue('');
		await expect(input).not.toHaveValue('—');
	});

	test('commits a dot-decimal value and sends a numeric JSON body', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			distanceToTarget: 180.5 / targetPrice - 1,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('200.5');
		await input.blur();

		await expect(input).toHaveValue('200.5');
		expect(putCalls.calls).toEqual([{ symbol: 'SAP.DE', targetPrice: 200.5 }]);
		await expect(distanceValue(page, 'SAP.DE')).toContainText('%');
	});

	test('commits a comma-decimal value as the equivalent numeric JSON body', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			distanceToTarget: 180.5 / targetPrice - 1,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('200,5');
		await input.blur();

		await expect(input).toHaveValue('200.5');
		expect(putCalls.calls).toEqual([{ symbol: 'SAP.DE', targetPrice: 200.5 }]);
	});

	test('commits a changed value on Enter without a duplicate save on the following blur', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			distanceToTarget: 0,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('175');
		await input.press('Enter');
		await expect(input).toHaveValue('175');
		await page.getByRole('heading', { name: 'Watchlist', level: 1 }).click();

		expect(putCalls.calls).toEqual([{ symbol: 'SAP.DE', targetPrice: 175 }]);
	});

	test('does not send a request when the effective value is unchanged, including a locale-equivalent representation', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');

		await input.focus();
		await input.blur();
		expect(putCalls.calls).toHaveLength(0);

		await input.fill('150,0');
		await input.blur();
		expect(putCalls.calls).toHaveLength(0);
	});

	test('rejects invalid input, sends no request, and keeps the entered text', async ({ page }) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('abc');
		await input.blur();

		expect(putCalls.calls).toHaveLength(0);
		await expect(input).toHaveValue('abc');
		await expect(page.getByRole('alert')).toBeVisible();
	});

	test('clearing an existing target price sends no request and shows validation feedback', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('');
		await input.blur();

		expect(putCalls.calls).toHaveLength(0);
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(input).toHaveValue('');
	});

	test('displays a server validation failure while preserving the entered value and the old persisted state', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await mockSetTargetPrice(page, () => ({
			status: 400,
			body: {
				error: { code: 'INVALID_TARGET_PRICE', message: 'The target price must be greater than 0.' }
			}
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('999');
		await input.blur();

		await expect(page.getByRole('alert')).toContainText('The target price must be greater than 0.');
		await expect(input).toHaveValue('999');
		const distanceCell = distanceValue(page, 'SAP.DE');
		await expect(distanceCell).toContainText('%');
		await expect(distanceCell).not.toHaveText('—');
	});

	test('a successful save updates the target price and distance without affecting other rows', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [AAPL_STOCK, SAP_DE_STOCK]);
		await mockSetTargetPrice(page, () => ({
			symbol: 'AAPL',
			targetPrice: 250,
			distanceToTarget: -0.1,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for AAPL');
		await input.fill('250');
		await input.blur();

		await expect(input).toHaveValue('250');
		await expect(distanceValue(page, 'AAPL')).toContainText('-10.00%');

		// Row isolation: the other row is untouched.
		await expect(page.getByLabel('Target price for SAP.DE')).toHaveValue('150');
		const sapDistanceCell = distanceValue(page, 'SAP.DE');
		await expect(sapDistanceCell).toContainText('%');
		await expect(sapDistanceCell).not.toHaveText('—');
	});

	test('a successful save with an unavailable refreshed distance shows a warning, not a failure', async ({
		page
	}) => {
		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await mockSetTargetPrice(page, () => ({
			symbol: 'SAP.DE',
			targetPrice: 250,
			warnings: [
				{
					code: 'MARKET_DATA_UNAVAILABLE',
					message: 'Current market data is temporarily unavailable.'
				}
			]
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.fill('250');
		await input.blur();

		await expect(input).toHaveValue('250');
		await expect(distanceValue(page, 'SAP.DE')).toHaveText('—');
		await expect(page.getByText('Current market data is temporarily unavailable.')).toBeVisible();
		await expect(page.getByText('Failed to save target price')).toHaveCount(0);
	});

	test('the target price input has maxlength=20 in Table mode (TASK-038)', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop-only: exercises Table mode');

		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		await expect(page.getByRole('table')).toBeVisible();
		await expect(page.getByLabel('Target price for SAP.DE')).toHaveAttribute('maxlength', '20');
	});

	test('the target price input has maxlength=20 in Card mode (TASK-038)', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only: exercises Card mode');

		await mockSingleWatchlist(page, [SAP_DE_STOCK]);
		await page.goto('/');

		await expect(page.getByRole('table')).toHaveCount(0);
		await expect(page.getByLabel('Target price for SAP.DE')).toHaveAttribute('maxlength', '20');
	});

	test('mobile layout keeps the target price input reachable and usable', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile-only assertion');

		await mockSingleWatchlist(page, [SAP_DE_STOCK, GAW_L_STOCK]);
		const putCalls = await mockSetTargetPrice(page, (symbol, targetPrice) => ({
			symbol,
			targetPrice,
			distanceToTarget: 0,
			warnings: []
		}));

		await page.goto('/');
		const input = page.getByLabel('Target price for SAP.DE');
		await input.scrollIntoViewIfNeeded();
		await expect(input).toBeVisible();
		await input.fill('160');
		await input.blur();

		await expect(input).toHaveValue('160');
		expect(putCalls.calls).toEqual([{ symbol: 'SAP.DE', targetPrice: 160 }]);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflows).toBe(false);
	});
});
