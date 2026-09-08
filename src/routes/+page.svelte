<script lang="ts">
	import { onMount } from 'svelte';
	import WatchlistTabs from '$lib/components/WatchlistTabs.svelte';
	import StockPresentation from '$lib/components/StockPresentation.svelte';
	import StockAddForm from '$lib/components/StockAddForm.svelte';
	import InvestmentAllocationControls from '$lib/components/InvestmentAllocationControls.svelte';
	import { MAX_COMPANY_NAME_FILTER_LENGTH } from '$lib/client/watchlistFilter';
	import { MAX_WATCHLIST_NAME_LENGTH } from '$lib/shared/watchlistName';
	import { WatchlistWorkspace } from '$lib/client/watchlistWorkspace.svelte';

	// One WatchlistWorkspace instance per rendered page instance (TASK-044).
	// This MUST stay a component-scoped construction, never a module-level
	// singleton, so reactive state can never leak across SSR requests,
	// concurrent page instances, or tests.
	const workspace = new WatchlistWorkspace();

	onMount(() => {
		workspace.load();
	});

	// UI-only adaptation (TASK-044 §58-59): the confirmation dialog itself is
	// presentation, so it stays here rather than in the Workspace, which
	// receives only the already-confirmed intent.
	function handleDeleteClick() {
		if (workspace.watchlists.length === 0 || workspace.managementBusy) {
			return;
		}

		const name = workspace.activeWatchlistName ?? 'this watchlist';
		if (!window.confirm(`Delete watchlist "${name}"?`)) {
			return;
		}

		workspace.deleteWatchlist();
	}
</script>

