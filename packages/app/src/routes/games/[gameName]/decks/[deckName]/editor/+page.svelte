<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { ReferenceEditor } from '@svg-table/svgeditor';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Upload } from '@lucide/svelte';
	import placeholderFrontSvg from '../../../../../../../static/placeholder.svg?raw';
	import { useDebounce } from 'runed';
	import { getFileSystemContext } from '../../../../context';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';
	import { createEmptySvg } from '$lib/utils/svg-helpers.js';
	import { untrack } from 'svelte';

	type Side = 'front' | 'back';
	type SvgMeta = {
		width?: string;
		height?: string;
		viewBox?: string;
	};

	const DEFAULT_TEXT_FONT_SIZE = 24;

	const fileSystem = getFileSystemContext();
	const game = $derived(requireParam('gameName'));
	const deck = $derived(requireParam('deckName'));
	const folder = $derived(joinFsPath(game, 'system', deck));
	const dataPath = $derived(`/games/${game}/decks/${deck}/data`);
	const maxSvgUploadSize = 12 * 1024 * 1024;

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

	async function loadSvgs(path: string) {
		const deckDir = await fileSystem.openDir(path);
		if (deckDir.error) {
			console.error('Failed to open deck folder', deckDir.error);
			return {
				front: '',
				back: '',
				meta: {
					front: {},
					back: {}
				}
			};
		}

		const [frontRes, backRes] = await Promise.all([
			deckDir.data.readText('front.svg'),
			deckDir.data.readText('back.svg')
		]);
		if (frontRes.error) {
			console.error('Failed to load front.svg', frontRes.error);
		}
		if (backRes.error) {
			console.error('Failed to load back.svg', backRes.error);
		}
		const front = frontRes.error ? null : frontRes.data;
		const back = backRes.error ? null : backRes.data;
		return {
			front: front ?? '',
			back: back ?? '',
			meta: {
				front: getSvgMeta(front),
				back: getSvgMeta(back)
			}
		};
	}

	const svgsProm = $derived(loadSvgs(folder));
	const svgs = $derived(await svgsProm);

	let front = $derived(svgs.front);
	let back = $derived(svgs.back);
	let frontMeta = $derived(svgs.meta.front);
	let backMeta = $derived(svgs.meta.back);
	let side = $state<Side>(untrack(() => (front || !back ? 'front' : 'back')));
	let blankWidth = $state(63);
	let blankHeight = $state(88);
	let createTemplatesDialogOpen = $state(false);
	let uploadInput: HTMLInputElement | null = $state(null);

	const svg = $derived(side === 'front' ? front : back);
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
		baseUnit: 'px'
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
		side = nextSide;
	};

	const writePlaceholderSvg = async () => {
		const file = new File([placeholderFrontSvg], 'placeholder.svg', {
			type: 'image/svg+xml'
		});
		const filesDir = await fileSystem.ensureDir(joinFsPath(game, 'files'));
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
		if (focusSide) side = focusSide;
		if (closeDialog) createTemplatesDialogOpen = false;
	};

	const switchSide = async (nextSide: Side) => {
		if (nextSide === side) return;
		if (!sideHasSvg(nextSide) && hasAnySvg) {
			await createBlankTemplates(nextSide, preferredBlankSize, { focusSide: nextSide });
			return;
		}
		side = nextSide;
	};

	const handleUploadInputChange = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			await buildUploadFunction(side)(file);
		}
		input.value = '';
	};

	const sideHasSvg = (nextSide: Side) => (nextSide === 'front' ? Boolean(front) : Boolean(back));
	const sideLabel = (nextSide: Side) => `${nextSide[0].toUpperCase()}${nextSide.slice(1)}`;

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

	const handleChange = (event: CustomEvent<{ svg: string; source: 'user' | 'external' }>) => {
		const { svg: value, source } = event.detail;
		if (source !== 'user') return;
		if (side === 'front') {
			front = value;
		}
		if (side === 'back') {
			back = value;
		}
		scheduleSave(side, value);
	};
</script>

<main class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
	<div class="flex flex-wrap items-center gap-2">
		<Button variant={side === 'front' ? 'default' : 'outline'} onclick={() => switchSide('front')}>
			Front
		</Button>
		<Button variant={side === 'back' ? 'default' : 'outline'} onclick={() => switchSide('back')}>
			Back
		</Button>
		<Button variant="ghost" href={dataPath}>Data</Button>
	</div>

	<input
		bind:this={uploadInput}
		class="hidden"
		type="file"
		accept=".svg,image/svg+xml"
		onchange={handleUploadInputChange}
	/>

	{#if hasAnySvg && svg}
		<Card>
			<CardContent class="pt-6">
				{#key side}
					<ReferenceEditor
						value={svg}
						{config}
						assetBasePath="/svgedit/images/"
						initialZoom="fit"
						toolbarActions={uploadToolbarAction}
						on:change={handleChange}
					/>
				{/key}
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardContent
				class="flex min-h-96 flex-col items-center justify-center gap-4 pt-6 text-center"
			>
				<div>
					<h1 class="text-xl font-semibold">No SVG templates</h1>
					<p class="text-muted-foreground mt-1 text-sm">
						Create front and back templates to start editing this deck.
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
