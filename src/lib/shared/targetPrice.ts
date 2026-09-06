/**
 * Client-safe Target Price numeric bound (TASK-038). Shared so the client
 * textual parser (`targetPriceInput.ts`) and the server's authoritative
 * validation (`TargetPriceService.ts`) apply the exact same maximum rather
 * than maintaining two independent numeric literals.
 */
export const MAX_TARGET_PRICE = 1_000_000;

/**
 * HTML `maxlength` for the Target Price text input. Deliberately not derived
 * from `MAX_TARGET_PRICE` plus a fixed decimal-precision assumption — TASK-038
 * introduces no decimal-place limit, so this only needs to comfortably cover
 * the maximum value plus a separator and a reasonable number of fractional
 * digits a user might type before the numeric range check rejects it.
 */
export const TARGET_PRICE_INPUT_MAX_LENGTH = 20;
