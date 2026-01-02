import type jspreadsheet from 'jspreadsheet-ce';
import type { Component } from 'svelte';

import {
	Trash2,
	Pen,
	ArrowUpNarrowWide,
	ArrowDownWideNarrow,
	Copy as CopyIcon,
	ClipboardPaste as PasteIcon,
	CircleArrowUp,
	CircleArrowDown,
	CircleArrowLeft,
	CircleArrowRight
} from '@lucide/svelte';

export interface SheetContextMenuItem {
	title?: string;
	shortcut?: string;
	onclick?: () => void;
	type?: 'line';
	icon?: Component;
}

export const defaultContextMenuItems = function (
	worksheet: jspreadsheet.WorksheetInstance,
	x: number | string | null,
	y: number | string | null,
	role: jspreadsheet.ContextMenuRole
) {
	const items: SheetContextMenuItem[] = [];

	const parsedX = x !== null ? parseInt(x as string) : null;
	const parsedY = y !== null ? parseInt(y as string) : null;

	if (role === 'header') {
		// Insert a new column
		if (parsedX !== null) {
			if (worksheet.options.allowInsertColumn != false) {
				items.push({
					title: 'Insert a new column before',
					icon: CircleArrowLeft,
					onclick: function () {
						worksheet.insertColumn(1, parsedX, true);
					}
				});
			}

			if (worksheet.options.allowInsertColumn != false) {
				items.push({
					title: 'Insert a new column after',
					icon: CircleArrowRight,
					onclick: function () {
						worksheet.insertColumn(1, parsedX, false);
					}
				});
			}
		}

		// Delete a column
		if (worksheet.options.allowDeleteColumn != false) {
			items.push({
				title: 'Delete selected columns',
				icon: Trash2,
				onclick: function () {
					worksheet.deleteColumn(
						worksheet.getSelectedColumns().length || parsedX === null ? undefined : parsedX
					);
				}
			});
		}

		if (parsedX !== null) {
			if (worksheet.options.allowRenameColumn != false) {
				items.push({
					title: 'Rename this column',
					icon: Pen,
					onclick: function () {
						const oldValue = worksheet.getHeader(parsedX);

						const newValue = prompt('Column name', oldValue);

						worksheet.setHeader(parsedX, newValue!);
					}
				});
			}

			// Sorting
			if (worksheet.options.columnSorting != false) {
				// Line
				items.push({ type: 'line' });

				items.push({
					title: 'Order ascending',
					icon: ArrowUpNarrowWide,

					onclick: function () {
						worksheet.orderBy(parsedX, 0);
					}
				});
				items.push({
					title: 'Order descending',
					icon: ArrowDownWideNarrow,

					onclick: function () {
						worksheet.orderBy(parsedX, 1);
					}
				});
			}
		}
	}

	if (role === 'row' || role === 'cell') {
		if (parsedY !== null) {
			if (worksheet.options.allowInsertRow != false) {
				items.push({
					title: 'Insert a new row before',
					icon: CircleArrowUp,

					onclick: function () {
						worksheet.insertRow(1, parsedY, 1);
					}
				});

				items.push({
					title: 'Insert a new row after',
					icon: CircleArrowDown,

					onclick: function () {
						worksheet.insertRow(1, parsedY);
					}
				});
			}
		}
		if (worksheet.options.allowDeleteRow != false) {
			items.push({
				title: 'Delete selected rows',
				icon: Trash2,
				onclick: function () {
					worksheet.deleteRow(
						worksheet.getSelectedRows().length || parsedY === null ? undefined : parsedY
					);
				}
			});
		}
	}

	// if (role === 'cell') {
	//     if (worksheet.options.allowComments != false) {
	//         items.push({ type: 'line' });
	//
	//         const title = worksheet.records[y][x].element.getAttribute('title') || '';
	//
	//         items.push({
	//             title: title ? 'Edit comments' : 'Add comments',
	//             icon: MessageSquare,
	//
	//             onclick: function() {
	//                 const comment = prompt('Comments', title);
	//                 if (comment) {
	//                     worksheet.setComments(getCellNameFromCoords(x, y), comment);
	//                 }
	//             }
	//         });
	//
	//         if (title) {
	//             items.push({
	//                 title: 'Clear comments',
	//                 icon: MessageSquareX,
	//
	//                 onclick: function() {
	//                     worksheet.setComments(getCellNameFromCoords(x, y), '');
	//                 }
	//             });
	//         }
	//     }
	// }

	if (items.length !== 0) {
		items.push({ type: 'line' });
	}

	// TODO does not work?
	if (role === 'header' || role === 'row' || role === 'cell') {
		items.push({
			title: 'Copy...',
			icon: CopyIcon,

			shortcut: 'Ctrl + C',
			onclick: function () {
				worksheet.copy.call(worksheet, true);
			}
		});

		// Paste
		if (navigator && navigator.clipboard) {
			items.push({
				title: 'Paste...',
				shortcut: 'Ctrl + V',
				icon: PasteIcon,

				onclick: function () {
					if (worksheet.selectedCell) {
						navigator.clipboard.readText().then(function (text) {
							if (text && worksheet.selectedCell) {
								worksheet.paste.call(
									worksheet,
									worksheet.selectedCell[0] as number,
									worksheet.selectedCell[1] as number,
									text
								);
							}
						});
					}
				}
			});
		}
	}

	return items;
};
