<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { setupTraceway, useTracewayAttributes } from '@tracewayapp/svelte';
	import '../app.css';

	let { children, data } = $props();

	const connection = env.PUBLIC_TRACEWAY_CONNECTION;
	const version = env.PUBLIC_APP_VERSION || 'dev';

	if (browser && connection) {
		setupTraceway({
			connectionString: connection,
			options: {
				captureLogs: true,
				captureNavigation: true,
				captureNetwork: true,
				debug: dev,
				recordAllSessions: false,
				sessionRecording: true,
				version
			}
		});
	}

	const sync = useTracewayAttributes();

	$effect(() => {
		const attributes: Record<string, string> = {};

		if (data.user?.email) {
			attributes.userEmail = data.user.email;
		}

		if (data.user?.name) {
			attributes.userName = data.user.name;
		}

		sync(attributes);
	});
</script>

{@render children()}
