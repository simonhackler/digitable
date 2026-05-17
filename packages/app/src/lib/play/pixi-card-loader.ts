import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { loadSvgsAndData } from '../../routes/games/[gameName]/data-loader';
import { generateSvg, loadSvgTemplate } from '../../routes/games/[gameName]/svg-helpers';
import '@pixi/layout';
import { LayoutContainer } from '@pixi/layout/components';
import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import type { ParsedSvg } from './initComponent';

const serializer = new XMLSerializer();
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

function createImagesOnlySvg(sourceSvg: SVGSVGElement): SVGSVGElement {
	const newSvg = document.createElementNS(SVG_NS, 'svg');

	newSvg.setAttribute('xmlns', SVG_NS);
	newSvg.setAttribute('xmlns:xlink', XLINK_NS);

	for (const attr of ['width', 'height', 'viewBox', 'preserveAspectRatio']) {
		const value = sourceSvg.getAttribute(attr);
		if (value) {
			newSvg.setAttribute(attr, value);
		}
	}

	for (const img of sourceSvg.querySelectorAll('image')) {
		const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
		if (href.trim()) {
			newSvg.appendChild(img.cloneNode(true));
		}
	}

	return newSvg;
}

function stripImagesFromSvg(svg: SVGSVGElement): SVGSVGElement {
	const svgClone = svg.cloneNode(true) as SVGSVGElement;
	svgClone.querySelectorAll('image').forEach((img) => img.remove());
	return svgClone;
}

function getTextureCacheKey(svg: SVGSVGElement) {
	const rootId = svg.getAttribute('id');
	svg.removeAttribute('id');
	const cacheKey = serializer.serializeToString(svg);
	if (rootId) {
		svg.setAttribute('id', rootId);
	}
	return cacheKey;
}

async function svgToTexture(svg: SVGSVGElement, textureCache: Map<string, Promise<Texture>>) {
	const cacheKey = getTextureCacheKey(svg);
	const cachedTexture = textureCache.get(cacheKey);
	if (cachedTexture) return cachedTexture;

	const svgData = serializer.serializeToString(svg);
	const objectUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
	const texture = Assets.load({
		src: objectUrl,
		format: 'svg',
		parser: 'svg',
		resolution: 1
	}) as Promise<Texture>;

	void texture.then(
		() => URL.revokeObjectURL(objectUrl),
		() => URL.revokeObjectURL(objectUrl)
	);
	textureCache.set(cacheKey, texture);

	return texture;
}

export async function createHybridContainer(
	svg: SVGSVGElement,
	textureCache: Map<string, Promise<Texture>>
) {
	const imagesOnlySvg = createImagesOnlySvg(svg);
	const strippedSvg = stripImagesFromSvg(svg);
	const svgTexture = await svgToTexture(strippedSvg, textureCache);
	const svgSprite = new Sprite({
		texture: svgTexture,
		layout: {
			objectFit: 'contain',
			objectPosition: 'center',
			width: '100%',
			aspectRatio: svgTexture.width / svgTexture.height
		}
	});

	if (imagesOnlySvg.querySelector('image') === null) {
		return svgSprite;
	}

	const imageTexture = await svgToTexture(imagesOnlySvg, textureCache);
	const imageBackground = new Sprite(imageTexture);
	const container = new LayoutContainer({
		layout: {
			aspectRatio: svgTexture.width / svgTexture.height,
			objectFit: 'contain',
			objectPosition: 'center'
		},
		background: imageBackground
	});
	container.addChild(svgSprite);

	return container as Container;
}

// Parsing the text to svg and then the images seperately, to get svg scaling and to be able to change the text later
export async function loadAndProcessCards(
	projectName: string,
	cardName: string,
	fileSystem: FsDir
): Promise<ParsedSvg[]> {
	const deckDir = await fileSystem.openDir(joinFsPath(projectName, 'system', cardName));
	if (deckDir.error) throw new Error(deckDir.error.message);

	const [frontFile, backFile] = await Promise.all([
		deckDir.data.readText('front.svg'),
		deckDir.data.readText('back.svg')
	]);
	if (frontFile.error) {
		throw new Error(frontFile.error.message);
	}
	if (backFile.error) {
		throw new Error(backFile.error.message);
	}
	const svgTextFront = frontFile.data;
	const svgTextBack = backFile.data;

	const svgTemplateFront = loadSvgTemplate(svgTextFront);
	const svgTemplateBack = loadSvgTemplate(svgTextBack);

	const { spreadsheetData, imagePaths } = await loadSvgsAndData(
		projectName,
		cardName,
		fileSystem,
		svgTemplateFront,
		svgTemplateBack,
		true
	);
	const idIndex = spreadsheetData.cols.findIndex((x) => x.title == 'id');

	const cards = spreadsheetData.data.map((row) => ({
		id: row[idIndex],
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
			imagePaths,
			{ columnPrefix: 'back_' }
		)
	}));

	const textureCache = new Map<string, Promise<Texture>>();

	const hybridPromises = cards.map(async (card) => {
		try {
			const [frontContainer, backContainer] = await Promise.all([
				createHybridContainer(card.front, textureCache),
				createHybridContainer(card.back, textureCache)
			]);
			return { id: card.id, front: frontContainer, back: backContainer };
		} catch (error) {
			console.error('failed card', card.id, error);
			throw error;
		}
	});
	const hybridResults = await Promise.all(hybridPromises);

	return hybridResults;
}
