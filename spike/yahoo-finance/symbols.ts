export interface SpikeSymbol {
	symbol: string;
	market: string;
	expectedCurrency: string;
	reason: string;
}

export const TEST_SYMBOLS: SpikeSymbol[] = [
	{
		symbol: 'AAPL',
		market: 'US - NASDAQ',
		expectedCurrency: 'USD',
		reason: 'US exchange baseline'
	},
	{
		symbol: 'SAP.DE',
		market: 'Germany - XETRA',
		expectedCurrency: 'EUR',
		reason: 'Germany/XETRA coverage'
	},
	{
		symbol: 'SHEL.L',
		market: 'UK - LSE',
		expectedCurrency: 'GBp',
		reason: 'UK stock reported by Yahoo in GBp (pence)'
	},
	{
		symbol: 'RELIANCE.NS',
		market: 'India - NSE',
		expectedCurrency: 'INR',
		reason: 'India/INR coverage; legacy app applies an INR dividend correction'
	},
	{
		symbol: 'LISP.SW',
		market: 'Switzerland - SIX',
		expectedCurrency: 'CHF',
		reason: 'Required symbol; legacy app applies a symbol-specific dividend correction (/10)'
	},
	{
		symbol: 'HEXA-B.ST',
		market: 'Sweden - Stockholm',
		expectedCurrency: 'SEK',
		reason: 'Required symbol; legacy app applies a symbol-specific dividend correction'
	},
	{
		symbol: 'TOM.OL',
		market: 'Norway - Oslo',
		expectedCurrency: 'NOK',
		reason: 'Required symbol; legacy app applies a symbol-specific dividend correction'
	}
];

export const INVALID_SYMBOL = 'NOTAREALSYMBOL123';

export const REQUIRED_FIELDS = [
	'symbol',
	'longName',
	'regularMarketPrice',
	'currency',
	'trailingAnnualDividendRate',
	'marketCap'
] as const;
