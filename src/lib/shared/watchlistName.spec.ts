import { describe, expect, it } from 'vitest';
import { MAX_WATCHLIST_NAME_LENGTH, isValidWatchlistName } from './watchlistName';

describe('isValidWatchlistName', () => {
	it('accepts a trimmed name of exactly the maximum length', () => {
		expect(isValidWatchlistName('A'.repeat(MAX_WATCHLIST_NAME_LENGTH))).toBe(true);
	});

	it('rejects a trimmed name one character over the maximum length', () => {
		expect(isValidWatchlistName('A'.repeat(MAX_WATCHLIST_NAME_LENGTH + 1))).toBe(false);
	});

	it('rejects an empty name', () => {
		expect(isValidWatchlistName('')).toBe(false);
	});

	it('accepts a short ordinary name', () => {
		expect(isValidWatchlistName('Main')).toBe(true);
	});

	it('counts UTF-16 code units, not grapheme clusters or code points', () => {
		// U+1F600 (an astral-plane emoji) is 2 UTF-16 code units, so 26 of them
		// is 52 code units — over the 50-code-unit maximum even though it is
		// only 26 visual characters.
		const name = '\u{1F600}'.repeat(26);
		expect(name.length).toBe(52);
		expect(isValidWatchlistName(name)).toBe(false);

		const shorterName = '\u{1F600}'.repeat(25);
		expect(shorterName.length).toBe(50);
		expect(isValidWatchlistName(shorterName)).toBe(true);
	});
});
