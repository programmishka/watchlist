import { defineConfig, devices } from '@playwright/test';

/**
 * Mocked UI E2E suite (TASK-018): `npm run dev` is sufficient because every
 * `/api/*` request used by these tests is intercepted in the browser before
 * it reaches the SvelteKit server, so the missing Cloudflare KV/Access
 * bindings under plain `vite dev` are never exercised.
 */
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
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
