<script lang="ts">
	import { base, resolve } from '$app/paths';
	import AuthBackdrop from '$lib/components/AuthBackdrop.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let acceptedPolicies = $state(false);
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

	async function handleSubmit() {
		errorMessage = '';

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		if (!acceptedPolicies) {
			errorMessage = 'Please accept the terms and privacy policy.';
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

		const policyResponse = await fetch(`${base}/api/legal/accept-current`, {
			method: 'POST'
		});

		if (!policyResponse.ok) {
			errorMessage = await readErrorMessage(policyResponse);
			isSubmitting = false;
			return;
		}

		window.location.assign('/app/games');
	}
</script>

<svelte:head>
	<title>Sign Up | Digitable</title>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-[#737d91] text-[#f8f4eb]">
	<AuthBackdrop />
	<main
		class="pointer-events-none relative z-10 mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
	>
		<section class="flex flex-col justify-center gap-6">
			<p class="text-sm font-semibold tracking-[0.3em] text-white/75 uppercase">Create account</p>
			<div class="max-w-xl space-y-4">
				<h1 class="font-['Newsreader'] text-4xl leading-tight sm:text-5xl">
					Start building your next boardgame workspace.
				</h1>
			</div>
		</section>

		<section class="mx-auto w-full max-w-md">
			<form
				class="pointer-events-auto rounded-[28px] border border-white/45 bg-white/95 p-6 text-[#171717] shadow-[0_30px_70px_rgba(20,20,20,0.22)] backdrop-blur sm:p-8"
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
							Sign in
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

					<label class="flex items-start gap-3 text-sm leading-5 text-[#4b4f57]">
						<input
							class="mt-1 h-4 w-4 rounded border-black/20 text-[#151515] accent-[#151515]"
							type="checkbox"
							bind:checked={acceptedPolicies}
							required
						/>
						<span>
							I accept the
							<a
								class="font-medium text-[#171717] underline underline-offset-4"
								href={resolve('/terms-and-conditions')}
							>
								terms and conditions
							</a>
							and
							<a
								class="font-medium text-[#171717] underline underline-offset-4"
								href={resolve('/privacy-policy')}
							>
								privacy policy
							</a>
							.
						</span>
					</label>
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
					{isSubmitting ? 'Creating account...' : 'Create account'}
				</Button>
			</form>
		</section>
	</main>
</div>
