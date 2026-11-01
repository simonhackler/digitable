import type { Doc, DocHandle, UrlHeads } from '@automerge/automerge-repo';
import { applySvgDocument } from './apply';
import { parseSvg, serializeSvg } from './codec';
import { isSvgDocument, type SvgDocument } from './model';

export type SvgDocumentBinding = ReturnType<typeof createSvgDocumentBinding>;

export function createSvgDocumentBinding(handle: DocHandle<SvgDocument>) {
	const initial = handle.doc();
	if (!isSvgDocument(initial))
		throw new Error('The Automerge SVG document has an unsupported format.');

	let current = $state.raw(serializeSvg(initial));
	let heads = handle.heads();
	let changing = false;
	let pending: string | null = null;
	let destroyed = false;

	const changed = ({ doc }: { doc: Doc<SvgDocument> | undefined }) => {
		if (!doc || !isSvgDocument(doc)) return;
		const next = serializeSvg(doc);
		heads = handle.heads();
		if (changing) {
			pending = next;
			return;
		}
		current = next;
	};

	handle.on('change', changed);

	return {
		get current() {
			return current;
		},
		get heads(): UrlHeads {
			return heads;
		},
		change(source: string, baseHeads: UrlHeads = heads): UrlHeads | null {
			if (destroyed) throw new Error('Cannot change a destroyed SVG document binding.');
			const incoming = parseSvg(source);
			const expected = serializeSvg(incoming);
			pending = null;
			changing = true;
			let changedHeads: UrlHeads | undefined;
			try {
				changedHeads = handle.changeAt(
					baseHeads,
					(document: SvgDocument) => applySvgDocument(document, incoming),
					{
						message: 'Edit SVG'
					}
				);
			} finally {
				changing = false;
			}
			heads = handle.heads();
			const merged = pending ?? serializeSvg(handle.doc()!);
			pending = null;
			if (merged !== expected) current = merged;
			return changedHeads ?? null;
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			handle.off('change', changed);
		}
	};
}
