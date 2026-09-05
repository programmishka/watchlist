import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { DevelopmentAuthenticationContext } from '$lib/server/auth/DevelopmentAuthenticationContext';
import { createCloudflareAccessJwtAuthenticationContext } from '$lib/server/auth/CloudflareAccessJwtAuthenticationContext';
import type { AuthenticationContext } from '$lib/server/auth/AuthenticationContext';

/**
 * `dev` is a build-time constant (true only for `npm run dev`'s Vite dev
 * server) — it cannot be influenced by request headers, cookies, or query
 * parameters, which is what makes it safe as the local/production
 * authentication switch (TASK-026 §38-41).
 */
export function selectAuthenticationContext(
	event: Parameters<Handle>[0]['event']
): AuthenticationContext {
	if (dev) {
		return new DevelopmentAuthenticationContext();
	}
	return createCloudflareAccessJwtAuthenticationContext(event.request, event.platform?.env);
}

export const handle: Handle = async ({ event, resolve }) => {
	const authenticationContext = selectAuthenticationContext(event);
	const result = await authenticationContext.getAuthenticatedUser();

	event.locals.user = result.status === 'authenticated' ? result.user : undefined;

	return resolve(event);
};
