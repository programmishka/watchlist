import { describe, expect, it } from 'vitest';
import { InvalidRequestError, PayloadTooLargeError } from './errors';
import {
	MAX_JSON_REQUEST_BODY_BYTES,
	parseJsonBody,
	readBoundedRequestBytes,
	requireNumberField,
	requireStringField
} from './requestBody';

function requestWithBody(body: string, headers?: Record<string, string>): Request {
	return new Request('https://example.test', { method: 'POST', body, headers });
}

describe('parseJsonBody', () => {
	it('parses a valid JSON body', async () => {
		const request = new Request('https://example.test', {
			method: 'POST',
			body: JSON.stringify({ name: 'Dividend' })
		});

		expect(await parseJsonBody(request)).toEqual({ name: 'Dividend' });
	});

	it('throws InvalidRequestError for malformed JSON below the limit', async () => {
		const request = new Request('https://example.test', {
			method: 'POST',
			body: '{ not valid json'
		});

		await expect(parseJsonBody(request)).rejects.toThrow(InvalidRequestError);
	});

	it('throws InvalidRequestError for an empty body', async () => {
		const request = requestWithBody('');

		await expect(parseJsonBody(request)).rejects.toThrow(InvalidRequestError);
	});

	it('throws PayloadTooLargeError, not InvalidRequestError, for an oversized malformed body', async () => {
		const oversizedMalformed = '{' + 'x'.repeat(MAX_JSON_REQUEST_BODY_BYTES + 1);
		const request = requestWithBody(oversizedMalformed);

		await expect(parseJsonBody(request)).rejects.toThrow(PayloadTooLargeError);
	});

	it('parses a valid JSON body containing multi-byte UTF-8 characters', async () => {
		const request = requestWithBody(JSON.stringify({ name: '漢字Ä€' }));

		expect(await parseJsonBody(request)).toEqual({ name: '漢字Ä€' });
	});
});

describe('readBoundedRequestBytes', () => {
	const MAX = MAX_JSON_REQUEST_BODY_BYTES;

	function bytesOf(text: string): number {
		return new TextEncoder().encode(text).byteLength;
	}

	it('accepts a body below the limit', async () => {
		const body = 'a'.repeat(MAX - 1);
		const bytes = await readBoundedRequestBytes(requestWithBody(body), MAX);

		expect(bytes.byteLength).toBe(bytesOf(body));
	});

	it('accepts a body of exactly the limit', async () => {
		const body = 'a'.repeat(MAX);
		const bytes = await readBoundedRequestBytes(requestWithBody(body), MAX);

		expect(bytes.byteLength).toBe(MAX);
	});

	it('rejects a body of limit + 1 byte', async () => {
		const body = 'a'.repeat(MAX + 1);

		await expect(readBoundedRequestBytes(requestWithBody(body), MAX)).rejects.toThrow(
			PayloadTooLargeError
		);
	});

	it('rejects immediately from Content-Length above the limit, without reading the body', async () => {
		const source: Pick<Request, 'headers' | 'body'> = {
			headers: new Headers({ 'content-length': String(MAX + 1) }),
			get body(): never {
				throw new Error('body must not be accessed when Content-Length exceeds the limit');
			}
		};

		await expect(readBoundedRequestBytes(source, MAX)).rejects.toThrow(PayloadTooLargeError);
	});

	it('does not trust a Content-Length equal to the limit; still bounds the actual body', async () => {
		// The actual body exceeds the declared header value, proving the header
		// alone never grants a pass — the streaming byte count is authoritative.
		const request = requestWithBody('a'.repeat(MAX + 1), { 'content-length': String(MAX) });

		await expect(readBoundedRequestBytes(request, MAX)).rejects.toThrow(PayloadTooLargeError);
	});

	it('rejects an oversized body with no usable Content-Length via streaming byte counting', async () => {
		const request = requestWithBody('a'.repeat(MAX + 1));

		expect(request.headers.get('content-length')).toBeNull();
		await expect(readBoundedRequestBytes(request, MAX)).rejects.toThrow(PayloadTooLargeError);
	});

	it('rejects an oversized body despite a malformed Content-Length header', async () => {
		const request = requestWithBody('a'.repeat(MAX + 1), { 'content-length': 'not-a-number' });

		await expect(readBoundedRequestBytes(request, MAX)).rejects.toThrow(PayloadTooLargeError);
	});

	it('rejects an oversized body despite a misleadingly small declared Content-Length', async () => {
		const request = requestWithBody('a'.repeat(MAX + 1), { 'content-length': '5' });

		await expect(readBoundedRequestBytes(request, MAX)).rejects.toThrow(PayloadTooLargeError);
	});

	it('counts UTF-8 bytes rather than JavaScript string characters', async () => {
		// Each '漢' is one UTF-16 code unit/JS character but 3 UTF-8 bytes.
		const oneCharBelowByteLimit = '漢'.repeat(Math.floor((MAX - 1) / 3));
		expect(oneCharBelowByteLimit.length).toBeLessThan(bytesOf(oneCharBelowByteLimit));
		expect(bytesOf(oneCharBelowByteLimit)).toBeLessThanOrEqual(MAX);

		const acceptedBytes = await readBoundedRequestBytes(
			requestWithBody(oneCharBelowByteLimit),
			MAX
		);
		expect(acceptedBytes.byteLength).toBe(bytesOf(oneCharBelowByteLimit));

		const overLimitByCharCountAlone = '漢'.repeat(Math.floor(MAX / 3) + 1);
		expect(bytesOf(overLimitByCharCountAlone)).toBeGreaterThan(MAX);
		await expect(
			readBoundedRequestBytes(requestWithBody(overLimitByCharCountAlone), MAX)
		).rejects.toThrow(PayloadTooLargeError);
	});
});

describe('requireStringField', () => {
	it('returns the string value when present', () => {
		expect(requireStringField({ name: 'Dividend' }, 'name')).toBe('Dividend');
	});

	it.each([
		['missing field', {}],
		['non-string field', { name: 42 }],
		['non-object body', 'not-an-object'],
		['null body', null]
	])('throws InvalidRequestError for %s', (_label, body) => {
		expect(() => requireStringField(body, 'name')).toThrow(InvalidRequestError);
	});

	it('does not silently coerce a numeric-looking string field', () => {
		expect(requireStringField({ name: '42' }, 'name')).toBe('42');
	});
});

describe('requireNumberField', () => {
	it('returns the numeric value when present', () => {
		expect(requireNumberField({ targetPrice: 200.5 }, 'targetPrice')).toBe(200.5);
	});

	it.each([
		['missing field', {}],
		['string field', { targetPrice: '200.5' }],
		['non-object body', 'not-an-object'],
		['null body', null]
	])('throws InvalidRequestError for %s', (_label, body) => {
		expect(() => requireNumberField(body, 'targetPrice')).toThrow(InvalidRequestError);
	});

	it('does not silently coerce a numeric string into a number', () => {
		expect(() => requireNumberField({ targetPrice: '200.5' }, 'targetPrice')).toThrow(
			InvalidRequestError
		);
	});
});
