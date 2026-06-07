<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { captureExceptionWithAttributes } from '@tracewayapp/frontend';
	import { onMount } from 'svelte';

	onMount(() => {
		if (page.error) {
			captureExceptionWithAttributes(
				page.error instanceof Error ? page.error : new Error(page.error.message),
				{
					path: page.url.pathname,
					status: String(page.status)
				}
			);
		}
	});
</script>

<main class="grid min-h-screen place-items-center bg-[#f7f3ec] px-6 text-[#151515]">
	<section class="w-full max-w-md space-y-3">
		<p class="text-sm text-[#6f665b]">{page.status}</p>
		<h1 class="text-2xl font-semibold">{page.error?.message ?? 'Something went wrong'}</h1>
		<a class="text-sm underline underline-offset-4" href={resolve('/')}>Return home</a>
	</section>
</main>
