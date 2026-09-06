<script lang="ts">
	import type { WatchlistMetadata } from '$lib/client/watchlistApi';

	interface Props {
		watchlists: WatchlistMetadata[];
		activeWatchlistId?: string;
		disabled?: boolean;
		deleteBusy?: boolean;
		onSelect: (watchlistId: string) => void;
		onDeleteActive: () => void;
	}

	let {
		watchlists,
		activeWatchlistId,
		disabled = false,
		deleteBusy = false,
		onSelect,
		onDeleteActive
	}: Props = $props();
</script>

<div class="tabs" role="tablist" aria-label="Watchlists">
	{#each watchlists as watchlist (watchlist.id)}
		{@const isActive = watchlist.id === activeWatchlistId}
		<!--
			The active-tab delete control is a sibling of the `role="tab"` button
			rather than nested inside it (TASK-034 §64): a button cannot legally
			contain another interactive button, and nesting one would also make
			the delete click also select the tab.
		-->
		<span class="tab-item" class:active={isActive}>
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={isActive}
				aria-selected={isActive}
				{disabled}
				onclick={() => onSelect(watchlist.id)}
			>
				{watchlist.name}
			</button>
			{#if isActive}
				<button
					type="button"
					class="btn btn-destructive btn-icon tab-delete"
					aria-label={`Remove watchlist "${watchlist.name}"`}
					aria-busy={deleteBusy}
					disabled={disabled || deleteBusy}
					onclick={onDeleteActive}
				>
					×
				</button>
			{/if}
		</span>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow-x: auto;
		border-bottom: 1px solid #d0d0d0;
	}

	.tab-item {
		display: flex;
		align-items: center;
		flex: 0 0 auto;
		gap: 0.2rem;
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

	.tab-delete {
		flex: 0 0 auto;
		margin-inline-end: 0.35rem;
		border-radius: 999px;
	}
</style>
