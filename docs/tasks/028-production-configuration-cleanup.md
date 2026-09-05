# TASK-028: Production Configuration Cleanup

## Status

Done

## Goal

Clean up and finalize the Cloudflare production configuration after the successful production deployment and authentication smoke test.

Production is now working with:

```text
Cloudflare Access
        |
        v
explicit email allowlist
        |
        v
One-Time PIN
        |
        v
Cf-Access-Jwt-Assertion
        |
        v
jose JWT verification
        |
        v
verified sub
        |
        v
user-scoped Watchlist data
```

The two Access configuration values are now stored in the Cloudflare Worker as **Secrets**, not ordinary dashboard Text variables:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

This solved the Wrangler remote-configuration conflict observed when they were dashboard-managed Text variables.

The successful production login has already verified that these Secrets are available to the Worker through `env` and that TASK-026 JWT authentication works in the real deployment.

This task must:

* align repository configuration and documentation with the final Secret-based production setup;
* investigate and, if supported by the installed/current Wrangler version, declare the required Secret bindings through Wrangler configuration without storing their values;
* simplify the TASK-027 dashboard-variable typing workaround if Wrangler can now generate the Secret names;
* determine whether `keep_vars: true` is still necessary;
* preserve the working production authentication architecture;
* preserve convenient local development;
* leave production deployment as a manual user action.

This is a configuration cleanup task.

Do not add product functionality.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `README.md`
* `wrangler.jsonc`
* `package.json`
* `src/app.d.ts`
* TASK-026;
* TASK-027;
* this task completely.

Inspect the actual installed Wrangler schema/version before changing configuration.

Current observed Wrangler version during production deployment:

```text
4.128.0
```

Do not rely on stale assumptions about Wrangler configuration.

---

# Production State Already Verified

## 1. Successful Production Authentication

The following has already been verified manually in production:

```text
https://watchlist.investment-tools.workers.dev
        |
        v
Cloudflare Access login
        |
        v
allowlisted email
        |
        v
One-Time PIN received
        |
        v
PIN accepted
        |
        v
Watchlist application loads successfully
```

The previous:

```text
Authentication is required.
```

failure no longer occurs.

Do not change the JWT authentication mechanism unless a concrete defect is discovered.

---

## 2. Negative Allowlist Test

The production Access allowlist has also been tested with a non-allowlisted email address.

Observed behavior:

```text
non-allowlisted email entered
        |
        v
Cloudflare displays PIN-entry step
        |
        v
no PIN email is actually delivered
        |
        v
user cannot authenticate
        |
        v
Watchlist remains inaccessible
```

This is expected Cloudflare Access behavior.

Do not attempt to change or reproduce this behavior inside the application.

---

# Final Production Secret Model

## 3. Current Secret Ownership

The real values are configured manually in:

```text
Cloudflare Worker
→ Runtime variables and secrets
```

with:

```text
ACCESS_TEAM_DOMAIN
Type: Secret

ACCESS_AUD
Type: Secret
```

The actual values MUST remain absent from the repository.

---

## 4. Secret Semantics

Although these values are configuration rather than high-value credentials, using Cloudflare Secret bindings is intentional because it provides a stable deployment ownership model.

Wrangler deployment must not replace them with absent local `vars`.

Do not convert them back to ordinary Text variables.

---

## 5. No Real Values in Repository

Never add the actual:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

values to:

* `wrangler.jsonc`;
* source code;
* README;
* ARCHITECTURE.md;
* CLAUDE.md;
* task files;
* tests;
* fixtures.

Tests must continue using synthetic values.

---

# Investigate `secrets.required`

## 6. Verify Support First

Before changing `wrangler.jsonc`, inspect:

```text
node_modules/wrangler/config-schema.json
```

and/or the installed Wrangler documentation/schema to determine whether the installed Wrangler version supports a configuration concept equivalent to:

```json
"secrets": {
  "required": [
    "ACCESS_TEAM_DOMAIN",
    "ACCESS_AUD"
  ]
}
```

Do not assume this syntax exists merely because it was suggested during deployment troubleshooting.

Use the actual installed schema as authoritative for repository compatibility.

---

## 7. If `secrets.required` Is Supported

If the installed Wrangler schema supports required Secret declarations, add:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

as required Secret names without values.

The intended result is conceptually:

```text
wrangler.jsonc
        |
        +-- declares required secret names
        |
        v
wrangler types
        |
        v
generated Env knows the bindings exist

Cloudflare
        |
        +-- stores actual secret values
```

No production value may enter the repository.

---

## 8. Verify Actual Behavior

Do not stop at schema acceptance.

