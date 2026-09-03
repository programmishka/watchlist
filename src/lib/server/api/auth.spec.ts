import { describe, expect, it } from 'vitest';
import { requireUserId } from './auth';
import { UnauthenticatedError } from './errors';

describe('requireUserId', () => {
	it('returns the authenticated user id', () => {
		expect(requireUserId({ user: { id: 'user-1' } } as App.Locals)).toBe('user-1');
	});

	it('throws UnauthenticatedError when no user is present', () => {
		expect(() => requireUserId({} as App.Locals)).toThrow(UnauthenticatedError);
	});

	it('ignores an email field and never uses it as the identity', () => {
		const locals = { user: { id: 'user-1', email: 'someone@example.test' } } as App.Locals;
		expect(requireUserId(locals)).toBe('user-1');
	});
});
