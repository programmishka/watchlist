import type { TargetPriceRepository, TargetPrices } from '../persistence/TargetPriceRepository';
import { InvalidSymbolError, InvalidTargetPriceError } from './TargetPriceServiceErrors';

function normalizeSymbol(symbol: string): string {
	return symbol.trim();
}

function assertValidSymbol(symbol: string): string {
	const normalized = normalizeSymbol(symbol);
	if (normalized.length === 0) {
		throw new InvalidSymbolError(symbol);
	}
	return normalized;
}

function assertValidTargetPrice(targetPrice: number): void {
	if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
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
