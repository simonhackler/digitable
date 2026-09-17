export { default as SvgCanvasHost } from './svelte/SvgCanvasHost.svelte';
export { createEditorController } from './svelte/createEditorController.svelte.ts';
export { createSvgCanvas } from './core/createSvgCanvas';
export type * from './core/types';
export { default as ReferenceEditor } from './reference/ReferenceEditor.svelte';
export { default as ReferenceEditorToolbar } from './reference/Toolbar.svelte';
export {
	SVG_DOCUMENT_SCHEMA_VERSION,
	isNodeId,
	isSvgDocument,
	validateSvgDocument
} from './crdt/model';
export type * from './crdt/model';
export { compare, comparePosition, isPositionId, positionBetween } from './crdt/position';
export type { PositionId } from './crdt/position';
export {
	SVG_NODE_ID_ATTRIBUTE,
	SVG_PATH_COMMANDS_ATTRIBUTE,
	SVG_POINTS_ATTRIBUTE,
	parseSvg,
	parseSvgDocument,
	serializeSvg,
	serializeSvgDocument
} from './crdt/codec';
export type { ParseSvgOptions, SerializeSvgOptions } from './crdt/codec';
export { applySvgDocument } from './crdt/apply';
export { createSvgDocumentBinding } from './crdt/binding.svelte';
export type { SvgDocumentBinding } from './crdt/binding.svelte';
