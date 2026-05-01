import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { devices, defineConfig } from '@playwright/test';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));
const devenvPlaywrightEnvPath = fileURLToPath(new URL('./.devenv/playwright.env', import.meta.url));

const loadEnvFile = (path: string, { override = false } = {}) => {
	if (!existsSync(path)) {
		return;
	}

	for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith('#')) {
			continue;
		}

		const match = trimmedLine.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) {
			continue;
		}

		const [, key, rawValue] = match;
		if (!override && process.env[key] !== undefined) {
			continue;
		}

		const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
		process.env[key] = value;
	}
};

loadEnvFile(envPath);
loadEnvFile(devenvPlaywrightEnvPath, { override: true });

const port = process.env.PORT ?? '5173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
	use: {
		baseURL
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
