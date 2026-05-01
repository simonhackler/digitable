<script lang="ts">
	import { base, resolve } from '$app/paths';
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

	async function handleSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
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

<div
	class="min-h-screen bg-[radial-gradient(circle_at_top_left,#fde7b3_0%,transparent_28%),radial-gradient(circle_at_bottom_right,#cad8ff_0%,transparent_32%),linear-gradient(180deg,#f7f3ea_0%,#fdfcf8_100%)] text-[#171717]"
>
	<main
		class="mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
	>
		<section class="flex flex-col justify-center gap-6">
			<p class="text-sm font-semibold tracking-[0.3em] text-[#6d5d37] uppercase">Digitable App</p>
			<div class="max-w-xl space-y-4">
				<h1 class="font-['Newsreader'] text-4xl leading-tight sm:text-5xl">
					Pick your project back up without losing momentum.
				</h1>
				<p class="text-lg text-[#4f4a42] sm:text-xl">
					Sign in to open your games, jump into playtests, and keep your design files moving.
				</p>
			</div>
			<div class="grid gap-3 text-sm text-[#3f3a32] sm:max-w-md">
				<div
					class="rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-[0_18px_35px_rgba(35,30,22,0.08)] backdrop-blur"
				>
					Your projects stay in the app, ready to edit or playtest.
				</div>
				<div
					class="rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-[0_18px_35px_rgba(35,30,22,0.08)] backdrop-blur"
				>
					Private rooms and game tickets keep collaborative sessions tied to your account.
				</div>
			</div>
		</section>

		<section class="mx-auto w-full max-w-md">
			<form
				class="rounded-[28px] border border-black/8 bg-white/88 p-6 shadow-[0_30px_70px_rgba(20,20,20,0.12)] backdrop-blur sm:p-8"
				onsubmit={handleSubmit}
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

				<Button class="mt-6 w-full justify-center" type="submit" size="lg" disabled={isSubmitting}>
					{isSubmitting ? 'Signing in...' : 'Sign in'}
				</Button>

				<p class="mt-4 text-center text-sm text-[#5d584f]">
					Want to start from scratch?
					<a
						class="font-medium text-[#171717] underline underline-offset-4"
						href={resolve('/sign-up')}
					>
						Go to sign up
					</a>
				</p>
			</form>
		</section>
	</main>
</div>
