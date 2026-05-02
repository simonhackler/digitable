<script lang="ts">
	import placeholderFrontSvg from '../../../../../../../static/placeholder.svg?raw';
	import { getToLoadSvgsContext } from '../svg-context.svelte';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button';
	import { MEGABYTE } from '$lib/components/ui/file-drop-zone';
	import FileDropZone, {
		type FileDropZoneProps
	} from '$lib/components/ui/file-drop-zone/file-drop-zone.svelte';
	import { Input } from '$lib/components/ui/input';
	import { z } from 'zod';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { PlusIcon } from '@lucide/svelte';
	import { getFileSystemContext } from '../../../../context';
	import type { Attachment } from 'svelte/attachments';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';

	const svgs = getToLoadSvgsContext();
	let { front: templateFront, back: templateBack } = $derived(await svgs());

	const emptyCardSchema = z.object({
		side: z.enum(['front', 'back']),
		width: z
			.number()
			.min(5, 'Width must be greater than 5mm')
			.max(1000, 'Width must be less than 1000mm'),
		height: z
			.number()
			.min(5, 'Height must be greater than 5mm')
			.max(1000, 'Height must be less than 1000mm')
	});

	const form = superForm(defaults(zod4(emptyCardSchema)), {
		SPA: true,
		validators: zod4(emptyCardSchema),
		onUpdate({ form }) {
			if (form.valid) {
				createEmptySvg(form.data.side, form.data.width, form.data.height);
			}
		}
	});

	const { form: formData, enhance } = form;

	const currentProject = $derived(requireParam('gameName'));
	const currentCard = $derived(requireParam('deckName'));
	const fullFolderPath = $derived(joinFsPath(currentProject, 'system', currentCard));
	const fileSystem = getFileSystemContext();
	let { width, height } = $derived.by(() => {
		let width = null;
		let height = null;
		if (templateFront) {
			width = templateFront.getAttribute('width');
			height = templateFront.getAttribute('height');
		} else if (templateBack) {
			width = templateBack.getAttribute('width');
			height = templateBack.getAttribute('height');
		}
		if (!width || !height) {
			return { width: null, height: null };
		}
		const widthNum = parseFloat(width.replace('mm', ''));
		const heightNum = parseFloat(height.replace('mm', ''));
		return { width: widthNum, height: heightNum };
	});

	function buildUploadFunction(type: 'front' | 'back') {
		const onUploadSvg = async (files: File[]) => {
			const file = files[0];
			const renamedFile = new File([file], `${type}.svg`, { type: file.type });
			const written = await fileSystem.write(
				joinFsPath(fullFolderPath, renamedFile.name),
				renamedFile
			);
			if (written.error) console.error(written.error);
		};
		return onUploadSvg;
	}

	const onFileRejected: FileDropZoneProps['onFileRejected'] = async ({ reason, file }) => {
		console.error(`File upload failed: ${file.name}`, reason);
	};

	function createEmptySvg(side: 'front' | 'back', width: number, height: number) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		svg.setAttribute('width', width + 'mm');
		svg.setAttribute('height', height + 'mm');
		svg.setAttribute('viewBox', `0 0 ${width || 100} ${height || 100}`);
		// Add static/placeholder.svg as child background image
		const backgroundImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
		backgroundImage.id = 'background';
		backgroundImage.setAttribute('href', '/placeholder.svg');
		backgroundImage.setAttribute('width', width + 'px');
		backgroundImage.setAttribute('height', height + 'px');
		svg.appendChild(backgroundImage);
		if (side === 'front') {
			templateFront = svg as SVGSVGElement;
		} else {
			templateBack = svg as SVGSVGElement;
		}

		const svgString = new XMLSerializer().serializeToString(svg);
		const svgFile = new File([svgString], `${side}.svg`, { type: 'image/svg+xml' });
		void fileSystem.write(joinFsPath(fullFolderPath, svgFile.name), svgFile);

		const file = new File([placeholderFrontSvg], 'placeholder.svg', {
			type: 'image/svg+xml'
		});
		void fileSystem.write(joinFsPath(currentProject, 'files', file.name), file);
	}

	function attachSVG(svg: SVGSVGElement): Attachment {
		return (element) => {
			if (svg instanceof Node) {
				svg.removeAttribute('width');
				svg.removeAttribute('height');
				element.appendChild(svg);
				svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
				Object.assign(svg.style, {
					display: 'block',
					width: '100%',
					height: 'auto',
					maxWidth: '100%',
					flex: '1 1 auto'
				});
			}
			return () => {
				element.removeChild(svg);
			};
		};
	}
