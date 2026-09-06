import { describe, expect, it } from 'vitest';
import {
	MAX_STOCK_SYMBOL_LENGTH,
	isValidStockSymbol,
	normalizeStockSymbol,
	parseStockSymbol
} from './stockSymbol';

describe('normalizeStockSymbol', () => {
	it.each([
		['aapl', 'AAPL'],
		[' AAPL ', 'AAPL'],
		['sap.de', 'SAP.DE'],
		['hexa-b.st', 'HEXA-B.ST'],
		['0700.hk', '0700.HK']
	])('normalizes %j to %j', (input, expected) => {
		expect(normalizeStockSymbol(input)).toBe(expected);
	});
});

describe('isValidStockSymbol', () => {
	it.each(['AAPL', 'SAP.DE', 'GAW.L', 'HEXA-B.ST', 'BRK-B', '0700.HK', '7203.T', '0005.HK'])(
		'accepts %j',
		(symbol) => {
			expect(isValidStockSymbol(symbol)).toBe(true);
		}
	);

	it.each([
		'',
		' ',
		'AAPL!',
		'SAP..DE',
		'SAP--DE',
		'SAP.-DE',
		'SAP-.DE',
		'SAP_DE',
		'SAP DE',
		'.SAP',
		'SAP.',
		'-SAP',
		'SAP-'
	])('rejects %j', (symbol) => {
		expect(isValidStockSymbol(symbol)).toBe(false);
	});

	it('accepts a symbol of exactly the maximum length (TASK-038)', () => {
		const maxLengthSymbol = 'A'.repeat(MAX_STOCK_SYMBOL_LENGTH);
		expect(isValidStockSymbol(maxLengthSymbol)).toBe(true);
	});

	it('rejects a symbol one character over the maximum length (TASK-038)', () => {
		const overLengthSymbol = 'A'.repeat(MAX_STOCK_SYMBOL_LENGTH + 1);
		expect(isValidStockSymbol(overLengthSymbol)).toBe(false);
	});

	it('rejects a pathologically long symbol, proving the bound holds regardless of magnitude (TASK-037 regression)', () => {
		const pathologicalSymbol = 'A'.repeat(5000);
		expect(isValidStockSymbol(pathologicalSymbol)).toBe(false);
	});
});

describe('parseStockSymbol', () => {
	it('normalizes before validating, so lowercase input with valid syntax is accepted', () => {
		expect(parseStockSymbol(' sap.de ')).toEqual({ valid: true, symbol: 'SAP.DE' });
	});

	it('returns the normalized symbol even when invalid, so it can be redisplayed for correction', () => {
		expect(parseStockSymbol('aapl!')).toEqual({ valid: false, symbol: 'AAPL!' });
	});

	it('treats empty and whitespace-only input as invalid', () => {
		expect(parseStockSymbol('').valid).toBe(false);
		expect(parseStockSymbol('   ').valid).toBe(false);
	});
});
