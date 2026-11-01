import { isPositionId, type PositionId } from './position';

declare const nodeIdBrand: unique symbol;
declare const resourceIdBrand: unique symbol;
declare const pathCommandIdBrand: unique symbol;
declare const pointIdBrand: unique symbol;

export type NodeId = string & { readonly [nodeIdBrand]: true };
export type ResourceId = string & { readonly [resourceIdBrand]: true };
export type PathCommandId = string & { readonly [pathCommandIdBrand]: true };
export type PointId = string & { readonly [pointIdBrand]: true };

export const SVG_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type Vec2 = { x: number; y: number };
export type ViewBox = { min: Vec2; size: Vec2 };

export type NodePlacement = {
	parent: NodeId | null;
	order: PositionId;
};
export type Placement = NodePlacement;

export type NodeMeta = {
	deleted: boolean;
	name?: string;
};

export type RawProjection = {
	value: string;
	signature: string;
};

export type Transform = {
	translation: Vec2;
	rotation: number;
	scale: Vec2;
	skew: Vec2;
	origin: Vec2;
	raw?: RawProjection;
};

export type Paint =
	| { kind: 'none' }
	| { kind: 'color'; value: string }
	| {
			kind: 'resource';
			sourceId: string;
			resourceId: ResourceId | null;
			fallback?: Paint;
	  }
	| { kind: 'raw'; value: string };

export type Stroke = {
	paint?: Paint;
	width?: number;
	lineCap?: 'butt' | 'round' | 'square';
	lineJoin?: 'miter' | 'round' | 'bevel';
	miterLimit?: number;
	dashArray?: number[] | 'none';
	dashOffset?: number;
};

export type Presentation = {
	visible?: boolean;
	opacity?: number;
	fill?: Paint;
	fillOpacity?: number;
	stroke?: Stroke;
	strokeOpacity?: number;
};

export type SvgGeometry = {
	position?: Vec2;
	size?: Vec2;
	viewBox?: ViewBox;
};

export type RectGeometry = {
	position?: Vec2;
	size?: Vec2;
	cornerRadius?: Vec2;
};

export type CircleGeometry = { center?: Vec2; radius?: number };
export type EllipseGeometry = { center?: Vec2; radius?: Vec2 };
export type LineGeometry = { start?: Vec2; end?: Vec2 };
export type TextGeometry = {
	position?: Vec2;
	offset?: Vec2;
	rotation?: number;
	textLength?: number;
	lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
};
export type ImageGeometry = { position?: Vec2; size?: Vec2 };

export type OrderedEntity<Id extends string = string> = {
	id: Id;
	order: PositionId;
	deleted: boolean;
};

export type PathCommand = OrderedEntity<PathCommandId> &
	(
		| { type: 'move' | 'line' | 'smoothQuadratic'; relative: boolean; to: Vec2 }
		| { type: 'horizontal'; relative: boolean; x: number }
		| { type: 'vertical'; relative: boolean; y: number }
		| { type: 'cubic'; relative: boolean; control1: Vec2; control2: Vec2; to: Vec2 }
		| { type: 'smoothCubic'; relative: boolean; control2: Vec2; to: Vec2 }
		| { type: 'quadratic'; relative: boolean; control: Vec2; to: Vec2 }
		| {
				type: 'arc';
				relative: boolean;
				radius: Vec2;
				xAxisRotation: number;
				largeArc: boolean;
				sweep: boolean;
				to: Vec2;
		  }
		| { type: 'close'; relative: boolean }
		| { type: 'raw'; relative: boolean; value: string }
	);

export type PathGeometry = {
	commands: Record<PathCommandId, PathCommand>;
	raw?: RawProjection;
};

export type OrderedPoint = OrderedEntity<PointId> & { value: Vec2 };
export type PointGeometry = {
	points: Record<PointId, OrderedPoint>;
	raw?: RawProjection;
};

