import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { devices, defineConfig } from '@playwright/test';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));

if (existsSync(envPath)) {
	for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith('#')) {
			continue;
		}

		const match = trimmedLine.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) {
			continue;
		}

		const [, key, rawValue] = match;
		if (process.env[key] !== undefined) {
			continue;
		}

		const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
		process.env[key] = value;
	}
}

const port = process.env.PORT ?? '5173';

export default defineConfig({
	use: {
		baseURL: `http://localhost:${port}`
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
