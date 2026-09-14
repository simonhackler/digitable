import type { Node } from 'prosemirror-model';
import type { MemberMaterializer } from '../materializer';
import { isMarkdownFileDocument, type MarkdownFileDocument } from '../model';
import { applyMarkdownNode, parseMarkdown, serializeMarkdownDocument } from './markdown-codec';

export const markdownFileMaterializer: MemberMaterializer<MarkdownFileDocument, Node> = {
	kind: 'rules',
	parse: parseMarkdown,
	apply(document, incoming) {
		applyMarkdownNode(document, incoming);
	},
	serialize: serializeMarkdownDocument,
	isDocument: isMarkdownFileDocument
};
