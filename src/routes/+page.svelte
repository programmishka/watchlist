<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import WatchlistTabs from '$lib/components/WatchlistTabs.svelte';
	import WatchlistTable from '$lib/components/WatchlistTable.svelte';
	import WatchlistCards from '$lib/components/WatchlistCards.svelte';
	import {
		STOCK_CARD_PRESENTATION_BREAKPOINT_PX,
		stockPresentationModeForWidth
	} from '$lib/client/watchlistPresentation';
	import type {
		InvestmentAllocationResponse,
		WatchlistApiError,
		WatchlistMetadata,
		WatchlistView,
		WatchlistsMetadataResponse
	} from '$lib/client/watchlistApi';
	import {
		addStockToActiveWatchlist,
		calculateInvestmentAllocationForActiveWatchlist,
		createWatchlistAndActivate,
		defaultWatchlistShellApi,
		deleteActiveWatchlistAndTransition,
		INVALID_STOCK_SYMBOL_MESSAGE,
		loadInitialWatchlists,
		removeStockFromActiveWatchlist,
		setTargetPriceForActiveStock,
		switchActiveWatchlist
	} from '$lib/client/watchlistShell';
	import {
		MAX_COMPANY_NAME_FILTER_LENGTH,
		filterStocksByCompanyName,
		formatStockCount
	} from '$lib/client/watchlistFilter';
	import { MAX_WATCHLIST_NAME_LENGTH } from '$lib/shared/watchlistName';
	import { MAX_STOCK_SYMBOL_LENGTH } from '$lib/shared/stockSymbol';
	import { TOTAL_SAVINGS_INPUT_MAX_LENGTH } from '$lib/shared/investmentSavings';
	import {
		DEFAULT_WATCHLIST_SORT,
		sortWatchlistStocks,
		toggleWatchlistSort,
		type WatchlistSort,
		type WatchlistSortColumn
	} from '$lib/client/watchlistSort';
	import { allocationBySymbol as buildAllocationBySymbol } from '$lib/client/investmentAllocation';
	import { parseTotalSavingsInput } from '$lib/client/investmentSavingsInput';
	import { formatWholeEuro } from '$lib/client/format';
	import type { TargetPriceSaveResult } from '$lib/components/TargetPriceCell.svelte';

	type MetadataStatus = 'loading' | 'loaded' | 'error';
	type ActiveViewStatus = 'idle' | 'loading' | 'loaded' | 'error';

	let watchlists = $state<WatchlistMetadata[]>([]);
	let activeWatchlistId = $state<string | undefined>(undefined);
	let metadataStatus = $state<MetadataStatus>('loading');
	let metadataError = $state<WatchlistApiError | undefined>(undefined);

	let activeView = $state<WatchlistView | undefined>(undefined);
	let activeViewStatus = $state<ActiveViewStatus>('idle');
	let activeViewError = $state<WatchlistApiError | undefined>(undefined);

	let tabSwitchError = $state<WatchlistApiError | undefined>(undefined);

	let newWatchlistName = $state('');
	let createStatus = $state<'idle' | 'creating'>('idle');
	let createError = $state<WatchlistApiError | undefined>(undefined);

	let deleteStatus = $state<'idle' | 'deleting'>('idle');
	let deleteError = $state<WatchlistApiError | undefined>(undefined);

	let newStockSymbol = $state('');
	let stockMutationBusy = $state(false);
	let stockMutationError = $state<WatchlistApiError | undefined>(undefined);
	// Local syntax-validation feedback (TASK-029 §26/§29), distinct from a
	// server-reported mutation error; takes precedence when both are set.
	let stockSymbolValidationError = $state<string | undefined>(undefined);

	let targetPriceMutationBusy = $state(false);

	// UI-local filter for the active Watchlist (TASK-022 §11); reset whenever
	// the active Watchlist itself changes rather than persisted anywhere.
	let companyNameFilter = $state('');

	// UI-local table sort (TASK-023), defaulting to Name ascending for every
	// newly active Watchlist (TASK-032); reset to that default at the same
	// active-Watchlist transitions as the filter, never persisted anywhere.
	let sort = $state<WatchlistSort>(DEFAULT_WATCHLIST_SORT);

	// Responsive Table/Card presentation switch (TASK-036 §54-61): a pure
	// width->mode mapping evaluated against the real viewport, guarded so it
	// never touches `window` during SSR (defaulting to the table, matching
	// the pre-TASK-036 behavior). Unlike WatchlistTabs' capacity computation,
	// this can't be left to CSS alone: the table and cards each mount their
	// own per-stock TargetPriceCell/remove-button instances, so both being
	// simultaneously present (even one hidden via CSS) would leave duplicate
	// interactive controls in the accessibility tree (§59). Using a single
	// `{#if}` below ensures only one presentation is ever mounted. Resizing
	// only recomputes this local presentation state; it never issues a
	// Watchlist/stock/Target-Price/allocation request.
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

	// Total Savings input text and the most recent successful investment
	// allocation (TASK-024 §12/§50): a temporary, unpersisted UI-state result
	// associated with the active Watchlist. Invalidated (set back to
	// undefined) whenever a successful mutation changes the business inputs
	// the allocation was based on, or the active Watchlist itself changes;
	// never recalculated automatically.
	let totalSavingsInput = $state('');
	let allocationInputError = $state<string | undefined>(undefined);
	let investmentAllocation = $state<InvestmentAllocationResponse | undefined>(undefined);
	let allocationBusy = $state(false);
	let allocationError = $state<WatchlistApiError | undefined>(undefined);

	// Any in-flight mutation or content load blocks other management actions
	// so responses can't resolve out of order and clobber a newer selection.
	let managementBusy = $derived(
		activeViewStatus === 'loading' ||
			createStatus === 'creating' ||
			deleteStatus === 'deleting' ||
			stockMutationBusy ||
			targetPriceMutationBusy ||
			allocationBusy
	);
	let createDisabled = $derived(newWatchlistName.trim().length === 0 || managementBusy);
	let addStockDisabled = $derived(newStockSymbol.trim().length === 0 || managementBusy);
	let activeWatchlistName = $derived(
		watchlists.find((watchlist) => watchlist.id === activeWatchlistId)?.name
	);

	let isFiltered = $derived(companyNameFilter.trim().length > 0);
	let filteredStocks = $derived(
		activeView ? filterStocksByCompanyName(activeView.stocks, companyNameFilter) : []
	);
	let visibleStocks = $derived(sortWatchlistStocks(filteredStocks, sort));
	let totalStockCount = $derived(activeView?.stocks.length ?? 0);
	let stockCountText = $derived(
		formatStockCount(totalStockCount, filteredStocks.length, isFiltered)
	);

	let allocationBySymbol = $derived(buildAllocationBySymbol(investmentAllocation));

	onMount(() => {
		loadInitialWatchlists(defaultWatchlistShellApi, {
			onMetadataLoading: () => {
				metadataStatus = 'loading';
				metadataError = undefined;
			},
			onMetadataLoaded: (response: WatchlistsMetadataResponse, initialActiveWatchlistId) => {
				watchlists = response.watchlists;
				activeWatchlistId = initialActiveWatchlistId;
				metadataStatus = 'loaded';
			},
			onMetadataError: (error) => {
				metadataStatus = 'error';
				metadataError = error;
			},
			onActiveWatchlistLoading: () => {
				activeViewStatus = 'loading';
				activeViewError = undefined;
			},
			onActiveWatchlistLoaded: (view) => {
				activeView = view;
				activeViewStatus = 'loaded';
			},
			onActiveWatchlistError: (error) => {
				activeViewStatus = 'error';
				activeViewError = error;
			}
		});
	});

	function handleSelectTab(watchlistId: string) {
		if (managementBusy) {
			return;
		}

		const previousStatus = activeViewStatus;
		const previousError = activeViewError;

		switchActiveWatchlist(defaultWatchlistShellApi, watchlistId, activeWatchlistId, {
			onSwitching: () => {
				tabSwitchError = undefined;
				activeViewStatus = 'loading';
			},
			onSelectionFailed: (error) => {
				tabSwitchError = error;
				activeViewStatus = previousStatus;
				activeViewError = previousError;
			},
			onSelected: (response) => {
				watchlists = response.watchlists;
				activeWatchlistId = watchlistId;
				companyNameFilter = '';
				sort = DEFAULT_WATCHLIST_SORT;
				investmentAllocation = undefined;
			},
			onActiveWatchlistLoaded: (view) => {
				activeView = view;
				activeViewStatus = 'loaded';
				activeViewError = undefined;
			},
			onActiveWatchlistError: (error) => {
				activeView = undefined;
				activeViewStatus = 'error';
				activeViewError = error;
			}
		});
	}

	function handleCreateSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (createDisabled) {
			return;
		}

		createWatchlistAndActivate(defaultWatchlistShellApi, newWatchlistName, {
			onCreating: () => {
				createStatus = 'creating';
				createError = undefined;
			},
			onCreateFailed: (error) => {
				createStatus = 'idle';
				createError = error;
			},
			onCreated: (response, newActiveWatchlistId) => {
				watchlists = response.watchlists;
				activeWatchlistId = newActiveWatchlistId;
				newWatchlistName = '';
				createStatus = 'idle';
				companyNameFilter = '';
				sort = DEFAULT_WATCHLIST_SORT;
				investmentAllocation = undefined;
			},
			onActiveWatchlistLoading: () => {
				activeViewStatus = 'loading';
				activeViewError = undefined;
			},
			onActiveWatchlistLoaded: (view) => {
				activeView = view;
				activeViewStatus = 'loaded';
			},
			onActiveWatchlistError: (error) => {
				activeView = undefined;
				activeViewStatus = 'error';
				activeViewError = error;
			}
		});
	}

	function handleDeleteClick() {
		if (watchlists.length === 0 || managementBusy) {
			return;
		}

		const name = activeWatchlistName ?? 'this watchlist';
		if (!window.confirm(`Delete watchlist "${name}"?`)) {
			return;
		}

		deleteActiveWatchlistAndTransition(defaultWatchlistShellApi, {
			onDeleting: () => {
				deleteStatus = 'deleting';
				deleteError = undefined;
			},
			onDeleteFailed: (error) => {
				deleteStatus = 'idle';
				deleteError = error;
			},
			onDeleted: (response) => {
				watchlists = response.watchlists;
				activeWatchlistId = response.activeWatchlistId;
				deleteStatus = 'idle';
				companyNameFilter = '';
				sort = DEFAULT_WATCHLIST_SORT;
				investmentAllocation = undefined;
			},
			onNoWatchlistsRemaining: () => {
				activeView = undefined;
				activeViewStatus = 'idle';
				activeViewError = undefined;
			},
			onActiveWatchlistLoading: () => {
				activeViewStatus = 'loading';
				activeViewError = undefined;
			},
			onActiveWatchlistLoaded: (view) => {
				activeView = view;
				activeViewStatus = 'loaded';
			},
			onActiveWatchlistError: (error) => {
				activeView = undefined;
				activeViewStatus = 'error';
				activeViewError = error;
			}
		});
	}

	function handleStockSymbolInput(event: Event) {
		// Immediate uppercase UX (TASK-029 §24-25): only case is transformed
		// while typing; trimming/full syntax validation happens on submit.
		newStockSymbol = (event.currentTarget as HTMLInputElement).value.toUpperCase();
	}

	function handleAddStockSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!activeWatchlistId || addStockDisabled) {
			return;
		}

		addStockToActiveWatchlist(defaultWatchlistShellApi, activeWatchlistId, newStockSymbol, {
			onInvalidSymbol: (normalizedSymbol) => {
				newStockSymbol = normalizedSymbol;
				stockMutationError = undefined;
				stockSymbolValidationError = INVALID_STOCK_SYMBOL_MESSAGE;
			},
			onAdding: () => {
				stockSymbolValidationError = undefined;
				stockMutationBusy = true;
				stockMutationError = undefined;
			},
			onAdded: (view) => {
				activeView = view;
				newStockSymbol = '';
				stockMutationBusy = false;
				investmentAllocation = undefined;
			},
			onAddFailed: (error) => {
				stockMutationBusy = false;
				stockMutationError = error;
			}
		});
	}

	function handleSort(column: WatchlistSortColumn) {
		sort = toggleWatchlistSort(sort, column);
	}

	function handleRemoveStock(symbol: string) {
		if (!activeWatchlistId || managementBusy) {
			return;
		}

		removeStockFromActiveWatchlist(defaultWatchlistShellApi, activeWatchlistId, symbol, {
			onRemoving: () => {
				stockMutationBusy = true;
				stockMutationError = undefined;
			},
			onRemoved: (view) => {
				activeView = view;
				stockMutationBusy = false;
				investmentAllocation = undefined;
			},
			onRemoveFailed: (error) => {
				stockMutationBusy = false;
				stockMutationError = error;
			}
		});
	}

	function handleSaveTargetPrice(
		symbol: string,
		targetPrice: number
	): Promise<TargetPriceSaveResult> {
		const view = activeView;
		if (!view) {
			return Promise.resolve({ ok: false, message: 'No active watchlist is loaded.' });
		}

		return new Promise((resolve) => {
			setTargetPriceForActiveStock(defaultWatchlistShellApi, view, symbol, targetPrice, {
				onSaving: () => {
					targetPriceMutationBusy = true;
				},
				onSaved: (updatedView, marketDataWarningMessage) => {
					activeView = updatedView;
					targetPriceMutationBusy = false;
					// The Target Price itself changed even when the distance refresh
					// warned (TASK-024 §38), so the allocation is invalidated either way.
					investmentAllocation = undefined;
					resolve({ ok: true, warningMessage: marketDataWarningMessage });
				},
				onSaveFailed: (error) => {
					targetPriceMutationBusy = false;
					resolve({ ok: false, message: error.message });
				}
			});
		});
	}

	function handleCalculateAllocation(event: SubmitEvent) {
		event.preventDefault();
		if (!activeWatchlistId || managementBusy) {
			return;
		}

		const totalSavings = parseTotalSavingsInput(totalSavingsInput);
		if (totalSavings === undefined) {
			allocationInputError = 'Enter a whole number of Euros, 0 or greater.';
			return;
		}
		allocationInputError = undefined;

		calculateInvestmentAllocationForActiveWatchlist(
			defaultWatchlistShellApi,
			activeWatchlistId,
			totalSavings,
			{
				onCalculating: () => {
					allocationBusy = true;
					allocationError = undefined;
				},
				onCalculated: (result) => {
					investmentAllocation = result;
					allocationBusy = false;
				},
				onCalculationFailed: (error) => {
					allocationBusy = false;
					allocationError = error;
				}
			}
		);
	}
