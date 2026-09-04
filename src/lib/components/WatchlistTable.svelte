<script lang="ts">
	import type { WatchlistStock } from '$lib/client/watchlistApi';
	import { formatNumber, formatPercentage, MISSING_VALUE_PLACEHOLDER } from '$lib/client/format';
	import TargetPriceCell, {
		type TargetPriceSaveResult
	} from '$lib/components/TargetPriceCell.svelte';

	interface Props {
		stocks: WatchlistStock[];
		busy?: boolean;
		onRemove: (symbol: string) => void;
		onSaveTargetPrice: (symbol: string, targetPrice: number) => Promise<TargetPriceSaveResult>;
	}

	let { stocks, busy = false, onRemove, onSaveTargetPrice }: Props = $props();
</script>

<div class="table-container">
	<table>
		<thead>
			<tr>
				<th scope="col">Symbol</th>
				<th scope="col">Name</th>
				<th scope="col" class="numeric">Cap (USD)</th>
				<th scope="col" class="numeric">Price</th>
				<th scope="col" class="numeric">Div</th>
				<th scope="col">Currency</th>
				<th scope="col" class="numeric">Target Price</th>
				<th scope="col" class="numeric">Distance to Target</th>
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
