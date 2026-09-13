<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import z from 'zod';

	interface Props {
		title: string;
		actionName: string;
		creatingName: string;
		onSubmit: (name: string, password?: string) => void;
	}
	const { onSubmit: createRoom, title, actionName, creatingName }: Props = $props();
	const createRoomSchema = z.object({
		name: z.string().min(3).max(40),
		password: z.string().max(32).optional()
	});
	const form = superForm(defaults(zod4(createRoomSchema)), {
		SPA: true,
		validators: zod4(createRoomSchema),
		onUpdate({ form }) {
			if (form.valid) {
				creating = true;
				createRoom($formData.name, $formData.password);
				creating = false;
				open = false;
			}
		}
	});
	const { form: formData, enhance } = form;
	let creating = $state(false);
	let open = $state(false);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} class="self-start" disabled={creating}>
				{creating ? creatingName : actionName}
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description></Dialog.Description>
		</Dialog.Header>
		<form class="flex flex-col gap-4" use:enhance>
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Name</Form.Label>
						<Input {...props} bind:value={$formData.name} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="password">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Password</Form.Label>
						<Input {...props} bind:value={$formData.password} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Dialog.Footer>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="outline" disabled={creating}>Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" disabled={creating}>
					{creating ? creatingName : actionName}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
