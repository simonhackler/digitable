<script lang="ts">
	import { resolve } from '$app/paths';
	import { captureException, captureMessage } from '@tracewayapp/frontend';

	function clientError() {
		captureException(new Error('Traceway SvelteKit client test error'));
	}

	function clientMessage() {
		captureMessage('Traceway SvelteKit client test message');
	}

	async function serverOk() {
		await fetch(resolve('/api/traceway-test'));
	}

	async function serverError() {
		await fetch(resolve('/api/traceway-error'));
	}
</script>

<main class="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 p-6">
	<h1 class="text-2xl font-semibold">Traceway Test</h1>
	<div class="grid gap-2">
		<button class="bg-primary text-primary-foreground rounded-md px-3 py-2" onclick={clientMessage}>
			Send client message
		</button>
		<button class="bg-primary text-primary-foreground rounded-md px-3 py-2" onclick={clientError}>
			Send client error
		</button>
		<button class="bg-secondary text-secondary-foreground rounded-md px-3 py-2" onclick={serverOk}>
			Call server OK endpoint
		</button>
		<button
			class="bg-secondary text-secondary-foreground rounded-md px-3 py-2"
			onclick={serverError}
		>
			Call server error endpoint
		</button>
	</div>
</main>
