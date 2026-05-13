<script lang="ts">
	import { base, resolve } from '$app/paths';
	import AuthBackdrop from '$lib/components/AuthBackdrop.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let isSubmitting = $state(false);

	async function readErrorMessage(response: Response) {
		const contentType = response.headers.get('content-type') ?? '';

		if (contentType.includes('application/json')) {
			const body = (await response.json()) as Record<string, unknown>;

			if (typeof body.message === 'string' && body.message.length > 0) {
				return body.message;
			}

			if (typeof body.error === 'string' && body.error.length > 0) {
				return body.error;
			}
		}

		const text = await response.text();
		return text || 'Sign in failed. Check your credentials and try again.';
	}

	async function handleSubmit() {
		errorMessage = '';
		isSubmitting = true;

		const response = await fetch(`${base}/api/auth/sign-in/email`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				email,
				password
			})
		});

		if (!response.ok) {
			errorMessage = await readErrorMessage(response);
			isSubmitting = false;
			return;
		}

		window.location.assign('/app/games');
	}
</script>

<svelte:head>
	<title>Sign In | Digitable</title>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-[#737d91] text-[#f8f4eb]">
	<AuthBackdrop />
	<main
		class="pointer-events-none relative z-10 mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
	>
		<section class="flex flex-col justify-center gap-6">
			<p class="text-sm font-semibold tracking-[0.3em] text-white/75 uppercase">Digitable App</p>
			<div class="max-w-xl space-y-4">
				<h1 class="font-['Newsreader'] text-4xl leading-tight sm:text-5xl">
					Pick your project back up without losing momentum.
				</h1>
			</div>
		</section>

		<section class="mx-auto w-full max-w-md">
			<form
				class="pointer-events-auto rounded-[28px] border border-white/45 bg-white/95 p-6 text-[#171717] shadow-[0_30px_70px_rgba(20,20,20,0.22)] backdrop-blur sm:p-8"
			>
				<div class="space-y-2">
					<p class="text-sm font-semibold tracking-[0.24em] text-[#8a6c27] uppercase">Sign in</p>
					<h2 class="text-3xl font-semibold">Welcome back</h2>
					<p class="text-sm text-[#5d584f]">
						No account yet?
						<a
							class="font-medium text-[#171717] underline underline-offset-4"
							href={resolve('/sign-up')}
						>
							Create one here
						</a>
					</p>
				</div>

				<div class="mt-6 grid gap-4">
					<Input
						type="email"
						bind:value={email}
						autocomplete="email"
						aria-label="Email"
						placeholder="you@studio.com"
						required
					/>

					<Input
						type="password"
						bind:value={password}
						autocomplete="current-password"
						aria-label="Password"
						placeholder="Enter your password"
						required
					/>
				</div>

				{#if errorMessage}
					<p
						class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
					>
						{errorMessage}
					</p>
				{/if}

				<Button
					class="mt-6 w-full justify-center"
					type="button"
					size="lg"
					disabled={isSubmitting}
					onclick={handleSubmit}
				>
					{isSubmitting ? 'Signing in...' : 'Sign in'}
				</Button>
			</form>
		</section>
	</main>
</div>
