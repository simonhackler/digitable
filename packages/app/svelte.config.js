import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			$svgeditor: resolve(rootDir, '../svgeditor/src/lib')
		},
		paths: {
			base: '/app'
		}
	}
};

export default config;
