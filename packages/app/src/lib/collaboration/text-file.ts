import { updateText } from '@automerge/automerge-repo';
import type { MemberMaterializer } from './materializer';
import { isTextFileDocument, type ProjectMemberKind, type TextFileDocument } from './model';

export function textFileMaterializer(
	kind: Exclude<ProjectMemberKind, 'game-metadata' | 'component-data' | 'asset'>
): MemberMaterializer<TextFileDocument> {
	return {
		kind,
		parse: (source) => ({ type: 'text-file', schemaVersion: 1, content: source }),
		apply(document, incoming) {
			if (document.content !== incoming.content) updateText(document, ['content'], incoming.content);
		},
		serialize: (document) => document.content,
		isDocument: isTextFileDocument
	};
}
