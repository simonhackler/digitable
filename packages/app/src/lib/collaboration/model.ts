import type { AutomergeUrl } from '@automerge/automerge-repo';
import type { SvgDocument } from '@svg-table/svgeditor';

export const GAME_METADATA_MEMBER_ID = '$metadata';

export type ProjectMemberKind =
	| 'game-metadata'
	| 'component-data'
	| 'component-svg'
	| 'rules'
	| 'table-setup'
	| 'feedback-registry'
	| 'feedback-markdown'
	| 'asset';

export type ProjectMember = {
	kind: ProjectMemberKind;
	path: string;
	url: AutomergeUrl;
	hash?: string;
	componentId?: string;
};

export type ProjectComponent = {
	name: string;
	frontMemberId?: string;
	backMemberId?: string;
	dataMemberId?: string;
};

export type ProjectDocument = {
	type: 'digitable-project';
	schemaVersion: 2;
	members: Record<string, ProjectMember>;
	components: Record<string, ProjectComponent>;
};

export type LegacyProjectDocument = {
	type: 'digitable-project';
	schemaVersion: 1;
	members: Record<
		string,
		{ kind: 'game-metadata' | 'component-data'; path: string; url: AutomergeUrl }
	>;
	components: Record<string, { name: string; dataMemberId?: string }>;
};

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export type GameMetadataDocument = {
	type: 'game-metadata';
	schemaVersion: 1;
	name: string;
	players: {
		min: number;
		max: number;
	};
	description: string;
	tags: string[];
	digitableVersion?: string;
	extra: Record<string, JsonValue>;
};

export type ComponentDataColumn = {
	name: string;
};

export type ComponentDataRow = {
	cells: Record<string, string>;
};

export type ComponentDataDocument = {
	type: 'component-data';
	schemaVersion: 1;
	columns: Record<string, ComponentDataColumn>;
	columnOrder: string[];
	rows: Record<string, ComponentDataRow>;
	rowOrder: string[];
};

export type TextFileDocument = {
	type: 'text-file';
	schemaVersion: 1;
	content: string;
};

export type MarkdownFileDocument = {
	type: 'markdown-file';
	schemaVersion: 1;
	dialect: 'commonmark';
	content: string;
};

export type BinaryFileDocument = {
	type: 'binary-file';
	schemaVersion: 1;
	content: Uint8Array;
};

export type ProjectMemberDocument =
	| GameMetadataDocument
	| ComponentDataDocument
	| TextFileDocument
	| SvgDocument
	| MarkdownFileDocument
	| BinaryFileDocument;

export function isProjectDocument(value: unknown): value is ProjectDocument {
	if (!isObject(value)) return false;
	if (value.type !== 'digitable-project' || value.schemaVersion !== 2) return false;
	if (!isObject(value.members) || !isObject(value.components)) return false;

	return (
		Object.values(value.members).every(isProjectMember) &&
		Object.values(value.components).every(
			(component) =>
				isObject(component) &&
				typeof component.name === 'string' &&
				(component.frontMemberId === undefined || typeof component.frontMemberId === 'string') &&
				(component.backMemberId === undefined || typeof component.backMemberId === 'string') &&
				(component.dataMemberId === undefined || typeof component.dataMemberId === 'string')
		)
	);
}

export function isLegacyProjectDocument(value: unknown): value is LegacyProjectDocument {
	if (!isObject(value)) return false;
	if (value.type !== 'digitable-project' || value.schemaVersion !== 1) return false;
	if (!isObject(value.members) || !isObject(value.components)) return false;
	return (
		Object.values(value.members).every(
			(member) =>
				isObject(member) &&
				(member.kind === 'game-metadata' || member.kind === 'component-data') &&
				typeof member.path === 'string' &&
				typeof member.url === 'string'
		) &&
		Object.values(value.components).every(
			(component) =>
				isObject(component) &&
				typeof component.name === 'string' &&
				(component.dataMemberId === undefined || typeof component.dataMemberId === 'string')
		)
	);
}

export function isGameMetadataDocument(value: unknown): value is GameMetadataDocument {
	if (!isObject(value)) return false;
	return (
		value.type === 'game-metadata' &&
		value.schemaVersion === 1 &&
		typeof value.name === 'string' &&
		isObject(value.players) &&
		Number.isInteger(value.players.min) &&
		Number.isInteger(value.players.max) &&
		typeof value.description === 'string' &&
		Array.isArray(value.tags) &&
		value.tags.every((tag) => typeof tag === 'string') &&
		(value.digitableVersion === undefined || typeof value.digitableVersion === 'string') &&
		isObject(value.extra) &&
		Object.values(value.extra).every(isJsonValue)
	);
}

export function isComponentDataDocument(value: unknown): value is ComponentDataDocument {
	if (!isObject(value)) return false;
	if (value.type !== 'component-data' || value.schemaVersion !== 1) return false;
	if (!isObject(value.columns) || !isObject(value.rows)) return false;
	if (!Array.isArray(value.columnOrder) || !value.columnOrder.every(isString)) return false;
	if (!Array.isArray(value.rowOrder) || !value.rowOrder.every(isString)) return false;

	return (
		Object.values(value.columns).every(
			(column) => isObject(column) && typeof column.name === 'string'
		) &&
		Object.values(value.rows).every(
			(row) =>
				isObject(row) &&
				isObject(row.cells) &&
				Object.values(row.cells).every((cell) => typeof cell === 'string')
		)
	);
}

export function isTextFileDocument(value: unknown): value is TextFileDocument {
	return (
		isObject(value) &&
		value.type === 'text-file' &&
		value.schemaVersion === 1 &&
		typeof value.content === 'string'
	);
}

export function isMarkdownFileDocument(value: unknown): value is MarkdownFileDocument {
	return (
		isObject(value) &&
		value.type === 'markdown-file' &&
		value.schemaVersion === 1 &&
		value.dialect === 'commonmark' &&
		typeof value.content === 'string'
	);
}

export function isBinaryFileDocument(value: unknown): value is BinaryFileDocument {
	return (
		isObject(value) &&
		value.type === 'binary-file' &&
		value.schemaVersion === 1 &&
		value.content instanceof Uint8Array
	);
}

function isProjectMember(value: unknown): value is ProjectMember {
	return (
		isObject(value) &&
		isProjectMemberKind(value.kind) &&
		typeof value.path === 'string' &&
		typeof value.url === 'string' &&
		(value.hash === undefined || typeof value.hash === 'string') &&
		(value.componentId === undefined || typeof value.componentId === 'string')
	);
}

function isProjectMemberKind(value: unknown): value is ProjectMemberKind {
	return (
		value === 'game-metadata' ||
		value === 'component-data' ||
		value === 'component-svg' ||
		value === 'rules' ||
		value === 'table-setup' ||
		value === 'feedback-registry' ||
		value === 'feedback-markdown' ||
		value === 'asset'
	);
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
	if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
	if (typeof value === 'number') return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(isJsonValue);
	return isObject(value) && Object.values(value).every(isJsonValue);
}
