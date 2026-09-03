# TASK-001: Project Bootstrap

## Status

Done

## Goal

Bootstrap the Watchlist application as a minimal Svelte 5 / SvelteKit / TypeScript project that can serve as the foundation for all subsequent implementation tasks.

The project must be prepared for deployment to Cloudflare Workers and must include a working unit-test setup.

This task establishes the technical foundation only.

**Do not implement Watchlist business functionality as part of this task.**

---

## Context

Read the following documents before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`

The application will eventually use:

* Svelte 5;
* SvelteKit;
* TypeScript;
* Cloudflare Workers;
* Cloudflare Access;
* Cloudflare Workers KV;
* Yahoo Finance;
* Frankfurter API.

Most of these integrations are intentionally **not** part of this bootstrap task.

The next planned task will be a technical spike evaluating `yahoo-finance2` in the Cloudflare environment.

---

## Requirements

### 1. SvelteKit Project

Create a minimal SvelteKit application using:

* Svelte 5;
* SvelteKit;
* TypeScript;
* current stable package versions that are mutually compatible.

Use the current recommended Svelte/SvelteKit project structure and tooling.

Do not introduce compatibility layers for obsolete Svelte versions.

---

### 2. Cloudflare Target

Configure the SvelteKit application for deployment to Cloudflare Workers using the currently recommended SvelteKit/Cloudflare integration.

Add the necessary Cloudflare configuration files to the repository.

The project must build successfully for the Cloudflare target.

Do not configure production domains, DNS, Cloudflare Access, or other account-specific infrastructure in this task.

Do not require Cloudflare credentials for local development or normal unit tests.

---

### 3. Minimal Application

Provide only a minimal initial page proving that the Svelte application runs.

For example, the page may display:

```text
Watchlist
```

No production UI design is required.

Do not implement:

* watchlist tabs;
* stock tables;
* stock filtering;
* sorting;
* target prices;
* investment calculations;
* Yahoo Finance integration;
* Frankfurter integration;
* authentication;
* KV persistence.

---

### 4. TypeScript

Configure TypeScript using the normal SvelteKit conventions.

The project must pass Svelte/TypeScript validation without errors.

Avoid `any` unless required by framework-generated code or an external API and there is no reasonable typed alternative.

---

### 5. Unit Testing

Add a unit-test framework suitable for SvelteKit and TypeScript.

Prefer tooling that integrates naturally with the Vite/Svelte ecosystem.

The test configuration must support testing pure server-side TypeScript business functions without requiring:

* a browser;
* Cloudflare;
* Workers KV;
* network access;
* external services.

Add at least one trivial bootstrap test proving that the test infrastructure works.

The bootstrap test should not introduce fake business logic solely for testing purposes.

---

### 6. Code Quality

Configure the standard lightweight code-quality tooling appropriate for a modern SvelteKit project.

The project should provide commands for:

* type/Svelte checking;
* unit tests;
* linting;
* formatting or formatting validation;
* production build.

Prefer official Svelte tooling and conventional ecosystem choices.

Avoid adding overlapping tools that solve the same problem.

---

### 7. Package Scripts

Provide clear npm scripts for the development workflow.

At minimum, the project should support equivalent commands for:

```text
npm run dev
npm run check
npm run test
npm run lint
npm run build
```

A formatting command/check may be provided separately according to the selected tooling.

Use the actual script names consistently in project documentation.

---

### 8. README

Create or update `README.md` with concise developer setup instructions.

It should contain at least:

* project purpose;
* prerequisites;
* dependency installation;
* local development command;
* test command;
* type-check command;
* lint command;
* build command;
* short note that production deployment targets Cloudflare Workers.

Do not duplicate the architecture documentation from `ARCHITECTURE.md`.

---

### 9. Git Hygiene

Ensure generated/local files that should not be committed are covered by `.gitignore`.

In particular, the repository must not accidentally commit:

* `node_modules`;
* build output;
* local environment files containing secrets;
* Cloudflare local runtime state where applicable;
* editor/OS-generated temporary files where appropriate.

Do not add real credentials or secrets.

---

## Project Structure

Use the normal current SvelteKit project conventions.

Do not create speculative application layers or empty directories merely to anticipate future tasks.

The repository should remain minimal after this task.

A conceptual result may resemble:

```text
watchlist/
├── CLAUDE.md
├── ARCHITECTURE.md
├── README.md
├── LICENSE
├── package.json
├── svelte.config.js
├── vite.config.ts
├── wrangler.jsonc
├── src/
│   ├── app.html
│   ├── lib/
│   └── routes/
│       └── +page.svelte
├── static/
└── ...
```

The exact generated structure may differ if current SvelteKit tooling recommends a different layout.

Follow current framework conventions rather than forcing this example structure.

---

## Non-Goals

Do NOT implement any of the following in this task:

* application domain model;
* Watchlist CRUD;
* stock management;
* Cloudflare Access;
* Cloudflare KV;
* user persistence;
* REST application APIs;
* Yahoo Finance;
* `yahoo-finance2`;
* Yahoo cookie/crumb handling;
* Frankfurter;
* currency conversion;
* dividend calculations;
* target-price calculations;
* savings calculations;
* final UI styling;
* E2E tests.

Do not add dependencies for these future features yet.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. The repository contains a valid Svelte 5 / SvelteKit / TypeScript application.
2. The application starts locally using the documented development command.
3. The initial page renders successfully.
4. The project is configured for Cloudflare Workers.
5. No Cloudflare account credentials are required for normal local development.
6. Type/Svelte checking completes successfully.
7. Unit tests execute successfully.
8. At least one bootstrap test proves that the test setup works.
9. Linting completes successfully.
10. The production build completes successfully.
11. `README.md` contains the required developer commands.
12. `.gitignore` protects local/generated files and likely secret files.
13. No application business functionality has been implemented.
14. No Yahoo Finance, Frankfurter, KV, or authentication dependencies have been introduced.
15. No credentials, cookies, tokens, or other secrets are committed.

---

## Verification

Before completing the task, execute the configured equivalents of:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Also verify that the application can start locally.

If formatting validation is configured separately, run it as well.

Do not report a command as successful unless it was actually executed successfully.

---

## Completion Report

When finished, report:

1. the major files/configuration created or changed;
2. the relevant technology/tooling choices and why they were selected;
3. the npm commands available for development and verification;
4. the results of all verification commands;
5. any warnings, assumptions, or unresolved issues;
6. any deviation from this task or `ARCHITECTURE.md`.

Do not start the Yahoo Finance spike or any subsequent task.
