import type { AuthenticatedUser } from './AuthenticatedUser';

export type AuthenticationResult =
	| { status: 'authenticated'; user: AuthenticatedUser }
	/** No Access JWT header (production), or no `dev`-selected context available. */
	| { status: 'unauthenticated' }
	/** A verified identity exists, but its stable user identifier is missing/unusable. */
	| { status: 'invalid-identity' };

export interface AuthenticationContext {
	getAuthenticatedUser(): Promise<AuthenticationResult>;
}
