export type StockPresentationMode = 'table' | 'cards';

/**
 * Empirically selected Table/Card presentation breakpoint (TASK-036 §5-7).
 *
 * The desktop table (`WatchlistTable.svelte`) uses `table-layout: fixed` with
 * a `min-width: 68rem` (1088px) content-aware column set (TASK-034 §42-45).
 * The page container reserves `2rem` (32px) of horizontal inset around it
 * (`src/routes/+page.svelte`), so the table stops requiring horizontal
 * scrolling only once the viewport reaches `68rem + 2rem = 70rem` (1120px) —
 * confirmed by measuring the table container's `scrollWidth`/`clientWidth`
 * across the project's representative widths (768/900/.../1600px) before
 * choosing this value, per this task's "determine empirically" requirement.
 * Below this width, Stock Cards (`WatchlistCards.svelte`) replace the table
 * instead of falling back to horizontal table scrolling.
 */
export const STOCK_CARD_PRESENTATION_BREAKPOINT_PX = 1120;

/** Pure width-to-presentation mapping, independent of any DOM/browser API. */
export function stockPresentationModeForWidth(width: number): StockPresentationMode {
	return width >= STOCK_CARD_PRESENTATION_BREAKPOINT_PX ? 'table' : 'cards';
}
