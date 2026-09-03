import type { AuthenticatedUser } from './AuthenticatedUser';

export type AuthenticationResult =
	| { status: 'authenticated'; user: AuthenticatedUser }
	/** No Cloudflare Access context, or Access returned no identity. */
	| { status: 'unauthenticated' }
	/** An Access context/identity exists, but its stable user identifier is missing/unusable. */
	| { status: 'invalid-identity' };

/**
 * Thrown only for a genuine retrieval failure (e.g. `getIdentity()` itself
 * throwing) — distinct from the routine `unauthenticated`/`invalid-identity`
 * results, which are expected outcomes callers handle via `AuthenticationResult`.
 */
export class AuthenticationError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'AuthenticationError';
	}
}

export interface AuthenticationContext {
	getAuthenticatedUser(): Promise<AuthenticationResult>;
}
