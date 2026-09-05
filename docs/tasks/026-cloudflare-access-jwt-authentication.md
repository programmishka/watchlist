# TASK-026: Cloudflare Access JWT Authentication for Production

## Status

Ready

## Goal

Correct the production authentication architecture for the actual Cloudflare deployment topology.

The application is deployed as a Cloudflare Worker with Static Assets:

```text
Cloudflare Access
        |
        v
Cloudflare-managed Static Assets router Worker
        |
        v
SvelteKit user Worker
```

Cloudflare Access successfully authenticates the user through One-Time PIN.

However, current Cloudflare documentation states that for Workers with Static Assets:

> Access still protects the application and its assets, but the internal router Worker does not pass `ctx.access` to the user Worker.

The current authentication implementation from TASK-008 relies on:

```text
event.platform.ctx.access
```

and therefore fails closed in production even after a successful Access login.

Observed production behavior:

```text
https://watchlist.investment-tools.workers.dev
        |
        v
Cloudflare Access
        |
        v
allowlisted email
        |
        v
One-Time PIN succeeds
        |
        v
SvelteKit application
        |
        v
ctx.access unavailable
        |
        v
Authentication is required.
```

This task replaces the production identity source with validation of Cloudflare Access's:

```http
Cf-Access-Jwt-Assertion
```

header.

The JWT MUST be cryptographically verified against Cloudflare Access JWKS and validated for the expected issuer and application audience.

At the same time, local development must remain convenient:

```text
LOCAL
npm run dev / local preview
        |
        v
fixed synthetic development user
        |
        v
no OTP required
```

while production remains:

```text
PRODUCTION
Cloudflare Access
        |
        v
One-Time PIN
        |
        v
Cf-Access-Jwt-Assertion
        |
        v
signature + issuer + audience validation
        |
        v
JWT sub
        |
        v
AuthenticatedUser.id
```

This task is an architecture correction caused by a documented Cloudflare runtime limitation.

It supersedes TASK-008 only where TASK-008 requires production identity to come exclusively from `ctx.access` and forbids application-level Access JWT verification.

All other authentication principles remain in force.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/tasks/008-*` if present;
* this task completely.

Also inspect the current production authentication implementation before making changes.

Relevant current modules include conceptually:

```text
AuthenticationContext
AuthenticationResult
AuthenticatedUser
CloudflareAccessAuthenticationContext
hooks.server.ts
requireUserId()
```

Use the actual repository structure and names.

Do not introduce a second unrelated authentication architecture.

---

# Production Evidence

## 1. Confirm Existing Assumption

Before modifying code, inspect the TASK-008 implementation and confirm that production authentication currently derives identity from:

```text
event.platform?.ctx.access
```

or the equivalent existing path.

Document the exact current flow in the completion report.

---

## 2. Cloudflare Static Assets Limitation

Treat the following current Cloudflare behavior as the reason for this architecture correction:

```text
Workers with Static Assets
        |
        v
internal router Worker
        |
        v
