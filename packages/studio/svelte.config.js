import adapter from '@sveltejs/adapter-node';
import { mdsvex } from 'mdsvex';
import mdsvexConfig from './mdsvex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', ...mdsvexConfig.extensions],
	preprocess: [mdsvex(mdsvexConfig)],
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	kit: {
		adapter: adapter()
	}
};

export default config;
