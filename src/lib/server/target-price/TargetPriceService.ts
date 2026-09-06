import { parseStockSymbol } from '../../shared/stockSymbol';
import { MAX_TARGET_PRICE } from '../../shared/targetPrice';
import type { TargetPriceRepository, TargetPrices } from '../persistence/TargetPriceRepository';
import { InvalidSymbolError, InvalidTargetPriceError } from './TargetPriceServiceErrors';

/**
 * TASK-038: applies the same canonical trim -> uppercase -> length -> grammar
 * rule as stock addition (`$lib/shared/stockSymbol.ts`), closing the
 * inconsistency where this route previously only trimmed its path symbol —
 * see `docs/security/input-boundary-audit.md` §4. `parseStockSymbol` is a
 * pure shared module, not a `watchlist` import, so this preserves TASK-010's
 * rule that `TargetPriceService` must not depend on the `watchlist` module.
 */
function assertValidSymbol(symbol: string): string {
	const parsed = parseStockSymbol(symbol);
	if (!parsed.valid) {
		throw new InvalidSymbolError(symbol);
	}
	return parsed.symbol;
}

function assertValidTargetPrice(targetPrice: number): void {
	if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > MAX_TARGET_PRICE) {
		throw new InvalidTargetPriceError(targetPrice);
	}
}

export class TargetPriceService {
	constructor(private readonly repository: TargetPriceRepository) {}

	async loadTargetPrices(userId: string): Promise<TargetPrices> {
		return this.repository.get(userId);
	}

	async getTargetPrice(userId: string, symbol: string): Promise<number | undefined> {
		const normalizedSymbol = assertValidSymbol(symbol);

		const targetPrices = await this.repository.get(userId);
		return targetPrices[normalizedSymbol];
	}

	async setTargetPrice(userId: string, symbol: string, targetPrice: number): Promise<TargetPrices> {
		const normalizedSymbol = assertValidSymbol(symbol);
		assertValidTargetPrice(targetPrice);

		const current = await this.repository.get(userId);
		const updated: TargetPrices = { ...current, [normalizedSymbol]: targetPrice };

		await this.repository.save(userId, updated);
		return updated;
	}
}
