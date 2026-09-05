# TASK-027: Dashboard-Managed Production Variables and Deployment Configuration

## Status

Done

> **Superseded in part by TASK-028.** Production `ACCESS_TEAM_DOMAIN`/
> `ACCESS_AUD` values were subsequently changed from dashboard Text
> variables to Worker Secrets in TASK-028 to avoid Wrangler remote-variable
> override conflicts. `keep_vars: true` and the `Env & AccessEnvironment`
> composition described below were the correct solution for the
> dashboard-Text-variable model in place at the time; see TASK-028 for the
> final Secret-based configuration.

## Goal

Finalize the Cloudflare production configuration introduced by TASK-026 so that:

* `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are managed only in the Cloudflare Worker dashboard;
* real production Access values are not stored in the repository;
* Wrangler deployments preserve those dashboard-managed variables;
* generated Cloudflare environment types remain usable;
* TypeScript understands that production may provide the two Access variables even though `wrangler types` cannot discover dashboard-only values;
* production authentication continues to fail closed if either value is unavailable;
* deployment always builds the SvelteKit Worker before invoking Wrangler.

The user has already made these configuration decisions:

```text
wrangler.jsonc
├── ACCESS_* placeholder vars removed
├── keep_vars = true
├── WATCHLIST_KV remains configured
└── production Access values are NOT stored in the repository

Cloudflare Worker Dashboard
├── ACCESS_TEAM_DOMAIN = real production value
└── ACCESS_AUD = real production value
```

The user has also added a deployment script that builds before deployment.

The current problem is local/generated TypeScript typing:

```text
src/hooks.server.ts

Argument of type 'Env | undefined' is not assignable to parameter of type
'{ ACCESS_TEAM_DOMAIN?: string | undefined;
   ACCESS_AUD?: string | undefined; } | undefined'.

Type 'Env' has no properties in common with type ...
```

This occurs because:

```text
wrangler types
```

can derive bindings from repository configuration but cannot discover runtime variables configured only in the Cloudflare dashboard.

Fix this cleanly without reintroducing fake production values.

This task MUST NOT deploy the Worker.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `README.md`
* `wrangler.jsonc`
* `package.json`
* `worker-configuration.d.ts`
* TASK-026;
* this task completely.

Inspect the current TASK-026 authentication implementation before changing types.

Relevant production authentication configuration is:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

Relevant production resource binding is:

```text
WATCHLIST_KV
```

---

# Configuration Ownership

## 1. Production Access Values

The real values of:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

are managed in:

```text
Cloudflare Dashboard
→ Worker: watchlist
→ Settings
→ Runtime variables and secrets
```

or the equivalent current Cloudflare UI.

Do not move the real values into the repository.

---

## 2. No Placeholder `vars`

Do NOT reintroduce a configuration such as:

```json
"vars": {
  "ACCESS_TEAM_DOMAIN": "https://your-team-name.cloudflareaccess.com",
  "ACCESS_AUD": "your-access-application-audience-tag"
}
```

merely to satisfy `wrangler types`.

Those are not real runtime values and must not be deployable as if they were.

---

## 3. Preserve `keep_vars`

Keep:

```json
"keep_vars": true
```

in `wrangler.jsonc`.

This is intentional because production runtime variables are managed outside the Wrangler configuration file.

Do not remove it unless current Wrangler behavior proves the configuration incorrect.

---

## 4. Preserve Production KV Binding

Do not alter the established:

```text
WATCHLIST_KV
```

production binding except where generated typing requires normal regeneration.

Do not create another KV namespace.

Do not rename the binding.

---

# Generated Types

## 5. Generated File Is Not Source Code

Treat:

```text
worker-configuration.d.ts
```

as generated output.

Do NOT manually add:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

to that file.

Any solution that disappears after:

```bash
npm run gen
```

is invalid.

---

## 6. Regeneration Must Remain Safe

After the fix, running:

```bash
npm run gen
```

must not break TypeScript compilation.

The expected workflow remains:

```text
wrangler.jsonc
      |
      v
wrangler types
      |
      v
