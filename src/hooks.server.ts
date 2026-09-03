import type { Handle } from '@sveltejs/kit';
import { CloudflareAccessAuthenticationContext } from '$lib/server/auth/CloudflareAccessAuthenticationContext';

export const handle: Handle = async ({ event, resolve }) => {
	const authenticationContext = new CloudflareAccessAuthenticationContext(
		event.platform?.ctx.access
	);
	const result = await authenticationContext.getAuthenticatedUser();

	event.locals.user = result.status === 'authenticated' ? result.user : undefined;

	return resolve(event);
};
