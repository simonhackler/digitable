import * as A from '@automerge/automerge';
import { pmDocFromSpans, pmNodeToSpans } from '@automerge/prosemirror';
import MarkdownIt from 'markdown-it';
import {
	defaultMarkdownParser,
	defaultMarkdownSerializer,
	MarkdownParser,
	MarkdownSerializer
} from 'prosemirror-markdown';
import type { Node } from 'prosemirror-model';
import type { MarkdownFileDocument } from '../model';
import { markdownSchemaAdapter } from './markdown-schema-adapter';

const tokenizer = new MarkdownIt('commonmark', { html: false }).enable('strikethrough');

export const markdownParser = new MarkdownParser(markdownSchemaAdapter.schema, tokenizer, {
	...defaultMarkdownParser.tokens,
	s: { mark: 'strike' }
});

export const markdownSerializer = new MarkdownSerializer(
	{
		...defaultMarkdownSerializer.nodes,
		list_item(state, node) {
			const paragraph = node.firstChild;
			const prefix =
				paragraph?.type.name === 'paragraph'
					? /^\[[ xX]\]\s/.exec(paragraph.textContent)?.[0]
					: undefined;
			if (!paragraph || !prefix) {
				defaultMarkdownSerializer.nodes.list_item(state, node, node, 0);
				return;
			}
			state.write(prefix);
			state.renderInline(paragraph.cut(prefix.length));
			state.closeBlock(paragraph);
			for (let index = 1; index < node.childCount; index += 1) {
				state.render(node.child(index), node, index);
			}
		},
		unknownBlock() {
			throw new Error('Rules contain a block that this version of Digitable cannot export.');
		}
	},
	{
		...defaultMarkdownSerializer.marks,
		strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true }
	}
);

export function parseMarkdown(source: string): Node {
	return markdownParser.parse(source);
}

export function serializeMarkdownNode(document: Node): string {
	return markdownSerializer.serialize(document);
}

export function applyMarkdown(document: MarkdownFileDocument, source: string): void {
	applyMarkdownNode(document, parseMarkdown(source));
}

export function applyMarkdownNode(document: MarkdownFileDocument, node: Node): void {
	A.updateSpans(
		document,
		['content'],
		pmNodeToSpans(markdownSchemaAdapter, node),
		markdownSchemaAdapter.updateSpansConfig()
	);
}

export function serializeMarkdownDocument(document: MarkdownFileDocument): string {
	const markdown = serializeMarkdownNode(
		pmDocFromSpans(markdownSchemaAdapter, A.spans(document, ['content']))
	);
	return markdown ? `${markdown}\n` : '';
}
