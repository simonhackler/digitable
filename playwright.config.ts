import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://localhost:5173'
	},
	testDir: 'e2e',
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					executablePath: process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH,
					args: ['--disable-crashpad', '--disable-features=CrashpadSupport']
				}
			}
		}
	]
});
