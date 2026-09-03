import { describe, expect, it } from 'vitest';
import { InvalidRequestError } from './errors';
import { parseJsonBody, requireNumberField, requireStringField } from './requestBody';

describe('parseJsonBody', () => {
	it('parses a valid JSON body', async () => {
		const request = new Request('https://example.test', {
			method: 'POST',
			body: JSON.stringify({ name: 'Dividend' })
		});

		expect(await parseJsonBody(request)).toEqual({ name: 'Dividend' });
	});

	it('throws InvalidRequestError for malformed JSON', async () => {
		const request = new Request('https://example.test', {
			method: 'POST',
			body: '{ not valid json'
		});

		await expect(parseJsonBody(request)).rejects.toThrow(InvalidRequestError);
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
