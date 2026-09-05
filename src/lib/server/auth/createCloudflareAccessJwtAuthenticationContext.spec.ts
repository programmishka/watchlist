import { describe, expect, it, vi } from 'vitest';
import { createCloudflareAccessJwtAuthenticationContext } from './CloudflareAccessJwtAuthenticationContext';

function requestWithToken(token: string): Request {
	return new Request('https://watchlist.example.test/api/watchlists', {
		headers: { 'Cf-Access-Jwt-Assertion': token }
	});
}

describe('createCloudflareAccessJwtAuthenticationContext', () => {
	it('fails closed when env is undefined', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const context = createCloudflareAccessJwtAuthenticationContext(
			requestWithToken('irrelevant'),
			undefined
		);

		expect(await context.getAuthenticatedUser()).toEqual({ status: 'unauthenticated' });
		consoleError.mockRestore();
	});

	it('fails closed when ACCESS_TEAM_DOMAIN is missing', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const context = createCloudflareAccessJwtAuthenticationContext(requestWithToken('irrelevant'), {
			ACCESS_AUD: 'some-audience'
		});

		expect(await context.getAuthenticatedUser()).toEqual({ status: 'unauthenticated' });
		consoleError.mockRestore();
	});

	it('fails closed when ACCESS_AUD is missing', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const context = createCloudflareAccessJwtAuthenticationContext(requestWithToken('irrelevant'), {
			ACCESS_TEAM_DOMAIN: 'https://test-team.cloudflareaccess.com'
		});

		expect(await context.getAuthenticatedUser()).toEqual({ status: 'unauthenticated' });
		consoleError.mockRestore();
	});

	it('never falls back to an authenticated result when configuration is missing, regardless of a request-supplied token', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const context = createCloudflareAccessJwtAuthenticationContext(
			requestWithToken('not-a-real-jwt-but-should-be-irrelevant'),
			undefined
		);
		const result = await context.getAuthenticatedUser();

		expect(result.status).not.toBe('authenticated');
		consoleError.mockRestore();
	});
});
