import type { Page } from '@playwright/test';
import type {
	WatchlistsMetadataResponse,
	WatchlistView
} from '../../../src/lib/client/watchlistApi';

/** Small reusable Playwright routing helpers for the deterministic `/api/watchlists*` endpoints (TASK-018 §6-7). */

export interface RouteCallRecorder {
	readonly calls: readonly string[];
}

interface JsonResponse {
	status: number;
	body: unknown;
}

function isJsonResponse(value: unknown): value is JsonResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'status' in value &&
		'body' in value &&
		typeof (value as JsonResponse).status === 'number'
	);
}

function toJsonResponse(value: unknown, defaultStatus: number): JsonResponse {
	return isJsonResponse(value) ? value : { status: defaultStatus, body: value };
}

function escapeForRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mocks `GET /api/watchlists`. */
export async function mockWatchlistsMetadata(
	page: Page,
	response: WatchlistsMetadataResponse | JsonResponse
): Promise<void> {
	await page.route('**/api/watchlists', async (route) => {
		if (route.request().method() !== 'GET') {
			await route.fallback();
			return;
		}
		const { status, body } = toJsonResponse(response, 200);
		await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	});
}

/** Mocks `GET /api/watchlists/{watchlistId}` and records how many times it was requested. */
export async function mockWatchlistView(
	page: Page,
	watchlistId: string,
	response: WatchlistView | JsonResponse
): Promise<RouteCallRecorder> {
	const calls: string[] = [];
	await page.route(
		new RegExp(`/api/watchlists/${escapeForRegExp(watchlistId)}$`),
		async (route) => {
			if (route.request().method() !== 'GET') {
				await route.fallback();
				return;
			}
			calls.push(watchlistId);
			const { status, body } = toJsonResponse(response, 200);
			await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
		}
	);
	return { calls };
}

/** Mocks `PUT /api/watchlists/active` and records every requested `watchlistId`. */
export async function mockSelectActiveWatchlist(
	page: Page,
	handler: (watchlistId: string) => WatchlistsMetadataResponse | JsonResponse
): Promise<RouteCallRecorder> {
	const calls: string[] = [];
	await page.route('**/api/watchlists/active', async (route) => {
		if (route.request().method() !== 'PUT') {
			await route.fallback();
			return;
		}
		const { watchlistId } = route.request().postDataJSON() as { watchlistId: string };
		calls.push(watchlistId);
		const { status, body } = toJsonResponse(handler(watchlistId), 200);
		await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	});
	return { calls };
}

/** Mocks `POST /api/watchlists` and records every requested `name`. */
export async function mockCreateWatchlist(
	page: Page,
	handler: (name: string) => WatchlistsMetadataResponse | JsonResponse
): Promise<RouteCallRecorder> {
	const calls: string[] = [];
	await page.route('**/api/watchlists', async (route) => {
		if (route.request().method() !== 'POST') {
			await route.fallback();
			return;
		}
		const { name } = route.request().postDataJSON() as { name: string };
		calls.push(name);
		const { status, body } = toJsonResponse(handler(name), 200);
		await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	});
	return { calls };
}

/** Mocks `DELETE /api/watchlists/active` and records how many times it was requested. */
export async function mockDeleteActiveWatchlist(
	page: Page,
	response: WatchlistsMetadataResponse | JsonResponse
): Promise<RouteCallRecorder> {
	const calls: string[] = [];
	await page.route('**/api/watchlists/active', async (route) => {
		if (route.request().method() !== 'DELETE') {
			await route.fallback();
			return;
		}
		calls.push('DELETE');
		const { status, body } = toJsonResponse(response, 200);
		await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	});
	return { calls };
}