If `secrets.required` or equivalent is introduced, verify what it actually does with:

```bash
npm run gen
```

Inspect the regenerated:

```text
worker-configuration.d.ts
```

and determine whether:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

are generated as environment properties.

Report the observed generated type shape.

---

## 9. If `secrets.required` Is Not Supported

If Wrangler 4.128.0 does not support the proposed configuration:

* do not invent unsupported configuration;
* retain the TASK-027 `AccessEnvironment` type composition;
* document that this remains necessary because dashboard/Secret bindings cannot be inferred by `wrangler types`.

Do not upgrade Wrangler solely to obtain this feature unless explicitly required and justified.

---

# TASK-027 Type Cleanup

## 10. Current Type Workaround

TASK-027 introduced conceptually:

```ts
interface AccessEnvironment {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
```

and:

```ts
App.Platform.env = Env & AccessEnvironment
```

because dashboard-only variables were invisible to `wrangler types`.

Review whether this remains necessary after the final Secret declaration strategy.

---

## 11. Remove Only If Redundant

If fresh generated `Env` now includes:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

with appropriate types, remove redundant application-owned type composition where doing so clearly simplifies the code.

Do not retain duplicate declarations for the same bindings without reason.

---

## 12. Keep If Still Required

If generated `Env` still does not contain the Secret bindings, keep the narrow TASK-027 composition.

Do not force removal merely for cleanup aesthetics.

Correct typing is more important than minimizing one interface.

---

## 13. Optionality and Runtime Validation

Even if generated types declare the Secret bindings as required strings, TASK-026 runtime fail-closed validation must remain.

Do not remove checks for missing/empty:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

merely because TypeScript says the properties exist.

Runtime deployment misconfiguration remains possible.

---

# `keep_vars`

## 14. Review `keep_vars`

`wrangler.jsonc` currently contains:

```json
"keep_vars": true
```

This was introduced while:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

were dashboard-managed ordinary Text variables.

They are now Secrets.

Determine from the installed/current Wrangler behavior whether `keep_vars` is still required for any repository-external ordinary variables.

---

## 15. Remove If No Longer Needed

If:

* the only externally managed values are now Secrets; and
* Wrangler preserves Secrets independently of `keep_vars`; and
* no other dashboard-managed Text variables exist;

then remove:

```json
"keep_vars": true
```

as obsolete configuration.

Document why it is no longer required.

---

## 16. Keep If Still Needed

If another concrete dashboard-managed ordinary variable depends on `keep_vars`, retain it and document that reason.

Do not keep it merely because TASK-027 previously required it.

---

# Wrangler Deploy Behavior

## 17. Preserve Secret Deployment Safety

The final configuration should allow normal:

```bash
npm run deploy
```

without Wrangler proposing to delete:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

because their values are absent from local `vars`.

Do not perform an actual production deploy during this task.

---

## 18. Dry/Configuration Verification

Use non-deploying Wrangler/schema/config inspection where available to establish that the final repository configuration is valid.

Do not execute a command that mutates the production Worker.

---

# Deployment Script

## 19. Preserve Build-Then-Deploy

Keep the existing deployment script conceptually equivalent to:

```json
"deploy": "npm run build && wrangler deploy"
```

The build is required because Wrangler's configured entry point is:

```text
.svelte-kit/cloudflare/_worker.js
```

Do not revert to a deploy command that assumes this generated file already exists.

---

## 20. No `--keep-vars` Unless Needed

If `keep_vars` is no longer part of the final model, do not add:

```text
--keep-vars
```

to the deployment script.

If it remains genuinely required for another variable, document why.

---

# Authentication

## 21. Do Not Change JWT Architecture

Production authentication remains:

```text
Cf-Access-Jwt-Assertion
        |
        v
jose
        |
        +-- Cloudflare JWKS
        +-- issuer
        +-- audience
        +-- expiration
        |
        v
verified sub
```

Do not return to:

```text
ctx.access
```

for production authentication.

---

## 22. Preserve Fail-Closed Behavior

Missing/invalid Secret configuration must still result in unauthenticated behavior.

No production fallback user.

---

## 23. Preserve Local Authentication

Local:

```bash
npm run dev
```

continues to use:

```text
DevelopmentAuthenticationContext
```

and:

```text
local-development-user
```

without requiring production Secrets.

---

# Documentation Corrections

## 24. ARCHITECTURE.md

Correct the configuration-ownership description introduced by TASK-027.

The final architecture should state:

