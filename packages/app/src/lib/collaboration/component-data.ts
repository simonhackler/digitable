import { updateText } from '@automerge/automerge-repo';
import Papa from 'papaparse';
import type { MemberMaterializer } from './materializer';
import {
	isComponentDataDocument,
	type ComponentDataDocument,
	type ComponentDataRow
} from './model';

export type ComponentDataTable = {
	header: string[];
	data: string[][];
};

export const componentDataMaterializer: MemberMaterializer<ComponentDataDocument> = {
	kind: 'component-data',
	parse(source, context) {
		const parsed = Papa.parse<string[]>(source, { skipEmptyLines: true });
		if (parsed.errors.length) {
			throw new Error(
				`data.csv is invalid: ${parsed.errors.map((error) => error.message).join('; ')}`
			);
		}
		if (!parsed.data.length) throw new Error('data.csv must contain a header row.');

		const [header, ...rows] = parsed.data;
		const duplicates = header.filter((name, index) => header.indexOf(name) !== index);
		if (duplicates.length)
			throw new Error(`data.csv contains duplicate column "${duplicates[0]}".`);

		const idIndex = header.indexOf('id');
		if (idIndex === -1 && !context.allowMissingIds) {
			throw new Error('data.csv must retain its id column after Automerge migration.');
		}
		const names = header.filter((_, index) => index !== idIndex);
		const columns = Object.fromEntries(
			names.map((name, index) => [columnId(context.hash, index), { name }])
		);
		const columnOrder = Object.keys(columns);
		const seen = new Set<string>();
		const parsedRows = rows.map((row, rowIndex) => {
			if (row.length > header.length) {
				throw new Error(`data.csv row ${rowIndex + 2} has more values than the header.`);
			}
			const suppliedId = idIndex === -1 ? '' : String(row[idIndex] ?? '').trim();
			if (!suppliedId && !context.allowMissingIds) {
				throw new Error(`data.csv row ${rowIndex + 2} must retain its id.`);
			}
			const id = suppliedId || rowId(rowIndex);
			if (seen.has(id)) throw new Error(`data.csv contains duplicate row id "${id}".`);
			seen.add(id);
			const cells = Object.fromEntries(
				columnOrder.map((id, columnIndex) => {
					const sourceIndex = header.indexOf(names[columnIndex]);
					return [id, String(row[sourceIndex] ?? '')];
				})
			);
			return [id, { cells }] as const;
		});

		return {
			type: 'component-data',
			schemaVersion: 1,
			columns,
			columnOrder,
			rows: Object.fromEntries(parsedRows),
			rowOrder: parsedRows.map(([id]) => id)
		};
	},
	apply(document, incoming) {
		const existingColumns = new Map(
			Array.from(document.columnOrder).flatMap((id) => {
				const column = document.columns[id];
				return column ? [[column.name, id] as const] : [];
			})
		);
		const incomingColumns = Array.from(incoming.columnOrder).flatMap((incomingId) => {
			const column = incoming.columns[incomingId];
			if (!column) return [];
			return [
				{ incomingId, id: existingColumns.get(column.name) ?? incomingId, name: column.name }
			];
		});
		const incomingColumnIds = new Set(incomingColumns.map((column) => column.id));

		for (const id of Object.keys(document.columns)) {
			if (!incomingColumnIds.has(id)) delete document.columns[id];
		}
		for (const column of incomingColumns) {
			if (!document.columns[column.id]) document.columns[column.id] = { name: column.name };
		}
		const columnOrder = incomingColumns.map((column) => column.id);
		if (!sameOrder(document.columnOrder, columnOrder)) {
			document.columnOrder.splice(0, document.columnOrder.length, ...columnOrder);
		}

		const incomingRowIds = new Set(incoming.rowOrder);
		for (const id of Object.keys(document.rows)) {
			if (!incomingRowIds.has(id)) delete document.rows[id];
		}
		for (const rowId of incoming.rowOrder) {
			const incomingRow = incoming.rows[rowId];
			if (!incomingRow) continue;
			const cells = Object.fromEntries(
				incomingColumns.map((column) => [column.id, incomingRow.cells[column.incomingId] ?? ''])
			);
			const row = document.rows[rowId];
			if (!row) {
				document.rows[rowId] = { cells };
				continue;
			}
			applyCells(document, rowId, row, cells);
		}
		if (!sameOrder(document.rowOrder, incoming.rowOrder)) {
			document.rowOrder.splice(0, document.rowOrder.length, ...incoming.rowOrder);
		}
	},
	serialize(document) {
		const table = componentDataTable(document);
		return `${Papa.unparse([table.header, ...table.data])}\n`;
	},
	isDocument: isComponentDataDocument
};

export function componentDataTable(document: ComponentDataDocument): ComponentDataTable {
	const columnOrder = normalizedOrder(document.columnOrder, Object.keys(document.columns));
	const columns = columnOrder.flatMap((id) => {
		const column = document.columns[id];
		return column ? [{ id, name: column.name }] : [];
	});
	const names = columns.map((column) => column.name);
	if (new Set(names).size !== names.length) {
		throw new Error('Cannot materialize data.csv with duplicate column names.');
	}
	const rowOrder = normalizedOrder(document.rowOrder, Object.keys(document.rows));
	return {
		header: ['id', ...columns.map((column) => column.name)],
		data: rowOrder.flatMap((id) => {
			const row = document.rows[id];
			return row ? [[id, ...columns.map((column) => row.cells[column.id] ?? '')]] : [];
		})
	};
}

function normalizedOrder(order: string[], ids: string[]): string[] {
	const available = new Set(ids);
	const seen = new Set<string>();
	const ordered = Array.from(order).filter((id) => {
		if (!available.has(id) || seen.has(id)) return false;
		seen.add(id);
		return true;
	});
	return [...ordered, ...ids.filter((id) => !seen.has(id)).sort()];
}

function applyCells(
	document: ComponentDataDocument,
	rowId: string,
	row: ComponentDataRow,
	cells: Record<string, string>
): void {
	for (const id of Object.keys(row.cells)) {
		if (!(id in cells)) delete row.cells[id];
	}
	for (const [id, value] of Object.entries(cells)) {
		if (!(id in row.cells)) {
			row.cells[id] = value;
			continue;
		}
		if (row.cells[id] !== value) updateText(document, ['rows', rowId, 'cells', id], value);
	}
}

function sameOrder(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function columnId(hash: string, index: number): string {
	return `column-${hash}-${index}`;
}

function rowId(index: number): string {
	return `row-missing-id-${index}`;
}
