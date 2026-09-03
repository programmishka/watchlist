/**
 * Thrown when a repository is called with an unusable `userId` — a caller
 * contract violation, not an infrastructure/corruption failure, so it is
 * kept distinct from `PersistenceError`.
 */
export class InvalidUserIdError extends Error {
	constructor(userId: string) {
		super(`userId must not be empty or whitespace-only. Received: ${JSON.stringify(userId)}`);
		this.name = 'InvalidUserIdError';
	}
}

/**
 * Guards against constructing global/malformed KV keys from an unusable
 * user ID. Deliberately does not validate any specific ID format (such as a
 * Cloudflare Access UUID) — that is not yet an established requirement.
 */
export function assertValidUserId(userId: string): void {
	if (userId.trim().length === 0) {
		throw new InvalidUserIdError(userId);
	}
}
