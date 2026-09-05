import type { AuthenticatedUser } from './AuthenticatedUser';
import type { AuthenticationContext, AuthenticationResult } from './AuthenticationContext';

/**
 * Fixed synthetic identity used only for local development (`npm run dev`).
 * Selection of this context happens exclusively through the trusted,
 * build-time `dev` flag in `hooks.server.ts` — never through request input
 * (see TASK-026 §38-41).
 */
export const DEVELOPMENT_USER: AuthenticatedUser = {
	id: 'local-development-user',
	email: 'developer@example.test'
};

export class DevelopmentAuthenticationContext implements AuthenticationContext {
	async getAuthenticatedUser(): Promise<AuthenticationResult> {
		return { status: 'authenticated', user: DEVELOPMENT_USER };
	}
}
