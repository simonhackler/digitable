<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Upload } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		displaySize,
		FileDropZone,
		MEGABYTE,
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone';
	import { XIcon } from '@lucide/svelte';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		uploadToAdapter: (file: File, overwrite?: boolean) => Promise<Error | null>;
		filesInFolder: string[];
	}

	let { uploadToAdapter, filesInFolder }: Props = $props();

	const onUpload: FileDropZoneProps['onUpload'] = async (files) => {
		await Promise.allSettled(files.map((file) => uploadFile(file)));
	};
	const onFileRejected: FileDropZoneProps['onFileRejected'] = async ({ reason, file }) => {
		toast.error(`${file.name} failed to upload!`, { description: reason });
	};
	const uploadFile = (file: File) => {
		if (files.find((f) => f.file.name === file.name)) return;
		const error = filesInFolder.find((f) => f === file.name) ? 'File already exists' : null;
		files.push({
			name: file.name,
			uploadedAt: Date.now(),
			error,
			url: URL.createObjectURL(file),
			file,
			rename: false,
			overwrite: false
		});
	};
	type UploadedFile = {
		name: string;
		file: File;
		uploadedAt: number;
		url: string;
		error: string | null;
		rename: boolean;
		overwrite: boolean;
	};
	let files = $state<UploadedFile[]>([]);
	onDestroy(async () => {
		for (const file of files) {
			URL.revokeObjectURL(file.url);
		}
	});

	$effect(() => {});

	const uploadDisabled = $derived(files.length == 0 || files.some((f) => f.error !== null));

	async function uploadFiles() {
		const errors = await Promise.all(files.map((f) => uploadToAdapter(f.file, f.overwrite)));
		if (errors.some((e) => e !== null)) {
			console.error('Upload errors:', errors);
		} else {
			open = false;
			files = [];
		}
	}

	let open = $state(false);

	function onBlurRename(file: UploadedFile) {
		file.rename = false;
		if (!filesInFolder.includes(file.name)) {
			file.error = null;
		}
		file.file = new File([file.file], file.name);
	}

	function overwriteFile(file: UploadedFile) {
		file.overwrite = !file.overwrite;
		file.error = null;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		<Button variant="outline"><Upload />Upload</Button>
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Upload files</Dialog.Title>

			<div class="flex w-full flex-col gap-2 p-6">
				<FileDropZone
					{onUpload}
					{onFileRejected}
					maxFileSize={6 * MEGABYTE}
					maxFiles={4}
					fileCount={files.length}
				/>
				<div class="flex flex-col gap-2">
					{#each files as file, i (file.file.name)}
						<div class="flex place-items-center justify-between gap-2">
							<div class="flex place-items-center gap-2">
								<div class="relative size-9 overflow-clip">
									<img
										src={file.url}
										alt={file.file.name}
										class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-clip"
									/>
								</div>
								<div class="flex flex-col">
									{#if file.rename}
										<Input
											type="text"
											bind:value={file.name}
											autofocus
											onblur={() => onBlurRename(file)}
											onkeydown={(e) => e.key === 'Enter' && onBlurRename(file)}
										/>
									{:else}
										<span>{file.name}</span>
									{/if}
									<span class="text-muted-foreground text-xs">{displaySize(file.file.size)}</span>
								</div>
							</div>
							<Button
								variant="outline"
								size="icon"
								onclick={() => {
									URL.revokeObjectURL(file.url);
									files = [...files.slice(0, i), ...files.slice(i + 1)];
								}}
							>
								<XIcon />
							</Button>
						</div>
						{#if file.error && !file.rename && !file.overwrite}
							<div class="flex justify-between">
								<span class="text-red-500">{file.error}</span>
								<div class="flex gap-2">
									<Button onclick={() => (file.rename = true)} variant="outline">Rename</Button>
									<Button onclick={() => overwriteFile(file)} variant="outline">Overwrite</Button>
								</div>
							</div>
						{/if}
					{/each}
				</div>
				<Button type="submit" disabled={uploadDisabled} onclick={uploadFiles}>Upload</Button>
			</div>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
