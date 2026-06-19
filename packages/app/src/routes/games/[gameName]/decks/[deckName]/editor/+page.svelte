<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { ReferenceEditor, type ChangeEvent } from '@svg-table/svgeditor';
	import type { createEditorController } from '@svg-table/svgeditor';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { FlipHorizontal2, Table2, Upload } from '@lucide/svelte';
	import placeholderFrontSvg from '../../../../../../../static/placeholder.svg?raw';
	import { useDebounce } from 'runed';
	import { getFileSystemContext } from '../../../../context';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { ASSETS_DIR, COMPONENTS_DIR } from '$lib/workspace/project-layout';
	import { requireParam } from '$lib/utils/assert';
	import { createEmptySvg } from '$lib/utils/svg-helpers.js';
	import { isEmbeddedImageReference, resolveImageReference } from '../../../data-loader';
	import ImageSelector from '../../../image-selector.svelte';
	import { getDeckSideIndexContext, getToLoadSvgsContext } from '../svg-context.svelte';
	import GameTopBar from '../../../../game-top-bar.svelte';
	import { Separator } from '$lib/components/ui/separator';

	type Side = 'front' | 'back';
	type EditorController = ReturnType<typeof createEditorController>;
	type ImagePickerTarget = {
		mode: 'insert' | 'replace';
		controller: EditorController;
	};
	type SvgMeta = {
		width?: string;
		height?: string;
		viewBox?: string;
	};

	const DEFAULT_TEXT_FONT_SIZE = 24;
	const SVG_MIME_TYPE = 'image/svg+xml';
	const XLINK_NS = 'http://www.w3.org/1999/xlink';
	const ORIGINAL_HREF_ATTR = 'data-digitable-original-href';

	const fileSystem = getFileSystemContext();
	const game = $derived(requireParam('gameName'));
	const deck = $derived(requireParam('deckName'));
	const folder = $derived(joinFsPath(game, COMPONENTS_DIR, deck));
	const dataPath = $derived(`/games/${game}/decks/${deck}/data`);
	const maxSvgUploadSize = 12 * 1024 * 1024;
	const deckSideIndex = getDeckSideIndexContext();

	const roundTo = (value: number, precision = 2) => {
		const factor = 10 ** precision;
		return Math.round(value * factor) / factor;
	};

	const parseSvgDimension = (value: string | undefined): number | null => {
		if (!value) return null;
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	};

	const getSvgCanvasSize = (meta: SvgMeta | undefined) => {
		if (!meta) return null;
		if (meta.viewBox) {
			const parts = meta.viewBox.split(/[ ,]+/).map((part) => Number(part));
			const width = parts[2];
			const height = parts[3];
			if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
				return { width, height };
			}
		}

		const width = parseSvgDimension(meta.width);
		const height = parseSvgDimension(meta.height);
		if (width && height) {
			return { width, height };
		}

		return null;
	};

	const getDefaultTextFontSize = (meta: SvgMeta | undefined) => {
		const size = getSvgCanvasSize(meta);
		if (!size) return DEFAULT_TEXT_FONT_SIZE;
		const scaled = Math.sqrt(size.width * size.height) / 9;
		return roundTo(Math.min(DEFAULT_TEXT_FONT_SIZE, Math.max(1, scaled)));
	};

	const getSvgMeta = (value: string | null | undefined): SvgMeta => {
		if (!value) return {};
		const doc = new DOMParser().parseFromString(value, 'image/svg+xml');
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return {};
		return {
			width: root.getAttribute('width') ?? undefined,
			height: root.getAttribute('height') ?? undefined,
			viewBox: root.getAttribute('viewBox') ?? undefined
		};
	};

	const applySvgMeta = (value: string, meta: SvgMeta): string => {
		if (!value) return value;
		if (!meta.width && !meta.height && !meta.viewBox) return value;
		const doc = new DOMParser().parseFromString(value, 'image/svg+xml');
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return value;
		if (meta.width) root.setAttribute('width', meta.width);
		if (meta.height) root.setAttribute('height', meta.height);
		if (meta.viewBox) root.setAttribute('viewBox', meta.viewBox);
		if (!meta.viewBox && meta.width && meta.height) {
			const w = Number.parseFloat(meta.width);
			const h = Number.parseFloat(meta.height);
			if (Number.isFinite(w) && Number.isFinite(h)) {
				root.setAttribute('viewBox', `0 0 ${w} ${h}`);
			}
		}
		return new XMLSerializer().serializeToString(doc);
	};

	const loadSvgTemplates = getToLoadSvgsContext();
	const svgs = $derived(await loadSvgTemplates());

	let front = $derived(svgs.frontText);
	let back = $derived(svgs.backText);
	let frontMeta = $derived(getSvgMeta(svgs.frontText));
	let backMeta = $derived(getSvgMeta(svgs.backText));
	const sideIndex = $derived(deckSideIndex.sideIndex);
	const side = $derived(sideIndex === 0 ? 'front' : 'back');
	const editorKey = $derived(`${game}/${deck}/${side}`);
	let blankWidth = $state(63);
	let blankHeight = $state(88);
	let createTemplatesDialogOpen = $state(false);
	let uploadInput: HTMLInputElement | null = $state(null);
	let imageSelectorOpen = $state(false);
	let imagePickerTarget = $state<ImagePickerTarget | null>(null);

	const svg = $derived(side === 'front' ? front : back);
	const editorSvg = $derived(await resolveSvgImagesForEditor(svg, game));
	const activeMeta = $derived(side === 'front' ? frontMeta : backMeta);
	const hasAnySvg = $derived(Boolean(front || back));
	const preferredBlankSize = $derived(
		getSvgCanvasSize(frontMeta) ??
			getSvgCanvasSize(backMeta) ?? { width: blankWidth, height: blankHeight }
	);
	const config = $derived.by(() => ({
		imgPath: '/svgedit/images/',
		initFill: { color: 'FFFFFF', opacity: 1 },
		initStroke: { color: '000000', opacity: 1, width: 1 },
		text: {
			stroke_width: 0,
			font_size: getDefaultTextFontSize(activeMeta),
			font_family: 'serif'
		},
		initOpacity: 1,
		baseUnit: 'px',
		pageBorderSnapping: true
	}));

	const writeSvgSide = async (
		nextSide: Side,
		value: string,
		{ preserveCanvasMeta = false, updateState = true } = {}
	) => {
		if (!value) return;
		const nextMeta = nextSide === 'front' ? frontMeta : backMeta;
		const nextValue = preserveCanvasMeta ? applySvgMeta(value, nextMeta) : value;
		const file = new File([nextValue], `${nextSide}.svg`, { type: 'image/svg+xml' });
		const deckDir = await fileSystem.ensureDir(folder);
		if (deckDir.error) {
			console.error(`Upload failed for ${nextSide}.svg`, deckDir.error);
			return;
		}
		const written = await deckDir.data.write(file.name, file);
		if (written.error) {
			console.error(`Upload failed for ${nextSide}.svg`, written.error);
			return;
		}
		if (updateState) setSvgSide(nextSide, nextValue);
	};

	const setSvgSide = (nextSide: Side, value: string) => {
		if (nextSide === 'front') {
			front = value;
			frontMeta = getSvgMeta(value);
		} else {
			back = value;
			backMeta = getSvgMeta(value);
		}
		deckSideIndex.setSideIndex(sideIndexForSide(nextSide));
	};

	const getImageHref = (image: SVGImageElement) =>
		image.getAttribute('href') ?? image.getAttribute('xlink:href') ?? '';

	const setImageHref = (image: SVGImageElement, value: string) => {
		const svgRoot =
			image.ownerSVGElement ??
			(image.ownerDocument.documentElement as unknown as SVGSVGElement | null);
		if (svgRoot && !svgRoot.hasAttribute('xmlns:xlink')) {
			svgRoot.setAttribute('xmlns:xlink', XLINK_NS);
		}
		image.setAttribute('href', value);
		image.setAttributeNS(XLINK_NS, 'xlink:href', value);
	};

	const projectImagePathToSvgHref = (imagePath: string) =>
		`../../${ASSETS_DIR}/${imagePath.trim().replace(/^\/+/, '')}`;

	const normalizeSvgImageFileInput = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed || isEmbeddedImageReference(trimmed)) return trimmed;
		const assetsMarker = `/${ASSETS_DIR}/`;
		const assetsIndex = trimmed.lastIndexOf(assetsMarker);
		if (assetsIndex >= 0) {
			return projectImagePathToSvgHref(trimmed.slice(assetsIndex + assetsMarker.length));
		}
		const localPath = trimmed
			.replace(new RegExp(`^(\\.\\.\\/)+${ASSETS_DIR}\\/`), '')
			.replace(new RegExp(`^${ASSETS_DIR}\\/`), '')
			.replace(/^\/+/, '');
		return projectImagePathToSvgHref(localPath);
	};

	function openImagePicker(mode: ImagePickerTarget['mode'], controller: EditorController) {
		imagePickerTarget = { mode, controller };
		imageSelectorOpen = true;
	}

	async function applySvgEditorImageSelection(imagePath: string) {
		if (!imagePickerTarget || !imagePath) return;
		const href = projectImagePathToSvgHref(imagePath);
		const resolvedHref = await resolveImageReference(fileSystem, game, href, true);
		const attributes = { [ORIGINAL_HREF_ATTR]: href };
		if (imagePickerTarget.mode === 'replace') {
			imagePickerTarget.controller.setSelectedImageHref(resolvedHref, { attributes });
			return;
		}
		imagePickerTarget.controller.insertImage(resolvedHref, { attributes });
	}

	async function applySvgEditorImageHref(controller: EditorController, value: string) {
		const href = normalizeSvgImageFileInput(value);
		if (!href) return;
		const resolvedHref = await resolveImageReference(fileSystem, game, href, true);
		controller.setSelectedImageHref(resolvedHref, {
			attributes: { [ORIGINAL_HREF_ATTR]: href }
		});
	}

	async function resolveSvgImagesForEditor(value: string, projectName: string) {
		if (!value) return { value, objectUrls: [] };

		const doc = new DOMParser().parseFromString(value, SVG_MIME_TYPE);
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return { value, objectUrls: [] };

		const objectUrls: string[] = [];
		await Promise.all(
			Array.from(root.querySelectorAll<SVGImageElement>('image')).map(async (image) => {
				const href = getImageHref(image).trim();
				if (!href || isEmbeddedImageReference(href)) return;

				const resolvedHref = await resolveImageReference(fileSystem, projectName, href);
				image.setAttribute(ORIGINAL_HREF_ATTR, href);
				setImageHref(image, resolvedHref);
				if (resolvedHref.startsWith('blob:')) objectUrls.push(resolvedHref);
			})
		);

		return {
			value: new XMLSerializer().serializeToString(doc),
			objectUrls
		};
	}

	function normalizeEditorSvgImages(value: string) {
		if (!value) return value;

		const doc = new DOMParser().parseFromString(value, SVG_MIME_TYPE);
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return value;

		for (const image of Array.from(root.querySelectorAll<SVGImageElement>('image'))) {
			const originalHref = image.getAttribute(ORIGINAL_HREF_ATTR);
			if (!originalHref) continue;
			setImageHref(image, originalHref);
			image.removeAttribute(ORIGINAL_HREF_ATTR);
		}

		return new XMLSerializer().serializeToString(doc);
	}

	$effect(() => {
		const objectUrls = editorSvg.objectUrls;
		return () => {
			for (const objectUrl of objectUrls) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	});

	const writePlaceholderSvg = async () => {
		const file = new File([placeholderFrontSvg], 'placeholder.svg', {
			type: 'image/svg+xml'
		});
		const filesDir = await fileSystem.ensureDir(joinFsPath(game, ASSETS_DIR));
		if (filesDir.error) {
			console.error(filesDir.error);
			return;
		}
		const placeholderWrite = await filesDir.data.write(file.name, file);
		if (placeholderWrite.error) console.error(placeholderWrite.error);
	};

	const buildUploadFunction = (nextSide: Side) => {
		return async (file: File) => {
			if (file.size > maxSvgUploadSize) {
				console.error(`File upload failed: ${file.name}`, 'Maximum file size exceeded');
				return;
			}
			await writeSvgSide(nextSide, await file.text());
		};
	};

	const createBlankTemplates = async (
		nextSides: Side | Side[],
		size = preferredBlankSize,
		{ closeDialog = false, focusSide }: { closeDialog?: boolean; focusSide?: Side } = {}
	) => {
		const sides = Array.isArray(nextSides) ? nextSides : [nextSides];
		await Promise.all([
			...sides.map((nextSide) => {
				const svg = new XMLSerializer().serializeToString(createEmptySvg(size.width, size.height));
				return writeSvgSide(nextSide, svg);
			}),
			writePlaceholderSvg()
		]);
		if (focusSide) deckSideIndex.setSideIndex(sideIndexForSide(focusSide));
		if (closeDialog) createTemplatesDialogOpen = false;
	};

	const switchSide = async (nextSide: Side) => {
		if (nextSide === side) return;
		if (!sideHasSvg(nextSide) && hasAnySvg) {
			await createBlankTemplates(nextSide, preferredBlankSize, { focusSide: nextSide });
			return;
		}
		deckSideIndex.setSideIndex(sideIndexForSide(nextSide));
	};

	const flipSide = () => switchSide(side === 'front' ? 'back' : 'front');

	const handleUploadInputChange = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			await buildUploadFunction(side)(file);
		}
		input.value = '';
	};

	const sideHasSvg = (nextSide: Side) => (nextSide === 'front' ? Boolean(front) : Boolean(back));
	const sideIndexForSide = (nextSide: Side) => (nextSide === 'front' ? 0 : 1);
	const sideLabel = (nextSide: Side) => `${nextSide[0].toUpperCase()}${nextSide.slice(1)}`;
	const imageSelectorTitle = $derived(
		imagePickerTarget?.mode === 'replace' ? 'Change Image' : 'Select Image'
	);
	const imageSelectorDescription = $derived(
		imagePickerTarget?.mode === 'replace'
			? `Replace the selected image in the ${sideLabel(side)} SVG`
			: `Add an image to the ${sideLabel(side)} SVG`
	);

	let activeSavePromises = $state<Promise<void>[]>([]);

	const saveSvgAndTrack = (nextSide: Side, value: string) => {
		const promise = writeSvgSide(nextSide, value, { preserveCanvasMeta: true, updateState: false });
		activeSavePromises = [...activeSavePromises, promise];
		void promise.finally(() => {
			activeSavePromises = activeSavePromises.filter((activePromise) => activePromise !== promise);
		});
		return promise;
	};

	const saveFrontDebounced = useDebounce((value: string) => saveSvgAndTrack('front', value), 600);
	const saveBackDebounced = useDebounce((value: string) => saveSvgAndTrack('back', value), 600);

	const scheduleSave = (nextSide: Side, value: string) => {
		const promise = nextSide === 'front' ? saveFrontDebounced(value) : saveBackDebounced(value);
		void promise.catch((error) => {
			console.error(`Failed to save ${nextSide}.svg`, error);
		});
	};

	const flushPendingSaves = async () => {
		await Promise.all([saveFrontDebounced.runScheduledNow(), saveBackDebounced.runScheduledNow()]);
		await Promise.allSettled(activeSavePromises);
	};

	onNavigate(() => {
		if (
			!saveFrontDebounced.pending &&
			!saveBackDebounced.pending &&
			activeSavePromises.length === 0
		) {
			return;
		}
		return flushPendingSaves();
	});

	const handleChange = (event: CustomEvent<ChangeEvent>) => {
		const { svg: value, source } = event.detail;
		if (source !== 'user' || !value) return;
		const normalizedValue = normalizeEditorSvgImages(value);
		if (side === 'front') {
			front = normalizedValue;
		}
		if (side === 'back') {
			back = normalizedValue;
		}
		scheduleSave(side, normalizedValue);
	};
