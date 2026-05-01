<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();
	let isSigningOut = $state(false);
	let errorMessage = $state('');

	async function signOut() {
		isSigningOut = true;
		errorMessage = '';

		const response = await fetch('/api/auth/sign-out', {
			method: 'POST'
		});

		if (!response.ok) {
			errorMessage = 'Sign out failed. Try again.';
			isSigningOut = false;
			return;
		}

		window.location.assign('/sign-in');
	}
</script>

<svelte:head>
	<title>User Settings | Digitable</title>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-10">
	<div class="space-y-2">
		<p class="text-muted-foreground text-sm font-medium">Account</p>
		<h1 class="text-3xl font-semibold">User settings</h1>
	</div>

	<section class="grid gap-4 rounded-lg border p-6">
		<div>
			<p class="text-muted-foreground text-sm">Name</p>
			<p class="font-medium">{data.user?.name ?? 'Not signed in'}</p>
		</div>
		<div>
			<p class="text-muted-foreground text-sm">Email</p>
			<p class="font-medium">{data.user?.email ?? 'Not signed in'}</p>
		</div>
	</section>

	{#if data.user}
		<div class="space-y-3">
			<Button type="button" variant="outline" onclick={signOut} disabled={isSigningOut}>
				{isSigningOut ? 'Signing out...' : 'Sign out'}
			</Button>

			{#if errorMessage}
				<p class="text-sm text-red-600">{errorMessage}</p>
			{/if}
		</div>
	{:else}
		<a class="text-sm font-medium underline underline-offset-4" href={resolve('/sign-in')}
			>Sign in</a
		>
	{/if}

	<a class="text-muted-foreground text-sm underline underline-offset-4" href={resolve('/games')}>
		Back to games
	</a>
</main>