ctx.access not passed to user Worker
```

Do not attempt to solve this through:

```text
assets.run_worker_first
```

or another unrelated routing option.

Current investigation already established that this does not restore `ctx.access`.

---

## 3. Access Remains the Authentication Provider

Do NOT replace Cloudflare Access.

Production authentication remains:

```text
Cloudflare Access
+
One-Time PIN
+
explicit email allowlist
```

The application still has:

* no password database;
* no registration;
* no login UI;
* no application-managed user accounts.

---

# Production Authentication Source

## 4. Access JWT Header

Use:

```http
Cf-Access-Jwt-Assertion
```

as the production authentication artifact.

Prefer the header over relying on:

```text
CF_Authorization
```

browser cookie because the header is the request-level assertion supplied by Access to the protected origin/Worker.

Do not use `/cdn-cgi/access/get-identity` as the primary proof of authentication.

---

## 5. No Unverified JWT Decoding

It is strictly forbidden to authenticate a user by merely:

* Base64-decoding the JWT;
* parsing JWT claims;
* using `decodeJwt()` without verification;
* trusting `sub` or `email` before verification.

The token must be cryptographically verified first.

---

# JOSE

## 6. Add JOSE

Add the current compatible stable:

```text
jose
```

package as a production dependency.

This explicitly supersedes TASK-008's previous prohibition on adding a JWT library.

Do not implement JWT cryptography manually.

Do not add multiple JWT libraries.

---

## 7. Workers Compatibility

Verify that the chosen `jose` APIs work with the project's Cloudflare Worker runtime and existing compatibility configuration.

Prefer Web Crypto-compatible APIs.

Do not add broader Node.js compatibility flags merely to support authentication unless genuinely required and justified.

---

# Required Production Configuration

## 8. Team Domain

Production authentication requires the Cloudflare Access Team Domain.

The user has already obtained this value locally.

Conceptually:

```text
https://<team-name>.cloudflareaccess.com
```

The exact value MUST NOT be hardcoded into TypeScript source.

---

## 9. Application Audience

Production authentication also requires the Access application's Audience (`AUD`) tag.

The user has already obtained this value locally.

The exact value MUST NOT be hardcoded into TypeScript source.

---

## 10. Environment Bindings

Introduce explicit Worker configuration bindings for these values.

Use clear names.

Preferred names:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

If the current Cloudflare conventions or generated environment typing strongly justify different names, document the reason.

---

## 11. Values Are Configuration

Treat:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

as deployment configuration.

Do not treat them as user-provided request values.

Do not allow:

* query parameters;
* request headers;
* cookies;
* form values

to override them.

---

## 12. No Production Values in Repository

Do not commit the user's actual:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

values into source-controlled configuration as part of this task.

Use placeholders/configuration declarations where necessary.

The user will configure the real production values manually after implementation.

Do not ask the user to paste the actual values into the task output.

---

# JWT Verification

## 13. JWKS URL

Derive the JWKS endpoint from the configured Team Domain.

Conceptually:

```text
<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs
```

Normalize URL joining safely.

Do not construct arbitrary external JWKS URLs from request-controlled input.

---

## 14. Remote JWKS

Use `jose`'s supported remote JWKS mechanism, conceptually:

```text
createRemoteJWKSet(...)
```

so Cloudflare signing-key rotation is supported.

Do not hardcode Cloudflare public signing keys.

---

## 15. JWT Verification

Use a verified JWT operation conceptually equivalent to:

```text
jwtVerify(...)
```

The verification MUST include:

* cryptographic signature;
* issuer;
* audience;
* normal JWT time validity handled by the library.

---

## 16. Issuer

Expected issuer is derived from the configured Team Domain.

Conceptually:

```text
https://<team-name>.cloudflareaccess.com
```

or the exact canonical issuer form required by current Cloudflare Access documentation.

Verify the actual required trailing-slash semantics before implementing.

Do not accept arbitrary issuers.

---

## 17. Audience

Require the configured:

```text
ACCESS_AUD
```

to be present in the JWT audience.

Do not accept a valid Cloudflare Access token issued for another Access application.

This is a critical security requirement.

---

## 18. Expiration / Time Claims

Allow `jose` to enforce normal JWT validity such as expiration where supported by `jwtVerify`.

Do not disable expiration validation.

Do not introduce excessive clock tolerance without evidence of a real need.

---

# User Identity

## 19. Stable User ID

After successful verification, derive:

```text
AuthenticatedUser.id
```

from the verified JWT:

```text
sub
```

claim.

Do NOT use email address as the persistence key.

This preserves stable per-user KV isolation.

---

## 20. Email

Map the verified:

```text
email
```

claim to:

```text
AuthenticatedUser.email
```

if the current domain type contains email.

Do not use email as a substitute for missing `sub`.

---

## 21. Required Subject

A verified token without a usable non-empty:

```text
sub
```

must be treated as unauthenticated/invalid.

Reuse the existing:

```text
assertValidUserId
```

or equivalent validation where appropriate.

---

## 22. Missing Email

Inspect the existing `AuthenticatedUser` contract.

If email is optional, a missing email may remain optional.

If the current contract requires email, preserve the established behavior unless Cloudflare's verified token contract proves that assumption invalid.

Do not redesign user identity unnecessarily.

---

# Authentication Result Semantics

## 23. Missing Header

If production request has no:

```http
Cf-Access-Jwt-Assertion
```

header:

```text
authentication = unauthenticated
```

Do not throw an unhandled error.

Do not create a fallback production user.

---

## 24. Invalid Signature

Invalid JWT signature:

```text
authentication = unauthenticated
```

or the existing authentication-failure representation.

Fail closed.

---

## 25. Wrong Issuer

Wrong issuer:

```text
authentication = unauthenticated
```

Fail closed.

---

## 26. Wrong Audience

Wrong audience:

```text
authentication = unauthenticated
```

Fail closed.

---

## 27. Expired Token

Expired token:

```text
authentication = unauthenticated
```

Fail closed.

---

## 28. Missing Subject

Verified token without usable `sub`:

```text
authentication = unauthenticated
```

Fail closed.

---

## 29. No Authentication Details Leaked

Client-facing 401 behavior should remain the existing stable:

```text
Authentication is required.
```

or current equivalent.

Do not expose details such as:

```text
JWT signature invalid
wrong audience
JWKS fetch failed
```

to the browser.

---

# JWKS / Infrastructure Failure

## 30. JWKS Failure

If Cloudflare JWKS cannot be retrieved or verification cannot complete because of infrastructure failure, the request MUST NOT authenticate.

Fail closed.

Do not use a stale invented identity.

---

## 31. Error Classification

Use the smallest error distinction needed internally.

Do not create a large authentication-error hierarchy unless required.

Security behavior matters more than exposing fine-grained failure reasons.

---

# Authentication Abstraction

## 32. Preserve AuthenticationContext

Preserve the existing authentication abstraction where practical:

```text
AuthenticationContext
        |
        +-- DevelopmentAuthenticationContext
        |
        +-- CloudflareAccessJwtAuthenticationContext
