/**
 * Stable, machine-readable diagnostic event names (TASK-040). Kept to the
 * smallest set that lets production logs answer "why did this stock field
 * become unavailable?" — see ARCHITECTURE.md's diagnostics section.
 */
export type DiagnosticEventName =
	| 'market_data_incomplete'
	| 'market_data_provider_failure'
	| 'market_cap_conversion_unavailable'
	| 'fx_provider_failure'
	| 'market_data_composition_anomaly';

/**
 * Structured diagnostic context. Deliberately excludes anything that could
 * carry authentication material, user identity, or a complete
 * Watchlist/provider response — see ARCHITECTURE.md's sensitive-data rule.
 * Every field here is small and bounded (a symbol, a currency code, a short
 * reason string, ...), never an arbitrary/unbounded payload.
 */
export interface DiagnosticContext {
	symbol?: string;
	provider?: string;
	operation?: string;
	missingFields?: string[];
	currency?: string;
	fromCurrency?: string;
	toCurrency?: string;
	currencies?: string[];
	reason?: string;
	errorCategory?: string;
	errorMessage?: string;
}

/**
 * Small server-side anomaly-diagnostics boundary. Intentionally not a
 * general-purpose logging framework (no levels beyond warn/error, no
 * transports, no hierarchy) — see TASK-040. Normal successful provider/FX/
 * composition operations must never be logged through this boundary; only
 * anomalous or unavailable conditions.
 */
export interface DiagnosticLogger {
	/** Expected partial-data conditions (missing field/rate) — not application errors. */
	warn(event: DiagnosticEventName, context: DiagnosticContext): void;
	/** Unexpected provider/application failures or composition anomalies. */
	error(event: DiagnosticEventName, context: DiagnosticContext): void;
}

/**
 * Production sink. Cloudflare Workers captures `console.warn`/`console.error`
 * output directly into Workers Logs — no external logging dependency is
 * needed (see ARCHITECTURE.md/README.md). Passing `context` as a structured
 * object, rather than interpolating it into the message string, keeps
 * diagnostics queryable instead of requiring log-string parsing.
 */
export class ConsoleDiagnosticLogger implements DiagnosticLogger {
	warn(event: DiagnosticEventName, context: DiagnosticContext): void {
		console.warn(event, context);
	}

	error(event: DiagnosticEventName, context: DiagnosticContext): void {
		console.error(event, context);
	}
}

/** Default for services/tests that don't care about diagnostics output. */
export class NoopDiagnosticLogger implements DiagnosticLogger {
	warn(): void {}
	error(): void {}
}

const MAX_DIAGNOSTIC_ERROR_MESSAGE_LENGTH = 200;

/**
 * Sanitized, length-bounded error summary for diagnostic context (§28/§76-77
 * of TASK-040) — never the full error object/stack, so an unexpectedly large
 * or unusual upstream error can't reach production logs unbounded.
 */
export function describeProviderError(error: unknown): {
	errorCategory: string;
	errorMessage: string;
} {
	if (error instanceof Error) {
		return {
			errorCategory: error.name || error.constructor.name,
			errorMessage: error.message.slice(0, MAX_DIAGNOSTIC_ERROR_MESSAGE_LENGTH)
		};
	}
	return {
		errorCategory: 'UnknownError',
		errorMessage: String(error).slice(0, MAX_DIAGNOSTIC_ERROR_MESSAGE_LENGTH)
	};
}