<div class="page">
	<header class="header">
		<h1>Watchlist</h1>
	</header>

	{#if workspace.metadataStatus === 'loading'}
		<p class="status">Loading watchlists…</p>
	{:else if workspace.metadataStatus === 'error'}
		<p class="status status-error" role="alert">
			{workspace.metadataError?.message ?? 'Failed to load watchlists.'}
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
				{#if workspace.watchlists.length > 0}
					<WatchlistTabs
						watchlists={workspace.watchlists}
						activeWatchlistId={workspace.activeWatchlistId}
						disabled={workspace.managementBusy}
						deleteBusy={workspace.deleteStatus === 'deleting'}
						onSelect={workspace.selectWatchlist}
						onDeleteActive={handleDeleteClick}
					/>
				{/if}
			</div>

			<form
				class="create-form"
				onsubmit={(event) => {
					event.preventDefault();
					workspace.createWatchlist();
				}}
			>
				<label class="sr-only" for="new-watchlist-name">Watchlist name</label>
				<input
					id="new-watchlist-name"
					class="field-input create-input"
					type="text"
					placeholder="New watchlist name"
					maxlength={MAX_WATCHLIST_NAME_LENGTH}
					bind:value={workspace.newWatchlistName}
					disabled={workspace.managementBusy}
					autocomplete="off"
				/>
				<button
					type="submit"
					class="btn btn-primary"
					aria-label="Add watchlist"
					aria-busy={workspace.createStatus === 'creating'}
					disabled={workspace.createDisabled}
				>
					+
				</button>
			</form>
		</section>

		{#if workspace.createError}
			<p class="status status-error" role="alert">
				Couldn't create watchlist: {workspace.createError.message}
			</p>
		{/if}

		{#if workspace.deleteError}
			<p class="status status-error" role="alert">
				Couldn't delete watchlist: {workspace.deleteError.message}
			</p>
		{/if}

		{#if workspace.tabSwitchError}
			<p class="status status-error" role="alert">
				Couldn't switch watchlist: {workspace.tabSwitchError.message}
			</p>
		{/if}
	{/if}

	{#if workspace.watchlists.length === 0}
		<p class="status empty-state">No watchlist has been created yet.</p>
	{:else}
		<div class="content">
			{#if workspace.activeWatchlistId}
				<!--
					Compact primary workspace toolbar (TASK-034 §21-38): stock
					mutation, table presentation, and allocation form three logical
					groups within one flex row that wraps as space runs out. The
					presentation/allocation groups only appear once stocks exist —
					filtering/allocating an empty watchlist is meaningless, and the
					lone stock-add control remains available to add the first stock.
				-->
				<div class="workspace-toolbar">
					<StockAddForm
						value={workspace.newStockSymbol}
						disabled={workspace.managementBusy}
						busy={workspace.stockMutationBusy}
						onInput={(value) => (workspace.newStockSymbol = value)}
						onAdd={workspace.addStock}
					/>

					{#if workspace.activeViewStatus === 'loaded' && workspace.activeView && workspace.activeView.stocks.length > 0}
						<div class="toolbar-group filter-group">
							<label class="sr-only" for="company-name-filter"> Filter by company name </label>
							<input
								id="company-name-filter"
								class="field-input filter-input"
								type="text"
								placeholder="Filter by company name"
								maxlength={MAX_COMPANY_NAME_FILTER_LENGTH}
								bind:value={workspace.companyNameFilter}
								autocomplete="off"
							/>
						</div>

						<InvestmentAllocationControls
							value={workspace.totalSavingsInput}
							disabled={workspace.managementBusy}
							busy={workspace.allocationBusy}
							inputInvalid={workspace.allocationInputError !== undefined}
							hasFeedback={workspace.allocationInputError !== undefined ||
								workspace.allocationError !== undefined}
							result={workspace.investmentAllocation}
							onInput={(value) => (workspace.totalSavingsInput = value)}
							onCalculate={workspace.calculateAllocation}
						/>
					{/if}
				</div>

				{#if workspace.stockSymbolValidationError}
					<p class="status status-error" role="alert">{workspace.stockSymbolValidationError}</p>
				{:else if workspace.stockMutationError}
					<p class="status status-error" role="alert">{workspace.stockMutationError.message}</p>
				{/if}

				{#if workspace.allocationInputError}
					<p id="allocation-feedback" class="status status-error" role="alert">
						{workspace.allocationInputError}
					</p>
				{:else if workspace.allocationError}
					<p id="allocation-feedback" class="status status-error" role="alert">
						{workspace.allocationError.message}
					</p>
				{/if}
			{/if}

			{#if workspace.activeViewStatus === 'loading'}
				<p class="status">Loading watchlist…</p>
			{:else if workspace.activeViewStatus === 'error'}
				<p class="status status-error" role="alert">
					{workspace.activeViewError?.message ?? 'Failed to load watchlist.'}
				</p>
			{:else if workspace.activeViewStatus === 'loaded' && workspace.activeView}
				{#each workspace.activeView.warnings as warning (warning.code)}
					<p class="status status-warning" role="status">{warning.message}</p>
				{/each}

				{#if workspace.activeView.stocks.length === 0}
					<p class="status empty-state">This watchlist is empty.</p>
				{:else if workspace.filteredStocks.length === 0}
					<p class="status filtered-empty">No stocks match the current filter.</p>
				{:else}
					<StockPresentation
						stocks={workspace.visibleStocks}
						sort={workspace.sort}
						busy={workspace.managementBusy}
						allocationBySymbol={workspace.allocationBySymbol}
						onSort={workspace.changeSort}
						onRemove={workspace.removeStock}
						onSaveTargetPrice={workspace.saveTargetPrice}
					/>
				{/if}

				{#if workspace.activeView.stocks.length > 0}
					<p class="count">{workspace.stockCountText}</p>
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

	/* `.toolbar-group` itself is shared, global vocabulary (moved to
	   `app.css` by TASK-042) so StockAddForm/InvestmentAllocationControls can
	   use it across their own component boundary; only the inline
	   company-name filter group's own sizing stays page-level here. */
	.filter-group {
		flex: 1 1 17.5rem;
	}

	.filter-input {
		width: 100%;
		min-width: 17.5rem;
		max-width: 25rem;
	}

	.count {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}
</style>
