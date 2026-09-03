import { describe, expect, it } from 'vitest';
import {
	InvalidTotalSavingsError,
	calculateFactorSum,
	calculateInvestedTotal,
	calculateInvestmentFactor,
	calculateSavingsAllocation,
	calculateTargetPriceDistance
} from './investmentAllocation';

describe('calculateTargetPriceDistance', () => {
	it('is negative when price is below target', () => {
		expect(calculateTargetPriceDistance(80, 100)).toBeCloseTo(-0.2);
	});

	it('is zero when price equals target', () => {
		expect(calculateTargetPriceDistance(100, 100)).toBe(0);
	});

	it('is positive when price is above target', () => {
		expect(calculateTargetPriceDistance(120, 100)).toBeCloseTo(0.2);
	});

	it('is zero when the market price is missing', () => {
		expect(calculateTargetPriceDistance(undefined, 100)).toBe(0);
	});

	it('is zero when the target price is missing', () => {
		expect(calculateTargetPriceDistance(100, undefined)).toBe(0);
	});

	it('is zero when the market price is zero', () => {
		expect(calculateTargetPriceDistance(0, 100)).toBe(0);
	});

	it('is zero when the target price is zero', () => {
		expect(calculateTargetPriceDistance(100, 0)).toBe(0);
	});

	it('is zero rather than Infinity when the division overflows', () => {
		expect(calculateTargetPriceDistance(Number.MAX_VALUE, Number.MIN_VALUE)).toBe(0);
	});
});

describe('calculateInvestmentFactor', () => {
	it('is below 1 for a positive distance', () => {
		expect(calculateInvestmentFactor(0.2)).toBeCloseTo(1 / 1.2);
	});

	it('is above 1 for a negative distance', () => {
		expect(calculateInvestmentFactor(-0.2)).toBeCloseTo(1 / 0.8);
	});

	it('is zero for an exact distance of 0 (intentional legacy semantics)', () => {
		expect(calculateInvestmentFactor(0)).toBe(0);
	});

	it('is zero when the distance is missing', () => {
		expect(calculateInvestmentFactor(undefined)).toBe(0);
	});

	it('is zero rather than Infinity when distance is exactly -1', () => {
		expect(calculateInvestmentFactor(-1)).toBe(0);
	});

	it('is zero rather than negative when distance is below -1', () => {
		expect(calculateInvestmentFactor(-2)).toBe(0);
	});

	it('is zero for a NaN distance', () => {
		expect(calculateInvestmentFactor(NaN)).toBe(0);
	});
});

describe('calculateFactorSum', () => {
	it('sums multiple positive factors', () => {
		expect(calculateFactorSum([1, 2, 1])).toBe(4);
	});

	it('includes zero factors without affecting the sum', () => {
		expect(calculateFactorSum([1, 0, 1])).toBe(2);
	});

	it('is zero when all factors are zero', () => {
		expect(calculateFactorSum([0, 0, 0])).toBe(0);
	});

	it('is zero for an empty collection', () => {
		expect(calculateFactorSum([])).toBe(0);
	});

	it('treats negative or non-finite factors as zero', () => {
		expect(calculateFactorSum([1, -5, NaN, Infinity, -Infinity])).toBe(1);
	});
});

describe('calculateSavingsAllocation', () => {
	it('distributes savings proportionally by factor', () => {
		expect(calculateSavingsAllocation([1, 2, 1], 1000)).toEqual([250, 500, 250]);
	});

	it('rounds each amount down without redistributing the remainder', () => {
		expect(calculateSavingsAllocation([1, 1, 1], 100)).toEqual([33, 33, 33]);
	});

	it('gives zero to a stock with a zero factor while others still receive a share', () => {
		expect(calculateSavingsAllocation([1, 0, 1], 200)).toEqual([100, 0, 100]);
	});

	it('gives everyone zero when all factors are zero, without producing NaN', () => {
		expect(calculateSavingsAllocation([0, 0, 0], 1000)).toEqual([0, 0, 0]);
	});

	it('returns an empty allocation for an empty stock collection', () => {
		expect(calculateSavingsAllocation([], 1000)).toEqual([]);
	});

	it('sanitizes negative or non-finite factors instead of propagating them', () => {
		expect(calculateSavingsAllocation([1, -5, NaN], 100)).toEqual([100, 0, 0]);
	});

	it('accepts a total savings of zero and allocates zero to everyone', () => {
		expect(calculateSavingsAllocation([1, 2, 1], 0)).toEqual([0, 0, 0]);
	});

	it.each([
		['negative', -1],
		['fractional', 100.5],
		['NaN', NaN],
		['Infinity', Infinity],
		['-Infinity', -Infinity]
	])('rejects %s totalSavings', (_label, totalSavings) => {
		expect(() => calculateSavingsAllocation([1, 1], totalSavings)).toThrow(
			InvalidTotalSavingsError
		);
	});
});

describe('calculateInvestedTotal', () => {
	it('sums an exact allocation', () => {
		expect(calculateInvestedTotal([250, 500, 250])).toBe(1000);
	});

	it('sums an allocation with a rounding remainder to less than the total', () => {
		expect(calculateInvestedTotal([33, 33, 33])).toBe(99);
	});

	it('is zero for an empty allocation', () => {
		expect(calculateInvestedTotal([])).toBe(0);
	});
});

describe('full allocation pipeline', () => {
	it('never invests more than the requested total savings', () => {
		const factors = [1, 1, 1];
		const totalSavings = 100;

		const allocation = calculateSavingsAllocation(factors, totalSavings);
		const invested = calculateInvestedTotal(allocation);

		expect(invested).toBeLessThanOrEqual(totalSavings);
		expect(invested).toBe(99);
	});
});
