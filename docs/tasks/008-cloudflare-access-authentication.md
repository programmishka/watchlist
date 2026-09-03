# TASK-008: Cloudflare Access Authentication Context

## Status

Done

## Goal

Implement the server-side authentication-context boundary using Cloudflare Workers' native Cloudflare Access integration.

The application must derive the authenticated user from the trusted Cloudflare Workers Access context rather than parsing Access JWTs itself.

This task establishes:

```text
Incoming Request
       |
       v
Cloudflare Access
       |
       v
Cloudflare Worker
       |
       v
ctx.access
       |
       v
Application Authentication Context
       |
       +-- userId
       +-- email (optional/display only)
```

The resulting application-owned authenticated-user representation will later be used by application services to scope Cloudflare KV persistence.

Do not implement Watchlist APIs, application services, login UI, or authorization rules beyond establishing the authenticated user context.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* Cloudflare Workers deployment configuration;
* the `WATCHLIST_KV` binding;
* user-scoped persistence repositories;
* `assertValidUserId`;
* market-data and exchange-rate providers;
* server-side domain calculations.

TASK-007 intentionally accepts a server-provided `userId` in repository methods.

This task establishes the trusted source of that user ID.

---

## 1. Use Native Cloudflare Workers Access Integration

Use the current native Cloudflare Workers Access integration exposed through:

```text
ctx.access
```

and its identity API.

Conceptually:

```ts
if (!ctx.access) {
  // unauthenticated
}

const identity = await ctx.access.getIdentity();
```

Verify the exact current TypeScript API and identity shape against the Cloudflare Workers types and documentation available to the project.

Do not assume an outdated identity shape if current generated/runtime types differ.

---

## 2. Do Not Implement JWT Validation

The application MUST NOT manually:

* read `CF_Authorization`;
* read `Cf-Access-Jwt-Assertion`;
* Base64-decode an Access JWT;
* parse JWT claims as proof of authentication;
* fetch Access JWKS;
* validate Access JWT signatures;
* validate JWT issuer/audience itself.

Do not add:

```text
jose
```

or another JWT library for Cloudflare Access.

Cloudflare Access and the Workers runtime are the authentication trust boundary for this architecture.

---

## 3. Application-Owned Authenticated User

Introduce a small application-owned authenticated-user representation.

Conceptually:

```ts
interface AuthenticatedUser {
  id: string;
  email?: string;
}
```

The exact name/location may follow existing project conventions.

The type MUST NOT expose:

* Cloudflare-specific identity objects;
* JWT payloads;
* Access tokens;
* session cookies;
* provider-specific authentication metadata not needed by the application.

Application services should eventually depend on this application-owned type rather than Cloudflare APIs.

---

## 4. Stable User ID

Use Cloudflare Access' stable authenticated user identifier as:

```text
AuthenticatedUser.id
```

The current Cloudflare identity API exposes a stable Access user identifier such as `user_uuid`.

Verify the exact property exposed by the current Workers Access identity API before implementing the mapping.

Do not use the email address as the application user ID.

Conceptually:

```text
Cloudflare Access identity
       |
       +-- stable user identifier --> AuthenticatedUser.id
       |
       +-- email ------------------> AuthenticatedUser.email
```

---

## 5. Email

Email is optional application metadata intended only for display or diagnostics where appropriate.

It MUST NOT be used:

* as a KV key;
* as the persistent application user ID;
* to determine ownership of Watchlists;
* to determine ownership of Target Prices.

A future email-address change must not implicitly create a different persistence identity if Cloudflare's stable user identifier remains unchanged.

---

## 6. Authentication Context Boundary

Introduce the smallest practical server-side abstraction that allows application/server code to obtain:

```text
AuthenticatedUser
```

without knowing about Cloudflare-specific identity details.

Possible conceptual designs include:

```ts
interface AuthenticationContext {
  getAuthenticatedUser(): Promise<AuthenticatedUser>;
}
```

or an equivalent small server-side function/service.

Choose the simplest design that:

* isolates Cloudflare-specific access;
* is easy to test;
* can later be used by SvelteKit server routes/application services;
* does not require a dependency-injection framework.

Do not build a general identity-management system.

---

## 7. Unauthenticated Requests

If:

```text
ctx.access
```

is unavailable, the authentication context must treat the request as unauthenticated.

