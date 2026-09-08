<script lang="ts">
	import type { StockAllocationResponse, WatchlistStock } from '$lib/client/watchlistApi';
	import {
		formatNumber,
		formatPercentage,
		formatSignedPercentage,
		formatWholeEuro,
		MISSING_VALUE_PLACEHOLDER
	} from '$lib/client/format';
	import type { WatchlistSort, WatchlistSortColumn } from '$lib/client/watchlistSort';
	import { distanceStateFor } from '$lib/client/distancePresentation';
	import { SORTABLE_STOCK_COLUMNS } from '$lib/client/sortableStockColumns';
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

	function ariaSortFor(column: WatchlistSortColumn): 'ascending' | 'descending' | 'none' {
		if (sort?.column !== column) {
			return 'none';
		}
		return sort.direction === 'asc' ? 'ascending' : 'descending';
	}
</script>

<div class="table-container">
	<table>
		<colgroup>
			<col class="col-symbol" />
			<col class="col-name" />
			<col class="col-market-cap" />
			<col class="col-price" />
			<col class="col-currency" />
			<col class="col-dividend-yield" />
			<col class="col-target-price" />
			<col class="col-distance" />
			<col class="col-savings" />
			<col class="col-actions" />
		</colgroup>
		<thead>
			<tr>
				{#each SORTABLE_STOCK_COLUMNS as column (column.key)}
					<th
						scope="col"
						class={column.numeric ? 'numeric' : undefined}
						aria-sort={ariaSortFor(column.key)}
					>
						<button
							type="button"
							class="sort-button"
							aria-label={`Sort by ${column.label}`}
							onclick={() => onSort(column.key)}
						>
							{column.label}
							{#if sort?.column === column.key}
								<span class="sort-indicator" aria-hidden="true">
									{sort.direction === 'asc' ? '↑' : '↓'}
								</span>
							{/if}
						</button>
					</th>
				{/each}
				<th scope="col" class="numeric">Savings Amount</th>
				<th scope="col">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each stocks as stock (stock.symbol)}
				{@const distanceState = distanceStateFor(stock.distanceToTarget)}
				{@const savingsAmount = allocationBySymbol?.get(stock.symbol)?.savingsAmount}
				{@const formattedSavingsAmount = formatWholeEuro(savingsAmount)}
				<tr class="stock-row">
					<td class="symbol">{stock.symbol}</td>
					<td class="name">{stock.name ?? MISSING_VALUE_PLACEHOLDER}</td>
					<td class="numeric">{formatNumber(stock.marketCapBillionsUsd)}</td>
					<td class="numeric">{formatNumber(stock.price)}</td>
					<td>{stock.currency ?? MISSING_VALUE_PLACEHOLDER}</td>
					<td class="numeric">{formatPercentage(stock.dividendYield)}</td>
					<td class="numeric target-price-cell">
						<TargetPriceCell
							symbol={stock.symbol}
							targetPrice={stock.targetPrice}
							{busy}
							onSave={onSaveTargetPrice}
						/>
					</td>
					<td class="numeric distance-value distance-{distanceState}">
						{formatSignedPercentage(stock.distanceToTarget)}
					</td>
					<td
						class="numeric savings-value"
						title={savingsAmount !== undefined ? formattedSavingsAmount : undefined}
					>
						{formattedSavingsAmount}
					</td>
					<td class="actions">
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
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		overflow-x: auto;
	}

	table {
		width: 100%;
		/* Content-aware column widths (TASK-034 §42-45): every column besides
		   Name has an explicit width below; table-layout: fixed hands Name the
		   remaining space instead of every column expanding proportionally.
		   The min-width is the sum of the explicit column widths plus a modest
		   floor for Name, so mobile/tablet still overflow into the container's
		   horizontal scroll (§39-41) while a wide desktop table gets most of
		   the page's width with no scrolling required. */
		min-width: 68rem;
		table-layout: fixed;
		border-collapse: collapse;
	}

	.col-symbol {
		/* Wide enough that common exchange-suffixed symbols (SAP.DE, GAW.L,
		   HEXA-B.ST) render on one line rather than wrapping mid-word. */
		width: 7rem;
	}

	.col-market-cap {
		width: 7rem;
	}

	.col-price {
		width: 6rem;
	}

	.col-currency {
		/* Wide enough for the "Currency" header label itself (an unbreakable
		   single word) at this font size/weight, not just the short data
		   values (USD, GBp, CHF, ...) the column normally holds. */
		width: 6.5rem;
	}

	.col-dividend-yield {
		width: 6rem;
	}

	.col-target-price {
		width: 8rem;
	}

	.col-distance {
		width: 6.5rem;
	}

	.col-savings {
		width: 5.5rem;
	}

	.col-actions {
		/* Wide enough for the "Actions" header label itself (an unbreakable
		   single word), not just the small icon button the column holds. */
		width: 5rem;
	}

	th,
	td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	td.name {
		white-space: normal;
		word-break: break-word;
		overflow-wrap: break-word;
	}

	/* Symbols can exceed the compact column width (e.g. exchange-suffixed
	   "HEXA-B.ST"); wrap rather than clip so the full symbol stays visible,
	   never hidden text under an ellipsis (unlike the other compact columns,
	   whose formatted values have a bounded, predictable length). */
	td.symbol {
		white-space: normal;
		overflow-wrap: break-word;
		overflow: visible;
	}

	td.target-price-cell {
		white-space: normal;
		overflow: visible;
		padding-inline: 0.4rem;
	}

	td.actions {
		text-align: center;
		padding-inline: 0.4rem;
	}

	thead th {
		/* Column widths are sized for the formatted data, not the (often
		   longer) header label; headers wrap instead of clipping. */
		white-space: normal;
		overflow: visible;
		border-bottom: 2px solid #d0d0d0;
		background: #f7f7f8;
		font-weight: 600;
	}

	tbody tr {
		border-bottom: 1px solid #eee;
	}

	tbody tr:hover {
		background: #fafafa;
	}

	.numeric {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* Value-oriented Distance-to-Target highlighting (TASK-033 §30-35):
	   applied only to this cell, never the surrounding row, and never to any
	   other financial column. The explicit signed percentage already carries
	   the same information independently of color (§36). */
	td.distance-favorable {
		color: var(--color-distance-favorable);
		background: var(--color-distance-favorable-bg);
	}

	td.distance-unfavorable {
		color: var(--color-distance-unfavorable);
		background: var(--color-distance-unfavorable-bg);
	}

	.sort-button {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-weight: 600;
		color: inherit;
		cursor: pointer;
		/* A flex container's text content defaults to a `min-width: auto`
		   (max-content) floor and won't wrap otherwise, even though the
		   ancestor `<th>` allows it (TASK-034 §42-45 compact header columns
		   like "Market Cap (USD bn)" need to wrap onto multiple lines). */
		min-width: 0;
		white-space: normal;
		text-align: left;
	}

	.sort-button:hover {
		text-decoration: underline;
	}

	th.numeric .sort-button {
		justify-content: flex-end;
	}

	.sort-indicator {
		font-size: 0.85em;
	}

	/* Trash icon application size (TASK-045 §14, §22-24): source is an
	   uncropped 24x24 outline glyph with no viewBox whitespace to trim, so
	   the viewBox is kept as-supplied and sizing is handled entirely here. */
	.icon-trash {
		width: 1.1rem;
		height: 1.1rem;
	}
</style>
