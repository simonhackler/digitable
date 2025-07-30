import type jspreadsheet from 'jspreadsheet-ce';
import jSuites from 'jsuites';
import type { Component } from 'svelte';

import {
  Plus,
  Trash2,
  Edit2,
  SortAsc,
  SortDesc,
  Copy as CopyIcon,
  ClipboardPaste as PasteIcon,
  Save as SaveIcon,
  MessageSquare,
  MessageSquareX,
  ArrowUpCircle,
  ArrowDown,
  ArrowDownCircle,
  ArrowLeftCircle,
  ArrowRightCircle
} from '@lucide/svelte';

export interface SheetContextMenuItem {
    title?: string;
    shortcut?: string;
    onclick?: () => void;
    type?: 'line';
    icon?: Component;
}

export const defaultContextMenuItems = function(worksheet: jspreadsheet.WorksheetInstance, x: number | string | null, y: number | string | null, role: jspreadsheet.ContextMenuRole) {
    const items: SheetContextMenuItem[] = [];

    if (role === 'header') {
        // Insert a new column
        if (worksheet.options.allowInsertColumn != false) {
            items.push({
                title: jSuites.translate('Insert a new column before'),
                icon: ArrowLeftCircle,
                onclick: function() {
                    worksheet.insertColumn(1, parseInt(x), 1);
                }
            });
        }

        if (worksheet.options.allowInsertColumn != false) {
            items.push({
                title: jSuites.translate('Insert a new column after'),
                icon: ArrowRightCircle,
                onclick: function() {
                    worksheet.insertColumn(1, parseInt(x), 0);
                }
            });
        }

        // Delete a column
        if (worksheet.options.allowDeleteColumn != false) {
            items.push({
                title: jSuites.translate('Delete selected columns'),
                icon: Trash2,
                onclick: function() {
                    worksheet.deleteColumn(worksheet.getSelectedColumns().length ? undefined : parseInt(x));
                }
            });
        }

        // Rename column
        if (worksheet.options.allowRenameColumn != false) {
            items.push({
                title: jSuites.translate('Rename this column'),
                icon: Edit2,
                onclick: function() {
                    const oldValue = worksheet.getHeader(x);

                    const newValue = prompt(jSuites.translate('Column name'), oldValue);

                    worksheet.setHeader(x, newValue);
                }
            });
        }

        // Sorting
        if (worksheet.options.columnSorting != false) {
            // Line
            items.push({ type: 'line' });

            items.push({
                title: jSuites.translate('Order ascending'),
                        icon: SortAsc,

                onclick: function() {
                    worksheet.orderBy(x, 0);
                }
            });
            items.push({
                title: jSuites.translate('Order descending'),
                        icon: SortDesc,

                onclick: function() {
                    worksheet.orderBy(x, 1);
                }
            });
        }
    }

    if (role === 'row' || role === 'cell') {
        // Insert new row
        if (worksheet.options.allowInsertRow != false) {
            items.push({
                title: jSuites.translate('Insert a new row before'),
                        icon: ArrowUpCircle,

                onclick: function() {
                    worksheet.insertRow(1, parseInt(y), 1);
                }
            });

            items.push({
                title: jSuites.translate('Insert a new row after'),
                        icon: ArrowDownCircle,

                onclick: function() {
                    worksheet.insertRow(1, parseInt(y));
                }
            });
        }

        if (worksheet.options.allowDeleteRow != false) {
            items.push({
                title: jSuites.translate('Delete selected rows'),
                icon: Trash2,
                onclick: function() {
                    worksheet.deleteRow(worksheet.getSelectedRows().length ? undefined : parseInt(y));
                }
            });
        }
    }

    if (role === 'cell') {
        if (worksheet.options.allowComments != false) {
            items.push({ type: 'line' });

            const title = worksheet.records[y][x].element.getAttribute('title') || '';

            items.push({
                title: jSuites.translate(title ? 'Edit comments' : 'Add comments'),
                        icon: MessageSquare,

                onclick: function() {
                    const comment = prompt(jSuites.translate('Comments'), title);
                    if (comment) {
                        worksheet.setComments(getCellNameFromCoords(x, y), comment);
                    }
                }

            });

            if (title) {
                items.push({
                    title: jSuites.translate('Clear comments'),
                              icon: MessageSquareX,

                    onclick: function() {
                        worksheet.setComments(getCellNameFromCoords(x, y), '');
                    }
                });
            }
        }
    }

    // Line
    if (items.length !== 0) {
        items.push({ type: 'line' });
    }

    // Copy
    if (role === 'header' || role === 'row' || role === 'cell') {
        items.push({
            title: jSuites.translate('Copy') + '...',
                  icon: CopyIcon,

            shortcut: 'Ctrl + C',
            onclick: function() {
                copy.call(worksheet, true);
            }
        });

        // Paste
        if (navigator && navigator.clipboard) {
            items.push({
                title: jSuites.translate('Paste') + '...',
                shortcut: 'Ctrl + V',
                        icon: PasteIcon,

                onclick: function() {
                    if (worksheet.selectedCell) {
                        navigator.clipboard.readText().then(function(text) {
                            if (text) {
                                paste.call(worksheet, worksheet.selectedCell[0], worksheet.selectedCell[1], text);
                            }
                        });
                    }
                }
            });
        }
    }

    return items;
}
