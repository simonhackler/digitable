import * as A from '@automerge/automerge';
import { SchemaAdapter, type MappedSchemaSpec } from '@automerge/prosemirror';
import type { DOMOutputSpec, Mark } from 'prosemirror-model';
import { Ok, trySync } from 'wellcrafted/result';

const p: DOMOutputSpec = ['p', 0];
const quote: DOMOutputSpec = ['blockquote', 0];
const pre: DOMOutputSpec = ['pre', ['code', 0]];

const spec: MappedSchemaSpec = {
	nodes: {
		doc: { content: 'block+' },
		paragraph: {
			automerge: { block: 'paragraph' },
			content: 'inline*',
			group: 'block',
			parseDOM: [{ tag: 'p' }],
			toDOM: () => p
		},
		unknownBlock: {
			automerge: { unknownBlock: true },
			group: 'block',
			content: 'block+',
			parseDOM: [{ tag: 'div[data-unknown-block]' }],
			toDOM: () => ['div', { 'data-unknown-block': 'true' }, 0]
		},
		blockquote: {
			automerge: { block: 'blockquote' },
			content: 'block+',
			group: 'block',
			defining: true,
			parseDOM: [{ tag: 'blockquote' }],
			toDOM: () => quote
		},
		horizontal_rule: {
			automerge: { block: 'horizontal-rule' },
			content: 'text*',
			marks: '',
			group: 'block',
			parseDOM: [{ tag: 'hr' }],
			toDOM: () => ['div', { 'data-horizontal-rule': 'true' }, 0]
		},
		heading: {
			automerge: {
				block: 'heading',
				attrParsers: {
					fromAutomerge: (block) => ({ level: block.attrs.level }),
					fromProsemirror: (node) => ({ level: node.attrs.level })
				}
			},
			attrs: { level: { default: 1 } },
			content: 'inline*',
			group: 'block',
			defining: true,
			parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
			toDOM: (node) => [`h${node.attrs.level}`, 0]
		},
		code_block: {
			automerge: {
				block: 'code-block',
				attrParsers: {
					fromAutomerge: (block) => ({ params: block.attrs.params ?? '' }),
					fromProsemirror: (node) => ({ params: node.attrs.params })
				}
			},
			attrs: { params: { default: '' } },
			content: 'text*',
			marks: '',
			group: 'block',
			code: true,
			defining: true,
			parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
			toDOM: () => pre
		},
		text: { group: 'inline' },
		image: {
			automerge: {
				block: 'image',
				isEmbed: true,
				attrParsers: {
					fromAutomerge: (block) => ({
						src: block.attrs.src?.toString() ?? '',
						alt: block.attrs.alt ?? null,
						title: block.attrs.title ?? null
					}),
					fromProsemirror: (node) => ({
						src: new A.ImmutableString(node.attrs.src),
						alt: node.attrs.alt,
						title: node.attrs.title
					})
				}
			},
			inline: true,
			attrs: { src: {}, alt: { default: null }, title: { default: null } },
			group: 'inline',
			draggable: true,
			parseDOM: [
				{
					tag: 'img[src]',
					getAttrs: (element) => {
						const image = element as HTMLElement;
						return {
							src: image.getAttribute('src'),
							alt: image.getAttribute('alt'),
							title: image.getAttribute('title')
						};
					}
				}
			],
			toDOM: (node) => ['img', node.attrs]
		},
		hard_break: {
			automerge: { block: 'hard-break', isEmbed: true },
			inline: true,
			group: 'inline',
			selectable: false,
			parseDOM: [{ tag: 'br' }],
			toDOM: () => ['br']
		},
		ordered_list: {
			group: 'block',
			content: 'list_item+',
			attrs: { order: { default: 1 }, tight: { default: false } },
			parseDOM: [{ tag: 'ol' }],
			toDOM: (node) => (node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0])
		},
		bullet_list: {
			group: 'block',
			content: 'list_item+',
			attrs: { tight: { default: false } },
			parseDOM: [{ tag: 'ul' }],
			toDOM: () => ['ul', 0]
		},
		list_item: {
			automerge: {
				block: {
					within: {
						ordered_list: 'ordered-list-item',
						bullet_list: 'unordered-list-item'
					}
				}
			},
			content: 'paragraph block*',
			defining: true,
			parseDOM: [{ tag: 'li' }],
			toDOM: () => ['li', 0]
		}
	},
	marks: {
		link: {
			automerge: {
				markName: 'link',
				parsers: {
					fromAutomerge: (value) => {
						if (typeof value !== 'string') return { href: '', title: null };
						const parsed = trySync({
							try: () => JSON.parse(value) as { href?: unknown; title?: unknown },
							catch: () => Ok({} as { href?: unknown; title?: unknown })
						}).data;
						return {
							href: typeof parsed.href === 'string' ? parsed.href : '',
							title: typeof parsed.title === 'string' ? parsed.title : null
						};
					},
					fromProsemirror: (mark: Mark) =>
						JSON.stringify({ href: mark.attrs.href, title: mark.attrs.title })
				}
			},
			attrs: { href: {}, title: { default: null } },
			inclusive: false,
			parseDOM: [
				{
					tag: 'a[href]',
					getAttrs: (element) => ({
						href: (element as HTMLElement).getAttribute('href'),
						title: (element as HTMLElement).getAttribute('title')
					})
				}
			],
			toDOM: (mark) => ['a', mark.attrs, 0]
		},
		em: {
			automerge: { markName: 'em' },
			parseDOM: [{ tag: 'em' }, { tag: 'i' }],
			toDOM: () => ['em', 0]
		},
		strong: {
			automerge: { markName: 'strong' },
			parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
			toDOM: () => ['strong', 0]
		},
		code: {
			automerge: { markName: 'code' },
			parseDOM: [{ tag: 'code' }],
			toDOM: () => ['code', 0]
		},
		strike: {
			automerge: { markName: 'strike' },
			parseDOM: [{ tag: 's' }, { tag: 'del' }],
			toDOM: () => ['s', 0]
		}
	}
};

export const markdownSchemaAdapter = new SchemaAdapter(spec);
