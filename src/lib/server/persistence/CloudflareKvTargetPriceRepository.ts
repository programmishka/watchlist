import type { KvNamespaceLike } from './KvNamespaceLike';
import { PersistenceError } from './PersistenceError';
import { assertValidUserId } from './UserId';
import { targetPricesKey } from './kvKeys';
import type { TargetPriceRepository, TargetPrices } from './TargetPriceRepository';

function isValidTargetPrices(value: unknown): value is TargetPrices {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	return Object.values(value as Record<string, unknown>).every(
		(price) => typeof price === 'number' && Number.isFinite(price) && price > 0
	);
}

export class CloudflareKvTargetPriceRepository implements TargetPriceRepository {
	constructor(private readonly kv: KvNamespaceLike) {}

	async get(userId: string): Promise<TargetPrices> {
		assertValidUserId(userId);
		const key = targetPricesKey(userId);

		let raw: string | null;
		try {
			raw = await this.kv.get(key);
		} catch (error) {
			throw new PersistenceError('Failed to read target prices from KV', { cause: error });
		}

		if (raw === null) {
			return {};
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch (error) {
			throw new PersistenceError('Stored target prices document is not valid JSON', {
				cause: error
			});
		}

		if (!isValidTargetPrices(parsed)) {
			throw new PersistenceError('Stored target prices document has an invalid shape');
		}

		return parsed;
	}

	async save(userId: string, targetPrices: TargetPrices): Promise<void> {
		assertValidUserId(userId);
		const key = targetPricesKey(userId);

		try {
			await this.kv.put(key, JSON.stringify(targetPrices));
		} catch (error) {
			throw new PersistenceError('Failed to write target prices to KV', { cause: error });
		}
	}
}