export type SvgImageSource = {
	kind: 'url' | 'data' | 'raw';
	value: string;
	attribute: 'href' | 'xlink:href';
};

export interface NodeSpec {
	svg: { geometry: SvgGeometry };
	group: Record<never, never>;
	rect: { geometry: RectGeometry };
	circle: { geometry: CircleGeometry };
	ellipse: { geometry: EllipseGeometry };
	line: { geometry: LineGeometry };
	path: { geometry: PathGeometry };
	polygon: { geometry: PointGeometry };
	polyline: { geometry: PointGeometry };
	text: { geometry: TextGeometry; text: string };
	image: { geometry: ImageGeometry; source: SvgImageSource | null };
	defs: Record<never, never>;
	title: { text: string };
	tspan: { geometry: TextGeometry; text: string };
	unknown: { tagName: string; text: string };
}

export type SvgNodeType = keyof NodeSpec;
export type NodeKind = SvgNodeType;

export type SvgNodeBase<Type extends SvgNodeType> = {
	id: NodeId;
	kind: Type;
	meta: NodeMeta;
	placement: NodePlacement;
	transform: Transform;
	presentation: Presentation;
	extras: Record<string, string>;
};

export type BaseNode<Type extends SvgNodeType> = SvgNodeBase<Type>;
export type NodeOf<Type extends SvgNodeType> = SvgNodeBase<Type> & NodeSpec[Type];

export type SvgNode = {
	[Type in SvgNodeType]: SvgNodeBase<Type> & NodeSpec[Type];
}[SvgNodeType];

export type SvgResource = {
	id: ResourceId;
	kind: 'paint-server' | 'definition' | 'image';
	nodeId: NodeId | null;
	sourceId: string | null;
	href: string | null;
	extras: Record<string, string>;
};

export type SvgDocument = {
	schemaVersion: typeof SVG_DOCUMENT_SCHEMA_VERSION;
	rootId: NodeId;
	nodes: Record<NodeId, SvgNode>;
	resources: Record<ResourceId, SvgResource>;
};

