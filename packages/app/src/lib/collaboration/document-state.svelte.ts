import type { ChangeFn, Doc, DocHandle } from '@automerge/automerge-repo';

export type DocumentState<T> = ReturnType<typeof createDocumentState<T>>;

export function createDocumentState<T>(
	handle: DocHandle<T>,
	onChange?: (document: Doc<T> | null) => void
) {
	const initial = handle.doc() ?? null;
	let current = $state.raw<Doc<T> | null>(initial);
	const changed = ({ doc }: { doc: Doc<T> | undefined }) => {
		current = doc ?? null;
		onChange?.(current);
	};
	let destroyed = false;

	handle.on('change', changed);
	onChange?.(initial);

	return {
		get current() {
			return current;
		},
		change(change: ChangeFn<T>) {
			if (destroyed) throw new Error('Cannot change a destroyed Automerge document state.');
			handle.change(change);
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			handle.off('change', changed);
		}
	};
}
