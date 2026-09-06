import { MAX_TARGET_PRICE } from '../shared/targetPrice';

/**
 * Parses locale-friendly Target Price input text into a positive finite
 * number, or `undefined` if the text cannot unambiguously represent one
 * (TASK-021 §9-14). Both `.` and `,` are accepted as the decimal separator,
 * but not together in the same value. Also rejects a value above
 * `MAX_TARGET_PRICE` (TASK-038), the same bound the server enforces. This is
 * input parsing, not business validation: the server remains authoritative
 * for Target Price validity.
 */
export function parseTargetPriceInput(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	const hasDot = trimmed.includes('.');
	const hasComma = trimmed.includes(',');
	if (hasDot && hasComma) {
		return undefined;
	}

	const normalized = hasComma ? trimmed.replace(',', '.') : trimmed;
	if (!/^\d+(\.\d+)?$/.test(normalized)) {
		return undefined;
	}

	const parsed = Number(normalized);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_TARGET_PRICE) {
		return undefined;
	}

	return parsed;
}
