import type { DocHandle } from '@automerge/automerge-repo';
import { componentDataMaterializer } from './component-data';
import { decodeText, encodeText } from './filesystem';
import { gameMetadataMaterializer } from './game-metadata';
import { markdownFileMaterializer } from './markdown/markdown-file';
import type { MaterializerContext, MemberMaterializer } from './materializer';
import {
	isBinaryFileDocument,
	type BinaryFileDocument,
	type MarkdownFileDocument,
	type ProjectMemberDocument,
	type ProjectMemberKind
} from './model';
import { textFileMaterializer } from './text-file';
import { svgFileMaterializer } from './svg-file';

export type ProjectMemberSeed = {
	document: ProjectMemberDocument;
	initialize?: (document: ProjectMemberDocument) => void;
};

export type ProjectMemberCodec = {
	kind: ProjectMemberKind;
	mutable: boolean;
	isDocument(value: unknown): boolean;
	seed(bytes: Uint8Array, context: MaterializerContext): ProjectMemberSeed;
	apply(document: ProjectMemberDocument, bytes: Uint8Array, context: MaterializerContext): void;
	serialize(document: ProjectMemberDocument): Uint8Array;
};

function materializerCodec<T extends object, Source>(
	materializer: MemberMaterializer<T, Source>
): ProjectMemberCodec {
	return {
		kind: materializer.kind,
		mutable: true,
		isDocument: materializer.isDocument,
		seed(bytes, context) {
			return {
				document: materializer.parse(decodeText(bytes), context) as ProjectMemberDocument
			};
		},
		apply(document, bytes, context) {
			if (!materializer.isDocument(document)) {
				throw new Error(`Automerge ${materializer.kind} document has an unsupported format.`);
			}
			materializer.apply(document, materializer.parse(decodeText(bytes), context));
		},
		serialize(document) {
			if (!materializer.isDocument(document)) {
				throw new Error(`Automerge ${materializer.kind} document has an unsupported format.`);
			}
			return encodeText(materializer.serialize(document));
		}
	};
}

const rulesCodec: ProjectMemberCodec = {
	kind: 'rules',
	mutable: true,
	isDocument: markdownFileMaterializer.isDocument,
	seed(bytes, context) {
		const source = decodeText(bytes);
		const incoming = markdownFileMaterializer.parse(source, context);
		return {
			document: {
				type: 'markdown-file',
				schemaVersion: 1,
				dialect: 'commonmark',
				content: source
			},
			initialize(document) {
				if (!markdownFileMaterializer.isDocument(document)) {
					throw new Error('Automerge rules document has an unsupported format.');
				}
				markdownFileMaterializer.apply(document, incoming);
			}
		};
	},
	apply(document, bytes, context) {
		if (!markdownFileMaterializer.isDocument(document)) {
			throw new Error('Automerge rules document has an unsupported format.');
		}
		markdownFileMaterializer.apply(
			document,
			markdownFileMaterializer.parse(decodeText(bytes), context)
		);
	},
	serialize(document) {
		if (!markdownFileMaterializer.isDocument(document)) {
			throw new Error('Automerge rules document has an unsupported format.');
		}
		return encodeText(markdownFileMaterializer.serialize(document));
	}
};

const assetCodec: ProjectMemberCodec = {
	kind: 'asset',
	mutable: false,
	isDocument: isBinaryFileDocument,
	seed(bytes) {
		return {
			document: {
				type: 'binary-file',
				schemaVersion: 1,
				content: Uint8Array.from(bytes)
			} satisfies BinaryFileDocument
		};
	},
	apply() {
		throw new Error('Automerge assets are immutable and must be replaced.');
	},
	serialize(document) {
		if (!isBinaryFileDocument(document)) {
			throw new Error('Automerge asset document has an unsupported format.');
		}
		return Uint8Array.from(document.content);
	}
};

export const projectMemberCodecs: Record<ProjectMemberKind, ProjectMemberCodec> = {
	'game-metadata': materializerCodec(gameMetadataMaterializer),
	'component-data': materializerCodec(componentDataMaterializer),
	'component-svg': materializerCodec(svgFileMaterializer),
	rules: rulesCodec,
	'table-setup': materializerCodec(textFileMaterializer('table-setup')),
	'feedback-registry': materializerCodec(textFileMaterializer('feedback-registry')),
	'feedback-markdown': materializerCodec(textFileMaterializer('feedback-markdown')),
	asset: assetCodec
};

export function projectMemberCodec(kind: ProjectMemberKind): ProjectMemberCodec {
	return projectMemberCodecs[kind];
}

export function serializeProjectMember(
	kind: ProjectMemberKind,
	document: ProjectMemberDocument
): Uint8Array {
	return projectMemberCodec(kind).serialize(document);
}

export function applyProjectMemberBytes(
	kind: ProjectMemberKind,
	handle: DocHandle<ProjectMemberDocument>,
	bytes: Uint8Array,
	context: MaterializerContext,
	message: string
): void {
	const codec = projectMemberCodec(kind);
	if (!codec.mutable) throw new Error(`Automerge ${kind} documents are immutable.`);
	handle.change((document) => codec.apply(document, bytes, context), { message });
}

export function seedProjectMember(
	kind: ProjectMemberKind,
	bytes: Uint8Array,
	context: MaterializerContext
): ProjectMemberSeed {
	return projectMemberCodec(kind).seed(bytes, context);
}
