import { Assets, Sprite, type Texture } from 'pixi.js';
import { loadSvgsAndData } from '../data-loader';
import { generateSvg, loadSvgTemplate } from '../svg-helpers';
import '@pixi/layout';
import type { Adapter } from '$lib/components/file-browser/adapters/adapter';

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
	const svgTexture = await svgToTexture(svg);

	// const container = new LayoutContainer({
	// 	layout: {
	// 		aspectRatio: svgTexture.width / svgTexture.height,
	// 		objectFit: 'contain',
	// 		objectPosition: 'center'
	// 	}
	// });
	//
	const svgSprite = new Sprite({
		texture: svgTexture,
		layout: {
			objectFit: 'contain',
			objectPosition: 'center',
			width: '100%',
			aspectRatio: svgTexture.width / svgTexture.height
		}
	});

	return svgSprite;
	// container.addChild(svgSprite);

	// return container;
}

// Parsing the text to svg and then the images seperately, to get svg scaling and to be able to change the text later
export async function loadAndProcessCards(
	projectName: string,
	cardName: string,
	fileSystem: Adapter
) {
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

	const { spreadsheetData, imagePaths } = await loadSvgsAndData(
		projectName,
		cardName,
		fileSystem,
		svgTemplateFront,
		svgTemplateBack
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
			imagePaths
		)
	}));

	const hybridPromises = cards.map(async (card) => {
		try {
			const [frontContainer, backContainer] = await Promise.all([
				createHybridContainer(card.front),
				createHybridContainer(card.back)
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
