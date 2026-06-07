<script lang="ts">
	import { LogIn, UserRound } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Join Playtest | Digitable</title>
</svelte:head>

<main class="min-h-screen bg-[#f5f7f2] px-6 py-10 text-[#171717]">
	<section class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-3xl content-center">
		<div
			class="border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(31,36,28,0.12)] sm:p-8"
		>
			<div class="grid gap-3">
				<p class="text-xs font-semibold tracking-[0.24em] text-[#5f6d55] uppercase">
					Playtest invite
				</p>
				<h1 class="text-3xl leading-tight font-semibold sm:text-4xl">Join this playtest</h1>
				<p class="text-sm leading-6 text-[#5d6459]">
					{data.projectName}
				</p>
			</div>

			<div class="mt-8 grid gap-3 sm:grid-cols-2">
				<a
					class="inline-flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-5 text-sm font-semibold text-white transition hover:bg-[#303030]"
					href={data.signInUrl}
				>
					<LogIn class="h-4 w-4" />
					<span>Sign in</span>
				</a>
				<a
					class="inline-flex min-h-12 items-center justify-center gap-2 border border-black/15 bg-white px-5 text-sm font-semibold text-[#171717] transition hover:bg-[#f3f5f0]"
					href={data.anonymousUrl}
				>
					<UserRound class="h-4 w-4" />
					<span>Continue as anonymous user</span>
				</a>
			</div>
		</div>
	</section>
</main>
