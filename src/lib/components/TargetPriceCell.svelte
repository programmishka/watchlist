<script lang="ts">
	import { parseTargetPriceInput } from '$lib/client/targetPriceInput';

	export type TargetPriceSaveResult =
		{ ok: true; warningMessage?: string } | { ok: false; message: string };

	interface Props {
		symbol: string;
		targetPrice?: number;
		busy?: boolean;
		onSave: (symbol: string, targetPrice: number) => Promise<TargetPriceSaveResult>;
	}

	let { symbol, targetPrice, busy = false, onSave }: Props = $props();

	function formatForInput(value: number | undefined): string {
		return value === undefined ? '' : String(value);
	}

	let inputValue = $state('');
	let committedValue = $state<number | undefined>(undefined);
	let saving = $state(false);
	let errorMessage = $state<string | undefined>(undefined);
	let warningMessage = $state<string | undefined>(undefined);

	// Resyncs local editable state (including on mount) when the
	// server-confirmed value changes, e.g. after this row's own successful
	// save (TASK-021 §22).
	$effect(() => {
		inputValue = formatForInput(targetPrice);
		committedValue = targetPrice;
	});

	let feedbackId = $derived(`target-price-feedback-${symbol}`);
	let feedback = $derived(errorMessage ?? warningMessage);

	async function commit() {
		if (saving) {
			return;
		}

		const parsed = parseTargetPriceInput(inputValue);
		if (parsed === undefined) {
			const isEmpty = inputValue.trim().length === 0;
			if (isEmpty && committedValue === undefined) {
				// Started and remains empty: nothing was entered, so there is nothing to validate.
				return;
			}
			errorMessage = 'Enter a target price greater than 0, e.g. 200 or 200,5.';
			warningMessage = undefined;
			return;
		}

		errorMessage = undefined;
		warningMessage = undefined;

		if (parsed === committedValue) {
			return;
		}

		saving = true;
		try {
			const result = await onSave(symbol, parsed);
			if (result.ok) {
				warningMessage = result.warningMessage;
			} else {
				errorMessage = result.message;
			}
		} finally {
			saving = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<input
	type="text"
	inputmode="decimal"
	class="target-price-input"
	aria-label={`Target price for ${symbol}`}
	aria-invalid={errorMessage !== undefined}
	aria-describedby={feedback ? feedbackId : undefined}
	aria-busy={saving}
	disabled={busy || saving}
	bind:value={inputValue}
	onblur={commit}
	onkeydown={handleKeydown}
/>
{#if errorMessage}
	<p id={feedbackId} class="target-price-feedback error" role="alert">{errorMessage}</p>
{:else if warningMessage}
	<p id={feedbackId} class="target-price-feedback warning">{warningMessage}</p>
{/if}

<style>
	.target-price-input {
		width: 5.5rem;
		max-width: 100%;
		padding: 0.35rem 0.5rem;
		border: 1px solid #b8b8b8;
		border-radius: 4px;
		font: inherit;
		text-align: right;
	}

	.target-price-input[aria-invalid='true'] {
		border-color: #b3261e;
	}

	.target-price-input:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.target-price-feedback {
		margin: 0.25rem 0 0;
		white-space: normal;
		text-align: left;
		font-size: 0.8rem;
		max-width: 12rem;
	}

	.target-price-feedback.error {
		color: #b3261e;
	}

	.target-price-feedback.warning {
		color: #8a5a00;
	}
</style>