Do not:

* create an anonymous user ID;
* fall back to email;
* use a hard-coded development user in production logic;
* allow persistence access without an authenticated identity.

Represent unauthenticated access using a small explicit application-level authentication error/result.

---

## 8. Invalid Identity

Even when an Access context exists, the returned identity must contain a usable stable user identifier.

Reject identities where the required stable identifier is:

* missing;
* empty;
* whitespace-only;
* otherwise unusable according to the existing user-ID contract.

Reuse existing user-ID validation where appropriate rather than duplicating conflicting rules.

Do not silently substitute another identity field.

---

## 9. Identity Retrieval Failure

If:

```text
ctx.access.getIdentity()
```

fails, expose a small application-owned authentication error.

Do not leak raw Cloudflare/runtime exceptions as the public application contract.

Preserve the original error as `cause` where useful for diagnostics.

Do not confuse:

```text
no authenticated Access context
```

with:

```text
Access identity retrieval failed
```

if the implementation can reasonably distinguish them.

Avoid a large authentication-error hierarchy.

---

## 10. Server-Only Implementation

Authentication-context code belongs exclusively to server-side code.

Use SvelteKit server-only module conventions.

The browser MUST NOT:

* access `ctx.access`;
* parse Access identities;
* determine its own user ID;
* submit a user ID to establish ownership.

No authentication implementation belongs in:

* `.svelte` components;
* client-side stores;
* browser modules.

---

## 11. Persistence Relationship

Do not modify repository contracts introduced in TASK-007.

They correctly accept:

```ts
userId: string
```

from trusted server-side callers.

The future flow will be:

```text
Cloudflare Access
       |
       v
Authentication Context
       |
       v
AuthenticatedUser.id
       |
       v
Application Service
       |
       v
Repository.get(userId)
Repository.save(userId, ...)
```

This task implements only the authentication-context part of that flow.

Do not wire Watchlist or Target Price repositories into authentication yet.

---

## 12. No Client-Provided User ID

The architecture security rule remains:

> The client must never determine the user ID used for persistence.

Do not introduce APIs such as:

```text
/api/users/{userId}/watchlists
```

or request payloads containing an ownership user ID.

No REST API is required by this task.

---

## 13. Local Development

Use Cloudflare's current Access development support for Workers where practical.

Configure a local development Access identity through the supported `wrangler` configuration mechanism so that authentication behavior can be exercised under:

```text
wrangler dev
```

without requiring a real Cloudflare Access login.

Use obviously non-production development identity values.

For example, conceptually:

```text
development user
email: developer@example.test
```

Do not use the user's real email address.

Do not commit real authentication tokens, cookies, or personal identity information.

---

## 14. Local Development User ID

The local Access development identity must provide a stable development user identifier compatible with the application mapping.

Use an obviously synthetic value if Cloudflare's development configuration supports specifying it.

For example:

```text
local-development-user
```

or a synthetic UUID.

Do not introduce fallback code such as:

```ts
if (dev) {
  return { id: 'hard-coded-user' };
}
```

Production and development must use the same authentication-context implementation.

Only the Cloudflare runtime configuration may provide the development identity.

---

## 15. Unauthenticated Local Verification

Where supported by the current Cloudflare development integration, also verify the unauthenticated path.

This may require temporarily running without the development Access identity/configuration.

Do not leave temporary insecure production behavior in source code.

If the current tooling makes this verification impractical without destructive configuration changes, document that clearly rather than inventing a workaround.

---

## 16. SvelteKit Integration

Determine the smallest appropriate integration point between SvelteKit server execution and the Cloudflare Workers Access context.

Possible locations may include:

* server hooks;
* request/platform context;
* a server-side adapter/helper around the Cloudflare execution context.

Follow current SvelteKit and Cloudflare adapter conventions.

Do not create a global mutable authenticated-user singleton.

Authentication state must be request-scoped.

---

## 17. Request-Scoped User Context

If SvelteKit `event.locals` is an appropriate current mechanism, it may be used to expose the application-owned authenticated user to later server-side routes.

For example, conceptually:

```text
Cloudflare Access
       |
       v
server hook
       |
       v
event.locals.user
       |
       v
future server routes
```

However, do not force this design if the current Cloudflare/SvelteKit integration provides a simpler or more appropriate request-scoped mechanism.

