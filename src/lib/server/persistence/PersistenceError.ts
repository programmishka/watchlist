/**
 * Thrown for infrastructure/corruption failures: a KV read/write failure,
 * malformed JSON, or a persisted document with an invalid shape. Distinct
 * from a missing KV key, which maps to the legitimate empty document state
 * instead of an error.
 */
export class PersistenceError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'PersistenceError';
	}
}
