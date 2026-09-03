import { assertValidUserId } from '../persistence/UserId';
import type { AuthenticatedUser } from './AuthenticatedUser';
import {
	AuthenticationError,
	type AuthenticationContext,
	type AuthenticationResult
} from './AuthenticationContext';

/**
 * The minimal slice of Cloudflare's identity shape this context depends on,
 * declared locally rather than importing the runtime's `CloudflareAccessIdentity`
 * type so the raw Cloudflare identity object never leaks into the application
 * contract. The real identity returned by `ctx.access.getIdentity()` (which
 * has many more optional/provider-specific fields) satisfies this structurally.
 */
interface AccessIdentityLike {
	user_uuid?: string;
	email?: string;
}

/** The minimal slice of Cloudflare's `ExecutionContext.access` this context depends on. */
export interface AccessContextLike {
	getIdentity(): Promise<AccessIdentityLike | undefined>;
}

export class CloudflareAccessAuthenticationContext implements AuthenticationContext {
	constructor(private readonly accessContext: AccessContextLike | undefined) {}

	async getAuthenticatedUser(): Promise<AuthenticationResult> {
		if (!this.accessContext) {
			return { status: 'unauthenticated' };
		}

		let identity: AccessIdentityLike | undefined;
		try {
			identity = await this.accessContext.getIdentity();
		} catch (error) {
			throw new AuthenticationError('Failed to retrieve Cloudflare Access identity', {
				cause: error
			});
		}

		if (!identity) {
			return { status: 'unauthenticated' };
		}

		if (identity.user_uuid === undefined) {
			return { status: 'invalid-identity' };
		}

		try {
			assertValidUserId(identity.user_uuid);
		} catch {
			return { status: 'invalid-identity' };
		}

		const user: AuthenticatedUser = { id: identity.user_uuid, email: identity.email };
		return { status: 'authenticated', user };
	}
}