If `event.locals` is used:

* store only the application-owned user representation;
* do not expose the raw Cloudflare identity through locals;
* update SvelteKit typing appropriately.

Do not implement application routes merely to demonstrate locals.

---

## 18. Authentication Enforcement Scope

Cloudflare Access itself is intended to protect the deployed application.

Application code should still fail closed when the expected authenticated context is absent.

Therefore:

```text
ctx.access missing
```

must never become:

```text
implicitly authenticated
```

This protects against:

* configuration mistakes;
* future route changes;
* local runtime differences.

---

## 19. Testing Strategy

Standard automated tests MUST NOT require:

* a real Cloudflare account;
* a real Access application;
* a real email OTP;
* network access;
* authentication cookies;
* JWTs.

Use minimal fake/test representations of the Cloudflare Access context at the boundary.

Do not mock JWT validation because this application does not perform JWT validation.

---

## 20. Required Unit Tests

At minimum test:

### Valid Identity

A valid Access context/identity produces:

```ts
{
  id: '<stable-id>',
  email: '<email>'
}
```

using application-owned fields.

### Valid Identity Without Email

If the current Cloudflare identity shape permits missing email, verify that a valid stable user ID still produces an authenticated user with no email.

### No Access Context

Produces the selected unauthenticated application error/result.

### Missing User ID

Identity exists but contains no usable stable ID:

```text
authentication failure
```

### Empty User ID

Reject:

```text
""
```

### Whitespace User ID

Reject:

```text
"   "
```

### Identity Retrieval Failure

A failure from `getIdentity()` becomes the selected application-owned authentication error and preserves the cause where appropriate.

### Email Is Not Identity

Verify that the stable ID, not email, becomes `AuthenticatedUser.id`.

Where useful, use two test identities with:

```text
same email / different stable ID
```

or:

```text
same stable ID / different email
```

to make the intended ownership semantics explicit.

---

## 21. No Authentication Persistence

Do not persist:

* `AuthenticatedUser`;
* email;
* Access identity;
* Access token;
* JWT;
* session state

to `WATCHLIST_KV`.

Cloudflare remains the identity provider.

The application's KV namespace stores Watchlists and Target Prices only.

---

## 22. No User Table

Do not introduce an application User repository or User KV document.

The application currently has no requirement for persistent user profile metadata.

Cloudflare Access is the identity store.

A separate User model may be introduced later only if application-owned user metadata becomes necessary.

---

## 23. No Login UI

Do not implement:

* login page;
* logout button;
* OTP form;
* registration form;
* account settings;
* password handling.

Cloudflare Access provides the authentication UI/workflow.

Application UI work is outside this task.

---

## 24. Cloudflare Configuration

Update `wrangler.jsonc` only as required for the current native Workers Access integration and local development identity.

Do not add:

* account ID;
* real Access application identifiers unless technically unavoidable and already known;
* real email addresses;
* API tokens;
* cookies;
* JWTs;
* secrets.

If production Access configuration cannot be completed until the application is manually created in Cloudflare, document the required future setup rather than fabricating values.

---

## 25. Existing KV Configuration

Do not accidentally break the existing:

```text
WATCHLIST_KV
```

binding introduced in TASK-007.

Authentication and KV configuration are independent concerns.

If local `wrangler dev` behavior differs because both Access and KV are now configured, document the observed behavior.

Do not begin application-service wiring merely to exercise both together.

---

## 26. Architecture Documentation

Update `ARCHITECTURE.md` to reflect the current Cloudflare Workers Access integration.

The architecture currently contains earlier assumptions based on directly reading a validated Access JWT / `sub`.

Those assumptions must be updated.

Make targeted changes only to authentication/security sections.

### Required Architecture Changes

The architecture must state that:

* authentication is handled by Cloudflare Access;
* the deployed Worker uses Cloudflare Workers' native Access context;
* application code obtains authenticated identity from `ctx.access`;
* application code does not parse or validate Access JWTs itself;
* the stable Access user identifier returned by the authenticated identity is used as the application user ID;
* email is optional display metadata and is not a persistence identity;
* absence of a valid Access context fails closed;
* user identity remains server-derived and is never supplied by the client.

### Remove Stale JWT/Sub Requirements

Remove or update language requiring the application to:

