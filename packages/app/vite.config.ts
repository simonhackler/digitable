import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
