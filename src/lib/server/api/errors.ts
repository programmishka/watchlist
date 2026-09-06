/** Thrown by route code when `event.locals.user` is absent. Maps to HTTP 401. */
export class UnauthenticatedError extends Error {
	constructor() {
		super('Authentication is required.');
		this.name = 'UnauthenticatedError';
	}
}

/** Thrown for malformed JSON or a request body that fails structural validation. Maps to HTTP 400. */
export class InvalidRequestError extends Error {
	constructor(message = 'The request body is invalid.', options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'InvalidRequestError';
	}
}

/**
 * Thrown when a request body exceeds `MAX_JSON_REQUEST_BODY_BYTES`
 * (TASK-039), whether detected from `Content-Length` or from the actual
 * streamed byte count. Maps to HTTP 413.
 */
export class PayloadTooLargeError extends Error {
	constructor(message = 'Request body is too large.') {
		super(message);
		this.name = 'PayloadTooLargeError';
	}
}
