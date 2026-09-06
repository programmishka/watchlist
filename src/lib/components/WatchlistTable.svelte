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

	// Column order/labels (TASK-033 §1-9): Currency moved to directly follow
	// Price, and Market Cap/Dividend Yield/Actions were renamed for clarity.
	// Presentation only — this never reorders the underlying stock data.
	const SORTABLE_COLUMNS: { key: WatchlistSortColumn; label: string; numeric: boolean }[] = [
		{ key: 'symbol', label: 'Symbol', numeric: false },
		{ key: 'name', label: 'Name', numeric: false },
		{ key: 'marketCapBillionsUsd', label: 'Market Cap (USD bn)', numeric: true },
		{ key: 'price', label: 'Price', numeric: true },
		{ key: 'currency', label: 'Currency', numeric: false },
		{ key: 'dividendYield', label: 'Dividend Yield', numeric: true },
		{ key: 'targetPrice', label: 'Target Price', numeric: true },
		{ key: 'distanceToTarget', label: 'Distance to Target', numeric: true }
	];

	function ariaSortFor(column: WatchlistSortColumn): 'ascending' | 'descending' | 'none' {
		if (sort?.column !== column) {
			return 'none';
		}
		return sort.direction === 'asc' ? 'ascending' : 'descending';
	}

	/**
	 * Value-oriented Distance-to-Target classification (TASK-033 §28-33): a
	 * negative distance means the market price is below Target Price, which
	 * is presentationally favorable; positive is unfavorable. This is
	 * deliberately not named after mathematical sign to avoid ambiguity.
	 * Zero and missing distances are both neutral, but for distinct reasons
	 * (a real equal-price result vs. no calculable value at all).
	 */
	function distanceStateFor(
		distanceToTarget: number | undefined
	): 'favorable' | 'unfavorable' | 'neutral' {
		if (distanceToTarget === undefined || distanceToTarget === 0) {
			return 'neutral';
		}
		return distanceToTarget < 0 ? 'favorable' : 'unfavorable';
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
				{#each SORTABLE_COLUMNS as column (column.key)}
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
				<tr>
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
					<td class="numeric distance-{distanceState}">
						{formatSignedPercentage(stock.distanceToTarget)}
					</td>
					<td class="numeric">
						{formatWholeEuro(allocationBySymbol?.get(stock.symbol)?.savingsAmount)}
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
							🗑
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
</style>
