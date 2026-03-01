<script lang="ts">
	import {
		Button as FormButton,
		Control,
		Field,
		FieldErrors
	} from '$lib/components/ui/form/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { subscribeSchema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import { zod4Client } from 'sveltekit-superforms/adapters';

	const pageProps = $props();

	const sf = superForm(pageProps.data.form, {
		validators: zod4Client(subscribeSchema)
	});

	const { form, enhance, message } = sf;
</script>

<form method="POST" use:enhance class="space-y-5">
	<Field form={sf} name="email">
		<Control>
			{#snippet children({ props })}
				<Input
					{...props}
					bind:value={$form.email}
					aria-label="Email"
					placeholder="you@domain.com"
					class="text-lg md:text-base"
				/>
			{/snippet}
		</Control>
		<FieldErrors />
	</Field>

	<Field form={sf} name="firstName">
		<Control>
			{#snippet children({ props })}
				<Input
					{...props}
					bind:value={$form.firstName}
					aria-label="First name"
					placeholder="First name (optional)"
					class="text-lg md:text-base"
				/>
			{/snippet}
		</Control>
		<FieldErrors />
	</Field>

	<input
		class="hidden"
		tabindex="-1"
		autocomplete="off"
		name="company"
		bind:value={$form.company}
	/>

	<FormButton variant="default" size="lg" class="w-full rounded-full text-lg font-semibold">
		Subscribe
	</FormButton>

	{#if $message}
		<p
			class={`text-sm ${
				typeof $message === 'object' && $message?.tone === 'error'
					? 'text-red-600'
					: 'text-[#2d2d36]'
			}`}
		>
			{typeof $message === 'object' ? $message.text : $message}
		</p>
	{/if}
</form>
