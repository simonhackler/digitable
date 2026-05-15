<script lang="ts">
	import { tick } from 'svelte';
	import { getFileSystemContext } from '../../context';
	import { type Attachment } from 'svelte/attachments';
	import { getProjectFilePath, isEmbeddedImageReference } from '../data-loader';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';

	export interface Sheet {
		name: string;
		svgs: SVGSVGElement[];
	}

	let {
		sheets,
		gameName,
		onExported
	}: {
		sheets: Sheet[];
		gameName: string;
		onExported: (sheet: Sheet) => void;
	} = $props();

	let index = $state(0);
	let svgs: SVGSVGElement[] = $derived(
		sheets[0].svgs.slice(0).map((svg) => {
			// TODO: Why does this work and with the "normal" svg way it doesn't? Very confusing
			const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
			return clonedSvg;
		})
	);
	let sheetEl: HTMLDivElement;
	const fileSytem = getFileSystemContext();
	const localImageCache: Record<string, LocalImage> = {};

	const TRANSPARENT_IMAGE =
		'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';
	const SVG_MIME_TYPE = 'image/svg+xml';
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const SHEET_WIDTH = 4096;
	const CARDS_PER_ROW = 10;

	type LocalImage =
		| {
				type: 'href';
				href: string;
		  }
		| {
				type: 'svg';
				text: string;
		  };

	const blobToDataUrl = (blob: Blob) =>
		new Promise<string>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.readAsDataURL(blob);
		});

	const getImageHref = (image: SVGImageElement) =>
		image.getAttribute('href') ?? image.getAttribute('xlink:href') ?? '';

	const setImageHref = (image: SVGImageElement, value: string) => {
		image.setAttribute('href', value);
		image.setAttribute('xlink:href', value);
	};

	const resolveLocalImage = async (href: string): Promise<LocalImage> => {
		const filePath = getProjectFilePath(gameName, href);
		if (!filePath) return { type: 'href', href: href || TRANSPARENT_IMAGE };

		const cached = localImageCache[filePath];
		if (cached) return cached;

		const file = await fileSytem.read(joinFsPath(filePath));
		if (file.error) {
			localImageCache[filePath] = { type: 'href', href: TRANSPARENT_IMAGE };
			return localImageCache[filePath];
		}

		const blob = file.data;
		const isSvg = blob.type.includes(SVG_MIME_TYPE) || filePath.toLowerCase().endsWith('.svg');
		localImageCache[filePath] = isSvg
			? { type: 'svg', text: await blob.text() }
			: { type: 'href', href: await blobToDataUrl(blob) };
		return localImageCache[filePath];
	};

	const inlineSvgImage = (image: SVGImageElement, svgText: string) => {
		const doc = new DOMParser().parseFromString(svgText, SVG_MIME_TYPE);
		const svg = doc.documentElement;
		if (svg.nodeName.toLowerCase() !== 'svg') {
			setImageHref(image, TRANSPARENT_IMAGE);
			return;
		}

		for (const attr of ['x', 'y', 'width', 'height', 'preserveAspectRatio', 'transform']) {
			const value = image.getAttribute(attr);
			if (value) svg.setAttribute(attr, value);
		}

		image.replaceWith(svg);
	};

	const inlineLocalSvgImages = async (root: Element) => {
		const images = Array.from(root.querySelectorAll<SVGImageElement>('svg image'));
		await Promise.all(
			images.map(async (image) => {
				const href = getImageHref(image).trim();
				if (href && isEmbeddedImageReference(href)) return;
				const localImage = await resolveLocalImage(href);
				if (localImage.type === 'svg') {
					inlineSvgImage(image, localImage.text);
				} else {
					setImageHref(image, localImage.href);
				}
			})
		);
	};

	const parsePositiveNumber = (value: string | null) => {
		if (!value) return null;
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	};

	const getSvgAspectRatio = (svg: SVGSVGElement) => {
		const viewBox = svg.getAttribute('viewBox');
		if (viewBox) {
			const [, , width, height] = viewBox.split(/[ ,]+/).map(Number);
			if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
				return height / width;
			}
		}

		const width = parsePositiveNumber(svg.getAttribute('width'));
		const height = parsePositiveNumber(svg.getAttribute('height'));
		return width && height ? height / width : 1;
	};

	const getCssValue = (element: HTMLElement | SVGElement, property: string) =>
		element.style.getPropertyValue(property).trim();

	const replaceForeignObjectsWithSvgText = (svg: SVGSVGElement) => {
		for (const foreignObject of Array.from(
			svg.querySelectorAll<SVGForeignObjectElement>('foreignObject')
		)) {
			const div = foreignObject.querySelector<HTMLElement>('div');
			const text = document.createElementNS(SVG_NS, 'text');
			const x = foreignObject.getAttribute('x') ?? '0';
			const y = foreignObject.getAttribute('y') ?? '0';
			const transform = foreignObject.getAttribute('transform');
			const fontSize = getCssValue(div ?? foreignObject, 'font-size') || '12px';
			const lineHeight = parsePositiveNumber(getCssValue(div ?? foreignObject, 'line-height'));
			const dy = lineHeight ?? (parsePositiveNumber(fontSize) ?? 12) * 1.2;
			const lines = (div?.textContent ?? '').split('\n');

			text.setAttribute('x', x);
			text.setAttribute('y', y);
			text.setAttribute('font-size', fontSize);
			text.setAttribute(
				'font-family',
				getCssValue(div ?? foreignObject, 'font-family') || 'sans-serif'
			);
			text.setAttribute('dominant-baseline', 'hanging');
			if (foreignObject.id) text.id = foreignObject.id;
			if (transform) text.setAttribute('transform', transform);

			const color = getCssValue(div ?? foreignObject, 'color');
			if (color) text.setAttribute('fill', color);

			const fontWeight = getCssValue(div ?? foreignObject, 'font-weight');
			if (fontWeight) text.setAttribute('font-weight', fontWeight);

			lines.forEach((line, i) => {
				const tspan = document.createElementNS(SVG_NS, 'tspan');
				tspan.setAttribute('x', x);
				if (i > 0) tspan.setAttribute('dy', String(dy));
				tspan.textContent = line;
				text.appendChild(tspan);
			});

			foreignObject.replaceWith(text);
		}
	};

	const getExportSafeSvg = (svg: SVGSVGElement) => {
		const clone = svg.cloneNode(true) as SVGSVGElement;
		replaceForeignObjectsWithSvgText(clone);
		return clone;
	};

	const renderSheetBlob = async (sheetSvgs: SVGSVGElement[]) => {
		const cellWidth = SHEET_WIDTH / CARDS_PER_ROW;
		const cellHeight = cellWidth * getSvgAspectRatio(sheetSvgs[0]);
		const rows = Math.max(1, Math.ceil(sheetSvgs.length / CARDS_PER_ROW));
		const height = cellHeight * rows;

		const canvas = document.createElement('canvas');
		canvas.width = SHEET_WIDTH;
		canvas.height = Math.ceil(height);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Failed to create canvas context');

		for (const [i, svg] of sheetSvgs.entries()) {
			const exportSvg = getExportSafeSvg(svg);
			exportSvg.setAttribute('xmlns', SVG_NS);
			exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
			exportSvg.setAttribute('width', String(cellWidth));
			exportSvg.setAttribute('height', String(cellHeight));
			exportSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			exportSvg.removeAttribute('style');

			const url = URL.createObjectURL(
				new Blob([new XMLSerializer().serializeToString(exportSvg)], { type: SVG_MIME_TYPE })
			);
			const image = new Image();
			const loaded = new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = reject;
			});
			try {
				image.src = url;
				await loaded;
				context.drawImage(
					image,
					(i % CARDS_PER_ROW) * cellWidth,
					Math.floor(i / CARDS_PER_ROW) * cellHeight,
					cellWidth,
					cellHeight
				);
			} finally {
				URL.revokeObjectURL(url);
			}
		}

		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('Failed to convert sheet to blob');
		return blob;
	};

	const prepareSvgForSheet = (svg: SVGSVGElement) => {
		svg.removeAttribute('width');
		svg.removeAttribute('height');
		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		Object.assign(svg.style, {
			display: 'block',
			width: '100%',
			height: 'auto',
			maxWidth: '100%',
			flex: '1 1 auto'
		});
	};

	async function takeImage() {
		try {
			await tick();
			await inlineLocalSvgImages(sheetEl);
			const height = sheetEl?.getBoundingClientRect().height || 0;
			console.log(
				`Taking image for sheet: ${sheets[index].name}, height: ${height} shetEl:`,
				sheetEl
			);

			const blob = await renderSheetBlob(svgs);

			const file = new File([blob], `${sheets[index].name}_sheet.png`, {
				type: 'image/png',
				lastModified: Date.now()
			});

			const exportDir = await fileSytem.ensureDir(joinFsPath(gameName, 'tts-export'));
			if (exportDir.error) throw exportDir.error;
			const written = await exportDir.data.write(file.name, file);
			if (written.error) throw written.error;
			if (index < sheets.length - 1) {
				index += 1;
				const svgsReal = sheets[index].svgs.map((svg) => {
					const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
					return clonedSvg;
				});
				const missing = Math.max(11 - svgsReal.length, 0); //TTS expects 2 rows per sheet, hacky
				console.log('SVGS for next sheet:', svgsReal.length, 'missing:', missing);
				for (let i = 0; i < missing; i++) {
					const clonedSvg = sheets[index].svgs[0].cloneNode(true) as SVGSVGElement;
					svgsReal.push(clonedSvg);
				}
				svgs = svgsReal;
			}
			onExported(sheets[index]);
		} catch (error) {
			console.error('Error taking image:', error);
			console.error('Sheet element:', sheetEl);
			console.error('Current sheet:', sheets[index]);
			console.error('SVGs in current sheet:', svgs.length);

			// Special handling for image load failures while rasterizing SVG cards.
			if (error instanceof Event) {
				const target = (error as Event).target || (error as Event).currentTarget;

				if (target instanceof HTMLImageElement) {
					console.error('[takeImage] Broken image src:', target.src);
					console.error('[takeImage] Image attributes:', {
						crossOrigin: target.crossOrigin,
						width: target.width,
						height: target.height
					});
				} else {
					console.error('[takeImage] Event target is not an HTMLImageElement:', target);
				}
			} else if (error instanceof Error) {
				console.error('Error message:', error.message);
				console.error('Error stack:', error.stack);
			} else {
				console.error('Unknown error type:', error);
			}
		}
	}

	function attachSVGs(): Attachment {
		return (element) => {
			sheetEl = element as HTMLDivElement;
			svgs.forEach((svg) => {
				prepareSvgForSheet(svg);
				element.appendChild(svg);
			});
			takeImage();
			return () => {
				svgs.forEach((svg) => {
					element.removeChild(svg);
				});
			};
		};
	}
</script>

<div class="sheet grid grid-cols-10" id="sheet" {@attach attachSVGs()}></div>

<style>
	.sheet {
		width: 4096px;
	}
</style>
