import { describe, expect, it } from 'vitest';
import type { ApiErrorResponse } from '$lib/server/api/ApiError';
import { DELETE as activeDelete, PUT as activePut } from './watchlists/active/+server';
import { GET as watchlistGet } from './watchlists/[watchlistId]/+server';
import { DELETE as stockDelete } from './watchlists/[watchlistId]/stocks/[symbol]/+server';
import { POST as stocksPost } from './watchlists/[watchlistId]/stocks/+server';
import { GET as watchlistsGet, POST as watchlistsPost } from './watchlists/+server';
import { POST as investmentAllocationPost } from './watchlists/[watchlistId]/investment-allocation/+server';
import { PUT as targetPricePut } from './target-prices/[symbol]/+server';

class FakeKv {
	private readonly store = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		return this.store.get(key) ?? null;
	}

	async put(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}
}

function jsonRequest(body: unknown): Request {
	return new Request('https://example.test', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

function malformedRequest(): Request {
	return new Request('https://example.test', { method: 'POST', body: '{ not valid json' });
}

// Only used for events that never reach createApplicationServices (auth/body
// validation failures short-circuit first), so `platform: undefined` is safe.
function unauthenticatedEvent(overrides: Record<string, unknown> = {}) {
	return {
		locals: {},
		platform: undefined,
		params: {},
		request: new Request('https://example.test', { method: 'GET' }),
		...overrides
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

async function expectApiError(response: Response, status: number, code: string) {
	const body = (await response.json()) as ApiErrorResponse;
	expect(response.status).toBe(status);
	expect(body.error.code).toBe(code);
}

describe('API route authentication wiring (real +server.ts handlers)', () => {
	it.each([
		['GET /api/watchlists', () => watchlistsGet(unauthenticatedEvent())],
		[
			'POST /api/watchlists',
			() => watchlistsPost(unauthenticatedEvent({ request: jsonRequest({ name: 'Main' }) }))
		],
		[
			'PUT /api/watchlists/active',
			() => activePut(unauthenticatedEvent({ request: jsonRequest({ watchlistId: 'wl-1' }) }))
		],
		['DELETE /api/watchlists/active', () => activeDelete(unauthenticatedEvent())],
		[
			'GET /api/watchlists/[id]',
			() => watchlistGet(unauthenticatedEvent({ params: { watchlistId: 'wl-1' } }))
		],
		[
			'POST /api/watchlists/[id]/stocks',
			() =>
				stocksPost(
					unauthenticatedEvent({
						params: { watchlistId: 'wl-1' },
						request: jsonRequest({ symbol: 'AAPL' })
					})
				)
		],
		[
			'DELETE /api/watchlists/[id]/stocks/[symbol]',
			() => stockDelete(unauthenticatedEvent({ params: { watchlistId: 'wl-1', symbol: 'AAPL' } }))
		],
		[
			'PUT /api/target-prices/[symbol]',
			() =>
				targetPricePut(
					unauthenticatedEvent({
						params: { symbol: 'AAPL' },
						request: jsonRequest({ targetPrice: 100 })
					})
				)
		],
		[
			'POST /api/watchlists/[id]/investment-allocation',
			() =>
				investmentAllocationPost(
					unauthenticatedEvent({
						params: { watchlistId: 'wl-1' },
						request: jsonRequest({ totalSavings: 1000 })
					})
				)
		]
	])('%s returns 401 UNAUTHENTICATED with no authenticated user', async (_label, callRoute) => {
		await expectApiError(await callRoute(), 401, 'UNAUTHENTICATED');
	});
});

describe('API route malformed-JSON handling (real +server.ts handlers)', () => {
	const authenticatedLocals = { user: { id: 'user-1' } };

	it.each([
		[
			'POST /api/watchlists',
			() =>
				watchlistsPost(
					unauthenticatedEvent({ locals: authenticatedLocals, request: malformedRequest() })
				)
		],
		[
			'PUT /api/watchlists/active',
			() =>
				activePut(
					unauthenticatedEvent({ locals: authenticatedLocals, request: malformedRequest() })
				)
		],
		[
			'POST /api/watchlists/[id]/stocks',
			() =>
				stocksPost(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { watchlistId: 'wl-1' },
						request: malformedRequest()
					})
				)
		],
		[
			'PUT /api/target-prices/[symbol]',
			() =>
				targetPricePut(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { symbol: 'AAPL' },
						request: malformedRequest()
					})
				)
		],
		[
			'POST /api/watchlists/[id]/investment-allocation',
			() =>
				investmentAllocationPost(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { watchlistId: 'wl-1' },
						request: malformedRequest()
					})
				)
		]
	])('%s returns 400 INVALID_REQUEST for malformed JSON', async (_label, callRoute) => {
		await expectApiError(await callRoute(), 400, 'INVALID_REQUEST');
	});
});

