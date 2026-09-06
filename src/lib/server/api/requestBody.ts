import { InvalidRequestError, PayloadTooLargeError } from './errors';

/**
 * Single application-wide JSON request-body byte limit (TASK-039). Every
 * legitimate payload — Watchlist name (<=50 UTF-16 code units, worst case
 * ~200 bytes as 4-byte UTF-8 astral characters), stock symbol (<=20 ASCII
 * characters), watchlistId (<=64 characters), or a `targetPrice`/
 * `totalSavings` numeric field — stays under a few hundred bytes including
 * JSON syntax overhead. 4 KiB leaves generous headroom for all of these plus
 * small future fields while remaining tiny relative to Cloudflare's
 * platform-level request-body limit, which is not treated as an acceptable
 * application boundary.
 */
export const MAX_JSON_REQUEST_BODY_BYTES = 4096;

/**
 * Reads at most `maxBytes` from `source`'s body, counting raw bytes as they
 * arrive rather than decoding first, so multi-byte UTF-8 content is measured
 * correctly and an oversized body is never fully buffered. A `Content-Length`
 * header that is a valid non-negative integer greater than `maxBytes`
 * short-circuits before the body is touched at all; any other declared value
 * (missing, malformed, or a misleadingly small number) falls through to the
 * streaming byte count, which remains authoritative.
 */
export async function readBoundedRequestBytes(
	source: Pick<Request, 'headers' | 'body'>,
	maxBytes: number
): Promise<Uint8Array> {
	const declaredLength = Number(source.headers.get('content-length'));
	if (Number.isInteger(declaredLength) && declaredLength >= 0 && declaredLength > maxBytes) {
		throw new PayloadTooLargeError();
	}

	if (source.body === null) {
		return new Uint8Array(0);
	}

	const reader = source.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		totalBytes += value.byteLength;
		if (totalBytes > maxBytes) {
			await reader.cancel();
			throw new PayloadTooLargeError();
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export async function parseJsonBody(request: Request): Promise<unknown> {
	const bytes = await readBoundedRequestBytes(request, MAX_JSON_REQUEST_BODY_BYTES);
	const text = new TextDecoder().decode(bytes);
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new InvalidRequestError('The request body is not valid JSON.', { cause: error });
	}
}

function requireObjectField(body: unknown, field: string): Record<string, unknown> {
	if (typeof body !== 'object' || body === null) {
		throw new InvalidRequestError(
			`The request body must be a JSON object with a "${field}" field.`
		);
	}
	return body as Record<string, unknown>;
}

export function requireStringField(body: unknown, field: string): string {
	const value = requireObjectField(body, field)[field];
	if (typeof value !== 'string') {
		throw new InvalidRequestError(`The request body must contain a string "${field}" field.`);
	}
	return value;
}

export function requireNumberField(body: unknown, field: string): number {
	const value = requireObjectField(body, field)[field];
	if (typeof value !== 'number') {
		throw new InvalidRequestError(`The request body must contain a numeric "${field}" field.`);
	}
	return value;
}
