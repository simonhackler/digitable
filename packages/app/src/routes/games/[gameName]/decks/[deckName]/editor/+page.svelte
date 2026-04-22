<script lang="ts">
	import { page } from '$app/state';
	import { ReferenceEditor } from '@svg-table/svgeditor';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { useDebounce } from 'runed';
	import { getFileSystemContext } from '../../../../context';

	type Side = 'front' | 'back';
	type SvgMeta = {
		width?: string;
		height?: string;
		viewBox?: string;
	};

	const DEFAULT_TEXT_FONT_SIZE = 24;

	const fileSystem = getFileSystemContext();
	const game = $derived(page.params.gameName);
	const deck = $derived(page.params.deckName);
	const folder = $derived(`/${game}/system/${deck}`);
	const layoutPath = $derived(`/games/${game}/decks/${deck}/layout`);
	const dataPath = $derived(`/games/${game}/decks/${deck}/data`);

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
		const [frontRes, backRes] = await fileSystem.download([
			`${path}/front.svg`,
			`${path}/back.svg`
		]);
		if (frontRes?.error) {
			console.error('Failed to load front.svg', frontRes.error);
		}
		if (backRes?.error) {
			console.error('Failed to load back.svg', backRes.error);
		}
		const front = await frontRes?.result?.data.text();
		const back = await backRes?.result?.data.text();
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
	const meta = $derived(svgs.meta);
	let side = $state<Side>('front');

	const svg = $derived(side === 'front' ? front : back);
	const activeMeta = $derived(side === 'front' ? meta.front : meta.back);
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

	const saveSvg = async (nextSide: Side, value: string) => {
		if (!value) return;
		const nextMeta = nextSide === 'front' ? meta.front : meta.back;
		const nextValue = nextMeta ? applySvgMeta(value, nextMeta) : value;
		const file = new File([nextValue], `${nextSide}.svg`, { type: 'image/svg+xml' });
		const error = await fileSystem.upload(file, folder, true);
		if (error) {
			console.error(`Upload failed for ${nextSide}.svg`, error);
		}
	};

	const saveDebounced = useDebounce(saveSvg, 600);

	const handleChange = (event: CustomEvent<{ svg: string; source: 'user' | 'external' }>) => {
		const { svg: value, source } = event.detail;
		if (source !== 'user') return;
		if (side === 'front') {
			front = value;
		}
		if (side === 'back') {
			back = value;
		}
		saveDebounced(side, value);
	};
</script>

<main class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
	<div class="flex flex-wrap items-center gap-2">
		<Button variant={side === 'front' ? 'default' : 'outline'} onclick={() => (side = 'front')}>
			Front
		</Button>
		<Button variant={side === 'back' ? 'default' : 'outline'} onclick={() => (side = 'back')}>
			Back
		</Button>
		<Button variant="ghost" href={layoutPath}>Layout</Button>
		<Button variant="ghost" href={dataPath}>Data</Button>
	</div>

	{#if svg}
		<Card>
			<CardContent class="pt-6">
				{#key side}
					<ReferenceEditor
						value={svg}
						{config}
						assetBasePath="/svgedit/images/"
						initialZoom="fit"
						on:change={handleChange}
					/>
				{/key}
			</CardContent>
		</Card>
	{/if}

	{#if !svg}
		<Card>
			<CardContent class="flex flex-col gap-3 pt-6">
				<p class="text-muted-foreground text-sm">
					Upload front/back SVGs in the layout editor to start editing.
				</p>
				<div class="flex items-center gap-2">
					<Button href={layoutPath}>Go to layout</Button>
					<Button variant="outline" href={dataPath}>Go to data</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</main>
