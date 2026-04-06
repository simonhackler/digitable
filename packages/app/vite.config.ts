import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT ?? '5173');

export default defineConfig({
	server: {
		port,
		strictPort: true
	},
	preview: {
		port,
		strictPort: true
	},
	plugins: [
		tailwindcss(),
		sveltekit()
		// {
		// 	name: 'full-reload',
		// 	handleHotUpdate({ server }) {
		// 		// send a “full‑reload” event instead of HMR update
		// 		server.ws.send({ type: 'full-reload' });
		// 		return [];
		// 	}
		// }
	]
});
