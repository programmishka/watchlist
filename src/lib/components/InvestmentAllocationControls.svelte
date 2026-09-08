<script lang="ts">
	import type { InvestmentAllocationResponse } from '$lib/client/watchlistApi';
	import { formatWholeEuro } from '$lib/client/format';
	import { TOTAL_SAVINGS_INPUT_MAX_LENGTH } from '$lib/shared/investmentSavings';

	interface Props {
		value: string;
		disabled: boolean;
		busy: boolean;
		// Distinct from `hasFeedback` below: only a locally-malformed value marks
		// the field itself invalid, matching the field's original behavior.
		inputInvalid: boolean;
		// True whenever either the local parse error or a server-reported
		// allocation error has a message to associate via `aria-describedby`.
		hasFeedback: boolean;
		result?: InvestmentAllocationResponse;
		onInput: (value: string) => void;
		onCalculate: (value: string) => void;
	}

	let { value, disabled, busy, inputInvalid, hasFeedback, result, onInput, onCalculate }: Props =
		$props();

	function handleInput(event: Event) {
		onInput((event.currentTarget as HTMLInputElement).value);
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (disabled) {
			return;
		}
		onCalculate(value);
	}
</script>

<form class="toolbar-group allocation-group" onsubmit={handleSubmit}>
	<label class="sr-only" for="total-savings">Total savings</label>
	<input
		id="total-savings"
		class="field-input allocation-input"
		type="text"
		inputmode="numeric"
		placeholder="Total savings"
		maxlength={TOTAL_SAVINGS_INPUT_MAX_LENGTH}
		{value}
		oninput={handleInput}
		aria-invalid={inputInvalid}
		aria-describedby={hasFeedback ? 'allocation-feedback' : undefined}
		{disabled}
		autocomplete="off"
	/>
	<button
		type="submit"
		class="btn btn-primary"
		aria-label="Calculate investment allocation"
		aria-busy={busy}
		{disabled}
	>
		Calculate
	</button>
	{#if result}
		<span class="allocation-result">Allocated savings: {formatWholeEuro(result.invested)}</span>
	{/if}
</form>

<style>
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
</style>
