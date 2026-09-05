import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { assertValidUserId } from '../persistence/UserId';
import type { AuthenticatedUser } from './AuthenticatedUser';
import type { AuthenticationContext, AuthenticationResult } from './AuthenticationContext';

/**
 * Cloudflare adds this header to every request it forwards to an
 * Access-protected origin/Worker. Preferred over the `CF_Authorization`
 * cookie, which is only sent by browser requests (TASK-026 §4).
 */
const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';

/**
 * `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are declared as required Secrets in
 * `wrangler.jsonc` (TASK-028) and so are also present on the generated
 * `Env`. This narrow, application-owned type is kept anyway so the
 * production authentication factory depends only on the two values it
 * actually needs, independent of `Env`'s other (generated) bindings such as
 * `WATCHLIST_KV`/`ASSETS`. Fields stay optional: generated types describing
 * a Secret as a required `string` do not prove it is actually configured in
 * a given deployment, so runtime presence is still validated below.
 */
export interface AccessEnvironment {
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_AUD?: string;
}

export interface CloudflareAccessJwtAuthenticationContextOptions {
	/** The incoming request; only the `Cf-Access-Jwt-Assertion` header is read. */
	request: Request;
	/** Resolves the signing key for a token's `kid`, e.g. `createRemoteJWKSet(...)` (production) or a local/static JWKS (tests). */
	getKey: JWTVerifyGetKey;
	/** Expected Access issuer, e.g. `https://<team-name>.cloudflareaccess.com`. */
	issuer: string;
	/** Expected Access application audience (AUD) tag. */
	audience: string;
}

/**
 * Derives the authenticated user from a cryptographically verified
 * Cloudflare Access JWT, used in production where the Workers-with-Static-
 * Assets router does not forward `ctx.access` to the user Worker (TASK-026).
 *
 * Every verification failure — missing header, bad signature, wrong
 * issuer/audience, expired token, or JWKS resolution failure — collapses to
 * the same `unauthenticated` result. The reasons are deliberately not
 * distinguished here: they must never leak to the client, and there is no
 * production behavior that needs to tell them apart (TASK-026 §29/§31).
 */
export class CloudflareAccessJwtAuthenticationContext implements AuthenticationContext {
	constructor(private readonly options: CloudflareAccessJwtAuthenticationContextOptions) {}

	async getAuthenticatedUser(): Promise<AuthenticationResult> {
		const token = this.options.request.headers.get(ACCESS_JWT_HEADER);
		if (!token) {
			return { status: 'unauthenticated' };
		}

		let sub: string | undefined;
		let email: string | undefined;
		try {
			const { payload } = await jwtVerify(token, this.options.getKey, {
				issuer: this.options.issuer,
				audience: this.options.audience
			});
			sub = payload.sub;
			email = typeof payload.email === 'string' ? payload.email : undefined;
		} catch {
			return { status: 'unauthenticated' };
		}

		if (sub === undefined) {
			return { status: 'invalid-identity' };
		}

		try {
			assertValidUserId(sub);
		} catch {
			return { status: 'invalid-identity' };
		}

		const user: AuthenticatedUser = { id: sub, email };
		return { status: 'authenticated', user };
	}
}

/** Module-scoped so signing keys fetched from Cloudflare are cached and reused across requests, per `jose`'s `createRemoteJWKSet` guidance. */
let cachedRemoteJwks: { teamDomain: string; getKey: JWTVerifyGetKey } | undefined;

function resolveRemoteJwks(teamDomain: string): JWTVerifyGetKey {
	if (cachedRemoteJwks?.teamDomain !== teamDomain) {
		cachedRemoteJwks = {
			teamDomain,
			getKey: createRemoteJWKSet(new URL('/cdn-cgi/access/certs', teamDomain))
		};
	}
	return cachedRemoteJwks.getKey;
}

const UNAUTHENTICATED_CONTEXT: AuthenticationContext = {
	async getAuthenticatedUser(): Promise<AuthenticationResult> {
		return { status: 'unauthenticated' };
	}
};

/**
 * Builds the production authentication context from trusted deployment
 * configuration (`env.ACCESS_TEAM_DOMAIN`/`env.ACCESS_AUD`), never from
 * request input. Missing or malformed configuration fails closed rather
 * than accepting an unverifiable token (TASK-026 §67).
 */
export function createCloudflareAccessJwtAuthenticationContext(
	request: Request,
	env: AccessEnvironment | undefined
): AuthenticationContext {
	const teamDomain = env?.ACCESS_TEAM_DOMAIN?.replace(/\/+$/, '');
	const audience = env?.ACCESS_AUD;

	if (!teamDomain || !audience) {
		console.error(
			'Cloudflare Access authentication is not configured: ACCESS_TEAM_DOMAIN and/or ACCESS_AUD are missing. Failing closed.'
		);
		return UNAUTHENTICATED_CONTEXT;
	}

	try {
		return new CloudflareAccessJwtAuthenticationContext({
			request,
			getKey: resolveRemoteJwks(teamDomain),
			issuer: teamDomain,
			audience
		});
	} catch (error) {
		console.error(
			'Failed to configure Cloudflare Access JWT authentication. Failing closed.',
			error
		);
		return UNAUTHENTICATED_CONTEXT;
	}
}
