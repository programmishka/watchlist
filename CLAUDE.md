# CLAUDE.md

## Project Context

This repository contains a lightweight multi-user stock watchlist built with Svelte 5, SvelteKit, TypeScript, and Cloudflare.

The authoritative architectural documentation is:

* `ARCHITECTURE.md`
* accepted ADRs under `docs/adr/`
* task specifications under `docs/tasks/`

## Before Implementing a Task

1. Read `ARCHITECTURE.md`.
2. Read the complete task specification.
3. Read ADRs relevant to the task.
4. Inspect the existing code before making changes.
5. Identify existing patterns and reuse them where appropriate.

Do not change accepted architectural decisions as part of a feature task. If a task conflicts with the architecture, report the conflict instead of silently introducing a different design.

## Architecture Rules

* Business logic belongs on the server.
* Keep Svelte components focused on presentation and user interaction.
* Keep client-side state UI-oriented.
* Filtering and sorting of already loaded watchlist data may happen on the client.
* Do not implement investment calculations in client-side code.
* Do not access Cloudflare KV from client-side code.
* Derive the authenticated user identity on the server from Cloudflare Access.
* Never trust or require a user ID supplied by the client for user-owned resources.
* Keep persistence behind repository boundaries.
* Keep external services behind application-owned provider abstractions.
* Yahoo Finance-specific data structures and workarounds must remain isolated from domain logic.
* Frankfurter-specific data structures must remain isolated from domain logic.
* Prefer simple boundaries over unnecessary architectural layers.

Refer to `ARCHITECTURE.md` for the detailed domain model, persistence model, calculations, security rules, and provider strategy.

## Development Guidelines

* Use TypeScript.
* Follow existing project conventions.
* Keep changes scoped to the current task.
* Prefer straightforward, readable implementations.
* Avoid speculative abstractions and premature generalization.
* Do not introduce new production dependencies unless they provide a clear benefit required by the task.
* Do not refactor unrelated code while implementing a task.
* Validate mutation input on the server.
* Return application-level errors instead of exposing raw infrastructure or provider errors.

## Git Workflow

Git repository history is managed by the user.

- Do not stage changes.
- Do not create commits.
- Do not push changes to any remote repository.
- Do not amend, reset, rebase, or otherwise modify Git history.
- You may use read-only Git commands such as `git status`, `git diff`, and
  `git log` to inspect the repository and review your changes.

After completing a task, leave all changes in the working tree for the user
to review and commit manually.

## Business Logic

Business calculations should preferably be implemented as pure functions where practical.

This especially applies to:

* target-price distance;
* dividend normalization;
* dividend yield;
* currency/unit normalization;
* market-cap conversion;
* investment factors;
* savings allocation;
* invested-total calculation.

Do not duplicate business formulas between server and client.

## Testing

Unit tests are required for new or changed business logic.

Tests for pure business logic must not require:

* network access;
* Cloudflare;
* Workers KV;
* Yahoo Finance;
* Frankfurter.

Use test doubles for infrastructure and external providers where appropriate.

Before completing a task, run all relevant checks that are configured in the project, including:

* unit tests;
* TypeScript/type checking;
* linting;
* formatting checks.

Do not claim that checks passed unless they were actually executed successfully.

## Security

Never commit or expose:

* passwords;
* API tokens;
* Cloudflare secrets;
* authentication tokens;
* Yahoo cookies;
* Yahoo crumbs;
* other credentials or session material.

Secrets belong in the appropriate Cloudflare/server-side secret configuration.

Never expose server-side secrets to Svelte client code.

User-owned data must always be scoped using the authenticated server-side user identity.

## External Providers

Yahoo Finance is an unofficial and potentially unstable dependency.

Do not allow Yahoo-specific response models, field names, cookie handling, crumb handling, or workarounds to leak beyond the Yahoo adapter/provider boundary.

Exchange-rate access follows the same principle through the application's exchange-rate provider abstraction.

Provider implementations must be replaceable without redesigning the application's business logic.

## Task Completion

Before considering a task complete:

1. Verify every acceptance criterion from the task.
2. Run the relevant automated checks.
3. Review the change for violations of `ARCHITECTURE.md`.
4. Ensure no secrets or credentials were introduced.
5. Report any unresolved issues, assumptions, or deviations.
6. Summarize what was changed and which checks were executed.

If an acceptance criterion cannot be satisfied, state that explicitly instead of silently omitting it.

## Task Status

Task specifications under `docs/tasks/` use the following statuses:

- `Draft` - not ready for implementation.
- `Ready` - approved and ready for implementation.
- `Done` - implementation and verification completed successfully.

Only implement tasks with status `Ready`.

After all acceptance criteria are satisfied and all required verification
checks pass, change the task's status from `Ready` to `Done`.

Do not mark a task as `Done` if:
- an acceptance criterion is not satisfied;
- a required verification check fails;
- a blocking issue remains unresolved.

Do not modify the status of unrelated tasks.
