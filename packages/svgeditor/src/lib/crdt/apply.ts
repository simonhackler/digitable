import { updateText } from '@automerge/automerge-repo';
import { isVec2, type NodeId, type SvgDocument, type SvgNode } from './model';

type MutableRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is MutableRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const clone = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(clone);
	if (!isRecord(value)) return value;
	return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
};

const sameValue = (left: unknown, right: unknown): boolean =>
	JSON.stringify(left) === JSON.stringify(right);

const isPaint = (value: unknown): boolean =>
	isRecord(value) && ['none', 'color', 'resource', 'raw'].includes(value.kind as string);

const isImageSource = (value: unknown): boolean =>
	isRecord(value) &&
	['url', 'data', 'raw'].includes(value.kind as string) &&
	(value.attribute === 'href' || value.attribute === 'xlink:href');

const isAtomic = (value: unknown): boolean =>
	Array.isArray(value) || isVec2(value) || isPaint(value) || isImageSource(value);

const reconcileSequence = (target: MutableRecord, incoming: MutableRecord): void => {
	for (const [id, value] of Object.entries(incoming)) {
		const current = target[id];
		if (isRecord(current) && isRecord(value)) {
			reconcileRecord(current, value);
			continue;
		}
		target[id] = clone(value);
	}
	for (const [id, value] of Object.entries(target)) {
		if (!(id in incoming) && isRecord(value) && value.deleted !== true) value.deleted = true;
	}
};

const reconcileRecord = (target: MutableRecord, incoming: MutableRecord): void => {
	for (const key of Object.keys(target)) if (!(key in incoming)) delete target[key];
	for (const [key, value] of Object.entries(incoming)) {
		const current = target[key];
		if ((key === 'commands' || key === 'points') && isRecord(current) && isRecord(value)) {
			reconcileSequence(current, value);
			continue;
		}
		if (isAtomic(value)) {
			if (!sameValue(current, value)) target[key] = clone(value);
			continue;
		}
		if (isRecord(current) && isRecord(value)) {
			reconcileRecord(current, value);
			continue;
		}
		if (!sameValue(current, value)) target[key] = clone(value);
	}
};

const reconcileNode = (
	document: SvgDocument,
	id: NodeId,
	target: SvgNode,
	incoming: SvgNode
): void => {
	const targetRecord = target as unknown as MutableRecord;
	const incomingRecord = incoming as unknown as MutableRecord;
	for (const key of Object.keys(targetRecord))
		if (!(key in incomingRecord)) delete targetRecord[key];
	for (const [key, value] of Object.entries(incomingRecord)) {
		const current = targetRecord[key];
		if (key === 'placement') {
			if (!sameValue(current, value)) targetRecord.placement = clone(value);
			continue;
		}
		if (key === 'text' && typeof value === 'string' && typeof current === 'string') {
			if (current !== value) updateText(document, ['nodes', id, 'text'], value);
			continue;
		}
		if (isAtomic(value)) {
			if (!sameValue(current, value)) targetRecord[key] = clone(value);
			continue;
		}
		if (isRecord(current) && isRecord(value)) {
			reconcileRecord(current, value);
			continue;
		}
		if (!sameValue(current, value)) targetRecord[key] = clone(value);
	}
};

/** Applies parsed state to an Automerge change draft without replacing existing node objects. */
export const applySvgDocument = (document: SvgDocument, incoming: SvgDocument): void => {
	if (document.schemaVersion !== incoming.schemaVersion)
		document.schemaVersion = incoming.schemaVersion;
	if (document.rootId !== incoming.rootId) document.rootId = incoming.rootId;

	for (const [rawId, node] of Object.entries(incoming.nodes)) {
		const id = rawId as NodeId;
		const current = document.nodes[id];
		if (!current) {
			document.nodes[id] = clone(node) as SvgNode;
			continue;
		}
		reconcileNode(document, id, current, node);
	}
	for (const [rawId, node] of Object.entries(document.nodes)) {
		const id = rawId as NodeId;
		if (!(id in incoming.nodes) && !node.meta.deleted) node.meta.deleted = true;
	}

	reconcileRecord(
		document.resources as unknown as MutableRecord,
		incoming.resources as unknown as MutableRecord
	);
};
