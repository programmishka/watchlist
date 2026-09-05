import { defineConfig, devices } from '@playwright/test';

/**
 * Mocked UI E2E suite (TASK-018): `npm run dev` is sufficient because every
 * `/api/*` request used by these tests is intercepted in the browser before
 * it reaches the SvelteKit server, so real Cloudflare Access/KV behavior is
 * never exercised regardless of what `npm run dev` itself provides.
 */
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	/**
	 * Explicit worker cap (TASK-025 §53-54). TASK-023/024 reported intermittent
	 * failures under high parallel load against the single shared `npm run dev`
	 * webServer. Reproduced on an 8-core machine: 8 workers failed a different
	 * test in 2 of 3 full-suite runs, while 4 workers passed 6 of 6 full-suite
	 * runs. 4 also happens to be Playwright's own CPU-based default here, so
	 * this pins that value explicitly rather than leaving it to vary with the
	 * host's core count (e.g. on CI).
	 */
	workers: 4,
	reporter: [['html', { open: 'never' }]],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium-desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }
		},
		{
			name: 'chromium-mobile',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 375, height: 812 },
				isMobile: true,
				hasTouch: true
			}
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 30_000
	}
});
