/**
 * The minimal slice of Cloudflare's `KVNamespace` binding this persistence
 * layer depends on, declared locally so tests can supply an in-memory fake
 * without a real/local Cloudflare KV runtime. The real `KVNamespace` global
 * (from `worker-configuration.d.ts`) satisfies this structurally.
 */
export interface KvNamespaceLike {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
}
