<script lang="ts">
	import { onMount } from 'svelte';
	import WatchlistTabs from '$lib/components/WatchlistTabs.svelte';
	import WatchlistTable from '$lib/components/WatchlistTable.svelte';
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
		loadInitialWatchlists,
		removeStockFromActiveWatchlist,
		setTargetPriceForActiveStock,
		switchActiveWatchlist
	} from '$lib/client/watchlistShell';
	import { filterStocksByCompanyName, formatStockCount } from '$lib/client/watchlistFilter';
	import {
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

	let targetPriceMutationBusy = $state(false);

	// UI-local filter for the active Watchlist (TASK-022 §11); reset whenever
	// the active Watchlist itself changes rather than persisted anywhere.
	let companyNameFilter = $state('');

	// UI-local table sort (TASK-023); reset at the same active-Watchlist
	// transitions as the filter, never persisted anywhere.
	let sort = $state<WatchlistSort | undefined>(undefined);

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
				sort = undefined;
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
				sort = undefined;
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
				sort = undefined;
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

	function handleAddStockSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!activeWatchlistId || addStockDisabled) {
			return;
		}

		addStockToActiveWatchlist(defaultWatchlistShellApi, activeWatchlistId, newStockSymbol, {
			onAdding: () => {
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
		<section class="management" aria-label="Watchlist management">
			<form class="create-form" onsubmit={handleCreateSubmit}>
				<label class="create-label" for="new-watchlist-name">Watchlist name</label>
				<input
					id="new-watchlist-name"
					class="field-input create-input"
					type="text"
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

			{#if createError}
				<p class="status status-error" role="alert">
					Couldn't create watchlist: {createError.message}
				</p>
			{/if}

			<div class="tabs-row">
				{#if watchlists.length > 0}
					<div class="tabs-wrapper">
						<WatchlistTabs
							{watchlists}
							{activeWatchlistId}
							disabled={managementBusy}
							onSelect={handleSelectTab}
						/>
					</div>
				{/if}

				<button
					type="button"
					class="btn btn-destructive"
					onclick={handleDeleteClick}
					disabled={watchlists.length === 0 || managementBusy}
					aria-busy={deleteStatus === 'deleting'}
				>
					Delete current watchlist
				</button>
			</div>

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
		</section>

		{#if watchlists.length === 0}
			<p class="status empty-state">No watchlist has been created yet.</p>
		{:else}
			<div class="content">
				{#if activeWatchlistId}
					<form class="add-stock-form" onsubmit={handleAddStockSubmit}>
						<label class="add-stock-label" for="new-stock-symbol">Stock symbol</label>
						<input
							id="new-stock-symbol"
							class="field-input add-stock-input"
							type="text"
							bind:value={newStockSymbol}
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

					{#if stockMutationError}
						<p class="status status-error" role="alert">{stockMutationError.message}</p>
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
					{:else}
						<h2 class="watchlist-heading">{activeView.name}</h2>

						<div class="table-controls">
							<form class="allocation-form" onsubmit={handleCalculateAllocation}>
								<label class="allocation-label" for="total-savings">Total savings</label>
								<input
									id="total-savings"
									class="field-input allocation-input"
									type="text"
									inputmode="numeric"
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
									<span class="invested"
										>Invested: {formatWholeEuro(investmentAllocation.invested)}</span
									>
								{/if}
							</form>

							{#if allocationInputError}
								<p id="allocation-feedback" class="status status-error" role="alert">
									{allocationInputError}
								</p>
							{:else if allocationError}
								<p id="allocation-feedback" class="status status-error" role="alert">
									{allocationError.message}
								</p>
							{/if}

							<div class="filter-row">
								<label class="filter-label" for="company-name-filter">
									Filter by company name
								</label>
								<input
									id="company-name-filter"
									class="field-input filter-input"
									type="text"
									bind:value={companyNameFilter}
									autocomplete="off"
								/>
							</div>
						</div>

						{#if filteredStocks.length === 0}
							<p class="status filtered-empty">No stocks match the current filter.</p>
						{:else}
							<WatchlistTable
								stocks={visibleStocks}
								{sort}
								busy={managementBusy}
								{allocationBySymbol}
								onSort={handleSort}
								onRemove={handleRemoveStock}
								onSaveTargetPrice={handleSaveTargetPrice}
							/>
						{/if}

						<p class="count">{stockCountText}</p>
					{/if}
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem clamp(1rem, 4vw, 2rem);
	}

	.header {
		margin-bottom: 1rem;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.watchlist-heading {
		font-size: 1.15rem;
		font-weight: 600;
		margin: 0 0 0.75rem;
	}

	.content {
		margin-top: 1rem;
	}

	.add-stock-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.add-stock-label {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.add-stock-input {
		flex: 1 1 12rem;
		min-width: 0;
	}

	.management {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-bottom: 1rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.create-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.create-label {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.create-input {
		flex: 1 1 12rem;
		min-width: 0;
	}

	.tabs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.tabs-wrapper {
		flex: 1 1 auto;
		min-width: 0;
	}

	.status {
		color: var(--color-text-muted);
	}

	/* Groups the table-scoped calculation and presentation controls
	   (allocation, filter) together, distinct from the stock-add mutation
	   above and the table below (TASK-025 §4). */
	.table-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.allocation-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.allocation-label {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.allocation-input {
		flex: 0 1 8rem;
		min-width: 0;
		text-align: right;
	}

	.invested {
		font-weight: 600;
		color: var(--color-text);
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-label {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.filter-input {
		flex: 1 1 12rem;
		min-width: 0;
		max-width: 20rem;
	}

	.count {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}
</style>