```text
read the sub claim directly from a validated Access JWT
```

as the normal authentication mechanism.

The application-owned user ID may still correspond semantically to Cloudflare's stable Access identity, but application code should not be coupled to JWT claim parsing.

### Security Principles

Ensure the security section reflects:

```text
Cloudflare Access
       |
       v
native Workers Access context
       |
       v
application-owned AuthenticatedUser
```

rather than:

```text
client/request
       |
       v
application parses JWT itself
```

Do not rewrite unrelated architecture sections.

---

## 27. Documentation

Update `README.md` only if local developer commands or setup genuinely change.

If `wrangler dev` requires a documented local Access development configuration, add a concise developer note.

Do not document a production Cloudflare Access setup that has not yet been performed.

A later deployment task can document the complete Cloudflare dashboard/configuration procedure.

---

## Non-Goals

Do NOT implement:

* manual JWT validation;
* JWKS retrieval;
* `jose`;
* password authentication;
* application-managed users;
* registration;
* login UI;
* logout UI;
* user profile persistence;
* Watchlist application services;
* Target Price application services;
* Watchlist REST endpoints;
* Target Price REST endpoints;
* authorization roles;
* admin users;
* Watchlist sharing;
* Cloudflare KV application wiring;
* Yahoo changes;
* Frankfurter changes;
* UI features;
* production deployment.

Do not add a general authentication framework.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Authentication uses Cloudflare Workers' native Access integration.
2. Application code obtains identity from the trusted Workers Access context.
3. No manual Access JWT parsing is implemented.
4. No JWT/JWKS validation library is introduced.
5. An application-owned authenticated-user representation exists.
6. The authenticated user contains a stable server-derived user ID.
7. Email is optional metadata and not the persistence identity.
8. The raw Cloudflare identity does not leak into application-service contracts.
9. Missing Access context fails closed.
10. Missing/empty/whitespace stable user IDs are rejected.
11. Identity retrieval failures map to a small application-owned authentication error.
12. Original identity-retrieval errors are preserved as causes where useful.
13. Authentication state is request-scoped.
14. No global mutable user state is introduced.
15. Client code cannot determine or submit the persistence user ID.
16. No authentication information is persisted in KV.
17. No application User repository/table/document is introduced.
18. Standard automated tests require no Cloudflare account or network.
19. Tests cover valid identity, unauthenticated context, invalid user IDs, retrieval failure, and email-vs-ID semantics.
20. Local Access development identity is configured/verified where supported by current Cloudflare tooling.
21. No real personal identity, token, cookie, or credential is committed.
22. Existing `WATCHLIST_KV` configuration remains intact.
23. `ARCHITECTURE.md` reflects the native Workers Access integration.
24. Stale direct-JWT/`sub` parsing requirements are removed or corrected.
25. Existing project checks still pass.
26. No Watchlist application service, REST API, or UI functionality is implemented.
27. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Additionally, where supported by the current project/runtime configuration, verify the authentication context under:

```bash
wrangler dev
```

using a synthetic local Access development identity.

The verification should demonstrate that the application-owned authentication-context code can obtain the configured development identity from the real `workerd` Access context.

Where practical, also verify the unauthenticated path.

Do not claim native Access runtime verification unless the code actually executed under `workerd`.

Do not use a real Access token or personal email account for this verification.

---

## Completion Report

When finished, report:

1. files added or changed;
2. the final `AuthenticatedUser` shape;
3. the final authentication-context abstraction/API;
4. the exact Cloudflare identity field used as the stable application user ID;
5. how email is handled;
6. how missing Access context is represented;
7. how invalid identity/user ID is represented;
8. how identity-retrieval failures are represented;
9. whether `event.locals` or another request-scoped SvelteKit mechanism is used and why;
10. unit-test scenarios added;
11. Cloudflare/wrangler configuration changes;
12. whether native Access behavior was actually verified under `wrangler dev` / `workerd`;
13. how local development identity was configured;
14. whether the unauthenticated runtime path was verified;
15. the exact relevant changes made to `ARCHITECTURE.md`;
16. confirmation that no JWT parsing/JWKS validation was introduced;
17. confirmation that no authentication data is persisted;
18. results of `check`, `test`, `lint`, and `build`;
19. assumptions or unresolved issues;
20. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to Watchlist application services, Target Price application services, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