worker-configuration.d.ts
```

followed by application-owned typing for dashboard-only configuration where necessary.

---

# Application-Owned Environment Typing

## 7. Introduce Explicit Type for Dashboard Variables

Represent the dashboard-managed Access configuration through a small application-owned type.

Conceptually:

```ts
interface AccessEnvironment {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
```

or equivalent.

The exact name/location should fit the existing server/auth architecture.

Do not create a large parallel copy of Cloudflare's generated `Env`.

---

## 8. Compose Rather Than Replace Generated Env

Where the application needs both generated Cloudflare bindings and dashboard-only variables, compose the types.

Conceptually:

```ts
type ApplicationEnv = Env & AccessEnvironment;
```

or an equivalent narrow intersection.

Do not manually reproduce generated bindings such as:

```text
WATCHLIST_KV
ASSETS
```

inside a handwritten full `Env` interface.

Generated Cloudflare typing remains authoritative for generated bindings.

---

## 9. Narrow Authentication Dependency

Prefer making the authentication factory depend only on the configuration it actually needs.

Conceptually:

```ts
type AccessEnvironment = {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};
```

rather than requiring the entire Worker environment if that keeps the boundary cleaner.

The production authentication implementation does not need to know about:

```text
WATCHLIST_KV
ASSETS
```

---

## 10. No Unsafe Broad Cast

Do not solve the problem with a broad assertion such as:

```ts
event.platform?.env as any
```

or:

```ts
event.platform?.env as unknown as SomeHugeEnv
```

merely to silence TypeScript.

If a narrow type assertion is genuinely necessary at the Cloudflare/SvelteKit boundary because generated types cannot represent dashboard-only bindings, keep it:

* local;
* narrow;
* documented;
* covered by fail-closed runtime validation.

Prefer structural composition where TypeScript permits it.

---

# Runtime Validation

## 11. Types Do Not Establish Trust

TypeScript declarations do not prove that the production dashboard variables exist.

TASK-026's runtime validation remains mandatory.

The production authentication factory must still treat missing:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

as invalid production configuration.

---

## 12. Missing Team Domain

If:

```text
ACCESS_TEAM_DOMAIN
```

is absent, empty, or unusable in production:

```text
authentication fails closed
```

Do not use a placeholder.

Do not use a default Cloudflare domain.

Do not fall back to the development user.

---

## 13. Missing Audience

If:

```text
ACCESS_AUD
```

is absent or empty:

```text
authentication fails closed
```

Do not accept arbitrary Access JWT audiences.

---

## 14. No Environment Fallback

Do not introduce:

```ts
env.ACCESS_TEAM_DOMAIN ?? 'https://your-team...'
```

or equivalent.

No production default values exist.

---

# Local Development

## 15. Preserve TASK-026 Local Authentication

Normal:

```bash
npm run dev
```

must continue to use:

```text
DevelopmentAuthenticationContext
```

with the stable synthetic local identity.

It must not require:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

to be present locally.

---

## 16. Local User

Preserve the established local identity:

```text
local-development-user
```

or the exact current TASK-026 equivalent.

Do not change local KV ownership.

---

## 17. No Production Vars Required for Dev

A developer cloning the repository must not need the real production:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

values to run:

```bash
npm run dev
```

This is an important portability requirement.

---

## 18. Local Preview Remains Fail-Closed

Preserve TASK-026's established behavior for the built Worker/local preview unless the current implementation deliberately provides a trusted local-production-mode configuration.

Do not weaken production-mode authentication merely to make preview easier.

---

# Deployment Script

## 19. Build Before Deploy

Verify the user-added deployment script builds before invoking Wrangler.

Conceptually:

```json
"deploy": "npm run build && wrangler deploy"
```

or equivalent using the project's normal command conventions.

The exact existing implementation may differ.

---

## 20. Why Build Is Required

Document concisely that Wrangler's entry point is:

```text
.svelte-kit/cloudflare/_worker.js
```

which is generated by the SvelteKit build.

Therefore direct:

```bash
npx wrangler deploy
```

from a clean tree may fail because the entry-point file does not yet exist.

---

## 21. Deployment Command

After this task, the documented deployment command should be:

```bash
npm run deploy
```

rather than instructing developers to manually remember:

```bash
npm run build
npx wrangler deploy
```

Do not deploy during this task.

---

# Dashboard Variables and Wrangler

## 22. Document `keep_vars`

Document why:

```json
"keep_vars": true
```

exists.

The reason is:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

are intentionally managed in the Cloudflare dashboard rather than `wrangler.jsonc`.

Future agents must not remove `keep_vars` as "unused cleanup" without revisiting this deployment decision.

---

## 23. Source of Truth

Document the final split clearly:

```text
Repository / wrangler.jsonc
├── Worker name/runtime configuration
├── WATCHLIST_KV binding
├── assets configuration
├── workers.dev configuration
└── keep_vars = true

Cloudflare Worker dashboard
├── ACCESS_TEAM_DOMAIN
└── ACCESS_AUD
```

Do not imply that the Access values can be reconstructed from repository configuration.

---

# Security

## 24. Production Authentication Unchanged

This task must not weaken TASK-026 JWT validation.

Production still requires:

```text
Cf-Access-Jwt-Assertion
        |
        v
signature verification
        |
        v
issuer validation
        |
        v
audience validation
        |
        v
verified sub
```

---

## 25. No Development Fallback

Typing changes must not accidentally make production authentication fall back to:

```text
local-development-user
```

when dashboard variables are missing.

---

## 26. No Request-Controlled Configuration

Do not allow request values to supply:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

No:

```text
query parameters
headers
cookies
form fields
```

may override deployment configuration.

---

# Tests

## 27. Type/Factory Tests

Extend existing TASK-026 tests only where necessary.

At minimum preserve proof that:

* missing `ACCESS_TEAM_DOMAIN` fails closed;
* missing `ACCESS_AUD` fails closed;
* valid configuration can construct/use the production authentication path;
* production never falls back to development identity.

Do not duplicate the complete JWT cryptography suite if it is already covered.

---

## 28. Development Test

Preserve/verify that development authentication works without either dashboard variable.

---

## 29. Regeneration Test

Actually execute:

```bash
npm run gen
```

after the final configuration/type changes.

Then execute:

```bash
npm run check
```

The exact failure that triggered this task must be gone.

---

## 30. Generated Type Inspection

Verify after regeneration that:

```text
worker-configuration.d.ts
```

does not need to contain the dashboard-only variables for application compilation to succeed.

This is intentional.

---

# Documentation

## 31. ARCHITECTURE.md

Update `ARCHITECTURE.md` with a small targeted clarification of production configuration ownership.

Document:

* Access JWT authentication from TASK-026;
* `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are dashboard-managed runtime variables;
* `wrangler types` cannot infer dashboard-only values;
* application-owned narrow typing bridges this compile-time gap;
* runtime presence is still validated fail-closed;
* `keep_vars: true` preserves dashboard-managed variables during Wrangler deployment;
* local development does not require production Access values.

Do not rewrite the authentication architecture.

---

## 32. README

Update README's deployment/configuration instructions.

Document at minimum:

```text
Required production dashboard variables:
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

and:

```bash
npm run deploy
```

Explain that the deploy script performs the required build first.

Do not include the user's real values.

---

## 33. CLAUDE.md

If necessary, add a concise infrastructure rule that:

* dashboard-managed production variables must not be replaced with fake `wrangler.jsonc` placeholders merely for type generation;
* generated `worker-configuration.d.ts` must not be manually edited.

Only add this if existing guidance does not already cover generated/configuration files sufficiently.

---

# Production Deployment — Manual Only

## 34. Do Not Deploy

Claude Code MUST NOT execute:

```bash
npm run deploy
```

or:

```bash
wrangler deploy
```

during this task.

Deployment remains a manual user action.

---

## 35. Do Not Modify Dashboard

Claude Code MUST NOT modify:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

in Cloudflare.

The user has already configured the real values manually.

---

## 36. Post-Task Manual Sequence

At completion, tell the user the exact next sequence:

```text
1. Review diff.
2. Commit manually.
3. Confirm dashboard ACCESS_TEAM_DOMAIN exists.
4. Confirm dashboard ACCESS_AUD exists.
5. Confirm WATCHLIST_KV points to watchlist-production.
6. Run npm run deploy manually.
7. Test production through Cloudflare Access One-Time PIN.
```

---

# Production Smoke Test After Manual Deployment

## 37. OTP Login

After the user deploys manually, verify in an incognito/private browser:

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
One-Time PIN
        |
        v
Watchlist application
```

The previous:

```text
Authentication is required.
```

failure must no longer occur for a valid Access session.

---

## 38. Production Persistence

After successful login:

1. create a Watchlist;
2. add a representative stock;
3. optionally set a Target Price;
4. reload the page;
5. confirm the data remains.

This verifies:

```text
verified Access sub
        |
        v
user-scoped production KV
```

---

## 39. Production KV Inspection

Where practical, inspect `watchlist-production` in the Cloudflare dashboard.

Expected key structure:

```text
user:<verified-user-id>:watchlists
user:<verified-user-id>:target-prices
```

Do not expose the complete production user identifier in public logs/documentation.

---

## 40. Allowlist Test

Test a non-allowlisted email address.

It must not gain access to the Watchlist application.

This remains primarily enforced by Cloudflare Access.

---

# Non-Goals

Do NOT implement:

* another authentication mechanism;
* another JWT library;
* secrets management redesign;
* Cloudflare API automation;
* production deployment;
* custom domain;
* additional KV namespaces;
* authentication UI;
* user management;
* password support;
* request-controlled development mode;
* UI/business features;
* unrelated refactors.

Do not modify the server-side business model.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Real Access production values remain absent from the repository.
2. Placeholder Access values are not reintroduced into `wrangler.jsonc`.
3. `keep_vars: true` remains configured.
4. `WATCHLIST_KV` remains unchanged.
5. `worker-configuration.d.ts` is not manually edited.
6. `npm run gen` may regenerate the file safely.
7. Dashboard-only Access variables have an application-owned narrow type.
8. Generated Cloudflare `Env` is not manually duplicated.
9. Type composition remains narrow and understandable.
10. No broad `any` cast is introduced.
11. Production still validates runtime presence of Team Domain.
12. Production still validates runtime presence of Audience.
13. Missing Team Domain fails closed.
14. Missing Audience fails closed.
15. No placeholder/default production values exist.
16. Local development does not require production Access values.
17. Local development still uses the synthetic user.
18. Local KV identity remains unchanged.
19. Production cannot fall back to development identity.
20. Request input cannot override Access configuration.
21. Deployment script builds before Wrangler deploy.
22. Direct generated-entry-point dependency is documented.
23. `npm run deploy` is the documented deployment command.
24. `keep_vars` purpose is documented.
25. Repository-vs-dashboard configuration ownership is documented.
26. TASK-026 JWT validation remains unchanged.
27. Existing security tests remain green.
28. Development-auth tests remain green.
29. `npm run gen` is actually executed.
30. `npm run check` passes after regeneration.
31. `worker-configuration.d.ts` need not contain dashboard-only Access vars.
32. `ARCHITECTURE.md` reflects the final configuration ownership.
33. README documents dashboard variables and deployment command.
34. No real production values are written to documentation.
35. No production deployment is performed.
36. No Cloudflare dashboard changes are performed.
37. Existing unit tests pass.
38. Existing E2E tests pass.
39. Lint passes.
40. Build passes.
41. No unrelated business/UI functionality changes.
42. No unnecessary dependency is introduced.

---

# Verification

Before completing the task, execute:

```bash
npm run gen
npm run check
npm run test
npm run test:e2e
npm run lint
npm run build
```

Verify specifically that the previous error in:

```text
src/hooks.server.ts
```

is gone after a fresh:

```bash
npm run gen
```

Do not manually modify generated types after regeneration.

Do NOT execute:

```bash
npm run deploy
```

or:

```bash
npx wrangler deploy
```

Do not modify the user's Cloudflare account.

---

# Task Status

After all implementation and local verification acceptance criteria are satisfied, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

This task may be marked Done before production deployment because deployment is explicitly a manual user responsibility.

Do not modify unrelated task statuses.

---

# Completion Report

When finished, report:

1. exact cause of the generated `Env` typing failure;
2. files added/changed;
3. final application-owned Access environment type;
4. how generated `Env` and dashboard-only vars are composed;
5. whether any type assertion is required and why;
6. confirmation that generated `worker-configuration.d.ts` was not manually edited;
7. result of fresh `npm run gen`;
8. production missing-config behavior;
9. confirmation that production cannot fall back to development identity;
10. local-development behavior;
11. local KV identity behavior;
12. final `wrangler.jsonc` ownership model;
13. confirmation that no placeholder Access vars remain;
14. `keep_vars` behavior/documentation;
15. final deployment script;
16. README deployment instructions;
17. `ARCHITECTURE.md` changes;
18. `CLAUDE.md` changes, if any;
19. tests added/changed;
20. results of `gen`, `check`, `test`, `test:e2e`, `lint`, and `build`;
21. confirmation that no production deployment was performed;
22. confirmation that no Cloudflare dashboard changes were performed;
23. exact manual steps the user should perform next;
24. confirmation that task status changed to Done;
25. assumptions or unresolved issues;
26. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to production deployment.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
