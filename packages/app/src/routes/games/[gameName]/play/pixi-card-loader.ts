import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { loadSvgsAndData } from '../data-loader';
import { generateSvg, loadSvgTemplate } from '../svg-helpers';
import { BoardGameItem } from '$lib/pixi/item';
import '@pixi/layout';
import { LayoutContainer, LayoutSprite } from '@pixi/layout/components';

interface ImageInfo {
	element: SVGImageElement;
	x: number;
	y: number;
	width: number;
	height: number;
	href: string;
	transform?: string;
}

function extractImagesFromSvg(svg: SVGSVGElement): ImageInfo[] {
	const images = svg.querySelectorAll('image');
	const imageInfos: ImageInfo[] = [];

	images.forEach((img) => {
		const x = parseFloat(img.getAttribute('x') || '0');
		const y = parseFloat(img.getAttribute('y') || '0');
		const width = parseFloat(img.getAttribute('width') || '0');
		const height = parseFloat(img.getAttribute('height') || '0');
		const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
		const transform = img.getAttribute('transform') || undefined;

		imageInfos.push({
			element: img,
			x,
			y,
			width,
			height,
			href,
			transform
		});
	});

	return imageInfos;
}

function stripImagesFromSvg(svg: SVGSVGElement): SVGSVGElement {
	const svgClone = svg.cloneNode(true) as SVGSVGElement;
	const images = svgClone.querySelectorAll('image');
	images.forEach((img) => img.remove());
	return svgClone;
}

function getSvgScale(svg: SVGSVGElement, texture: Texture) {
	const viewBox = svg.viewBox.baseVal;
	if (!viewBox || viewBox.width === 0 || viewBox.height === 0) {
		return { scaleX: 1, scaleY: 1 };
	}
	return {
		scaleX: texture.width / viewBox.width,
		scaleY: texture.height / viewBox.height
	};
}

function applyScale(value: number, scale: number) {
	if (!isFinite(value)) return 0;
	return value * scale;
}

async function createImageSprites(
	svg: SVGSVGElement,
	texture: Texture,
	imageInfos: ImageInfo[]
): Promise<Sprite[]> {
	const sprites: Sprite[] = [];
	const { scaleX, scaleY } = getSvgScale(svg, texture);

	for (const imageInfo of imageInfos) {
		try {
			const spriteTexture = await Assets.load(imageInfo.href);
			const sprite = new Sprite(spriteTexture);

			sprite.x = applyScale(imageInfo.x, scaleX);
			sprite.y = applyScale(imageInfo.y, scaleY);
			sprite.width = applyScale(imageInfo.width, scaleX);
			sprite.height = applyScale(imageInfo.height, scaleY);

			if (imageInfo.transform) {
				// Apply transform if present (basic support)
				// You might need to extend this for complex transforms
				const transformMatch = imageInfo.transform.match(/translate\(([^)]+)\)/);
				if (transformMatch) {
					const [rawTx, rawTy = 0] = transformMatch[1].split(',').map((v) => parseFloat(v.trim()));
					sprite.x += applyScale(rawTx, scaleX);
					sprite.y += applyScale(rawTy, scaleY);
				}
			}

			sprites.push(sprite);
		} catch (error) {
			console.warn('Failed to load image:', imageInfo.href, error);
		}
	}

	return sprites;
}

async function svgToTexture(svg: SVGSVGElement, cardIndex?: number) {
	const svgClone = svg.cloneNode(true) as SVGSVGElement;
	const svgData = new XMLSerializer().serializeToString(svgClone);
	const objectUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
	const texture = (await Assets.load({
		src: objectUrl,
		format: 'svg',
		parser: 'svg',
		resolution: 1
	})) as Texture;

	if (cardIndex !== undefined) {
		console.log(`Card ${cardIndex} texture timing:`);
	}

	URL.revokeObjectURL(objectUrl);

	return texture;
}

export async function createHybridContainer(svg: SVGSVGElement) {
	const imageInfos = extractImagesFromSvg(svg);
	const strippedSvg = stripImagesFromSvg(svg);

	const svgTexture = await svgToTexture(strippedSvg);
	const imageSprites = await createImageSprites(svg, svgTexture, imageInfos);

	const imageContainer = new Container();

	const svgSprite = new Sprite({
		texture: svgTexture,
		layout: {
			objectFit: 'contain',
			objectPosition: 'center',
			width: '100%',
			aspectRatio: svgTexture.width / svgTexture.height
		}
	});

	imageSprites.forEach((sprite) => {
		imageContainer.addChild(sprite);
	});
	imageContainer.cacheAsTexture({ resolution: 4 });
	const container = new LayoutContainer({
		layout: {
			aspectRatio: svgTexture.width / svgTexture.height,
			objectFit: 'contain',
			objectPosition: 'center'
		},
		background: imageContainer
	});
	container.addChild(svgSprite);

	return container;
}

export async function loadAndProcessCards(projectName: string, cardName: string, fileSystem: any) {
	const fullFolderPath = `/${projectName}/system/${cardName}`;
	const [frontFile, backFile] = await fileSystem.download([
		`${fullFolderPath}/front.svg`,
		`${fullFolderPath}/back.svg`
	]);

	const svgTextFront = await frontFile.result?.data.text();
	const svgTextBack = await backFile.result?.data.text();
	if (!svgTextFront || !svgTextBack) throw new Error('Could not load SVG template files');

	const svgTemplateFront = loadSvgTemplate(svgTextFront);
	const svgTemplateBack = loadSvgTemplate(svgTextBack);

	const { svgData, spreadsheetData, imagePaths } = await loadSvgsAndData(
		projectName,
		cardName,
		fileSystem,
		svgTemplateFront,
		svgTemplateBack
	);

	console.log('Loaded SVG Data:', svgData);
	console.log('Spreadsheet Data:', spreadsheetData);

	const cards = spreadsheetData.data.map((row) => ({
		front: generateSvg(
			svgTemplateFront,
			spreadsheetData.cols.map((c) => c.title as string),
			row,
			imagePaths
		),
		back: generateSvg(
			svgTemplateBack,
			spreadsheetData.cols.map((c) => c.title as string),
			row,
			imagePaths
		)
	}));

	const hybridPromises = cards.map(async (card, index) => {
		const [frontContainer, backContainer] = await Promise.all([
			createHybridContainer(card.front),
			createHybridContainer(card.back)
		]);
		return { front: frontContainer, back: backContainer, index };
	});
	const hybridResults = await Promise.all(hybridPromises);

	return hybridResults;
}
