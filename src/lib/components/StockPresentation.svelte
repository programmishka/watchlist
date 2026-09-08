<script lang="ts">
	import { browser } from '$app/environment';
	import type { StockAllocationResponse, WatchlistStock } from '$lib/client/watchlistApi';
	import {
		STOCK_CARD_PRESENTATION_BREAKPOINT_PX,
		stockPresentationModeForWidth
	} from '$lib/client/watchlistPresentation';
	import type { WatchlistSort, WatchlistSortColumn } from '$lib/client/watchlistSort';
	import WatchlistTable from '$lib/components/WatchlistTable.svelte';
	import WatchlistCards from '$lib/components/WatchlistCards.svelte';
	import type { TargetPriceSaveResult } from '$lib/components/TargetPriceCell.svelte';

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

	// Responsive Table/Card presentation switch (TASK-036, relocated from
	// `+page.svelte` by TASK-043): a pure width->mode mapping evaluated
	// against the real viewport, guarded so it never touches `window` during
	// SSR (defaulting to the table, matching pre-TASK-036 behavior). The
	// table and cards each mount their own per-stock TargetPriceCell/
	// remove-button instances, so both being simultaneously present (even one
	// hidden via CSS) would leave duplicate interactive controls in the
	// accessibility tree - a single `{#if}` below ensures only one
	// presentation is ever mounted. Resizing only recomputes this local
	// presentation state; it never issues a Watchlist/stock/Target-Price/
	// allocation request.
	function currentPresentationMode(): 'table' | 'cards' {
		if (!browser) {
			return 'table';
		}
		return stockPresentationModeForWidth(window.innerWidth);
	}

	let presentationMode = $state(currentPresentationMode());

	$effect(() => {
		if (!browser) {
			return;
		}
		const query = window.matchMedia(`(min-width: ${STOCK_CARD_PRESENTATION_BREAKPOINT_PX}px)`);
		const update = () => {
			presentationMode = currentPresentationMode();
		};
		query.addEventListener('change', update);
		return () => {
			query.removeEventListener('change', update);
		};
	});
</script>

{#if presentationMode === 'table'}
	<WatchlistTable
		{stocks}
		{sort}
		{busy}
		{allocationBySymbol}
		{onSort}
		{onRemove}
		{onSaveTargetPrice}
	/>
{:else}
	<WatchlistCards
		{stocks}
		{sort}
		{busy}
		{allocationBySymbol}
		{onSort}
		{onRemove}
		{onSaveTargetPrice}
	/>
{/if}
