<script lang="ts">
	import { browser } from '$app/environment';
	import type { WatchlistMetadata } from '$lib/client/watchlistApi';
	import {
		MEDIUM_NAVIGATION_BREAKPOINT_PX,
		WIDE_NAVIGATION_BREAKPOINT_PX,
		navigationCapacityForWidth,
		partitionWatchlistsForNavigation
	} from '$lib/client/watchlistNavigation';

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

	// Responsive direct-tab capacity (TASK-035 §58-60): derived from viewport
	// width via `matchMedia`, guarded so it never runs during SSR. Resizing
	// across a breakpoint only recomputes this client-side presentation
	// state; it never issues a server request.
	function currentCapacity(): number {
		if (!browser) {
			return navigationCapacityForWidth(WIDE_NAVIGATION_BREAKPOINT_PX);
		}
		return navigationCapacityForWidth(window.innerWidth);
	}

	let capacity = $state(currentCapacity());

	$effect(() => {
		if (!browser) {
			return;
		}
		const mediumQuery = window.matchMedia(`(min-width: ${MEDIUM_NAVIGATION_BREAKPOINT_PX}px)`);
		const wideQuery = window.matchMedia(`(min-width: ${WIDE_NAVIGATION_BREAKPOINT_PX}px)`);
		const update = () => {
			capacity = currentCapacity();
		};
		mediumQuery.addEventListener('change', update);
		wideQuery.addEventListener('change', update);
		return () => {
			mediumQuery.removeEventListener('change', update);
			wideQuery.removeEventListener('change', update);
		};
	});

	let partition = $derived(
		partitionWatchlistsForNavigation(watchlists, activeWatchlistId, capacity)
	);
	// "Watchlists" is used whenever only the active Watchlist is directly
	// visible (the mobile case, TASK-035 §34); "More" otherwise.
	let overflowLabel = $derived(capacity <= 1 ? 'Watchlists' : 'More');

	let detailsEl: HTMLDetailsElement | undefined = $state();

	// The browser fully owns the native open/closed state (no `overflowOpen`
	// reactive mirror): a keyboard-triggered (Space/Enter) native toggle
	// flips the DOM `open` property synchronously, but the corresponding
	// `toggle` event fires on a separately queued task shortly after (per the
	// HTML `<details>` spec). Mirroring that event into Svelte state and
	// driving `open` back down via a reactive binding created a race where
	// the delayed event could re-open the element immediately after an
	// explicit close. Closing imperatively via the DOM property instead has
	// no such race.
	function closeOverflow() {
		if (detailsEl) {
			detailsEl.open = false;
		}
	}

	function handleSummaryClick(event: MouseEvent) {
		if (disabled) {
			event.preventDefault();
		}
	}

	function handleOverflowSelect(watchlistId: string) {
		closeOverflow();
		onSelect(watchlistId);
	}

	function handleWindowClick(event: MouseEvent) {
		if (detailsEl?.open && !detailsEl.contains(event.target as Node)) {
			closeOverflow();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (detailsEl?.open && event.key === 'Escape') {
			closeOverflow();
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="navigation">
	<div class="tabs" role="tablist" aria-label="Watchlists">
		{#each partition.visible as watchlist (watchlist.id)}
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
					title={watchlist.name}
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

	<!--
		Overflow disclosure (TASK-035 §5, §36, §43): a native details/summary
		disclosure kept outside the tablist above, since it is not itself a
		Watchlist tab. Only rendered when at least one Watchlist doesn't fit
		directly (§35).
	-->
	{#if partition.overflow.length > 0}
		<details class="overflow" bind:this={detailsEl}>
			<!--
				`<summary>`'s implicit role is spec'd as "button", but verified
				Chromium accessibility-tree output does not expose it as a
				queryable button role; the explicit role below keeps the control
				reliably reachable by role-based tooling.
			-->
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<summary
				class="overflow-toggle"
				role="button"
				aria-disabled={disabled}
				onclick={handleSummaryClick}
			>
				{overflowLabel}<span aria-hidden="true"> ▾</span>
			</summary>
			<ul class="overflow-menu">
				{#each partition.overflow as watchlist (watchlist.id)}
					<li>
						<button
							type="button"
							class="overflow-item"
							{disabled}
							onclick={() => handleOverflowSelect(watchlist.id)}
						>
							{watchlist.name}
						</button>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.navigation {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.4rem;
		min-width: 0;
	}

	.tabs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-width: 0;
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
		max-width: 12rem;
		padding: 0.6rem 1rem;
		border: none;
		border-bottom: 3px solid transparent;
		background: transparent;
		font: inherit;
		color: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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

	/* Delete-button geometry/centering fix (TASK-035 §24-26): an explicit
	   equal width/height grid with no padding, rather than relying on
	   line-height/padding to visually center the glyph. */
	.tab-delete {
		flex: 0 0 auto;
		display: inline-grid;
		place-items: center;
		width: 1.85rem;
		height: 1.85rem;
		padding: 0;
		margin-inline-end: 0.35rem;
		border-radius: 999px;
		line-height: 1;
	}

	.overflow {
		position: relative;
		flex: 0 0 auto;
	}

	.overflow-toggle {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: #fff;
		font: inherit;
		font-weight: 600;
		color: inherit;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.overflow-toggle::-webkit-details-marker {
		display: none;
	}

	.overflow-toggle:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.overflow-toggle:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.overflow-toggle[aria-disabled='true'] {
		cursor: default;
		opacity: 0.6;
	}

	.overflow-menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.25rem);
		left: 0;
		min-width: 12rem;
		max-width: min(20rem, 90vw);
		max-height: 60vh;
		overflow-y: auto;
		margin: 0;
		padding: 0.25rem;
		list-style: none;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.overflow-item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: none;
		border-radius: var(--radius);
		background: transparent;
		font: inherit;
		color: inherit;
		text-align: left;
		white-space: normal;
		overflow-wrap: break-word;
		cursor: pointer;
	}

	.overflow-item:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.05);
	}

	.overflow-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.overflow-item:disabled {
		cursor: default;
		opacity: 0.6;
	}
</style>