const nodeTypes = new Set<SvgNodeType>([
	'svg',
	'group',
	'rect',
	'circle',
	'ellipse',
	'line',
	'path',
	'polygon',
	'polyline',
	'text',
	'image',
	'defs',
	'title',
	'tspan',
	'unknown'
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
	isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

export const isNodeId = (value: unknown): value is NodeId =>
	typeof value === 'string' && value.length > 0;

export const isVec2 = (value: unknown): value is Vec2 =>
	isRecord(value) &&
	typeof value.x === 'number' &&
	Number.isFinite(value.x) &&
	typeof value.y === 'number' &&
	Number.isFinite(value.y);

const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

const isRawProjection = (value: unknown): value is RawProjection =>
	isRecord(value) && typeof value.value === 'string' && typeof value.signature === 'string';

const isOptionalRawProjection = (value: Record<string, unknown>): boolean =>
	!('raw' in value) || isRawProjection(value.raw);

const isTransform = (value: unknown): value is Transform =>
	isRecord(value) &&
	isVec2(value.translation) &&
	isNumber(value.rotation) &&
	isVec2(value.scale) &&
	isVec2(value.skew) &&
	isVec2(value.origin) &&
	isOptionalRawProjection(value);

const isPaint = (value: unknown): value is Paint => {
	if (!isRecord(value) || typeof value.kind !== 'string') return false;
	if (value.kind === 'none') return true;
	if ((value.kind === 'color' || value.kind === 'raw') && typeof value.value === 'string')
		return true;
	return (
		value.kind === 'resource' &&
		typeof value.sourceId === 'string' &&
		(value.resourceId === null || isNodeId(value.resourceId)) &&
		(!('fallback' in value) || isPaint(value.fallback))
	);
};

const isStroke = (value: unknown): value is Stroke =>
	isRecord(value) &&
	(!('paint' in value) || isPaint(value.paint)) &&
	(!('width' in value) || isNumber(value.width)) &&
	(!('lineCap' in value) || ['butt', 'round', 'square'].includes(value.lineCap as string)) &&
	(!('lineJoin' in value) || ['miter', 'round', 'bevel'].includes(value.lineJoin as string)) &&
	(!('miterLimit' in value) || isNumber(value.miterLimit)) &&
	(!('dashArray' in value) ||
		value.dashArray === 'none' ||
		(Array.isArray(value.dashArray) && value.dashArray.every(isNumber))) &&
	(!('dashOffset' in value) || isNumber(value.dashOffset));

const isPresentation = (value: unknown): value is Presentation =>
	isRecord(value) &&
	(!('visible' in value) || typeof value.visible === 'boolean') &&
	(!('opacity' in value) || isNumber(value.opacity)) &&
	(!('fill' in value) || isPaint(value.fill)) &&
	(!('fillOpacity' in value) || isNumber(value.fillOpacity)) &&
	(!('stroke' in value) || isStroke(value.stroke)) &&
	(!('strokeOpacity' in value) || isNumber(value.strokeOpacity));

const isOrderedEntry = (id: string, value: unknown): value is Record<string, unknown> =>
	isRecord(value) &&
	value.id === id &&
	typeof value.deleted === 'boolean' &&
	isPositionId(value.order);

const isPathCommand = (id: string, value: unknown): value is PathCommand => {
	if (
		!isOrderedEntry(id, value) ||
		typeof value.type !== 'string' ||
		typeof value.relative !== 'boolean'
	)
		return false;
	switch (value.type) {
		case 'move':
		case 'line':
		case 'smoothQuadratic':
			return isVec2(value.to);
		case 'horizontal':
			return isNumber(value.x);
		case 'vertical':
			return isNumber(value.y);
		case 'cubic':
			return isVec2(value.control1) && isVec2(value.control2) && isVec2(value.to);
		case 'smoothCubic':
			return isVec2(value.control2) && isVec2(value.to);
		case 'quadratic':
			return isVec2(value.control) && isVec2(value.to);
		case 'arc':
			return (
				isVec2(value.radius) &&
				isNumber(value.xAxisRotation) &&
				typeof value.largeArc === 'boolean' &&
				typeof value.sweep === 'boolean' &&
				isVec2(value.to)
			);
		case 'close':
			return true;
		case 'raw':
			return typeof value.value === 'string';
		default:
			return false;
	}
};

const isPathGeometry = (value: unknown): value is PathGeometry =>
	isRecord(value) &&
	isRecord(value.commands) &&
	Object.entries(value.commands).every(([id, command]) => isPathCommand(id, command)) &&
	isOptionalRawProjection(value);

const isPointGeometry = (value: unknown): value is PointGeometry =>
	isRecord(value) &&
	isRecord(value.points) &&
	Object.entries(value.points).every(
		([id, point]) => isOrderedEntry(id, point) && isVec2(point.value)
	) &&
	isOptionalRawProjection(value);

const hasOptionalVec = (value: Record<string, unknown>, key: string): boolean =>
	!(key in value) || isVec2(value[key]);

const hasOptionalNumber = (value: Record<string, unknown>, key: string): boolean =>
	!(key in value) || isNumber(value[key]);

const isGeometry = (type: SvgNodeType, value: unknown): boolean => {
	if (!isRecord(value)) return false;
	switch (type) {
		case 'svg':
			return (
				hasOptionalVec(value, 'position') &&
				hasOptionalVec(value, 'size') &&
				(!('viewBox' in value) ||
					(isRecord(value.viewBox) && isVec2(value.viewBox.min) && isVec2(value.viewBox.size)))
			);
		case 'rect':
			return (
				hasOptionalVec(value, 'position') &&
				hasOptionalVec(value, 'size') &&
				hasOptionalVec(value, 'cornerRadius')
			);
		case 'circle':
			return hasOptionalVec(value, 'center') && hasOptionalNumber(value, 'radius');
		case 'ellipse':
			return hasOptionalVec(value, 'center') && hasOptionalVec(value, 'radius');
		case 'line':
			return hasOptionalVec(value, 'start') && hasOptionalVec(value, 'end');
		case 'path':
			return isPathGeometry(value);
		case 'polygon':
		case 'polyline':
			return isPointGeometry(value);
		case 'text':
		case 'tspan':
			return (
				hasOptionalVec(value, 'position') &&
				hasOptionalVec(value, 'offset') &&
				hasOptionalNumber(value, 'rotation') &&
				hasOptionalNumber(value, 'textLength') &&
				(!('lengthAdjust' in value) ||
					value.lengthAdjust === 'spacing' ||
					value.lengthAdjust === 'spacingAndGlyphs')
			);
		case 'image':
			return hasOptionalVec(value, 'position') && hasOptionalVec(value, 'size');
		default:
			return false;
	}
};

const isImageSource = (value: unknown): value is SvgImageSource =>
	isRecord(value) &&
	['url', 'data', 'raw'].includes(value.kind as string) &&
	typeof value.value === 'string' &&
	(value.attribute === 'href' || value.attribute === 'xlink:href');

export const isSvgDocument = (value: unknown): value is SvgDocument => {
	if (!isRecord(value) || value.schemaVersion !== SVG_DOCUMENT_SCHEMA_VERSION) return false;
	if (!isNodeId(value.rootId) || !isRecord(value.nodes) || !isRecord(value.resources)) return false;
	for (const [id, valueNode] of Object.entries(value.nodes)) {
		if (
			!isRecord(valueNode) ||
			valueNode.id !== id ||
			!nodeTypes.has(valueNode.kind as SvgNodeType) ||
			!isRecord(valueNode.meta) ||
			typeof valueNode.meta.deleted !== 'boolean' ||
			!(!('name' in valueNode.meta) || typeof valueNode.meta.name === 'string') ||
			!isRecord(valueNode.placement) ||
			!(valueNode.placement.parent === null || isNodeId(valueNode.placement.parent)) ||
			!isPositionId(valueNode.placement.order) ||
			!isTransform(valueNode.transform) ||
			!isPresentation(valueNode.presentation) ||
			!isStringRecord(valueNode.extras)
		)
			return false;
		if (
			[
				'svg',
				'rect',
				'circle',
				'ellipse',
				'line',
				'path',
				'polygon',
				'polyline',
				'text',
				'image',
				'tspan'
			].includes(valueNode.kind as string) &&
			!isGeometry(valueNode.kind as SvgNodeType, valueNode.geometry)
		)
			return false;
		if (
			['text', 'title', 'tspan', 'unknown'].includes(valueNode.kind as string) &&
			typeof valueNode.text !== 'string'
		)
			return false;
		if (valueNode.kind === 'unknown' && typeof valueNode.tagName !== 'string') return false;
		if (
			valueNode.kind === 'image' &&
			!(valueNode.source === null || isImageSource(valueNode.source))
		)
			return false;
	}
	const root = value.nodes[value.rootId] as Record<string, unknown> | undefined;
	if (!root || root.kind !== 'svg') return false;
	for (const [id, valueResource] of Object.entries(value.resources)) {
		if (
			!isRecord(valueResource) ||
			valueResource.id !== id ||
			!['paint-server', 'definition', 'image'].includes(valueResource.kind as string) ||
			!(valueResource.nodeId === null || isNodeId(valueResource.nodeId)) ||
			!(valueResource.sourceId === null || typeof valueResource.sourceId === 'string') ||
			!(valueResource.href === null || typeof valueResource.href === 'string') ||
			!isStringRecord(valueResource.extras)
		)
			return false;
	}
	return true;
};

export function validateSvgDocument(value: unknown): asserts value is SvgDocument {
	if (!isSvgDocument(value)) throw new TypeError('Value is not a normalized SvgDocument.');
}
