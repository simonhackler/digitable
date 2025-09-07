import type { CellValue, WorksheetInstance, Column, CustomEditor } from 'jspreadsheet-ce';

export const ImageEditor: CustomEditor = {
	updateCell: function (cell, value, x, y, instance, options) {
		if (cell) {
			cell.innerText = String(value || '');
		}
		return value;
	},
	createCell: function (cell, value, x, y, instance, options) {
		if (cell) {
			cell.innerText = String(value || '');
		}
		return cell;
	},
	openEditor: function (cell, value, x, y, instance) {
		// Create a simple text input for image editing
		const input = document.createElement('input');
		input.type = 'text';
		input.value = String(value || '');
		input.style.width = '100%';
		input.style.height = '100%';
		input.style.border = 'none';
		input.style.outline = 'none';

		// Clear cell content and append input
		cell.innerHTML = '';
		cell.appendChild(input);
		input.focus();

		return input;
	},
	closeEditor: function (cell, save, x, y, instance, options) {
		const input = cell.querySelector('input');
		if (input && save) {
			return input.value;
		}
		return undefined;
	}
};
