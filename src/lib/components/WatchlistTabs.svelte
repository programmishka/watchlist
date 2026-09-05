<script lang="ts">
	import type { WatchlistMetadata } from '$lib/client/watchlistApi';

	interface Props {
		watchlists: WatchlistMetadata[];
		activeWatchlistId?: string;
		disabled?: boolean;
		onSelect: (watchlistId: string) => void;
	}

	let { watchlists, activeWatchlistId, disabled = false, onSelect }: Props = $props();
</script>

<div class="tabs" role="tablist" aria-label="Watchlists">
	{#each watchlists as watchlist (watchlist.id)}
		<button
			type="button"
			role="tab"
			class="tab"
			class:active={watchlist.id === activeWatchlistId}
			aria-selected={watchlist.id === activeWatchlistId}
			{disabled}
			onclick={() => onSelect(watchlist.id)}
		>
			{watchlist.name}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		border-bottom: 1px solid #d0d0d0;
	}

	.tab {
		flex: 0 0 auto;
		min-height: 2.75rem;
		padding: 0.6rem 1rem;
		border: none;
		border-bottom: 3px solid transparent;
		background: transparent;
		font: inherit;
		color: inherit;
		white-space: nowrap;
		cursor: pointer;
	}

	.tab:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.tab:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.tab.active {
		border-bottom-color: var(--color-primary);
		font-weight: 600;
	}

	.tab:disabled {
		cursor: default;
		opacity: 0.6;
	}
</style>
