import { describe, expect, it } from 'vitest';
import { distanceStateFor } from './distancePresentation';

describe('distanceStateFor', () => {
	it('classifies a negative distance as favorable', () => {
		expect(distanceStateFor(-0.1)).toBe('favorable');
	});

	it('classifies a positive distance as unfavorable', () => {
		expect(distanceStateFor(0.1)).toBe('unfavorable');
	});

	it('classifies a real zero distance as neutral', () => {
		expect(distanceStateFor(0)).toBe('neutral');
	});

	it('classifies a missing distance as neutral', () => {
		expect(distanceStateFor(undefined)).toBe('neutral');
	});
});