</script>

{#snippet svgOrUpload(svgFile: SVGSVGElement | null, side: 'front' | 'back')}
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-center text-2xl">{side} svg</Card.Title>
		</Card.Header>
		<Card.Content class="flex h-full items-center justify-center">
			{#if svgFile}
				{@const svg = svgFile.cloneNode(true) as SVGSVGElement}
				<div class="text-center">
					<div {@attach attachSVG(svg)} class="w-full max-w-sm border"></div>
					<div class="mt-2 flex items-center justify-between">
						{#if width && height}
							<Popover.Root>
								<Popover.Trigger class="w-full">
									<Button class="w-full">Upload</Button>
								</Popover.Trigger>
								<Popover.Content>
									<FileDropZone
										onUpload={buildUploadFunction(side)}
										{onFileRejected}
										maxFileSize={12 * MEGABYTE}
										maxFiles={1}
										fileCount={0}
										class="mb-4 h-full"
									/>
								</Popover.Content>
							</Popover.Root>
							<Button onclick={() => createEmptySvg(side, width, height)}
								>Overwrite with empty</Button
							>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex h-full w-full flex-col">
					<FileDropZone
						onUpload={buildUploadFunction(side)}
						{onFileRejected}
						maxFileSize={12 * MEGABYTE}
						maxFiles={1}
						fileCount={0}
						class="mb-4 h-full"
					/>
					{#if width && height}
						<Button onclick={() => createEmptySvg(side, width, height)}>Create empty</Button>
					{:else}
						<Popover.Root>
							<Popover.Trigger>
								<Button class="w-full" onclick={() => ($formData.side = side)}>Create empty</Button>
							</Popover.Trigger>
							<Popover.Content>
								<form use:enhance>
									<div class="class flex flex-col">
										<Form.Field {form} name="width" class="grid grid-cols-4 gap-2">
											<Form.Control>
												{#snippet children({ props })}
													<Form.Label>Width:</Form.Label>
													<Input
														{...props}
														type="number"
														placeholder="width (mm)"
														bind:value={$formData.width}
														class="col-span-3"
													/>
												{/snippet}
											</Form.Control>
											<Form.FieldErrors class="col-span-4 mb-2" />
										</Form.Field>
										<Form.Field {form} class="grid grid-cols-4 gap-2" name="height">
											<Form.Control>
												{#snippet children({ props })}
													<Form.Label>Height:</Form.Label>
													<Input
														{...props}
														type="number"
														placeholder="hegith (mm)"
														bind:value={$formData.height}
														class="col-span-3"
													/>
												{/snippet}
											</Form.Control>
											<Form.FieldErrors class="col-span-4 mb-2" />
										</Form.Field>
									</div>
									<Button type="submit">
										<PlusIcon /> Create new empty {side} deck
									</Button>
								</form>
							</Popover.Content>
						</Popover.Root>
					{/if}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{/snippet}

<div class="flex w-full flex-col items-center justify-center">
	<div class="grid w-1/2 grid-cols-2 grid-rows-2">
		{@render svgOrUpload(templateBack, 'back')}
		{@render svgOrUpload(templateFront, 'front')}
	</div>
</div>
