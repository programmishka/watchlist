import type {
	InvestmentAllocationResponse,
	WatchlistApiError,
	WatchlistMetadata,
	WatchlistView
} from './watchlistApi';
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
	switchActiveWatchlist,
	type WatchlistShellApi
} from './watchlistShell';
import { filterStocksByCompanyName, formatStockCount } from './watchlistFilter';
import {
	DEFAULT_WATCHLIST_SORT,
	sortWatchlistStocks,
	toggleWatchlistSort,
	type WatchlistSort,
	type WatchlistSortColumn
} from './watchlistSort';
import { allocationBySymbol as buildAllocationBySymbol } from './investmentAllocation';
import { parseTotalSavingsInput } from './investmentSavingsInput';
import type { TargetPriceSaveResult } from '$lib/components/TargetPriceCell.svelte';

export type MetadataStatus = 'loading' | 'loaded' | 'error';
export type ActiveViewStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Owns the reactive state and lifecycle of one rendered Watchlist workspace
 * (TASK-044) and coordinates the existing stateless `watchlistShell`
 * operations into consistent page-state transitions.
 *
 * SSR/per-instance rule: a `WatchlistWorkspace` MUST be constructed fresh for
 * every rendered page instance (see `+page.svelte`) and MUST NEVER be
 * exported as an already-constructed module-level singleton. Doing so would
 * leak reactive state across SSR requests, concurrent page instances, and
 * tests.
 */
export class WatchlistWorkspace {
	private readonly api: WatchlistShellApi;

	// Server-derived client state.
	watchlists: WatchlistMetadata[] = $state([]);
	activeWatchlistId: string | undefined = $state(undefined);
	metadataStatus: MetadataStatus = $state('loading');
	metadataError: WatchlistApiError | undefined = $state(undefined);

	activeView: WatchlistView | undefined = $state(undefined);
	activeViewStatus: ActiveViewStatus = $state('idle');
	activeViewError: WatchlistApiError | undefined = $state(undefined);

	tabSwitchError: WatchlistApiError | undefined = $state(undefined);

	// Form draft state whose lifecycle is coupled to workflow success/failure
	// (redisplay-on-invalid, reset-on-success), not purely presentational.
	newWatchlistName = $state('');
	newStockSymbol = $state('');
	totalSavingsInput = $state('');

	// Operation/error state, one pair per workflow (TASK-044 §22-27).
	createStatus: 'idle' | 'creating' = $state('idle');
	createError: WatchlistApiError | undefined = $state(undefined);

	deleteStatus: 'idle' | 'deleting' = $state('idle');
	deleteError: WatchlistApiError | undefined = $state(undefined);

	stockMutationBusy = $state(false);
	stockMutationError: WatchlistApiError | undefined = $state(undefined);
	// Local syntax-validation feedback (TASK-029 §26/§29), distinct from a
	// server-reported mutation error; takes precedence when both are set.
	stockSymbolValidationError: string | undefined = $state(undefined);

	targetPriceMutationBusy = $state(false);

	// Workspace UI state: presentation-only, never sent to the server, and
	// reset together whenever the active Watchlist itself changes (§46-48).
	companyNameFilter = $state('');
	sort: WatchlistSort = $state(DEFAULT_WATCHLIST_SORT);

	allocationInputError: string | undefined = $state(undefined);
	// Transient server result retained client-side; invalidated by several
	// mutation workflows below (§41-45) rather than persisted or automatically
	// recalculated.
	investmentAllocation: InvestmentAllocationResponse | undefined = $state(undefined);
	allocationBusy = $state(false);
	allocationError: WatchlistApiError | undefined = $state(undefined);

	// Any in-flight mutation or content load blocks other management actions
	// so responses can't resolve out of order and clobber a newer selection.
	managementBusy = $derived(
		this.activeViewStatus === 'loading' ||
			this.createStatus === 'creating' ||
			this.deleteStatus === 'deleting' ||
			this.stockMutationBusy ||
			this.targetPriceMutationBusy ||
			this.allocationBusy
	);

	createDisabled = $derived(this.newWatchlistName.trim().length === 0 || this.managementBusy);

	activeWatchlistName = $derived(
		this.watchlists.find((watchlist) => watchlist.id === this.activeWatchlistId)?.name
	);

	isFiltered = $derived(this.companyNameFilter.trim().length > 0);