</script>

<main class="flex h-svh w-full flex-col overflow-hidden">
	<GameTopBar>
		<Button size="sm" variant="ghost" href={dataPath} title="Open Spreadsheet editor">
			<Table2 class="size-4" />
			Spreadsheet
		</Button>
		<Separator orientation="vertical" class="h-5" />
		<Button
			size="sm"
			variant="ghost"
			class="w-20 justify-start"
			onclick={flipSide}
			title="Flip card side"
		>
			<FlipHorizontal2 class="size-4" />
			{side === 'front' ? 'Back' : 'Front'}
		</Button>
	</GameTopBar>

	<input
		bind:this={uploadInput}
		class="hidden"
		type="file"
		accept=".svg,image/svg+xml"
		onchange={handleUploadInputChange}
	/>

	{#if hasAnySvg && svg}
		{#key editorKey}
			<div class="min-h-0 flex-1 p-4">
				<ReferenceEditor
					value={editorSvg.value}
					{config}
					assetBasePath="/svgedit/images/"
					initialZoom="fit"
					toolbarActions={uploadToolbarAction}
					imageToolAction={(controller) => openImagePicker('insert', controller)}
					selectedImageChangeAction={(controller) => openImagePicker('replace', controller)}
					selectedImageHrefApplyAction={applySvgEditorImageHref}
					on:change={handleChange}
				/>
			</div>
		{/key}
	{:else}
		<Card class="m-4">
			<CardContent
				class="flex min-h-96 flex-col items-center justify-center gap-4 pt-6 text-center"
			>
				<div>
					<h1 class="text-xl font-semibold">No SVG templates</h1>
					<p class="text-muted-foreground mt-1 text-sm">
						Create front and back templates to start editing this deck layout.
					</p>
				</div>
				<Dialog.Root bind:open={createTemplatesDialogOpen}>
					<Dialog.Trigger>
						{#snippet child({ props })}
							<Button {...props}>Create templates</Button>
						{/snippet}
					</Dialog.Trigger>
					<Dialog.Content>
						<Dialog.Header>
							<Dialog.Title>New SVG templates</Dialog.Title>
							<Dialog.Description>
								Set the shared canvas size for the front and back templates.
							</Dialog.Description>
						</Dialog.Header>
						<form class="grid gap-4" onsubmit={(event) => event.preventDefault()}>
							<div class="grid gap-2">
								<label class="text-sm font-medium" for="blank-width">Width</label>
								<Input id="blank-width" type="number" bind:value={blankWidth} min="5" max="1000" />
							</div>
							<div class="grid gap-2">
								<label class="text-sm font-medium" for="blank-height">Height</label>
								<Input
									id="blank-height"
									type="number"
									bind:value={blankHeight}
									min="5"
									max="1000"
								/>
							</div>
							<div class="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onclick={() => (createTemplatesDialogOpen = false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									onclick={() =>
										createBlankTemplates(
											['front', 'back'],
											{ width: blankWidth, height: blankHeight },
											{ closeDialog: true, focusSide: 'front' }
										)}
								>
									Create
								</Button>
							</div>
						</form>
					</Dialog.Content>
				</Dialog.Root>
			</CardContent>
		</Card>
	{/if}
</main>

{#snippet uploadToolbarAction()}
	<Button
		size="sm"
		variant="ghost"
		class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
		title={`Upload or replace ${sideLabel(side)} SVG`}
		disabled={!svg}
		onclick={() => uploadInput?.click()}
	>
		<Upload class="size-4" />
		Upload
	</Button>
{/snippet}

<ImageSelector
	bind:open={imageSelectorOpen}
	showTrigger={false}
	title={imageSelectorTitle}
	description={imageSelectorDescription}
	onSelect={applySvgEditorImageSelection}
/>