</script>

<div class="page">
	<header class="header">
		<h1>Watchlist</h1>
	</header>

	{#if metadataStatus === 'loading'}
		<p class="status">Loading watchlists…</p>
	{:else if metadataStatus === 'error'}
		<p class="status status-error" role="alert">
			{metadataError?.message ?? 'Failed to load watchlists.'}
		</p>
	{:else}
		<!--
			Consolidated watchlist bar (TASK-034 §16, §21): tabs and Watchlist
			creation share one compact row instead of separate full-width rows.
			Per-tab deletion is now owned by WatchlistTabs itself (adjacent to the
			active tab), so there is no separate standalone delete button here.
		-->
		<section class="watchlist-bar" aria-label="Watchlist management">
			<div class="tabs-wrapper">
				{#if watchlists.length > 0}
					<WatchlistTabs
						{watchlists}
						{activeWatchlistId}
						disabled={managementBusy}
						deleteBusy={deleteStatus === 'deleting'}
						onSelect={handleSelectTab}
						onDeleteActive={handleDeleteClick}
					/>
				{/if}
			</div>

			<form class="create-form" onsubmit={handleCreateSubmit}>
				<label class="sr-only" for="new-watchlist-name">Watchlist name</label>
				<input
					id="new-watchlist-name"
					class="field-input create-input"
					type="text"
					placeholder="New watchlist name"
					maxlength={MAX_WATCHLIST_NAME_LENGTH}
					bind:value={newWatchlistName}
					disabled={managementBusy}
					autocomplete="off"
				/>
				<button
					type="submit"
					class="btn btn-primary"
					aria-label="Add watchlist"
					aria-busy={createStatus === 'creating'}
					disabled={createDisabled}
				>
					+
				</button>
			</form>
		</section>

		{#if createError}
			<p class="status status-error" role="alert">
				Couldn't create watchlist: {createError.message}
			</p>
		{/if}

		{#if deleteError}
			<p class="status status-error" role="alert">
				Couldn't delete watchlist: {deleteError.message}
			</p>
		{/if}

		{#if tabSwitchError}
			<p class="status status-error" role="alert">
				Couldn't switch watchlist: {tabSwitchError.message}
			</p>
		{/if}
	{/if}

	{#if watchlists.length === 0}
		<p class="status empty-state">No watchlist has been created yet.</p>
	{:else}
		<div class="content">
			{#if activeWatchlistId}
				<!--
					Compact primary workspace toolbar (TASK-034 §21-38): stock
					mutation, table presentation, and allocation form three logical
					groups within one flex row that wraps as space runs out. The
					presentation/allocation groups only appear once stocks exist —
					filtering/allocating an empty watchlist is meaningless, and the
					lone stock-add control remains available to add the first stock.
				-->
				<div class="workspace-toolbar">
					<form class="toolbar-group stock-group" onsubmit={handleAddStockSubmit}>
						<label class="sr-only" for="new-stock-symbol">Stock symbol</label>
						<input
							id="new-stock-symbol"
							class="field-input stock-symbol-input"
							type="text"
							placeholder="Stock symbol"
							maxlength={MAX_STOCK_SYMBOL_LENGTH}
							value={newStockSymbol}
							oninput={handleStockSymbolInput}
							disabled={managementBusy}
							autocomplete="off"
						/>
						<button
							type="submit"
							class="btn btn-primary"
							aria-label="Add stock"
							aria-busy={stockMutationBusy}
							disabled={addStockDisabled}
						>
							+
						</button>
					</form>

					{#if activeViewStatus === 'loaded' && activeView && activeView.stocks.length > 0}
						<div class="toolbar-group filter-group">
							<label class="sr-only" for="company-name-filter"> Filter by company name </label>
							<input
								id="company-name-filter"
								class="field-input filter-input"
								type="text"
								placeholder="Filter by company name"
								maxlength={MAX_COMPANY_NAME_FILTER_LENGTH}
								bind:value={companyNameFilter}
								autocomplete="off"
							/>
						</div>

						<form class="toolbar-group allocation-group" onsubmit={handleCalculateAllocation}>
							<label class="sr-only" for="total-savings">Total savings</label>
							<input
								id="total-savings"
								class="field-input allocation-input"
								type="text"
								inputmode="numeric"
								placeholder="Total savings"
								maxlength={TOTAL_SAVINGS_INPUT_MAX_LENGTH}
								bind:value={totalSavingsInput}
								aria-invalid={allocationInputError !== undefined}
								aria-describedby={allocationInputError || allocationError
									? 'allocation-feedback'
									: undefined}
								disabled={managementBusy}
								autocomplete="off"
							/>
							<button
								type="submit"
								class="btn btn-primary"
								aria-label="Calculate investment allocation"
								aria-busy={allocationBusy}
								disabled={managementBusy}
							>
								Calculate
							</button>
							{#if investmentAllocation}
								<span class="allocation-result"
									>Allocated savings: {formatWholeEuro(investmentAllocation.invested)}</span
								>
							{/if}
						</form>
					{/if}
				</div>

				{#if stockSymbolValidationError}
					<p class="status status-error" role="alert">{stockSymbolValidationError}</p>
				{:else if stockMutationError}
					<p class="status status-error" role="alert">{stockMutationError.message}</p>
				{/if}

				{#if allocationInputError}
					<p id="allocation-feedback" class="status status-error" role="alert">
						{allocationInputError}
					</p>
				{:else if allocationError}
					<p id="allocation-feedback" class="status status-error" role="alert">
						{allocationError.message}
					</p>
				{/if}
			{/if}

			{#if activeViewStatus === 'loading'}
				<p class="status">Loading watchlist…</p>
			{:else if activeViewStatus === 'error'}
				<p class="status status-error" role="alert">
					{activeViewError?.message ?? 'Failed to load watchlist.'}
				</p>
			{:else if activeViewStatus === 'loaded' && activeView}
				{#each activeView.warnings as warning (warning.code)}
					<p class="status status-warning" role="status">{warning.message}</p>
				{/each}

				{#if activeView.stocks.length === 0}
					<p class="status empty-state">This watchlist is empty.</p>
				{:else if filteredStocks.length === 0}
					<p class="status filtered-empty">No stocks match the current filter.</p>
				{:else if presentationMode === 'table'}
					<WatchlistTable
						stocks={visibleStocks}
						{sort}
						busy={managementBusy}
						{allocationBySymbol}
						onSort={handleSort}
						onRemove={handleRemoveStock}
						onSaveTargetPrice={handleSaveTargetPrice}
					/>
				{:else}
					<WatchlistCards
						stocks={visibleStocks}
						{sort}
						busy={managementBusy}
						{allocationBySymbol}
						onSort={handleSort}
						onRemove={handleRemoveStock}
						onSaveTargetPrice={handleSaveTargetPrice}
					/>
				{/if}

				{#if activeView.stocks.length > 0}
					<p class="count">{stockCountText}</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		width: min(calc(100% - 2rem), 1600px);
		margin-inline: auto;
		padding-block: 1rem 2rem;
	}

	.header {
		margin-bottom: 0.75rem;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.content {
		margin-top: 0.75rem;
	}

	.watchlist-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.tabs-wrapper {
		flex: 1 1 16rem;
		min-width: 0;
	}

	.create-form {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem;
		flex: 0 0 auto;
	}

	.create-input {
		width: 12rem;
		max-width: 14rem;
	}

	.status {
		color: var(--color-text-muted);
	}

	/* Compact primary workspace toolbar (TASK-034 §21-23): three logical
	   groups (stock mutation, table presentation, allocation) separated by
	   spacing rather than borders, wrapping as a whole per group so mobile
	   stacks each group on its own line. */
	.workspace-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.5rem;
		padding: 0.5rem 0;
		margin-bottom: 0.4rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		/* Without this, a flex item's default `min-width: auto` refuses to
		   shrink below its content's unwrapped width, which would force page
		   overflow at narrow viewports instead of letting the group's own
		   flex-wrap reflow its children onto separate lines (TASK-034 §37-38). */
		min-width: 0;
	}

	.stock-group {
		flex: 0 1 auto;
	}

	.stock-symbol-input {
		width: 11rem;
	}

	.filter-group {
		flex: 1 1 17.5rem;
	}

	.filter-input {
		width: 100%;
		min-width: 17.5rem;
		max-width: 25rem;
	}

	.allocation-group {
		flex: 0 1 auto;
		margin-left: auto;
	}

	.allocation-input {
		width: 7rem;
		text-align: right;
	}

	.allocation-result {
		font-weight: 600;
		color: var(--color-text);
	}

	.count {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}
</style>
