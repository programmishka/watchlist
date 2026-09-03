// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuthenticatedUser } from '$lib/server/auth/AuthenticatedUser';

declare global {
	namespace App {
		interface Platform {
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
