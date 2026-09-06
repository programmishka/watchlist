/**
 * Client-safe Total Savings numeric bound (TASK-038). Shared so the client
 * textual parser (`investmentSavingsInput.ts`) and the server's authoritative
 * validation (`investmentAllocation.ts`) apply the exact same maximum rather
 * than maintaining two independent numeric literals.
 */
export const MAX_TOTAL_SAVINGS = 10_000_000;

/** HTML `maxlength` for the Total Savings text input: `10000000` is 8 digits. */
export const TOTAL_SAVINGS_INPUT_MAX_LENGTH = 8;
