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
		defaultWatchlistShellApi,
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
		if (activeViewStatus === 'loading') {
			// A load is already in flight (initial or a previous switch); ignore
			// re-entrant clicks so responses can't resolve out of order and
			// clobber a newer selection.
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
</script>

<div class="page">
	<header class="header">
		<h1>Watchlist</h1>
	</header>

	{#if metadataStatus === 'loading'}
		<p class="status">Loading watchlists…</p>
	{:else if metadataStatus === 'error'}
		<p class="status error">{metadataError?.message ?? 'Failed to load watchlists.'}</p>
	{:else if watchlists.length === 0}
		<p class="status">No watchlist has been created yet.</p>
	{:else}
		<WatchlistTabs
			{watchlists}
			{activeWatchlistId}
			disabled={activeViewStatus === 'loading'}
			onSelect={handleSelectTab}
		/>

		{#if tabSwitchError}
			<p class="status error" role="alert">
				Couldn't switch watchlist: {tabSwitchError.message}
			</p>
		{/if}

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
