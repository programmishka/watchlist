<script lang="ts">
	import type { StockAllocationResponse, WatchlistStock } from '$lib/client/watchlistApi';
	import {
		formatNumber,
		formatPercentage,
		formatPriceWithCurrency,
		formatSignedPercentage,
		formatWholeEuro,
		MISSING_VALUE_PLACEHOLDER
	} from '$lib/client/format';
	import { distanceStateFor } from '$lib/client/distancePresentation';
	import { SORTABLE_STOCK_COLUMNS } from '$lib/client/sortableStockColumns';
	import type { WatchlistSort, WatchlistSortColumn } from '$lib/client/watchlistSort';
	import TargetPriceCell, {
		type TargetPriceSaveResult
	} from '$lib/components/TargetPriceCell.svelte';

	interface Props {
		stocks: WatchlistStock[];
		sort?: WatchlistSort;
		busy?: boolean;
		allocationBySymbol?: Map<string, StockAllocationResponse>;
		onSort: (column: WatchlistSortColumn) => void;
		onRemove: (symbol: string) => void;
		onSaveTargetPrice: (symbol: string, targetPrice: number) => Promise<TargetPriceSaveResult>;
	}

	let {
		stocks,
		sort,
		busy = false,
		allocationBySymbol,
		onSort,
		onRemove,
		onSaveTargetPrice
	}: Props = $props();

	// Card mode has no sortable column headers (§45), so it exposes an
	// explicit compact sort control instead. Both controls manipulate the
	// same `WatchlistSort` state via the same `onSort`/`toggleWatchlistSort`
	// semantics as the table (§46, §52-53): selecting a different column from
	// the dropdown always starts ascending, and the direction button re-fires
	// `onSort` with the *current* column, which `toggleWatchlistSort` (owned
	// by the caller) reverses. No separate sort logic exists in this component.
	function handleColumnChange(event: Event) {
		const column = (event.currentTarget as HTMLSelectElement).value as WatchlistSortColumn;
		onSort(column);
	}

	function handleDirectionToggle() {
		if (sort) {
			onSort(sort.column);
		}
	}

	let directionLabel = $derived(sort?.direction === 'desc' ? 'descending' : 'ascending');
</script>

<div class="cards-toolbar">
	<label class="sr-only" for="card-sort-column">Sort by</label>
	<select
		id="card-sort-column"
		class="field-input card-sort-select"
		value={sort?.column ?? 'name'}
		onchange={handleColumnChange}
	>
		{#each SORTABLE_STOCK_COLUMNS as column (column.key)}
			<option value={column.key}>{column.label}</option>
		{/each}
	</select>
	<button
		type="button"
		class="btn btn-compact card-sort-direction"
		aria-label={`Sort direction: ${directionLabel}`}
		onclick={handleDirectionToggle}
	>
		<span aria-hidden="true">{sort?.direction === 'desc' ? '↓' : '↑'}</span>
	</button>
</div>

<ul class="cards-grid">
	{#each stocks as stock (stock.symbol)}
		{@const distanceState = distanceStateFor(stock.distanceToTarget)}
		<li class="stock-row stock-card">
			<div class="card-header">
				<span class="symbol">{stock.symbol}</span>
				<span class="card-name">{stock.name ?? MISSING_VALUE_PLACEHOLDER}</span>
			</div>

			<div class="card-valuation">
				<div class="card-field">
					<span class="card-label">Price</span>
					<span class="card-value">{formatPriceWithCurrency(stock.price, stock.currency)}</span>
				</div>
				<div class="card-field">
					<span class="card-label">Target Price</span>
					<TargetPriceCell
						symbol={stock.symbol}
						targetPrice={stock.targetPrice}
						{busy}
						onSave={onSaveTargetPrice}
					/>
				</div>
				<div class="card-field">
					<span class="card-label">Distance</span>
					<span class="card-value distance-value distance-{distanceState}"
						>{formatSignedPercentage(stock.distanceToTarget)}</span
					>
				</div>
			</div>

			<div class="card-secondary">
				<div class="card-field">
					<span class="card-label">Market Cap (USD bn)</span>
					<span class="card-value">{formatNumber(stock.marketCapBillionsUsd)}</span>
				</div>
				<div class="card-field">
					<span class="card-label">Dividend Yield</span>
					<span class="card-value">{formatPercentage(stock.dividendYield)}</span>
				</div>
				<div class="card-field">
					<span class="card-label">Savings Amount</span>
					<span class="card-value savings-value"
						>{formatWholeEuro(allocationBySymbol?.get(stock.symbol)?.savingsAmount)}</span
					>
				</div>
			</div>

			<div class="card-actions">
				<button
					type="button"
					class="btn btn-destructive btn-icon"
					aria-label={`Remove ${stock.symbol}`}
					aria-busy={busy}
					disabled={busy}
					onclick={() => onRemove(stock.symbol)}
				>
					<svg
						class="icon-trash"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<path
							d="M10 12L14 16M14 12L10 16M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</li>
	{/each}
</ul>

<style>
	.cards-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.card-sort-select {
		width: auto;
		min-width: 10rem;
	}

	.card-sort-direction {
		flex: 0 0 auto;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Two cards per row only once each remains comfortably readable (§34-36);
	   never more than two, and never forced at the narrower end of Card
	   mode's own range (e.g. 768px). */
	@media (min-width: 56rem) {
		.cards-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.stock-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
		padding: 0.9rem 1rem;
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius);
		background: #fff;
	}

	.card-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
	}

	.card-header .symbol {
		font-size: 1.1rem;
		font-weight: 700;
		overflow-wrap: break-word;
	}

	.card-name {
		color: var(--color-text-muted);
		overflow-wrap: break-word;
	}

	.card-valuation,
	.card-secondary {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.card-valuation {
		padding-block: 0.5rem;
		border-block: 1px solid var(--color-border-subtle);
	}

	.card-field {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	.card-label {
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}

	.card-value {
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: break-word;
	}

	/* Distance to Target is one of the card's most prominent values (§25),
	   reusing the same value-oriented favorable/unfavorable tokens as the
	   table (TASK-033 §30-35) rather than inventing separate Card styling. */
	.distance-value {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.distance-favorable {
		color: var(--color-distance-favorable);
	}

	.distance-unfavorable {
		color: var(--color-distance-unfavorable);
	}

	.card-actions {
		display: flex;
		justify-content: flex-end;
	}

	/* Trash icon application size (TASK-045 §14, §22-24), matching WatchlistTable
	   so Table and Cards represent stock removal identically (§6). */
	.icon-trash {
		width: 1.1rem;
		height: 1.1rem;
	}
</style>
