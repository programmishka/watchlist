import { describe, expect, it, vi } from 'vitest';
import type { Handle } from '@sveltejs/kit';

/**
 * `DevelopmentAuthenticationContext` is re-imported here (rather than
 * statically at the top of this file) so that after `vi.resetModules()` it
 * comes from the same fresh module registry entry as the one
 * `./hooks.server` sees — otherwise `instanceof` would compare two distinct
 * class objects and fail even when the selection logic is correct.
 */
async function importHooksWithDevFlag(devValue: boolean) {
	vi.resetModules();
	vi.doMock('$app/environment', () => ({ dev: devValue }));
	const [hooks, developmentAuth] = await Promise.all([
		import('./hooks.server'),
		import('$lib/server/auth/DevelopmentAuthenticationContext')
	]);
	return {
		...hooks,
		DevelopmentAuthenticationContext: developmentAuth.DevelopmentAuthenticationContext
	};
}

function fakeEvent(request: Request): Parameters<Handle>[0]['event'] {
	return { request, platform: undefined } as unknown as Parameters<Handle>[0]['event'];
}

describe('selectAuthenticationContext (local/production selection)', () => {
	it('selects DevelopmentAuthenticationContext when the build-time dev flag is true', async () => {
		const { selectAuthenticationContext, DevelopmentAuthenticationContext } =
			await importHooksWithDevFlag(true);

		const request = new Request('https://watchlist.example.test/');
		const context = selectAuthenticationContext(fakeEvent(request));

		expect(context).toBeInstanceOf(DevelopmentAuthenticationContext);
	});

	it('ignores request-controlled bypass attempts and still selects the production context when dev is false', async () => {
		const { selectAuthenticationContext, DevelopmentAuthenticationContext } =
			await importHooksWithDevFlag(false);

		const request = new Request('https://watchlist.example.test/?dev=true&local=true', {
			headers: { 'X-Development-User': 'true', 'X-Debug-Auth': 'true' }
		});
		const context = selectAuthenticationContext(fakeEvent(request));

		expect(context).not.toBeInstanceOf(DevelopmentAuthenticationContext);
	});

	it('never returns the development user through the production path, even with an attempted bypass header and a fake token', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { selectAuthenticationContext } = await importHooksWithDevFlag(false);

		const request = new Request('https://watchlist.example.test/?dev=true', {
			headers: {
				'X-Development-User': 'local-development-user',
				'Cf-Access-Jwt-Assertion': 'not-a-real-jwt'
			}
		});
		const context = selectAuthenticationContext(fakeEvent(request));
		const result = await context.getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
		consoleError.mockRestore();
	});
});