describe('POST /api/watchlists/[id]/investment-allocation early validation (real +server.ts handler)', () => {
	const authenticatedLocals = { user: { id: 'user-1' } };

	it('returns 400 INVALID_TOTAL_SAVINGS for an invalid amount without constructing application services', async () => {
		const event = unauthenticatedEvent({
			locals: authenticatedLocals,
			params: { watchlistId: 'wl-1' },
			request: jsonRequest({ totalSavings: -1 }),
			platform: undefined
		});

		// platform is deliberately undefined: if validation happened after
		// createApplicationServices, this would fail with 500 INTERNAL_ERROR
		// (PlatformUnavailableError) instead of the expected 400.
		await expectApiError(await investmentAllocationPost(event), 400, 'INVALID_TOTAL_SAVINGS');
	});
});

describe('Watchlist ID boundary (TASK-038, real +server.ts handlers)', () => {
	const authenticatedLocals = { user: { id: 'user-1' } };
	const OVER_LIMIT_ID = 'a'.repeat(65);

	it.each([
		[
			'GET /api/watchlists/[id]',
			() =>
				watchlistGet(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { watchlistId: OVER_LIMIT_ID },
						platform: undefined
					})
				)
		],
		[
			'POST /api/watchlists/[id]/stocks',
			() =>
				stocksPost(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { watchlistId: OVER_LIMIT_ID },
						request: jsonRequest({ symbol: 'AAPL' }),
						platform: undefined
					})
				)
		],
		[
			'DELETE /api/watchlists/[id]/stocks/[symbol]',
			() =>
				stockDelete(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { watchlistId: OVER_LIMIT_ID, symbol: 'AAPL' },
						platform: undefined
					})
				)
		],
		[
			'POST /api/watchlists/[id]/investment-allocation',
			() =>
				investmentAllocationPost(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						params: { watchlistId: OVER_LIMIT_ID },
						request: jsonRequest({ totalSavings: 1000 }),
						platform: undefined
					})
				)
		],
		[
			'PUT /api/watchlists/active',
			() =>
				activePut(
					unauthenticatedEvent({
						locals: authenticatedLocals,
						request: jsonRequest({ watchlistId: OVER_LIMIT_ID }),
						platform: undefined
					})
				)
		]
	])(
		'%s returns 400 INVALID_REQUEST for a 65-character watchlistId without constructing application services',
		async (_label, callRoute) => {
			// platform is deliberately undefined: if validation happened after
			// createApplicationServices, this would fail with 500 INTERNAL_ERROR
			// (PlatformUnavailableError) instead of the expected 400.
			await expectApiError(await callRoute(), 400, 'INVALID_REQUEST');
		}
	);

	it('does not reject a well-formed 64-character watchlistId solely for length (falls through to WATCHLIST_NOT_FOUND)', async () => {
		const kv = new FakeKv();
		const event = unauthenticatedEvent({
			locals: authenticatedLocals,
			params: { watchlistId: 'a'.repeat(64) },
			platform: { env: { WATCHLIST_KV: kv } }
		});

		await expectApiError(await watchlistGet(event), 404, 'WATCHLIST_NOT_FOUND');
	});
});

describe('API route ownership (real +server.ts handlers, fake KV, no network)', () => {
	it('creates the watchlist under the authenticated user id, ignoring any client-supplied userId', async () => {
		const kv = new FakeKv();
		const event = unauthenticatedEvent({
			locals: { user: { id: 'user-1' } },
			platform: { env: { WATCHLIST_KV: kv } },
			request: jsonRequest({ name: 'Main', userId: 'user-2' })
		});

		const response = await watchlistsPost(event);
		expect(response.status).toBe(200);

		const persisted = await kv.get('user:user-1:watchlists');
		expect(persisted).not.toBeNull();
		expect(await kv.get('user:user-2:watchlists')).toBeNull();
	});
});
