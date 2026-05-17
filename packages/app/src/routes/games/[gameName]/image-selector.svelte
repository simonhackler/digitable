<script lang="ts">
	import {
		Button,
		buttonVariants,
		type ButtonSize,
		type ButtonVariant
	} from '$lib/components/ui/button/index.js';
	import { joinFsPath, type FsEntry } from '$lib/components/file-browser/adapters/adapter';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { cn } from '$lib/utils/utils.js';
	import { requireParam } from '$lib/utils/assert';
	import { Image, Loader2, Upload } from '@lucide/svelte';
	import { getFileSystemContext } from '../context';
	import { isImageFileName, listProjectImageFiles, resolveImageReference } from './data-loader';

	type ImageChoice = {
		path: string;
		previewUrl: string;
	};

	type Props = {
		open?: boolean;
		disabled?: boolean;
		showTrigger?: boolean;
		title?: string;
		description?: string;
		detail?: string;
		triggerLabel?: string;
		triggerTitle?: string;
		triggerVariant?: ButtonVariant;
		triggerSize?: ButtonSize;
		triggerClass?: string;
		onSelect: (imagePath: string) => void | Promise<void>;
	};

	let {
		open = $bindable(false),
		disabled = false,
		showTrigger = true,
		title = 'Select Image',
		description = '',
		detail = '',
		triggerLabel = 'Select Image',
		triggerTitle = title,
		triggerVariant = 'outline',
		triggerSize = 'default',
		triggerClass = '',
		onSelect
	}: Props = $props();

	let loading = $state(false);
	let selectedPath = $state('');
	let choices: ImageChoice[] = $state([]);
	let errorMessage = $state('');
	let wasOpen = false;

	const gameName = $derived(requireParam('gameName'));
	const filesystem = getFileSystemContext();

	function revokeChoiceUrls(nextChoices: ImageChoice[]) {
		for (const choice of nextChoices) {
			if (choice.previewUrl.startsWith('blob:')) {
				URL.revokeObjectURL(choice.previewUrl);
			}
		}
	}

	async function refreshImages() {
		loading = true;
		errorMessage = '';
		try {
			const paths = await listProjectImageFiles(filesystem, gameName);
			const nextChoices = await Promise.all(
				paths.map(async (path) => ({
					path,
					previewUrl: await resolveImageReference(filesystem, gameName, path)
				}))
			);
			revokeChoiceUrls(choices);
			choices = nextChoices;
			if (!selectedPath || !nextChoices.some((choice) => choice.path === selectedPath)) {
				selectedPath = nextChoices[0]?.path ?? '';
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	function clearChoices() {
		revokeChoiceUrls(choices);
		choices = [];
	}

	function setOpen(nextOpen: boolean) {
		if (open === nextOpen) return;
		open = nextOpen;
	}

	$effect(() => {
		if (open === wasOpen) return;
		wasOpen = open;
		if (open) {
			void refreshImages();
		} else {
			clearChoices();
		}
	});

	async function selectImage(imagePath: string) {
		if (!imagePath) return;
		errorMessage = '';
		loading = true;
		try {
			await onSelect(imagePath);
			setOpen(false);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	function sanitizeFileName(name: string) {
		const normalized = name
			.trim()
			.replace(/[/\\]/g, '-')
			.replace(/[^A-Za-z0-9._-]/g, '-');
		const collapsed = normalized.replace(/-+/g, '-').replace(/^\.+/, '');
		return collapsed || 'upload.png';
	}

	function uniqueFileName(requestedName: string, existingNames: Set<string>) {
		if (!existingNames.has(requestedName)) return requestedName;
		const dotIndex = requestedName.lastIndexOf('.');
		const base = dotIndex > 0 ? requestedName.slice(0, dotIndex) : requestedName;
		const ext = dotIndex > 0 ? requestedName.slice(dotIndex) : '';
		let index = 2;
		while (existingNames.has(`${base}-${index}${ext}`)) index += 1;
		return `${base}-${index}${ext}`;
	}

	async function handleUpload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		if (!file.type.startsWith('image/') && !isImageFileName(file.name)) {
			errorMessage = 'Choose an image file.';
			return;
		}

		errorMessage = '';
		loading = true;
		try {
			const uploadDir = await filesystem.ensureDir(joinFsPath(gameName, 'files', 'uploads'));
			if (uploadDir.error) throw new Error(uploadDir.error.message);

			const existingEntries = await uploadDir.data.list();
			const existingNames = new Set(
				existingEntries.error
					? []
					: existingEntries.data
							.filter((entry: FsEntry) => entry.kind === 'file')
							.map((entry: FsEntry) => entry.name)
			);
			const fileName = uniqueFileName(sanitizeFileName(file.name), existingNames);
			const written = await uploadDir.data.write(fileName, file);
			if (written.error) throw new Error(written.error.message);

			const imagePath = joinFsPath('uploads', fileName);
			await refreshImages();
			await selectImage(imagePath);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger
			class={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }), triggerClass)}
			{disabled}
			title={triggerTitle}
		>
			<Image class="size-4" />
			{triggerLabel}
		</Dialog.Trigger>
	{/if}
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-[920px]">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			{#if description}
				<Dialog.Description>{description}</Dialog.Description>
			{/if}
		</Dialog.Header>

		<div class="grid gap-4 py-4">
			<div class="flex items-center justify-between gap-2">
				{#if detail}
					<div class="text-muted-foreground text-sm">{detail}</div>
				{/if}
				<label
					class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'ml-auto')}
					aria-disabled={loading}
				>
					<Upload class="mr-2 size-4" />
					Upload
					<input
						class="hidden"
						type="file"
						accept="image/*,.svg,.avif"
						disabled={loading}
						onchange={handleUpload}
					/>
				</label>
			</div>

			{#if errorMessage}
				<div class="text-destructive text-sm" role="alert">{errorMessage}</div>
			{/if}

			{#if loading}
				<div class="text-muted-foreground flex min-h-40 items-center justify-center gap-2 text-sm">
					<Loader2 class="size-4 animate-spin" />
					Loading images
				</div>
			{:else if choices.length === 0}
				<div class="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
					No images found
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{#each choices as choice (choice.path)}
						<button
							type="button"
							class="border-input bg-background hover:bg-accent focus-visible:ring-ring grid gap-2 rounded-md border p-2 text-left text-sm outline-none focus-visible:ring-2"
							class:ring-2={selectedPath === choice.path}
							class:ring-ring={selectedPath === choice.path}
							onclick={() => (selectedPath = choice.path)}
							ondblclick={() => selectImage(choice.path)}
						>
							<div
								class="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded"
							>
								<img src={choice.previewUrl} alt="" class="h-full w-full object-contain" />
							</div>
							<div class="truncate" title={choice.path}>{choice.path}</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => setOpen(false)}>Cancel</Button>
			<Button disabled={!selectedPath || loading} onclick={() => selectImage(selectedPath)}>
				Apply
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
