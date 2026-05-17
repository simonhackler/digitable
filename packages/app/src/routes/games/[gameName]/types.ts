import type { CustomEditor } from 'jspreadsheet-ce';

export interface ColumnWithData {
	title: string;
	type: 'text' | CustomEditor;
	data: string[];
}
