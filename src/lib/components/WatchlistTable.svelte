<script lang="ts">
	import type { WatchlistStock } from '$lib/client/watchlistApi';
	import { formatNumber, formatPercentage, MISSING_VALUE_PLACEHOLDER } from '$lib/client/format';
	import type { WatchlistSort, WatchlistSortColumn } from '$lib/client/watchlistSort';
	import TargetPriceCell, {
		type TargetPriceSaveResult
	} from '$lib/components/TargetPriceCell.svelte';

	interface Props {
		stocks: WatchlistStock[];
		sort?: WatchlistSort;
		busy?: boolean;
		onSort: (column: WatchlistSortColumn) => void;
		onRemove: (symbol: string) => void;
		onSaveTargetPrice: (symbol: string, targetPrice: number) => Promise<TargetPriceSaveResult>;
	}

	let { stocks, sort, busy = false, onSort, onRemove, onSaveTargetPrice }: Props = $props();

	const SORTABLE_COLUMNS: { key: WatchlistSortColumn; label: string; numeric: boolean }[] = [
		{ key: 'symbol', label: 'Symbol', numeric: false },
		{ key: 'name', label: 'Name', numeric: false },
		{ key: 'marketCapBillionsUsd', label: 'Cap (USD)', numeric: true },
		{ key: 'price', label: 'Price', numeric: true },
		{ key: 'dividendYield', label: 'Div', numeric: true },
		{ key: 'currency', label: 'Currency', numeric: false },
		{ key: 'targetPrice', label: 'Target Price', numeric: true },
		{ key: 'distanceToTarget', label: 'Distance to Target', numeric: true }
	];

	function ariaSortFor(column: WatchlistSortColumn): 'ascending' | 'descending' | 'none' {
		if (sort?.column !== column) {
			return 'none';
		}
		return sort.direction === 'asc' ? 'ascending' : 'descending';
	}
</script>

<div class="table-container">
	<table>
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
				<th scope="col">Delete</th>
			</tr>
		</thead>
		<tbody>
			{#each stocks as stock (stock.symbol)}
				<tr>
					<td>{stock.symbol}</td>
					<td class="name">{stock.name ?? MISSING_VALUE_PLACEHOLDER}</td>
					<td class="numeric">{formatNumber(stock.marketCapBillionsUsd)}</td>
					<td class="numeric">{formatNumber(stock.price)}</td>
					<td class="numeric">{formatPercentage(stock.dividendYield)}</td>
					<td>{stock.currency ?? MISSING_VALUE_PLACEHOLDER}</td>
					<td class="numeric target-price-cell">
						<TargetPriceCell
							symbol={stock.symbol}
							targetPrice={stock.targetPrice}
							{busy}
							onSave={onSaveTargetPrice}
						/>
					</td>
					<td class="numeric">{formatPercentage(stock.distanceToTarget)}</td>
					<td>
						<button
							type="button"
							class="remove-button"
							aria-label={`Remove ${stock.symbol}`}
							aria-busy={busy}
							disabled={busy}
							onclick={() => onRemove(stock.symbol)}
						>
							Delete
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
		min-width: 720px;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		white-space: nowrap;
	}

	td.name {
		white-space: normal;
		min-width: 10rem;
		max-width: 20rem;
	}

	td.target-price-cell {
		white-space: normal;
	}

	thead th {
		border-bottom: 2px solid #d0d0d0;
		font-weight: 600;
	}

	tbody tr {
		border-bottom: 1px solid #eee;
	}

	.numeric {
		text-align: right;
		font-variant-numeric: tabular-nums;
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

	.remove-button {
		padding: 0.35rem 0.6rem;
		border: 1px solid #b3261e;
		border-radius: 4px;
		background: #fff;
		color: #b3261e;
		font: inherit;
		cursor: pointer;
	}

	.remove-button:disabled {
		cursor: default;
		opacity: 0.5;
	}
</style>