```text
Repository
├── declares Worker resources/runtime configuration
├── may declare required Secret names if supported
└── never contains real Access Secret values

Cloudflare Worker
├── ACCESS_TEAM_DOMAIN (Secret)
└── ACCESS_AUD (Secret)
```

Remove language describing these as dashboard-managed ordinary Text variables.

---

## 25. Secret Rationale

Document briefly why the two Access values are represented as Worker Secrets:

* values remain outside the repository;
* Wrangler deployments preserve Secret bindings safely;
* the Worker receives them through `env`;
* this avoids remote-vs-local ordinary-variable overwrite conflicts.

Do not claim the values themselves are highly confidential credentials if that is not true.

---

## 26. README

Update production setup instructions.

They should tell a future developer/operator to configure:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

under:

```text
Worker
→ Runtime variables and secrets
```

with:

```text
Type: Secret
```

Do not instruct them to add the values to `wrangler.jsonc`.

---

## 27. Team Domain Format

Document the required format:

```text
ACCESS_TEAM_DOMAIN =
https://<team-name>.cloudflareaccess.com
```

The `https://` prefix is required by the current authentication implementation.

This was a real production configuration issue and should not have to be rediscovered.

---

## 28. Audience Meaning

Document that:

```text
ACCESS_AUD
```

is the **Application Audience (AUD) Tag** for the Access application protecting the Watchlist Worker.

It is not:

* policy ID;
* account ID;
* application display name.

Do not include the real value.

---

## 29. CLAUDE.md

Correct any TASK-027 guidance saying the Access values are dashboard-managed ordinary variables.

Future agents should understand:

* they are production Worker Secrets;
* real values must not be added to repository files;
* generated Cloudflare files must not be manually edited;
* required Secret-name declarations may exist in Wrangler config.

---

# TASK-027 Historical Context

## 30. Preserve TASK-027

Do not rewrite TASK-027 as if its decision was irrational.

At the time, the production values were ordinary dashboard variables and caused a real generated-type/ownership issue.

If useful, add a concise supersession note:

```text
Production ACCESS_* values were subsequently changed from dashboard Text
variables to Worker Secrets in TASK-028 to avoid Wrangler remote-variable
override conflicts.
```

Do not change TASK-027's Done status.

---

# Production Verification Documentation

## 31. Record Successful OTP Verification

Document that production authentication has now been manually verified with:

```text
allowlisted email
→ One-Time PIN delivered
→ PIN accepted
→ application successfully authenticated
```

This is operational evidence, not an automated test.

Do not record the actual email address.

---

## 32. Record Negative Allowlist Verification

Document the observed negative test:

```text
non-allowlisted email
→ PIN entry UI shown
→ no PIN email delivered
→ no application access
```

Clarify that this is expected Cloudflare behavior and avoids leaking allowlist membership.

---

# Production Persistence Check

## 33. Do Not Modify Production Data Automatically

Claude Code must not create or modify production Watchlists as part of this cleanup.

If production persistence has already been manually verified, document that fact if provided by the user.

Otherwise leave it as a manual post-task check.

---

# Tests

## 34. Generated Types

After final configuration changes:

```bash
npm run gen
```

must succeed.

Inspect generated types.

---

## 35. Type Check

Run:

```bash
npm run check
```

after fresh generation.

There must be no recurrence of the TASK-027 `Env` incompatibility.

---

## 36. Authentication Tests

Run the existing TASK-026 authentication tests.

Do not weaken:

* signature verification;
* issuer validation;
* audience validation;
* expiration validation;
* missing-sub handling;
* fail-closed configuration behavior.

---

## 37. Local Development

Actually verify:

```bash
npm run dev
```

still allows local application usage without OTP.

At minimum verify one authenticated local API request.

---

## 38. E2E

Existing deterministic Playwright tests remain independent of Cloudflare Access.

Run the complete suite.

Do not change the E2E authentication strategy.

---

# No Production Mutation

## 39. Do Not Deploy

Do NOT execute:

```bash
npm run deploy
```

or:

```bash
wrangler deploy
```

during this task.

The user performs deployment manually after review.

---

## 40. Do Not Modify Secrets

Do not use Wrangler/API/dashboard automation to:

* set;
* delete;
* rotate;
* inspect

the real production Secret values.

---

# Non-Goals

Do NOT implement:

