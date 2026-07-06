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
		adapter: adapter(),
		prerender: {
			handleHttpError: ({ path, status, message }) => {
				if (status === 404 && (path === '/app' || path.startsWith('/app/'))) return;

				throw new Error(message);
			}
		},
		experimental: {
			instrumentation: {
				server: true
			},
			tracing: {
				server: true
			}
		}
	}
};

export default config;
