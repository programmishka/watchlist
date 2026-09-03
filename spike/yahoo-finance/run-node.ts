import YahooFinance from 'yahoo-finance2';
import { INVALID_SYMBOL, REQUIRED_FIELDS, TEST_SYMBOLS } from './symbols.ts';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function summarize(quote: Record<string, unknown>) {
	const summary: Record<string, unknown> = {};
	for (const field of REQUIRED_FIELDS) {
		summary[field] = field in quote ? quote[field] : '<missing>';
	}
	return summary;
}

async function testSingleQuotes() {
	console.log('\n=== Single quote retrieval ===');
	for (const { symbol, market } of TEST_SYMBOLS) {
		try {
			const quote = await yahooFinance.quote(symbol);
			console.log(symbol, `(${market})`, '->', JSON.stringify(summarize(quote)));
		} catch (error) {
			console.log(
				symbol,
				`(${market})`,
				'-> ERROR',
				(error as Error).name,
				(error as Error).message
			);
		}
	}
}

async function testBatchQuotes() {
	console.log('\n=== Batch quote retrieval (including one invalid symbol) ===');
	const symbols = [...TEST_SYMBOLS.map((s) => s.symbol), INVALID_SYMBOL];
	try {
		const results = await yahooFinance.quote(symbols);
		console.log(
			`Batch call returned ${results.length} result(s) for ${symbols.length} requested symbol(s).`
		);
		for (const quote of results) {
			console.log(' -', quote.symbol, JSON.stringify(summarize(quote)));
		}
		const returnedSymbols = new Set(results.map((r) => r.symbol));
		for (const symbol of symbols) {
			if (!returnedSymbols.has(symbol)) {
				console.log(' - (missing from batch result):', symbol);
			}
		}
	} catch (error) {
		console.log('Batch call threw:', (error as Error).name, (error as Error).message);
	}
}

async function testInvalidSingleQuote() {
	console.log('\n=== Single invalid-symbol retrieval ===');
	try {
		const result = await yahooFinance.quote(INVALID_SYMBOL);
		console.log('Resolved without throwing. typeof result:', typeof result, 'value:', result);
	} catch (error) {
		console.log('ERROR (thrown):', (error as Error).name, (error as Error).message);
	}
}

async function testCrumbBootstrapVsReuse() {
	console.log('\n=== Crumb/cookie bootstrap cost vs cached reuse (fresh client instance) ===');
	const freshClient = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
	const first = Date.now();
	await freshClient.quote('AAPL');
	const afterFirst = Date.now();
	await freshClient.quote('MSFT');
	const afterSecond = Date.now();
	console.log(
		`First call on fresh client (includes crumb/cookie bootstrap): ${afterFirst - first}ms`
	);
	console.log(
		`Second call on same client (should reuse cached crumb/cookie): ${afterSecond - afterFirst}ms`
	);
}

async function testSimulatedNetworkFailure() {
	console.log('\n=== Simulated total provider/network failure ===');
	const client = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (() =>
		Promise.reject(new TypeError('simulated network failure'))) as typeof fetch;
	try {
		await client.quote('AAPL');
		console.log('Unexpectedly succeeded despite simulated failure.');
	} catch (error) {
		console.log('ERROR (expected):', (error as Error).name, (error as Error).message);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function main() {
	await testSingleQuotes();
	await testBatchQuotes();
	await testInvalidSingleQuote();
	await testCrumbBootstrapVsReuse();
	await testSimulatedNetworkFailure();
}

main().catch((error) => {
	console.error('Spike run failed:', error);
	process.exitCode = 1;
});