* new authentication mechanisms;
* `ctx.access` production authentication;
* Access policy automation;
* OTP handling in application code;
* login/logout UI;
* user management;
* custom domain;
* additional Worker environments;
* additional KV namespaces;
* business/UI functionality;
* production deployment;
* unrelated dependency upgrades;
* Wrangler upgrade solely for cleanup convenience.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Final production Access configuration is documented as Worker Secrets.
2. `ACCESS_TEAM_DOMAIN` remains outside the repository.
3. `ACCESS_AUD` remains outside the repository.
4. No placeholder values are reintroduced.
5. Installed Wrangler support for required Secret declarations is verified rather than assumed.
6. `secrets.required` or equivalent is used only if actually supported.
7. Required Secret declaration contains names only, never values.
8. `npm run gen` behavior with required Secrets is empirically verified.
9. Generated `Env` shape is inspected and reported.
10. TASK-027 `AccessEnvironment` composition is removed only if genuinely redundant.
11. No generated file is manually edited.
12. Runtime fail-closed configuration validation remains.
13. Missing Team Domain cannot authenticate.
14. Missing Audience cannot authenticate.
15. Local development does not require production Secrets.
16. Local synthetic identity remains unchanged.
17. `keep_vars` necessity is explicitly reviewed.
18. `keep_vars` is removed if no ordinary dashboard-managed variables require it.
19. Deployment script continues to build before Wrangler deploy.
20. Deployment script does not gain unnecessary `--keep-vars`.
21. JWT verification architecture remains unchanged.
22. Production does not fall back to development identity.
23. README documents Worker Secret setup.
24. README documents the required full Team Domain URL format.
25. README identifies `ACCESS_AUD` as Application Audience Tag.
26. ARCHITECTURE.md reflects final Secret ownership.
27. CLAUDE.md reflects final Secret ownership.
28. TASK-027 historical context remains preserved.
29. Successful production OTP login is documented.
30. Negative allowlist behavior is documented.
31. No actual production Secret value is exposed.
32. Existing authentication security tests remain green.
33. `npm run gen` passes.
34. `npm run check` passes.
35. `npm run test` passes.
36. `npm run test:e2e` passes.
37. `npm run lint` passes.
38. `npm run build` passes.
39. `npm run dev` local authenticated path is verified.
40. No production deployment is performed.
41. No production Secret mutation is performed.
42. No unrelated product functionality changes.
43. No unnecessary production dependency is introduced.

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

Also:

1. inspect the installed Wrangler schema for required Secret support;
2. inspect regenerated `worker-configuration.d.ts`;
3. verify missing-production-config tests remain fail-closed;
4. start `npm run dev`;
5. verify one authenticated local API request works without OTP.

Do NOT execute:

```bash
npm run deploy
```

or:

```bash
npx wrangler deploy
```

Do not modify Cloudflare production Secrets.

---

# Manual Steps After Completion

Claude must provide the user with the final manual sequence.

Expected sequence:

```text
1. Review TASK-028 diff.
2. Commit manually.
3. Confirm Worker has:
   ACCESS_TEAM_DOMAIN (Secret)
   ACCESS_AUD (Secret)
4. Confirm ACCESS_TEAM_DOMAIN includes https://.
5. Confirm ACCESS_AUD is the Access Application Audience Tag.
6. Confirm WATCHLIST_KV points to watchlist-production.
7. Run npm run deploy manually.
8. Confirm Wrangler does not propose deleting ACCESS_* as ordinary vars.
9. Test allowlisted OTP login.
10. Verify production persistence.
```

The negative allowlist test does not need to be repeated unless the Access policy changes.

---

# Task Status

After all implementation and local verification criteria are satisfied, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

The task may be marked Done before the user's manual deployment.

Do not modify unrelated task statuses.

---

# Completion Report

When finished, report:

1. files added/changed;
2. installed Wrangler version inspected;
3. whether `secrets.required` or equivalent is supported;
4. final Wrangler Secret-name declaration, if any;
5. fresh generated `Env` result;
6. final `AccessEnvironment` typing decision;
7. confirmation generated files were not manually edited;
8. final `keep_vars` decision and evidence;
9. final deployment script;
10. confirmation no `--keep-vars` is required, if applicable;
11. final production configuration ownership model;
12. confirmation real Access values remain absent from repository;
13. runtime fail-closed behavior;
14. local-development behavior;
15. authentication-test result;
16. `ARCHITECTURE.md` changes;
17. README changes;
18. CLAUDE.md changes;
19. TASK-027 supersession/history note;
20. documented successful production OTP evidence;
21. documented negative allowlist evidence;
22. results of `gen`, `check`, `test`, `test:e2e`, `lint`, and `build`;
23. local `npm run dev` verification;
24. confirmation no production deploy was performed;
25. confirmation no production Secrets were modified;
26. exact manual steps the user should perform next;
27. confirmation task status changed to Done;
28. assumptions or unresolved issues;
29. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to unrelated V2 functionality.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
