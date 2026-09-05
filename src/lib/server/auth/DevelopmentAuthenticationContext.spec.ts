import { describe, expect, it } from 'vitest';
import {
	DEVELOPMENT_USER,
	DevelopmentAuthenticationContext
} from './DevelopmentAuthenticationContext';

describe('DevelopmentAuthenticationContext.getAuthenticatedUser', () => {
	it('returns the fixed synthetic development user', async () => {
		const context = new DevelopmentAuthenticationContext();

		const result = await context.getAuthenticatedUser();

		expect(result).toEqual({ status: 'authenticated', user: DEVELOPMENT_USER });
	});

	it('uses the stable local development user ID', async () => {
		const context = new DevelopmentAuthenticationContext();

		const result = await context.getAuthenticatedUser();

		expect(result).toMatchObject({ user: { id: 'local-development-user' } });
	});
});
