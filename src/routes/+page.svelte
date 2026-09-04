<script lang="ts">
	import { onMount } from 'svelte';
	import WatchlistTabs from '$lib/components/WatchlistTabs.svelte';
	import WatchlistTable from '$lib/components/WatchlistTable.svelte';
	import type {
		WatchlistApiError,
		WatchlistMetadata,
		WatchlistView,
		WatchlistsMetadataResponse
	} from '$lib/client/watchlistApi';
	import {
		createWatchlistAndActivate,
		defaultWatchlistShellApi,
		deleteActiveWatchlistAndTransition,
		loadInitialWatchlists,
		switchActiveWatchlist
	} from '$lib/client/watchlistShell';

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

	// Any in-flight mutation or content load blocks other management actions
	// so responses can't resolve out of order and clobber a newer selection.
	let managementBusy = $derived(
		activeViewStatus === 'loading' || createStatus === 'creating' || deleteStatus === 'deleting'
	);
	let createDisabled = $derived(newWatchlistName.trim().length === 0 || managementBusy);
	let activeWatchlistName = $derived(
		watchlists.find((watchlist) => watchlist.id === activeWatchlistId)?.name
	);

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
</script>

<div class="page">
	<header class="header">
		<h1>Watchlist</h1>
	</header>

	{#if metadataStatus === 'loading'}
		<p class="status">Loading watchlists…</p>
	{:else if metadataStatus === 'error'}
		<p class="status error">{metadataError?.message ?? 'Failed to load watchlists.'}</p>
	{:else}
		<section class="management">
			<form class="create-form" onsubmit={handleCreateSubmit}>
				<label class="create-label" for="new-watchlist-name">Watchlist name</label>
				<input
					id="new-watchlist-name"
					class="create-input"
					type="text"
					bind:value={newWatchlistName}
					disabled={managementBusy}
					autocomplete="off"
				/>
				<button
					type="submit"
					class="create-button"
					aria-label="Add watchlist"
					aria-busy={createStatus === 'creating'}
					disabled={createDisabled}
				>
					+
				</button>
			</form>

			{#if createError}
				<p class="status error" role="alert">Couldn't create watchlist: {createError.message}</p>
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
					class="delete-button"
					onclick={handleDeleteClick}
					disabled={watchlists.length === 0 || managementBusy}
					aria-busy={deleteStatus === 'deleting'}
				>
					Delete current watchlist
				</button>
			</div>

			{#if deleteError}
				<p class="status error" role="alert">Couldn't delete watchlist: {deleteError.message}</p>
			{/if}

			{#if tabSwitchError}
				<p class="status error" role="alert">
					Couldn't switch watchlist: {tabSwitchError.message}
				</p>
			{/if}
		</section>

		{#if watchlists.length === 0}
			<p class="status">No watchlist has been created yet.</p>
		{:else}
			<div class="content">
				{#if activeViewStatus === 'loading'}
					<p class="status">Loading watchlist…</p>
				{:else if activeViewStatus === 'error'}
					<p class="status error">{activeViewError?.message ?? 'Failed to load watchlist.'}</p>
				{:else if activeViewStatus === 'loaded' && activeView}
					{#each activeView.warnings as warning (warning.code)}
						<p class="status warning">{warning.message}</p>
					{/each}

					{#if activeView.stocks.length === 0}
						<p class="status">This watchlist is empty.</p>
					{:else}
						<h2>{activeView.name}</h2>
						<WatchlistTable stocks={activeView.stocks} />
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
		margin: 0;
	}

	.content {
		margin-top: 1rem;
	}

	.management {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.create-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.create-label {
		font-size: 0.9rem;
		color: #444;
	}

	.create-input {
		flex: 1 1 12rem;
		min-width: 0;
		padding: 0.5rem 0.6rem;
		border: 1px solid #b8b8b8;
		border-radius: 4px;
		font: inherit;
	}

	.create-button {
		flex: 0 0 auto;
		min-width: 2.5rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid #1a5fb4;
		border-radius: 4px;
		background: #1a5fb4;
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.create-button:disabled {
		cursor: default;
		opacity: 0.6;
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

	.delete-button {
		flex: 0 0 auto;
		padding: 0.5rem 0.9rem;
		border: 1px solid #b3261e;
		border-radius: 4px;
		background: #fff;
		color: #b3261e;
		font: inherit;
		cursor: pointer;
	}

	.delete-button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.status {
		color: #444;
	}

	.status.error {
		color: #b3261e;
	}

	.status.warning {
		color: #8a5a00;
	}
</style>
