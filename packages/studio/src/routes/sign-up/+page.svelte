<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
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
		return text || 'Sign up failed. Try again in a moment.';
	}

	async function handleSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		errorMessage = '';

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		isSubmitting = true;

		const response = await fetch(`${base}/api/auth/sign-up/email`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name,
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
	<title>Sign Up | Digitable</title>
</svelte:head>

<div
	class="min-h-screen bg-[radial-gradient(circle_at_top_right,#cfe4ff_0%,transparent_30%),radial-gradient(circle_at_bottom_left,#f8d5a6_0%,transparent_28%),linear-gradient(180deg,#f5f8ff_0%,#fffaf3_100%)] text-[#171717]"
>
	<main
		class="mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
	>
		<section class="flex flex-col justify-center gap-6">
			<p class="text-sm font-semibold tracking-[0.3em] text-[#48607c] uppercase">Create account</p>
			<div class="max-w-xl space-y-4">
				<h1 class="font-['Newsreader'] text-4xl leading-tight sm:text-5xl">
					Start building your next boardgame workspace.
				</h1>
				<p class="text-lg text-[#4b4f57] sm:text-xl">
					Set up an account to design components, run playtests, and ship exports from one place.
				</p>
			</div>
			<div class="grid gap-3 text-sm text-[#38404b] sm:max-w-md">
				<div
					class="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_35px_rgba(35,30,22,0.08)] backdrop-blur"
				>
					Use one account for game design, online sessions, and export workflows.
				</div>
				<div
					class="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_35px_rgba(35,30,22,0.08)] backdrop-blur"
				>
					Your account unlocks the authenticated room and ticket APIs already used by the app.
				</div>
			</div>
		</section>

		<section class="mx-auto w-full max-w-md">
			<form
				class="rounded-[28px] border border-black/8 bg-white/90 p-6 shadow-[0_30px_70px_rgba(20,20,20,0.12)] backdrop-blur sm:p-8"
				onsubmit={handleSubmit}
			>
				<div class="space-y-2">
					<p class="text-sm font-semibold tracking-[0.24em] text-[#59708a] uppercase">Sign up</p>
					<h2 class="text-3xl font-semibold">Create your Digitable account</h2>
					<p class="text-sm text-[#5d584f]">
						Already have an account?
						<a
							class="font-medium text-[#171717] underline underline-offset-4"
							href={resolve('/sign-in')}
						>
							Go to sign in
						</a>
					</p>
				</div>

				<div class="mt-6 grid gap-4">
					<Input
						type="text"
						bind:value={name}
						autocomplete="name"
						aria-label="Name"
						placeholder="Ada Lovelace"
						required
					/>

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
						autocomplete="new-password"
						aria-label="Password"
						placeholder="Create a password"
						minlength={8}
						required
					/>

					<Input
						type="password"
						bind:value={confirmPassword}
						autocomplete="new-password"
						aria-label="Confirm password"
						placeholder="Re-enter your password"
						minlength={8}
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
					{isSubmitting ? 'Creating account...' : 'Create account'}
				</Button>

				<p class="mt-4 text-center text-sm text-[#5d584f]">
					Returning designer?
					<a
						class="font-medium text-[#171717] underline underline-offset-4"
						href={resolve('/sign-in')}
					>
						Sign in instead
					</a>
				</p>
			</form>
		</section>
	</main>
</div>
