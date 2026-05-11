import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { devices, defineConfig } from '@playwright/test';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));
const devenvPlaywrightEnvPath = fileURLToPath(new URL('./.devenv/playwright.env', import.meta.url));
const hasExplicitPlaywrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL !== undefined;
const hasDevenvPlaywrightEnv = existsSync(devenvPlaywrightEnvPath);

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

if (!hasExplicitPlaywrightBaseUrl && !hasDevenvPlaywrightEnv) {
	throw new Error(
		'PLAYWRIGHT_BASE_URL is not set and .devenv/playwright.env does not exist. Start devenv before running Playwright.'
	);
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

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
