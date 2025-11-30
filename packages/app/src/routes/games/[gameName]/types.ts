import type { CustomEditor } from 'jspreadsheet-ce';

export interface SvgCard {
	front: SVGSVGElement;
	back: SVGSVGElement;
}

export interface ColumnWithData {
	title: string;
	type: 'text' | CustomEditor;
	data: string[];
}