	filteredStocks = $derived(
		this.activeView ? filterStocksByCompanyName(this.activeView.stocks, this.companyNameFilter) : []
	);

	visibleStocks = $derived(sortWatchlistStocks(this.filteredStocks, this.sort));

	totalStockCount = $derived(this.activeView?.stocks.length ?? 0);

	stockCountText = $derived(
		formatStockCount(this.totalStockCount, this.filteredStocks.length, this.isFiltered)
	);

	allocationBySymbol = $derived(buildAllocationBySymbol(this.investmentAllocation));

	constructor(api: WatchlistShellApi = defaultWatchlistShellApi) {
		this.api = api;
	}

	/**
	 * Shared active-Watchlist-view loading/loaded/error handler shape used
	 * identically by `load`/`selectWatchlist`/`createWatchlist`/
	 * `deleteWatchlist` below (TASK-044 §73: a small internal lifecycle helper,
	 * not a generic mutation-runner).
	 */
	private activeWatchlistLoadHandlers() {
		return {
			onActiveWatchlistLoading: () => {
				this.activeViewStatus = 'loading';
				this.activeViewError = undefined;
			},
			onActiveWatchlistLoaded: (view: WatchlistView) => {
				this.activeView = view;
				this.activeViewStatus = 'loaded';
				this.activeViewError = undefined;
			},
			onActiveWatchlistError: (error: WatchlistApiError) => {
				this.activeView = undefined;
				this.activeViewStatus = 'error';
				this.activeViewError = error;
			}
		};
	}

	/**
	 * Centralizes the coupled consequence of a successful active-Watchlist
	 * transition (TASK-044 §46-48): filter reset, sort reset to Name
	 * ascending, and allocation invalidation. Applied only from success paths;
	 * never from a failed transition.
	 */
	private applyActiveWatchlistTransitionReset(): void {
		this.companyNameFilter = '';
		this.sort = DEFAULT_WATCHLIST_SORT;
		this.investmentAllocation = undefined;
	}

	load = (): Promise<void> => {
		return loadInitialWatchlists(this.api, {
			onMetadataLoading: () => {
				this.metadataStatus = 'loading';
				this.metadataError = undefined;
			},
			onMetadataLoaded: (response, initialActiveWatchlistId) => {
				this.watchlists = response.watchlists;
				this.activeWatchlistId = initialActiveWatchlistId;
				this.metadataStatus = 'loaded';
			},
			onMetadataError: (error) => {
				this.metadataStatus = 'error';
				this.metadataError = error;
			},
			...this.activeWatchlistLoadHandlers()
		});
	};

	selectWatchlist = (watchlistId: string): Promise<void> => {
		if (this.managementBusy) {
			return Promise.resolve();
		}

		const previousStatus = this.activeViewStatus;
		const previousError = this.activeViewError;

		return switchActiveWatchlist(this.api, watchlistId, this.activeWatchlistId, {
			onSwitching: () => {
				this.tabSwitchError = undefined;
				this.activeViewStatus = 'loading';
			},
			onSelectionFailed: (error) => {
				this.tabSwitchError = error;
				this.activeViewStatus = previousStatus;
				this.activeViewError = previousError;
			},
			onSelected: (response) => {
				this.watchlists = response.watchlists;
				this.activeWatchlistId = watchlistId;
				this.applyActiveWatchlistTransitionReset();
			},
			...this.activeWatchlistLoadHandlers()
		});
	};

	createWatchlist = (): Promise<void> => {
		if (this.createDisabled) {
			return Promise.resolve();
		}

		return createWatchlistAndActivate(this.api, this.newWatchlistName, {
			onCreating: () => {
				this.createStatus = 'creating';
				this.createError = undefined;
			},
			onCreateFailed: (error) => {
				this.createStatus = 'idle';
				this.createError = error;
			},
			onCreated: (response, newActiveWatchlistId) => {
				this.watchlists = response.watchlists;
				this.activeWatchlistId = newActiveWatchlistId;
				this.newWatchlistName = '';
				this.createStatus = 'idle';
				this.applyActiveWatchlistTransitionReset();
			},
			...this.activeWatchlistLoadHandlers()
		});
	};

