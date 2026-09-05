import { describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { CloudflareAccessJwtAuthenticationContext } from './CloudflareAccessJwtAuthenticationContext';

const ISSUER = 'https://test-team.cloudflareaccess.com';
const AUDIENCE = 'test-application-audience';
const KID = 'test-key';

async function createTestJwks() {
	const { publicKey, privateKey } = await generateKeyPair('RS256');
	const publicJwk = await exportJWK(publicKey);
	const getKey: JWTVerifyGetKey = createLocalJWKSet({
		keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }]
	});
	return { privateKey, getKey };
}

function signToken(
	privateKey: Parameters<SignJWT['sign']>[0],
	claims: Record<string, unknown>,
	options: { issuer?: string; audience?: string; expiresIn?: string; kid?: string } = {}
) {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: 'RS256', kid: options.kid ?? KID })
		.setIssuedAt()
		.setIssuer(options.issuer ?? ISSUER)
		.setAudience(options.audience ?? AUDIENCE)
		.setExpirationTime(options.expiresIn ?? '5m')
		.sign(privateKey);
}

function requestWithToken(token: string | undefined): Request {
	const headers = new Headers();
	if (token !== undefined) {
		headers.set('Cf-Access-Jwt-Assertion', token);
	}
	return new Request('https://watchlist.example.test/api/watchlists', { headers });
}

function contextFor(request: Request, getKey: JWTVerifyGetKey) {
	return new CloudflareAccessJwtAuthenticationContext({
		request,
		getKey,
		issuer: ISSUER,
		audience: AUDIENCE
	});
}

describe('CloudflareAccessJwtAuthenticationContext.getAuthenticatedUser', () => {
	it('authenticates a correctly signed token with the expected issuer/audience', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, {
			sub: 'ce40d564-c72f-475f-a9b8-f395f19ad986',
			email: 'user@example.test'
		});

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({
			status: 'authenticated',
			user: { id: 'ce40d564-c72f-475f-a9b8-f395f19ad986', email: 'user@example.test' }
		});
	});

	it('authenticates a valid token with no email claim', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: 'user-1' });

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'authenticated', user: { id: 'user-1', email: undefined } });
	});

	it('returns unauthenticated when the Access JWT header is missing', async () => {
		const { getKey } = await createTestJwks();

		const result = await contextFor(requestWithToken(undefined), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
	});

	it('returns unauthenticated for a token signed by an untrusted key', async () => {
		const { getKey } = await createTestJwks();
		const attacker = await generateKeyPair('RS256');
		const token = await signToken(attacker.privateKey, { sub: 'user-1' });

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
	});

	it('returns unauthenticated for a token with the wrong issuer', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(
			privateKey,
			{ sub: 'user-1' },
			{ issuer: 'https://other-team.cloudflareaccess.com' }
		);

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
	});

	it('returns unauthenticated for a token with the wrong audience', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: 'user-1' }, { audience: 'other-application' });

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
	});

	it('returns unauthenticated for an expired token', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: 'user-1' }, { expiresIn: '-1s' });

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
	});

	it('returns invalid-identity for a verified token with no sub claim', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, {});

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'invalid-identity' });
	});

	it('returns invalid-identity for a verified token with an empty sub claim', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: '' });

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'invalid-identity' });
	});

	it('returns invalid-identity for a verified token with a whitespace-only sub claim', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: '   ' });

		const result = await contextFor(requestWithToken(token), getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'invalid-identity' });
	});

	it('never maps email from an unrelated request header', async () => {
		const { privateKey, getKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: 'user-1' });
		const request = requestWithToken(token);
		request.headers.set('X-Forwarded-Email', 'attacker@example.test');

		const result = await contextFor(request, getKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'authenticated', user: { id: 'user-1', email: undefined } });
	});

	it('returns unauthenticated when key resolution (JWKS retrieval) fails', async () => {
		const { privateKey } = await createTestJwks();
		const token = await signToken(privateKey, { sub: 'user-1' });
		const failingGetKey: JWTVerifyGetKey = async () => {
			throw new Error('JWKS endpoint unreachable');
		};

		const result = await contextFor(requestWithToken(token), failingGetKey).getAuthenticatedUser();

		expect(result).toEqual({ status: 'unauthenticated' });
	});
});
