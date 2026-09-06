import { describe, expect, it } from 'vitest';
import {
	STOCK_CARD_PRESENTATION_BREAKPOINT_PX,
	stockPresentationModeForWidth
} from './watchlistPresentation';

describe('stockPresentationModeForWidth', () => {
	it('uses cards below the breakpoint', () => {
		expect(stockPresentationModeForWidth(STOCK_CARD_PRESENTATION_BREAKPOINT_PX - 1)).toBe('cards');
	});

	it('uses the table at and above the breakpoint', () => {
		expect(stockPresentationModeForWidth(STOCK_CARD_PRESENTATION_BREAKPOINT_PX)).toBe('table');
		expect(stockPresentationModeForWidth(STOCK_CARD_PRESENTATION_BREAKPOINT_PX + 1)).toBe('table');
	});

	it('uses cards at representative mobile/tablet widths', () => {
		expect(stockPresentationModeForWidth(375)).toBe('cards');
		expect(stockPresentationModeForWidth(768)).toBe('cards');
	});

	it('uses the table at representative wide-desktop widths', () => {
		expect(stockPresentationModeForWidth(1280)).toBe('table');
		expect(stockPresentationModeForWidth(1600)).toBe('table');
	});
});