	deleteWatchlist = (): Promise<void> => {
		if (this.watchlists.length === 0 || this.managementBusy) {
			return Promise.resolve();
		}

		return deleteActiveWatchlistAndTransition(this.api, {
			onDeleting: () => {
				this.deleteStatus = 'deleting';
				this.deleteError = undefined;
			},
			onDeleteFailed: (error) => {
				this.deleteStatus = 'idle';
				this.deleteError = error;
			},
			onDeleted: (response) => {
				this.watchlists = response.watchlists;
				this.activeWatchlistId = response.activeWatchlistId;
				this.deleteStatus = 'idle';
				this.applyActiveWatchlistTransitionReset();
			},
			onNoWatchlistsRemaining: () => {
				this.activeView = undefined;
				this.activeViewStatus = 'idle';
				this.activeViewError = undefined;
			},
			...this.activeWatchlistLoadHandlers()
		});
	};

	addStock = (symbol: string): Promise<void> => {
		if (!this.activeWatchlistId || this.managementBusy) {
			return Promise.resolve();
		}

		return addStockToActiveWatchlist(this.api, this.activeWatchlistId, symbol, {
			onInvalidSymbol: (normalizedSymbol) => {
				this.newStockSymbol = normalizedSymbol;
				this.stockMutationError = undefined;
				this.stockSymbolValidationError = INVALID_STOCK_SYMBOL_MESSAGE;
			},
			onAdding: () => {
				this.stockSymbolValidationError = undefined;
				this.stockMutationBusy = true;
				this.stockMutationError = undefined;
			},
			onAdded: (view) => {
				this.activeView = view;
				this.newStockSymbol = '';
				this.stockMutationBusy = false;
				this.investmentAllocation = undefined;
			},
			onAddFailed: (error) => {
				this.stockMutationBusy = false;
				this.stockMutationError = error;
			}
		});
	};

	removeStock = (symbol: string): Promise<void> => {
		if (!this.activeWatchlistId || this.managementBusy) {
			return Promise.resolve();
		}

		return removeStockFromActiveWatchlist(this.api, this.activeWatchlistId, symbol, {
			onRemoving: () => {
				this.stockMutationBusy = true;
				this.stockMutationError = undefined;
			},
			onRemoved: (view) => {
				this.activeView = view;
				this.stockMutationBusy = false;
				this.investmentAllocation = undefined;
			},
			onRemoveFailed: (error) => {
				this.stockMutationBusy = false;
				this.stockMutationError = error;
			}
		});
	};

	saveTargetPrice = (symbol: string, targetPrice: number): Promise<TargetPriceSaveResult> => {
		const view = this.activeView;
		if (!view) {
			return Promise.resolve({ ok: false, message: 'No active watchlist is loaded.' });
		}

		return new Promise((resolve) => {
			setTargetPriceForActiveStock(this.api, view, symbol, targetPrice, {
				onSaving: () => {
					this.targetPriceMutationBusy = true;
				},
				onSaved: (updatedView, marketDataWarningMessage) => {
					this.activeView = updatedView;
					this.targetPriceMutationBusy = false;
					// The Target Price itself changed even when the distance refresh
					// warned (TASK-024 §38), so the allocation is invalidated either way.
					this.investmentAllocation = undefined;
					resolve({ ok: true, warningMessage: marketDataWarningMessage });
				},
				onSaveFailed: (error) => {
					this.targetPriceMutationBusy = false;
					resolve({ ok: false, message: error.message });
				}
			});
		});
	};

	calculateAllocation = (rawTotalSavingsInput: string): Promise<void> => {
		if (!this.activeWatchlistId || this.managementBusy) {
			return Promise.resolve();
		}

		const totalSavings = parseTotalSavingsInput(rawTotalSavingsInput);
		if (totalSavings === undefined) {
			this.allocationInputError = 'Enter a whole number of Euros, 0 or greater.';
			return Promise.resolve();
		}
		this.allocationInputError = undefined;

		return calculateInvestmentAllocationForActiveWatchlist(
			this.api,
			this.activeWatchlistId,
			totalSavings,
			{
				onCalculating: () => {
					this.allocationBusy = true;
					this.allocationError = undefined;
				},
				onCalculated: (result) => {
					this.investmentAllocation = result;
					this.allocationBusy = false;
				},
				onCalculationFailed: (error) => {
					this.allocationBusy = false;
					this.allocationError = error;
				}
			}
		);
	};

	changeSort = (column: WatchlistSortColumn): void => {
		this.sort = toggleWatchlistSort(this.sort, column);
	};
}
