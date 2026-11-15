import {
	applySvgDocument,
	isSvgDocument,
	parseSvgDocument,
	serializeSvgDocument,
	type SvgDocument
} from '@svg-table/svgeditor';
import type { MemberMaterializer } from './materializer';

export const svgFileMaterializer: MemberMaterializer<SvgDocument> = {
	kind: 'component-svg',
	parse(source, context) {
		let index = 0;
		return parseSvgDocument(source, {
			createNodeId: () => `node-${context.hash}-${index++}`
		});
	},
	apply: applySvgDocument,
	serialize: serializeSvgDocument,
	isDocument: isSvgDocument
};
