import { UnauthenticatedError } from './errors';

/** Returns the trusted, server-derived user ID, or throws `UnauthenticatedError` (mapped to HTTP 401). */
export function requireUserId(locals: App.Locals): string {
	if (!locals.user) {
		throw new UnauthenticatedError();
	}
	return locals.user.id;
}