```

or an equivalent design.

Do not make route handlers understand JWTs.

---

## 33. Production Context

Introduce or replace the Cloudflare implementation with something conceptually equivalent to:

```text
CloudflareAccessJwtAuthenticationContext
```

It should own:

* reading the Access JWT header;
* JWT verification;
* claim mapping.

---

## 34. Route Independence

Existing application code such as:

```text
requireUserId()
WatchlistService
TargetPriceService
WatchlistQueryService
```

must remain unaware of:

* JWT;
* JWKS;
* Cloudflare header names;
* issuer;
* audience.

They continue consuming:

```text
event.locals.user
```

or the existing authenticated-user abstraction.

---

# Local Development Authentication

## 35. Preserve Easy Local Development

The application MUST remain locally usable without Cloudflare OTP.

The developer should be able to start the normal local application and use:

```text
Watchlists
stocks
Target Prices
filtering
sorting
investment allocation
```

without signing into Cloudflare.

---

## 36. Synthetic Development User

Use a fixed synthetic development identity conceptually equivalent to:

```text
id = local-development-user
email = developer@example.test
```

The exact existing values may be reused.

This user remains isolated in local KV through keys such as:

```text
user:local-development-user:watchlists
user:local-development-user:target-prices
```

---

## 37. DevelopmentAuthenticationContext

Prefer an explicit local authentication implementation rather than pretending that local development has a real Access JWT.

Conceptually:

```text
DevelopmentAuthenticationContext
```

returns the fixed development user.

Do not generate fake production Access tokens at runtime.

---

# Development / Production Selection

## 38. Critical Security Boundary

The selection between:

```text
DevelopmentAuthenticationContext
```

and:

```text
CloudflareAccessJwtAuthenticationContext
```

MUST be determined exclusively by trusted server/runtime configuration.

It MUST NOT be controlled by the HTTP request.

---

## 39. Forbidden Dev Activation

Do NOT allow development authentication to be activated through:

```text
?dev=true
?local=true
```

or:

```http
X-Development-User
X-Debug-Auth
```

or cookies, form fields, URL paths, client state, etc.

No request-controlled development bypass is allowed.

---

## 40. Production Fail Closed

A deployed production Worker with missing/incorrect authentication configuration must NOT fall back to:

```text
local-development-user
```

It must reject authentication.

This must be explicitly tested.

---

## 41. Runtime Configuration Design

Use the simplest trustworthy runtime signal available in the existing SvelteKit/Cloudflare environment to distinguish local development from deployed production.

Inspect current runtime/config capabilities before choosing.

Do not rely on a browser-supplied hostname alone as the security boundary.

Document the selected mechanism and why it cannot be enabled by an untrusted request.

---

## 42. `npm run dev`

Normal:

```bash
npm run dev
```

must remain usable with the synthetic development user.

---

## 43. Local `npm run preview`

Where practical, local:

```bash
npm run build
npm run preview
```

should also use the synthetic development identity.

If the existing runtime makes this distinction materially difficult without weakening production security, report the issue before implementing a workaround.

Production safety takes priority.

---

# Existing `access.dev`

## 44. Review Wrangler `access.dev`

The current `wrangler.jsonc` contains:

```text
access.dev
```

configuration that simulates:

```text
ctx.access
```

for local development.

Since production no longer uses `ctx.access`, inspect whether this configuration still provides any useful purpose.

---

## 45. Remove Dead Configuration if Appropriate

If `access.dev` is no longer consumed by any production/local authentication path after this task:

* remove it from `wrangler.jsonc`;
* update generated types/config expectations;
* update documentation.

Do not leave misleading dead authentication configuration merely because it existed previously.

If it remains useful for a concrete reason, document that reason.

---

# Dependency Injection / Testability

## 46. Deterministic JWT Tests

The JWT authentication implementation must be testable without contacting Cloudflare.

Do not make unit tests depend on the live:

```text
cloudflareaccess.com
```

JWKS endpoint.

---

## 47. JWKS Verification Seam

Introduce the smallest reasonable test seam around JWT verification/JWKS resolution.

Acceptable approaches include:

* injectable key resolver;
* injectable verification function;
* local test JWKS.

Do not introduce a DI framework.

---

## 48. Real Signed Test JWTs

Where practical, tests should use real cryptographically signed JWTs generated with test keys.

This is preferable to mocking:

```text
jwtVerify -> success
```

for every security test because it verifies the actual claim/signature behavior.

Keep keys ephemeral/test-only.

Do not commit real Cloudflare keys or tokens.

---

# Required Authentication Tests

## 49. Valid Token

Test a correctly signed token with:

```text
correct issuer
correct audience
valid expiration
non-empty sub
email
```

Expected:

```text
authenticated
```

with:

```text
AuthenticatedUser.id = sub
```

---

## 50. Missing Header

No Access JWT header:

```text
unauthenticated
```

---

## 51. Invalid Signature

Token signed with an untrusted key:

```text
unauthenticated
```

---

## 52. Wrong Issuer

Correctly signed token with wrong issuer:

```text
unauthenticated
```

---

## 53. Wrong Audience

Correctly signed token for another application audience:

```text
unauthenticated
```

---

## 54. Expired Token

Correctly signed expired token:

```text
unauthenticated
```

---

## 55. Missing Subject

Correctly signed token without usable `sub`:

```text
unauthenticated
```

---

## 56. Empty Subject

Test:

```text
sub = ""
```

or whitespace if JWT tooling permits.

Must not authenticate.

---

## 57. Email Mapping

Verify email is mapped only from verified claims.

Do not accept an email from another request header as identity.

---

## 58. JWKS Failure

Simulate JWKS/key-resolution failure.

Expected:

```text
not authenticated
```

No fallback user.

---

# Development Authentication Tests

## 59. Development User

Verify development context returns exactly the configured synthetic local user.

---

## 60. Local User ID

Verify:

```text
id = local-development-user
```

or the selected stable equivalent.

---

## 61. Production Does Not Fall Back

Test that the production authentication path with:

```text
missing JWT
invalid JWT
missing production config
```

never returns the development user.

This is a critical acceptance criterion.

---

## 62. Request Cannot Enable Development Mode

Add a structural/unit test where practical proving that request-controlled values cannot select development authentication.

At minimum inspect/test the selected runtime-selection function.

Do not add a production request parameter merely to test that it is ignored.

---

# Hooks Integration

## 63. Update `hooks.server.ts`

Update the SvelteKit authentication hook so it selects the appropriate authentication context based on trusted runtime configuration.

Conceptually:

```text
local development
    -> DevelopmentAuthenticationContext

