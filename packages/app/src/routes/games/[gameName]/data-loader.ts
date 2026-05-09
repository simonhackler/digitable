import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import type { Column } from 'jspreadsheet-ce';
import { parseCsvFile } from './csv-helper';
import { ImageEditor } from './decks/[deckName]/data/custom-image';
import { getSvgDataMap } from './svg-helpers';
import type { ColumnWithData } from './types';

const LOCAL_FILE_MARKER = '/files/';
const TRANSPARENT_IMAGE =
	'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';

const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.readAsDataURL(blob);
	});

export const isEmbeddedImageReference = (value: string) =>
	/^(data|blob|https?|file):/i.test(value.trim());

export function getProjectFilePath(projectName: string, value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed || isEmbeddedImageReference(trimmed)) return null;

	const withoutQuery = trimmed.split(/[?#]/, 1)[0];
	const filesIndex = withoutQuery.lastIndexOf(LOCAL_FILE_MARKER);
	const localPath =
		filesIndex >= 0
			? withoutQuery.slice(filesIndex + LOCAL_FILE_MARKER.length)
			: withoutQuery.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');

	if (!localPath) return null;
	return `/${projectName}/files/${localPath}`;
}

export async function loadSpreadsheetData(
	svgData: Map<string, ColumnWithData>,
	currentProject: string,
	currentCard: string,
	fileSystem: FsDir
) {
	const csvTextResult = await fileSystem.readText(
		joinFsPath(currentProject, 'system', currentCard, 'data.csv')
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
			data
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
					crypto.randomUUID(),
					...Array.from(svgData.keys()).map((key) => svgData.get(key)?.data[0] || '')
				]
			]
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
	const downloadPaths = imageStrings.map((img) => getProjectFilePath(projectName, img));
	const files = await Promise.all(
		downloadPaths.map(async (path) => {
			if (!path) return null;
			const file = await fileSystem.read(joinFsPath(path));
			return file.error ? null : file.data;
		})
	);
	const imagePaths = new Map<string, string>();
	await Promise.all(
		imageStrings.map(async (img, i) => {
			if (!img) {
				imagePaths.set(img, '');
				return;
			}
			if (isEmbeddedImageReference(img)) {
				imagePaths.set(img, img);
				return;
			}

			const file = files[i];
			if (file) {
				if (useDataUrls) {
					imagePaths.set(img, await blobToDataUrl(file));
				} else {
					imagePaths.set(img, URL.createObjectURL(file));
				}
			} else {
				imagePaths.set(img, TRANSPARENT_IMAGE);
			}
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
	const svgData = getSvgDataMap(svgTemplateFront, svgTemplateBack);
	const spreadsheetData = await loadSpreadsheetData(svgData, projectName, cardName, fileSystem);
	const imagePaths = await loadImagePaths(spreadsheetData, fileSystem, projectName, useDataUrls);
	return {
		svgData,
		spreadsheetData,
		imagePaths
	};
}
