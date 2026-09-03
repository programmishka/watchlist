import { describe, expect, it } from 'vitest';
import {
	CloudflareAccessAuthenticationContext,
	type AccessContextLike
} from './CloudflareAccessAuthenticationContext';
import { AuthenticationError } from './AuthenticationContext';

function fakeAccessContext(getIdentity: AccessContextLike['getIdentity']): AccessContextLike {
	return { getIdentity };
}

describe('CloudflareAccessAuthenticationContext.getAuthenticatedUser', () => {
	it('returns an authenticated user for a valid identity', async () => {
		const accessContext = fakeAccessContext(async () => ({
			user_uuid: 'ce40d564-c72f-475f-a9b8-f395f19ad986',
			email: 'developer@example.test'
		}));
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		const result = await authenticationContext.getAuthenticatedUser();

		expect(result).toEqual({
			status: 'authenticated',
			user: { id: 'ce40d564-c72f-475f-a9b8-f395f19ad986', email: 'developer@example.test' }
		});
	});

	it('returns an authenticated user with no email when the identity omits it', async () => {
		const accessContext = fakeAccessContext(async () => ({ user_uuid: 'user-1' }));
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		const result = await authenticationContext.getAuthenticatedUser();

		expect(result).toEqual({ status: 'authenticated', user: { id: 'user-1', email: undefined } });
	});

	it('returns unauthenticated when there is no Access context', async () => {
		const authenticationContext = new CloudflareAccessAuthenticationContext(undefined);

		expect(await authenticationContext.getAuthenticatedUser()).toEqual({
			status: 'unauthenticated'
		});
	});

	it('returns unauthenticated when getIdentity resolves to undefined', async () => {
		const accessContext = fakeAccessContext(async () => undefined);
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		expect(await authenticationContext.getAuthenticatedUser()).toEqual({
			status: 'unauthenticated'
		});
	});

	it('returns invalid-identity when the identity has no user_uuid', async () => {
		const accessContext = fakeAccessContext(async () => ({ email: 'developer@example.test' }));
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		expect(await authenticationContext.getAuthenticatedUser()).toEqual({
			status: 'invalid-identity'
		});
	});

	it('returns invalid-identity for an empty user_uuid', async () => {
		const accessContext = fakeAccessContext(async () => ({ user_uuid: '' }));
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		expect(await authenticationContext.getAuthenticatedUser()).toEqual({
			status: 'invalid-identity'
		});
	});

	it('returns invalid-identity for a whitespace-only user_uuid', async () => {
		const accessContext = fakeAccessContext(async () => ({ user_uuid: '   ' }));
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		expect(await authenticationContext.getAuthenticatedUser()).toEqual({
			status: 'invalid-identity'
		});
	});

	it('throws AuthenticationError, preserving the cause, when getIdentity fails', async () => {
		const originalError = new Error('Access identity lookup failed');
		const accessContext = fakeAccessContext(async () => {
			throw originalError;
		});
		const authenticationContext = new CloudflareAccessAuthenticationContext(accessContext);

		try {
			await authenticationContext.getAuthenticatedUser();
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(AuthenticationError);
			expect((error as AuthenticationError).cause).toBe(originalError);
		}
	});

	it('uses the stable user_uuid, not email, as the application user ID', async () => {
		const sameEmailDifferentUuid = [
			fakeAccessContext(async () => ({ user_uuid: 'user-a', email: 'shared@example.test' })),
			fakeAccessContext(async () => ({ user_uuid: 'user-b', email: 'shared@example.test' }))
		];

		const results = await Promise.all(
			sameEmailDifferentUuid.map((accessContext) =>
				new CloudflareAccessAuthenticationContext(accessContext).getAuthenticatedUser()
			)
		);

		expect(results[0]).toMatchObject({ user: { id: 'user-a' } });
		expect(results[1]).toMatchObject({ user: { id: 'user-b' } });
		expect(results[0]).not.toEqual(results[1]);

		const sameUuidDifferentEmail = [
			fakeAccessContext(async () => ({ user_uuid: 'user-c', email: 'first@example.test' })),
			fakeAccessContext(async () => ({ user_uuid: 'user-c', email: 'second@example.test' }))
		];
		const [first, second] = await Promise.all(
			sameUuidDifferentEmail.map((accessContext) =>
				new CloudflareAccessAuthenticationContext(accessContext).getAuthenticatedUser()
			)
		);
		expect(first).toMatchObject({ user: { id: 'user-c' } });
		expect(second).toMatchObject({ user: { id: 'user-c' } });
	});
});
