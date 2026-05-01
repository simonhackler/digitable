<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Plus } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import Input from '$lib/components/ui/input/input.svelte';
	import { navigateToCreateGameSchema, type NavigateToCreateGameSchema } from './schemas.js';
	import type { Snippet } from 'svelte';

	interface Props {
		trigger: Snippet<[Record<string, unknown>]>;
	}

	let { trigger }: Props = $props();

	async function navigateToGame(gameName: string) {
		const folderName = gameName.replace(/\s+/g, '_');
		const searchParams = new URLSearchParams({ gameName });
		await goto(resolve(`/games/${folderName}?${searchParams}`));
	}

	const form = $derived(
		superForm(defaults({ name: '' }, zod4(navigateToCreateGameSchema)), {
			SPA: true,
			validators: zod4(navigateToCreateGameSchema),
			async onUpdate({ form }) {
				if (form.valid) {
					const data: NavigateToCreateGameSchema = form.data;
					await navigateToGame(data.name);
				}
			}
		})
	);
	const { form: formData, enhance } = $derived(form);
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			{#if trigger}
				{@render trigger(props)}
			{:else}
				<Button class="flex w-full items-center gap-2" {...props}>
					<Plus class="h-4 w-4" />
					Create Game
				</Button>
			{/if}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content>
		<form use:enhance class="w-full space-y-6">
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Gamename</Form.Label>
						<Input
							{...props}
							bind:value={$formData.name}
							placeholder=""
							maxlength={80}
							class="w-full"
						/>
					{/snippet}
				</Form.Control>
				<Form.Description class="text-muted-foreground flex justify-between text-xs">
					<span>up to 80 characters · required</span>
					<span>{$formData.name?.length || 0}/80</span>
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
			<Button type="submit">Create</Button>
		</form>
	</Popover.Content>
</Popover.Root>
