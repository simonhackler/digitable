<script lang="ts">
	import { CheckCircle2 } from '@lucide/svelte';

	let { data, form } = $props();
	let errorMessage = $state('');
	let isSubmitting = $state(false);

	const policyLabels = {
		terms: 'Terms & Conditions',
		privacy_policy: 'Privacy Policy'
	} as const;

	const displayedError = $derived(form?.message ?? errorMessage);

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
		return text || 'Could not accept the current legal documents.';
	}

	async function handleSubmit(event: SubmitEvent) {
		if (!data.anonymousMode) return;
		event.preventDefault();
		if (isSubmitting) return;

		const formElement = event.currentTarget as HTMLFormElement;
		const formData = new FormData(formElement);
		if (formData.get('accepted') !== 'on') {
			errorMessage = 'Accept the current Terms & Conditions and acknowledge the Privacy Policy.';
			return;
		}

		errorMessage = '';
		isSubmitting = true;

		const signInResponse = await fetch('/api/auth/sign-in/anonymous', {
			method: 'POST'
		});
		if (!signInResponse.ok) {
			errorMessage = await readErrorMessage(signInResponse);
			isSubmitting = false;
			return;
		}

		const policyResponse = await fetch('/api/legal/accept-current', {
			method: 'POST'
		});
		if (!policyResponse.ok) {
			errorMessage = await readErrorMessage(policyResponse);
			isSubmitting = false;
			return;
		}

		window.location.assign(data.next);
	}
</script>

<svelte:head>
	<title>Legal Updates | Digitable</title>
</svelte:head>

<main class="min-h-screen bg-[#f5f7f2] px-6 py-10 text-[#171717]">
	<section class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-3xl content-center">
		<div
			class="border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(31,36,28,0.12)] sm:p-8"
		>
			<div class="flex items-start gap-4">
				<div class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center bg-[#dfead2]">
					<CheckCircle2 class="h-5 w-5 text-[#2f5f2e]" />
				</div>
				<div class="grid gap-3">
					<p class="text-xs font-semibold tracking-[0.24em] text-[#5f6d55] uppercase">
						Legal update
					</p>
					<h1 class="text-3xl leading-tight font-semibold sm:text-4xl">
						Review the current legal documents.
					</h1>
				</div>
			</div>

			<div class="mt-8 grid gap-3">
				{#each data.missingPolicies as policy (policy.id)}
					<div class="flex items-center justify-between gap-4 border border-black/10 p-4">
						<div>
							<p class="font-medium">{policyLabels[policy.policyType]}</p>
							<p class="text-sm text-[#5d6459]">Version {policy.version}</p>
						</div>
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							class="text-sm font-medium underline underline-offset-4"
							href={policy.policyType === 'terms' ? '/terms-and-conditions' : '/privacy-policy'}
						>
							Open
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>
				{/each}
			</div>

			<form method="POST" class="mt-8 grid gap-5" onsubmit={handleSubmit}>
				<input name="next" type="hidden" value={data.next} />
				{#if data.anonymousMode}
					<input name="anonymous" type="hidden" value="playtest" />
				{/if}

				<label class="flex items-start gap-3 text-sm leading-6 text-[#3f463b]">
					<input
						class="mt-1 h-4 w-4 rounded border-black/20 accent-[#171717]"
						name="accepted"
						type="checkbox"
						required
					/>
					<span>
						I accept the current Terms & Conditions and acknowledge the current Privacy Policy.
					</span>
				</label>

				{#if displayedError}
					<p class="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{displayedError}
					</p>
				{/if}

				<button
					class="inline-flex h-11 w-full items-center justify-center bg-[#171717] px-5 text-sm font-semibold text-white transition hover:bg-[#303030] sm:w-fit"
					disabled={isSubmitting}
					type="submit"
				>
					{isSubmitting ? 'Continuing...' : 'Continue'}
				</button>
			</form>
		</div>
	</section>
</main>
