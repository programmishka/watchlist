/**
 * Application-owned authenticated-user representation. `id` is Cloudflare
 * Access' stable user identifier (`user_uuid`) and is the only field used
 * for persistence ownership. `email` is optional display/diagnostic
 * metadata only — never a persistence identity (see ARCHITECTURE.md §8.2).
 */
export interface AuthenticatedUser {
	id: string;
	email?: string;
}
