export interface WatchlistMetadata {
	id: string;
	name: string;
}

export interface WatchlistsMetadataResponse {
	activeWatchlistId?: string;
	watchlists: WatchlistMetadata[];
}

export interface WatchlistWarning {
	code: 'FX_PROVIDER_UNAVAILABLE' | 'MARKET_DATA_UNAVAILABLE';
	message: string;
}

export interface WatchlistStock {
	symbol: string;
	name?: string;
	price?: number;
	currency?: string;
	targetPrice?: number;
	/**
	 * Undefined represents a genuinely unavailable refreshed distance (e.g. a
	 * Target Price save whose market-data refresh failed, TASK-021 §28), and
	 * must be displayed distinctly from a real numeric `0`.
	 */
	distanceToTarget?: number;
	dividendYield: number;
	marketCapBillionsUsd?: number;
}

export interface WatchlistView {
	id: string;
	name: string;
	stocks: WatchlistStock[];
	warnings: WatchlistWarning[];
}

/** Response shape of `PUT /api/target-prices/{symbol}` (TASK-013), reused as-is by TASK-021. */
export interface TargetPriceMutationResponse {
	symbol: string;
	targetPrice: number;
	distanceToTarget?: number;
	warnings: WatchlistWarning[];
}

/** Client-side representation of the stable API error shape, preserving `code`/`message`/HTTP status. */
export class WatchlistApiError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(code: string, message: string, status: number) {
		super(message);
		this.name = 'WatchlistApiError';
		this.code = code;
		this.status = status;
	}
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(input, init);
	} catch {
		throw new WatchlistApiError(
			'NETWORK_ERROR',
			'Unable to reach the server. Check your connection and try again.',
			0
		);
	}

	if (!response.ok) {
		const body = await response.json().catch(() => undefined);
		const error = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
		throw new WatchlistApiError(
			error?.code ?? 'UNKNOWN_ERROR',
			error?.message ?? 'An unexpected error occurred.',
			response.status
		);
	}

	return (await response.json()) as T;
}

export function loadWatchlists(): Promise<WatchlistsMetadataResponse> {
	return requestJson<WatchlistsMetadataResponse>('/api/watchlists');
}

export function selectActiveWatchlist(watchlistId: string): Promise<WatchlistsMetadataResponse> {
	return requestJson<WatchlistsMetadataResponse>('/api/watchlists/active', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ watchlistId })
	});
}

export function loadWatchlist(watchlistId: string): Promise<WatchlistView> {
	return requestJson<WatchlistView>(`/api/watchlists/${encodeURIComponent(watchlistId)}`);
}

export function createWatchlist(name: string): Promise<WatchlistsMetadataResponse> {
	return requestJson<WatchlistsMetadataResponse>('/api/watchlists', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name })
	});
}

export function deleteActiveWatchlist(): Promise<WatchlistsMetadataResponse> {
	return requestJson<WatchlistsMetadataResponse>('/api/watchlists/active', {
		method: 'DELETE'
	});
}

export function addStock(watchlistId: string, symbol: string): Promise<WatchlistView> {
	return requestJson<WatchlistView>(`/api/watchlists/${encodeURIComponent(watchlistId)}/stocks`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ symbol })
	});
}

export function removeStock(watchlistId: string, symbol: string): Promise<WatchlistView> {
	return requestJson<WatchlistView>(
		`/api/watchlists/${encodeURIComponent(watchlistId)}/stocks/${encodeURIComponent(symbol)}`,
		{ method: 'DELETE' }
	);
}

export function setTargetPrice(
	symbol: string,
	targetPrice: number
): Promise<TargetPriceMutationResponse> {
	return requestJson<TargetPriceMutationResponse>(
		`/api/target-prices/${encodeURIComponent(symbol)}`,
		{
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ targetPrice })
		}
	);
}
