import type { Adapter } from "$lib/components/file-browser/adapters/adapter";
import type { Column } from "jspreadsheet-ce";
import { parseCsvFile } from "./csv-helper";
import { getSvgDataMap } from "./svg-helpers";
import type { ColumnWithData } from "./types";
import { ImageEditor } from "./decks/[deckName]/data/custom-image";

export async function loadSpreadsheetData(
    svgData: Map<string, ColumnWithData>,
    currentProject: string,
    currentCard: string,
    fileSystem: Adapter
) {
    const csvFileResult = await fileSystem.download([
        `/${currentProject}/system/${currentCard}/data.csv`
    ]);
    const csvFile = csvFileResult[0].result?.data;
    const csvData = csvFile ? await parseCsvFile(csvFile) : null;
    console.log('svgData', svgData);
    if (csvData) {
        const newCols: Column[] = csvData.header.map((header) => {
            return svgData.get(header) // WTF am I even doing here? This is wrong
                ? { ...svgData.get(header) }
                : { title: header, type: 'text' }; // TODO custom column
        });
        return {
            cols: newCols,
            data: csvData.data
        };
    } else {
        return {
            cols: Array.from(svgData.values()).map((c) => ({
                title: c.title,
                type: c.type
            })),
            data: [
                Array.from(svgData.keys()).map((key) => svgData.get(key)?.data || '')
            ]
        };
    }
}

export async function loadImagePaths(
    spreadsheetData: { cols: Column[]; data: string[][] },
    fileSystem: Adapter,
    projectName: string
) {
    const imageStrings = Array.from(new Set(spreadsheetData.data.flatMap((row) => row)));
    // The download and files api is really bad
    const files = await fileSystem.download(
        imageStrings.map((img) => `/${projectName}/files/${img}`)
    );
    const imagePaths = new Map<string, string>();
    imageStrings.forEach((img, i) => {
        const file = files[i];
        if (file.result) {
            imagePaths.set(img, URL.createObjectURL(file.result.data));
        } else {
            imagePaths.set(img, '');
        }
    });
    return imagePaths;
}

export async function loadSvgsAndData(projectName: string, cardName: string, fileSystem: Adapter, svgTemplateFront: SVGSVGElement, svgTemplateBack: SVGSVGElement) {
    const svgData = getSvgDataMap(svgTemplateFront, svgTemplateBack);
    const spreadsheetData = (
        await loadSpreadsheetData(svgData, projectName, cardName, fileSystem)
    );
    const imagePaths = (await loadImagePaths(spreadsheetData, fileSystem, projectName));
    return {
        svgData,
        spreadsheetData,
        imagePaths
    };
}
