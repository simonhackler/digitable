import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
import type { Column } from 'jspreadsheet-ce';
import { parseCsvFile } from './csv-helper';
import { getSvgDataMap } from './svg-helpers';
import type { ColumnWithData } from './types';

export async function loadSpreadsheetData(
	svgData: Map<string, ColumnWithData>,
	currentProject: string,
	currentCard: string,
	fileSystem: Adapter
) {
	const csvFileResult = await fileSystem.download([
		`/${currentProject}/system/${currentCard}/data.csv`
	]);
	const csvBlob = csvFileResult[0].result?.data;
	const csvFile = csvBlob ? new File([csvBlob], 'data.csv', { type: 'text/csv' }) : null;
	const csvData = csvFile ? await parseCsvFile(csvFile) : null;
	const idCol: Column = { type: 'hidden', title: 'id' };
	if (csvData) {
		const newCols: Column[] = csvData.header
			.filter((x) => x !== 'id')
			.map((header) => {
				const svgCol = svgData.get(header);
				if (svgCol) {
					// Create proper Column object from ColumnWithData
					return {
						title: svgCol.title,
						type: svgCol.type
					} as Column;
				} else {
					// Column not in svgData
					return { title: header, type: 'text' } as Column;
				}
			});
		newCols.unshift(idCol);

		const idIndexInCsv = csvData.header.indexOf('id');

		const data = csvData.data.map((row) => {
			const idValue =
				idIndexInCsv >= 0 && row[idIndexInCsv] != null && String(row[idIndexInCsv]).trim() !== ''
					? row[idIndexInCsv]
					: crypto.randomUUID();

			const rest = newCols.slice(1).map((h) => {
				const idx = newCols.indexOf(h);
				return idx >= 0 ? row[idx] : '';
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
	fileSystem: Adapter,
	projectName: string,
	useDataUrls = false
) {
	const imageStrings = Array.from(new Set(spreadsheetData.data.flatMap((row) => row)));
	// The download and files api is really bad
	const files = await fileSystem.download(
		imageStrings.map((img) => `/${projectName}/files/${img}`)
	);
	const imagePaths = new Map<string, string>();
	await Promise.all(
		imageStrings.map(async (img, i) => {
			const file = files[i];
			if (file.result) {
				const result = file.result;
				if (useDataUrls) {
					const dataUrl = new Promise<string>((resolve) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result as string);
						reader.readAsDataURL(result.data);
					});
					imagePaths.set(img, await dataUrl);
				} else {
					imagePaths.set(img, URL.createObjectURL(file.result.data));
				}
			} else {
				imagePaths.set(img, '');
			}
		})
	);
	return imagePaths;
}

export async function loadSvgsAndData(
	projectName: string,
	cardName: string,
	fileSystem: Adapter,
	svgTemplateFront: SVGSVGElement,
	svgTemplateBack: SVGSVGElement
) {
	const svgData = getSvgDataMap(svgTemplateFront, svgTemplateBack);
	const spreadsheetData = await loadSpreadsheetData(svgData, projectName, cardName, fileSystem);
	const imagePaths = await loadImagePaths(spreadsheetData, fileSystem, projectName, true);
	return {
		svgData,
		spreadsheetData,
		imagePaths
	};
}
