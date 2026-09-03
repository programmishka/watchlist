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