deployed production
    -> CloudflareAccessJwtAuthenticationContext
```

Then:

```text
AuthenticationResult
        |
        v
event.locals.user
```

remains the application-facing result.

---

## 64. Existing `requireUserId`

Do not change the semantics of:

```text
requireUserId()
```

unless strictly necessary.

Unauthenticated requests continue to produce the established 401 behavior.

---

## 65. Existing API Routes

Do not individually modify every API route to parse JWTs.

Authentication belongs in the server hook/context layer.

---

# Configuration Typing

## 66. Cloudflare Environment Types

Ensure:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

are represented correctly in the Cloudflare environment typing used by the project.

Use the existing Wrangler type-generation workflow.

Do not manually maintain conflicting environment interfaces if generated types already solve this.

---

## 67. Missing Production Configuration

If deployed production lacks:

```text
ACCESS_TEAM_DOMAIN
```

or:

```text
ACCESS_AUD
```

authentication must fail closed.

Prefer a clear server-side diagnostic/logging path while keeping client response generic.

Do not silently substitute placeholders.

---

# Local UI Verification

## 68. `npm run dev`

Actually verify:

```bash
npm run dev
```

and open/use the application locally.

Confirm:

* no Cloudflare login is required;
* synthetic local user is authenticated;
* existing local Watchlists can be loaded;
* at least one normal API operation works.

---

## 69. Local KV Isolation

Confirm local persistence still uses the development user ID.

Do not allow local development to accidentally write production-user keys.

---

## 70. Production KV Safety

Local development must continue to use local Wrangler/dev storage rather than the real:

```text
watchlist-production
```

KV namespace.

Do not perform a destructive test against production KV.

---

# Playwright

## 71. Existing E2E Strategy

Normal:

```bash
npm run test:e2e
```

continues using deterministic intercepted API responses.

Do not make Playwright E2E depend on Access JWTs.

---

## 72. No E2E Auth Rewrite

Do not rewrite the browser E2E foundation solely because server authentication changed.

The existing mocked `/api/*` UI strategy remains valid.

---

# Workerd Verification

## 73. Local Worker Runtime

Where the selected local-auth strategy supports it, verify the built Worker under:

```bash
npm run preview
```

or the project's documented Wrangler runtime.

Confirm the local synthetic user path works without Access OTP.

If this is not safely achievable under the chosen trusted runtime-selection mechanism, document the limitation explicitly.

---

# Production Configuration — Manual User Step

## 74. Do Not Configure Cloudflare Account Automatically

Claude Code MUST NOT:

* modify the user's Cloudflare Access application;
* modify Access policies;
* create/delete KV namespaces;
* set production environment variables through Cloudflare API;
* deploy automatically.

The user performs account-level configuration manually.

---

## 75. Required Manual Values

At completion, tell the user exactly where the application expects:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

to be configured.

Do not ask the user to expose the actual values in the completion report.

---

## 76. Do Not Deploy

Do NOT execute:

```bash
wrangler deploy
```

or equivalent production deployment.

The user performs deployment manually after reviewing the task.

---

# Production Smoke Test Plan

## 77. Document Post-Deployment Verification

Update documentation with a concise post-deployment verification plan.

After the user configures the real values and deploys manually:

```text
incognito browser
        |
        v
workers.dev URL
        |
        v
Cloudflare Access
        |
        v
allowlisted email
        |
        v
One-Time PIN
        |
        v
Watchlist loads
```

---

## 78. Verify User Isolation After Deployment

The post-deployment plan should include creating/loading data and confirming production KV keys use the verified JWT subject.

Conceptually:

```text
user:<verified-sub>:watchlists
user:<verified-sub>:target-prices
```

Do not expose the full subject publicly.

---

## 79. Non-Allowlisted User

The post-deployment plan should include verifying that a non-allowlisted email cannot access the application.

Cloudflare Access remains the first enforcement layer.

---

# Architecture Documentation

## 80. Supersede TASK-008 Narrowly

Update `ARCHITECTURE.md` to explicitly state that TASK-026 supersedes TASK-008 only for the production Access identity mechanism.

TASK-008 remains authoritative for principles such as:

* managed authentication;
* no passwords in application;
* server-derived identity;
* no client-provided user IDs;
* fail-closed authentication;
* user-scoped persistence.

---

## 81. Correct `ctx.access` Statements

Remove/update architecture statements claiming production identity comes from:

```text
ctx.access
```

for this deployment.

Document the Static Assets router limitation as the reason.

---

## 82. Document JWT Verification

Architecture must state production authentication uses:

```text
Cf-Access-Jwt-Assertion
```

with:

```text
JWKS signature verification
issuer validation
audience validation
sub -> user ID
```

---

## 83. Document Development Authentication

Architecture must state local development uses an explicit synthetic development identity selected only through trusted runtime configuration.

It is not a request-controlled authentication bypass.

---

## 84. Document Local/Production Difference

Make the distinction explicit:

```text
LOCAL
synthetic development identity

PRODUCTION
verified Cloudflare Access JWT
```

This difference is intentional.

---

## 85. Update Authentication Diagram

Update the relevant architecture flow diagram.

Production should conceptually become:

```text
Browser
   |
   v
Cloudflare Access
   |
   v
Static Assets Router
   |
   v
SvelteKit Worker
   |
   +-- Cf-Access-Jwt-Assertion
   |
   v
JWT Verification
   |
   +-- Cloudflare JWKS
   +-- issuer
   +-- audience
   |
   v
verified sub
   |
   v
event.locals.user
   |
   v
Application Services
   |
   v
user:<sub>:...
```

---

# TASK-008 Documentation

## 86. Do Not Rewrite Historical Task

Do not rewrite TASK-008 as if the original decision never existed.

It is useful historical evidence of the previous architecture.

If the task-file convention supports a short superseded note, add only a concise reference such as:

```text
Production ctx.access identity mechanism superseded by TASK-026 because
Cloudflare's Static Assets router does not pass ctx.access to the user Worker.
```

Do not change TASK-008 status from Done.

---

# CLAUDE.md

## 87. Update Agent Guidance if Necessary

If `CLAUDE.md` currently instructs agents to use `ctx.access` for production authentication, update that guidance.

Ensure future agents understand:

```text
Production:
verified Cloudflare Access JWT

Local:
synthetic trusted development identity
```

Do not add implementation duplication already covered by `ARCHITECTURE.md`.

---

# README

## 88. Local Development Documentation

Update README so developers know:

```bash
npm run dev
```

does not require Cloudflare OTP and uses a synthetic local development identity.

---

## 89. Production Configuration Documentation

Document the required production bindings:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
WATCHLIST_KV
```

Do not include real values.

---

## 90. Deployment Boundary

README should make clear that production deployment/account configuration is manual.

Do not include user-specific Cloudflare account identifiers.

---

# Non-Goals

Do NOT implement:

* a login page;
* passwords;
* application registration;
* logout UI;
* application user management;
* refresh-token management;
* direct OTP handling;
* OTP email delivery;
* Access policy management;
* Cloudflare API automation;
* production deployment;
* custom domain;
* authentication through Google/GitHub;
* `/cdn-cgi/access/get-identity` enrichment;
* email-based KV keys;
* client-provided user identity;
* request-controlled dev authentication;
* a second persistence model;
* unrelated UI changes.

Do not weaken Cloudflare Access protection.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. The existing `ctx.access` production dependency is identified and removed/replaced.
2. The Cloudflare Static Assets router limitation is documented.
3. Cloudflare Access remains the production authentication provider.
4. One-Time PIN remains external to the application.
5. `jose` is the only JWT library added.
6. Production reads `Cf-Access-Jwt-Assertion`.
7. JWTs are cryptographically verified.
8. Cloudflare JWKS is used.
9. Signing keys are not hardcoded.
10. Issuer is explicitly validated.
11. Audience is explicitly validated.
12. Expiration/time validity is not disabled.
13. JWT decoding without verification cannot authenticate.
14. Verified `sub` becomes `AuthenticatedUser.id`.
15. Email is taken only from verified claims.
16. Missing JWT fails closed.
17. Invalid signature fails closed.
18. Wrong issuer fails closed.
19. Wrong audience fails closed.
20. Expired token fails closed.
21. Missing/empty subject fails closed.
22. JWKS failure fails closed.
23. Client-facing auth failures do not leak JWT details.
24. Existing `AuthenticationContext` abstraction remains usable.
25. Route handlers do not parse JWTs.
26. Existing application services remain Cloudflare/JWT-independent.
27. `ACCESS_TEAM_DOMAIN` is configuration, not hardcoded.
28. `ACCESS_AUD` is configuration, not hardcoded.
29. Actual production values are not committed.
30. Missing production configuration does not fall back to local identity.
31. Local development remains usable without OTP.
32. Local development uses a stable synthetic user.
33. Local user remains isolated through the existing user-scoped KV model.
34. Development authentication cannot be enabled by request-controlled input.
35. Production never falls back to the development user.
36. `npm run dev` is actually verified.
37. Local persistence does not use production-user identity.
38. Local development does not write production KV.
39. Existing `access.dev` is reviewed and removed if dead.
40. JWT verification is deterministically unit-testable without Cloudflare network access.
41. Tests use cryptographically meaningful signed tokens where practical.
42. Valid-token authentication is tested.
43. Missing-token authentication is tested.
44. Invalid-signature authentication is tested.
45. Wrong-issuer authentication is tested.
46. Wrong-audience authentication is tested.
47. Expired-token authentication is tested.
48. Missing-subject authentication is tested.
49. JWKS/key-resolution failure is tested.
50. Development-user behavior is tested.
51. Production-no-fallback behavior is tested.
52. Existing `requireUserId()` behavior remains intact.
53. Existing API routes retain authentication behavior through `event.locals.user`.
54. Cloudflare environment typing includes required configuration.
55. Existing deterministic Playwright strategy remains intact.
56. `npm run test:e2e` does not require Access.
57. Local built-worker verification is performed where safely supported.
58. No production Cloudflare configuration is changed automatically.
59. No production deployment is performed.
60. Post-deployment OTP verification steps are documented.
61. Post-deployment user-isolation verification is documented.
62. Non-allowlisted-user verification is documented.
63. `ARCHITECTURE.md` narrowly supersedes TASK-008's production `ctx.access` mechanism.
64. TASK-008 historical context is preserved.
65. `CLAUDE.md` is corrected if necessary.
66. README documents local synthetic authentication.
67. README documents required production configuration names.
68. No client-provided identity mechanism is introduced.
69. No authentication UI is introduced.
70. No unrelated business/UI functionality is modified.
71. Existing project checks pass.
72. No unnecessary production dependency beyond `jose` is introduced.

---

# Verification

Before completing the task, execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

Additionally:

1. verify valid signed Access-like JWT authentication;
2. verify invalid signature;
3. verify wrong issuer;
4. verify wrong audience;
5. verify expired JWT;
6. verify missing JWT;
7. verify missing subject;
8. verify JWKS/key-resolution failure;
9. verify production path never returns the development user;
10. run `npm run dev` and verify the UI/API works without OTP;
11. verify the local user ID remains stable;
12. verify local data remains local;
13. verify the built Worker locally if safely supported by the selected runtime-mode mechanism.

Do NOT run:

```bash
wrangler deploy
```

Do NOT modify the user's Cloudflare account.

Do not report a verification step as successful unless it was actually executed successfully.

---

# Manual Steps After Task Completion

Claude must provide exact instructions for the user, but must not execute them.

The expected sequence is conceptually:

```text
1. Review implementation.
2. Commit changes manually.
3. Configure production ACCESS_TEAM_DOMAIN.
4. Configure production ACCESS_AUD.
5. Verify WATCHLIST_KV production binding.
6. Build/check locally.
7. Deploy manually.
8. Open workers.dev URL in an incognito browser.
9. Enter allowlisted email.
10. Receive One-Time PIN by email.
11. Enter PIN.
12. Confirm Watchlist loads instead of "Authentication is required."
13. Create/load a Watchlist.
14. Confirm user-scoped KV data is created.
15. Test a non-allowlisted email.
```

The completion report must state exactly how steps 3–4 should be performed with the final implementation.

---

# Task Status

After all implementation acceptance criteria and local verification steps are satisfied, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

The task may be marked Done before production deployment because production account configuration/deployment is explicitly a manual user responsibility.

Do not modify unrelated task statuses.

---

# Completion Report

When finished, report:

1. exact old production authentication flow;
2. confirmed Static Assets/`ctx.access` root cause;
3. files added/changed;
4. `jose` version added;
5. final production authentication flow;
6. JWT header used;
7. JWKS strategy;
8. issuer validation;
9. audience validation;
10. expiration validation;
11. verified-claim mapping;
12. stable user-ID choice;
13. missing/invalid-token behavior;
14. JWKS failure behavior;
15. client-facing failure behavior;
16. final `AuthenticationContext` structure;
17. local development authentication design;
18. trusted runtime-selection mechanism;
19. proof that request input cannot activate dev auth;
20. production-no-fallback behavior;
21. `access.dev` decision;
22. Cloudflare environment bindings introduced;
23. confirmation that real production values were not committed;
24. JWT security tests added;
25. development-auth tests added;
26. existing authentication/application tests affected;
27. local `npm run dev` verification;
28. local KV verification;
29. built-worker/local preview verification result;
30. existing E2E result;
31. `ARCHITECTURE.md` corrections;
32. TASK-008 historical/supersession note;
33. `CLAUDE.md` changes;
34. README changes;
35. exact manual configuration steps for `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`;
36. exact manual post-deployment OTP smoke-test steps;
37. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
38. confirmation that no production deployment/configuration was performed;
39. confirmation that no auth UI/password/user-management feature was introduced;
40. confirmation that this task's status was changed to Done;
41. assumptions or unresolved issues;
42. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to production deployment.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
