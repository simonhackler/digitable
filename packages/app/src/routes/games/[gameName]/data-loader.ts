import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import { ASSETS_DIR, COMPONENTS_DIR } from '$lib/workspace/project-layout';
import type { Column } from 'jspreadsheet-ce';
import { parseCsvFile } from './csv-helper';
import { ImageEditor } from './decks/[deckName]/data/custom-image';
import { getSvgDataMapForSides, type SvgDataSide } from './svg-helpers';
import type { ColumnWithData } from './types';

const LOCAL_ASSET_MARKER = `/${ASSETS_DIR}/`;
export const TRANSPARENT_IMAGE =
	'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.readAsDataURL(blob);
	});

export const isEmbeddedImageReference = (value: string) =>
	/^(data|blob|https?|file):/i.test(value.trim());

export const isImageFileName = (path: string) => {
	const trimmed = path.trim().split(/[?#]/, 1)[0].toLowerCase();
	const lastDot = trimmed.lastIndexOf('.');
	if (lastDot < 0) return false;
	return IMAGE_EXTENSIONS.has(trimmed.slice(lastDot));
};

export function getProjectFilePath(projectName: string, value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed || isEmbeddedImageReference(trimmed)) return null;

	const withoutQuery = trimmed.split(/[?#]/, 1)[0];
	const assetsIndex = withoutQuery.lastIndexOf(LOCAL_ASSET_MARKER);
	const localPath =
		assetsIndex >= 0
			? withoutQuery.slice(assetsIndex + LOCAL_ASSET_MARKER.length)
			: withoutQuery
					.replace(/^(\.\.\/)+/, '')
					.replace(/^\/+/, '')
					.replace(new RegExp(`^${ASSETS_DIR}/`), '');

	if (!localPath) return null;
	return `/${projectName}/${ASSETS_DIR}/${localPath}`;
}

export async function resolveImageReference(
	fileSystem: FsDir,
	projectName: string,
	value: string,
	useDataUrls = false
) {
	const img = value.trim();
	if (!img) return '';
	if (isEmbeddedImageReference(img)) return img;

	const filePath = getProjectFilePath(projectName, img);
	if (!filePath) return TRANSPARENT_IMAGE;

	const file = await fileSystem.read(joinFsPath(filePath));
	if (file.error) return TRANSPARENT_IMAGE;

	return useDataUrls ? await blobToDataUrl(file.data) : URL.createObjectURL(file.data);
}

export async function listProjectImageFiles(fileSystem: FsDir, projectName: string) {
	const rootPath = joinFsPath(projectName, ASSETS_DIR);
	const images: string[] = [];

	async function walk(relativePath: string) {
		const fullPath = relativePath ? joinFsPath(rootPath, relativePath) : rootPath;
		const entries = await fileSystem.list(fullPath);
		if (entries.error) return;

		await Promise.all(
			entries.data.map(async (entry) => {
				const entryPath = relativePath ? joinFsPath(relativePath, entry.name) : entry.name;
				if (entry.kind === 'directory') {
					await walk(entryPath);
					return;
				}
				if (isImageFileName(entry.name)) {
					images.push(entryPath);
				}
			})
		);
	}

	await walk('');
	return images.sort((a, b) => a.localeCompare(b));
}

export async function loadSpreadsheetData(
	svgData: Map<string, ColumnWithData>,
	currentProject: string,
	currentCard: string,
	fileSystem: FsDir
) {
	const csvTextResult = await fileSystem.readText(
		joinFsPath(currentProject, COMPONENTS_DIR, currentCard, 'data.csv')
	);
	const csvFile = csvTextResult.error
		? null
		: new File([csvTextResult.data], 'data.csv', { type: 'text/csv' });
	const csvData = csvFile ? await parseCsvFile(csvFile) : null;
	const idCol: Column = { type: 'hidden', title: 'id' };
	if (csvData) {
		const csvHeaders = csvData.header.filter((x) => x !== 'id');
		const csvHeaderSet = new Set(csvData.header);
		const csvCols: Column[] = csvHeaders.map((header) => {
			const svgCol = svgData.get(header);
			if (svgCol) {
				return {
					title: svgCol.title,
					type: svgCol.type
				} as Column;
			}

			return { title: header, type: 'text' } as Column;
		});
		const missingSvgCols: Column[] = Array.from(svgData.values())
			.filter((col) => !csvHeaderSet.has(col.title))
			.map(
				(col) =>
					({
						title: col.title,
						type: col.type
					}) as Column
			);

		const newCols: Column[] = [...csvCols, ...missingSvgCols];
		newCols.unshift(idCol);

		const idIndexInCsv = csvData.header.indexOf('id');

		const data = csvData.data.map((row) => {
			const idValue =
				idIndexInCsv >= 0 && row[idIndexInCsv] != null && String(row[idIndexInCsv]).trim() !== ''
					? row[idIndexInCsv]
					: crypto.randomUUID();

			const rest = newCols.slice(1).map((h) => {
				const title = h.title as string;
				const idx = csvData.header.indexOf(title);
				if (idx >= 0) return row[idx] ?? '';
				return svgData.get(title)?.data[0] || '';
			});

			return [idValue, ...rest];
		});

		return {
			cols: newCols,
			data,
			generatedFromTemplates: false
		};
	} else {
		return {
			cols: [
				idCol,
				...Array.from(svgData.values()).map(
					(c) =>
						({
							title: c.title,
							type: c.type
						}) as Column
				)
			],
			data: [
				[
					'template',
					...Array.from(svgData.keys()).map((key) => svgData.get(key)?.data[0] || '')
				]
			],
			generatedFromTemplates: true
		};
	}
}

export async function loadImagePaths(
	spreadsheetData: { cols: Column[]; data: string[][] },
	fileSystem: FsDir,
	projectName: string,
	useDataUrls = false
) {
	const imageColumnIndexes = spreadsheetData.cols.flatMap((col, index) =>
		col.type === ImageEditor ? [index] : []
	);
	const imageStrings = Array.from(
		new Set(
			spreadsheetData.data.flatMap((row) =>
				imageColumnIndexes
					.map((index) => row[index])
					.filter((value) => value && value.trim() !== '')
			)
		)
	);
	if (imageStrings.length === 0) {
		return new Map<string, string>();
	}
	const imagePaths = new Map<string, string>();
	await Promise.all(
		imageStrings.map(async (img) => {
			if (!img) {
				imagePaths.set(img, '');
				return;
			}
			imagePaths.set(img, await resolveImageReference(fileSystem, projectName, img, useDataUrls));
		})
	);
	return imagePaths;
}

export async function loadSvgsAndData(
	projectName: string,
	cardName: string,
	fileSystem: FsDir,
	svgTemplateFront: SVGSVGElement,
	svgTemplateBack: SVGSVGElement,
	useDataUrls = true
) {
	return loadSvgsAndDataForSides(
		projectName,
		cardName,
		fileSystem,
		[{ template: svgTemplateFront }, { template: svgTemplateBack, columnPrefix: 'back_' }],
		useDataUrls
	);
}

export async function loadSvgsAndDataForSides(
	projectName: string,
	cardName: string,
	fileSystem: FsDir,
	sides: SvgDataSide[],
	useDataUrls = true
) {
	const svgData = getSvgDataMapForSides(sides);
	const spreadsheetData = await loadSpreadsheetData(svgData, projectName, cardName, fileSystem);
	const imagePaths = await loadImagePaths(spreadsheetData, fileSystem, projectName, useDataUrls);
	return {
		svgData,
		spreadsheetData,
		imagePaths
	};
}
