import { describe, expect, it, vi } from 'vitest';
import { ConsoleDiagnosticLogger, describeProviderError } from './DiagnosticLogger';

describe('ConsoleDiagnosticLogger', () => {
	it('emits a warning with the event name and structured context, without stringifying it', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const logger = new ConsoleDiagnosticLogger();

		logger.warn('market_data_incomplete', {
			symbol: 'AZO',
			missingFields: ['marketCap'],
			reason: 'provider_field_missing'
		});

		expect(warnSpy).toHaveBeenCalledWith('market_data_incomplete', {
			symbol: 'AZO',
			missingFields: ['marketCap'],
			reason: 'provider_field_missing'
		});

		warnSpy.mockRestore();
	});

	it('emits an error with the event name and structured context', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logger = new ConsoleDiagnosticLogger();

		logger.error('market_data_provider_failure', {
			provider: 'yahoo-finance',
			operation: 'getQuotes',
			errorCategory: 'TypeError',
			errorMessage: 'network down'
		});

		expect(errorSpy).toHaveBeenCalledWith('market_data_provider_failure', {
			provider: 'yahoo-finance',
			operation: 'getQuotes',
			errorCategory: 'TypeError',
			errorMessage: 'network down'
		});

		errorSpy.mockRestore();
	});
});

describe('describeProviderError', () => {
	it('extracts a sanitized category and message from an Error', () => {
		const result = describeProviderError(new TypeError('boom'));

		expect(result).toEqual({ errorCategory: 'TypeError', errorMessage: 'boom' });
	});

	it('bounds an unexpectedly long error message rather than logging it unbounded', () => {
		const longMessage = 'x'.repeat(5000);

		const result = describeProviderError(new Error(longMessage));

		expect(result.errorMessage.length).toBe(200);
	});

	it('falls back to a stable category for a non-Error thrown value', () => {
		const result = describeProviderError('a plain string failure');

		expect(result).toEqual({
			errorCategory: 'UnknownError',
			errorMessage: 'a plain string failure'
		});
	});
});
