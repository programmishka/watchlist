// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuthenticatedUser } from '$lib/server/auth/AuthenticatedUser';

declare global {
	namespace App {
		interface Platform {
			/**
			 * `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are declared as required Secret
			 * names via `secrets.required` in `wrangler.jsonc` (TASK-028), so
			 * `wrangler types` now generates them directly on `Env` even though
			 * their real values live only in the Worker's Secret bindings. No
			 * application-owned type composition is needed here anymore
			 * (superseding TASK-027's `Env & AccessEnvironment`).
			 */
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			user?: AuthenticatedUser;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
