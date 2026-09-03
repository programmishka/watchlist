# watchlist

A lightweight multi-user stock watchlist built with SvelteKit and Cloudflare, featuring target prices, market data, dividend analysis, and investment allocation.

## Prerequisites

- Node.js (current LTS or newer)
- npm

## Getting Started

Install dependencies:

```sh
npm install
```

## Development

Start the local development server:

```sh
npm run dev
```

## Previewing Against the Cloudflare Runtime

`npm run dev` does not provide Cloudflare bindings (KV, Access) or run under
`workerd`. The `/api/*` routes require the real `WATCHLIST_KV` binding to
construct their application services and will fail under plain `npm run dev`.
To exercise the full server API locally, build and preview the actual Worker:

```sh
npm run build
npm run preview
```

`wrangler.jsonc` configures a synthetic local development identity
(`access.dev`) so `npm run preview` simulates being authenticated via
Cloudflare Access, without a real login. This is local-only and has no
effect in production, where Cloudflare Access performs real authentication.

In short:

```text
npm run dev     -> UI/basic Vite development, no Cloudflare bindings
npm run preview -> Access + KV + Yahoo/Frankfurter + full server API, under workerd
```

## Testing

Run the unit test suite:

```sh
npm run test
```

## Type/Svelte Checking

```sh
npm run check
```

## Linting and Formatting

Check code style:

```sh
npm run lint
```

Automatically fix formatting:

```sh
npm run format
```

## Build

Create a production build:

```sh
npm run build
```

## Deployment

Production deployment targets Cloudflare Workers. See `ARCHITECTURE.md` for architectural details.
