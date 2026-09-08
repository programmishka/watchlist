<script lang="ts">
	import { MAX_STOCK_SYMBOL_LENGTH } from '$lib/shared/stockSymbol';

	interface Props {
		value: string;
		disabled: boolean;
		busy: boolean;
		onInput: (value: string) => void;
		onAdd: (symbol: string) => void;
	}

	let { value, disabled, busy, onInput, onAdd }: Props = $props();

	let submitDisabled = $derived(value.trim().length === 0 || disabled);

	function handleInput(event: Event) {
		// Immediate uppercase UX (TASK-029 §24-25): only case is transformed
		// while typing; trimming/full syntax validation happens on submit.
		onInput((event.currentTarget as HTMLInputElement).value.toUpperCase());
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitDisabled) {
			return;
		}
		onAdd(value);
	}
</script>

<form class="toolbar-group stock-group" onsubmit={handleSubmit}>
	<label class="sr-only" for="new-stock-symbol">Stock symbol</label>
	<input
		id="new-stock-symbol"
		class="field-input stock-symbol-input"
		type="text"
		placeholder="Stock symbol"
		maxlength={MAX_STOCK_SYMBOL_LENGTH}
		{value}
		oninput={handleInput}
		{disabled}
		autocomplete="off"
	/>
	<button
		type="submit"
		class="btn btn-primary"
		aria-label="Add stock"
		aria-busy={busy}
		disabled={submitDisabled}
	>
		+
	</button>
</form>

<style>
	.stock-group {
		flex: 0 1 auto;
	}

	.stock-symbol-input {
		width: 11rem;
	}
</style>
