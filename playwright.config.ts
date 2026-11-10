import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { devices, defineConfig } from '@playwright/test';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));

const loadEnvFile = (path: string) => {
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
		if (process.env[key] !== undefined) {
			continue;
		}

		const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
		process.env[key] = value;
	}
};

loadEnvFile(envPath);

if (!process.env.PLAYWRIGHT_BASE_URL) {
	throw new Error(
		'PLAYWRIGHT_BASE_URL is not set. Run Playwright inside devenv or set it explicitly.'
	);
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
	workers: 1,
	use: {
		baseURL
	},
	testDir: 'e2e',
	workers: 1,
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
