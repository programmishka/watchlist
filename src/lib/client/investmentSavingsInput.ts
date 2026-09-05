/**
 * Parses Total Savings input text into a non-negative whole-Euro integer, or
 * `undefined` if the text cannot unambiguously represent one (TASK-024 §3-4,
 * §62). Unlike Target Price input, no decimal separator is accepted at all —
 * this field intentionally only accepts whole Euros. This is input parsing,
 * not business validation: the server remains authoritative for
 * totalSavings validity.
 */
export function parseTotalSavingsInput(value: string): number | undefined {
	const trimmed = value.trim();
	if (!/^\d+$/.test(trimmed)) {
		return undefined;
	}

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return undefined;
	}

	return parsed;
}
