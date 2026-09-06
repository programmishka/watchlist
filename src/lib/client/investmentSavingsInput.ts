import { MAX_TOTAL_SAVINGS } from '../shared/investmentSavings';

/**
 * Parses Total Savings input text into a non-negative whole-Euro integer, or
 * `undefined` if the text cannot unambiguously represent one (TASK-024 §3-4,
 * §62). Unlike Target Price input, no decimal separator is accepted at all —
 * this field intentionally only accepts whole Euros. Also rejects a value
 * above `MAX_TOTAL_SAVINGS` or an unsafe integer (TASK-038), the same bounds
 * the server enforces. This is input parsing, not business validation: the
 * server remains authoritative for totalSavings validity.
 */
export function parseTotalSavingsInput(value: string): number | undefined {
	const trimmed = value.trim();
	if (!/^\d+$/.test(trimmed)) {
		return undefined;
	}

	const parsed = Number(trimmed);
	if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_TOTAL_SAVINGS) {
		return undefined;
	}

	return parsed;
}
