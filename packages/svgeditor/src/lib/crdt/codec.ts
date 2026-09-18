import {
	SVG_DOCUMENT_SCHEMA_VERSION,
	validateSvgDocument,
	type CircleGeometry,
	type EllipseGeometry,
	type ImageGeometry,
	type LineGeometry,
	type NodeId,
	type OrderedPoint,
	type Paint,
	type PathCommand,
	type PathCommandId,
	type PathGeometry,
	type PointGeometry,
	type PointId,
	type Presentation,
	type RawProjection,
	type RectGeometry,
	type ResourceId,
	type Stroke,
	type SvgDocument,
	type SvgGeometry,
	type SvgImageSource,
	type SvgNode,
	type SvgNodeType,
	type SvgResource,
	type TextGeometry,
	type Transform,
	type Vec2
} from './model';
import { comparePosition, isPositionId, positionBetween, type PositionId } from './position';

export const SVG_NODE_ID_ATTRIBUTE = 'data-svg-table-node-id';
export const SVG_PATH_COMMANDS_ATTRIBUTE = 'data-svg-table-path-commands';
export const SVG_POINTS_ATTRIBUTE = 'data-svg-table-points';

export type ParseSvgOptions = {
	createNodeId?: () => string;
	parser?: DOMParser;
};

export type SerializeSvgOptions = {
	xmlDeclaration?: boolean;
};

type ProjectedId = { id: string; order: PositionId };
type Matrix = [number, number, number, number, number, number];
type ParsedPathCommand = PathCommand extends infer Command
	? Command extends PathCommand
		? Omit<Command, 'id' | 'order' | 'deleted'>
		: never
	: never;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const pathTokenPattern = /[a-zA-Z]|[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g;
const paintServerTags = new Set(['linearGradient', 'radialGradient', 'pattern']);

const nodeType = (element: Element): SvgNodeType => {
	switch (element.localName) {
		case 'svg':
		case 'rect':
		case 'circle':
		case 'ellipse':
		case 'line':
		case 'path':
		case 'polygon':
		case 'polyline':
		case 'text':
		case 'image':
		case 'defs':
		case 'title':
		case 'tspan':
			return element.localName;
		case 'g':
			return 'group';
		default:
			return 'unknown';
	}
};

const createRandomNodeId = (): string => {
	if (typeof globalThis.crypto?.randomUUID === 'function')
		return `node-${globalThis.crypto.randomUUID()}`;
	if (typeof globalThis.crypto?.getRandomValues === 'function') {
		const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
		return `node-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
	}
	return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const finiteNumber = (value: string | undefined): number | null => {
	if (value === undefined || !numberPattern.test(value.trim())) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const takeNumber = (attributes: Record<string, string>, name: string): number | undefined => {
	const parsed = finiteNumber(attributes[name]);
	if (parsed === null) return undefined;
	delete attributes[name];
	return parsed;
};

const takeVec = (
	attributes: Record<string, string>,
	xName: string,
	yName: string,
	missing = 0
): Vec2 | undefined => {
	if (!(xName in attributes) && !(yName in attributes)) return undefined;
	const x = xName in attributes ? finiteNumber(attributes[xName]) : missing;
	const y = yName in attributes ? finiteNumber(attributes[yName]) : missing;
	if (x === null || y === null) return undefined;
	delete attributes[xName];
	delete attributes[yName];
	return { x, y };
};

const identityTransform = (): Transform => ({
	translation: { x: 0, y: 0 },
	rotation: 0,
	scale: { x: 1, y: 1 },
	skew: { x: 0, y: 0 },
	origin: { x: 0, y: 0 }
});

const transformSignature = (transform: Transform): string =>
	JSON.stringify({
		translation: transform.translation,
		rotation: transform.rotation,
		scale: transform.scale,
		skew: transform.skew,
		origin: transform.origin
	});

const normalizeRotation = (value: number): number => ((((value + 180) % 360) + 360) % 360) - 180;

const multiplyMatrix = (left: Matrix, right: Matrix): Matrix => [
	left[0] * right[0] + left[2] * right[1],
	left[1] * right[0] + left[3] * right[1],
	left[0] * right[2] + left[2] * right[3],
	left[1] * right[2] + left[3] * right[3],
	left[0] * right[4] + left[2] * right[5] + left[4],
	left[1] * right[4] + left[3] * right[5] + left[5]
];

const parseTransform = (value: string | undefined): Transform => {
	const identity = identityTransform();
	if (value === undefined) return identity;
	const functions = [...value.matchAll(/([A-Za-z]+)\s*\(([^)]*)\)/g)];
	const residue = value.replaceAll(/([A-Za-z]+)\s*\(([^)]*)\)/g, '').trim();
	let matrix: Matrix = [1, 0, 0, 1, 0, 0];
	let valid = functions.length > 0 && residue === '';
	let rotateOrigin: Vec2 | null = null;

	for (const match of functions) {
		const name = match[1];
		const values = match[2]
			.trim()
			.split(/[\s,]+/)
			.filter(Boolean)
			.map((part) => finiteNumber(part));
		if (values.some((part) => part === null)) {
			valid = false;
			break;
		}
		const numbers = values as number[];
		let next: Matrix | null = null;
		if (name === 'matrix' && numbers.length === 6) next = numbers as Matrix;
		if (name === 'translate' && (numbers.length === 1 || numbers.length === 2))
			next = [1, 0, 0, 1, numbers[0], numbers[1] ?? 0];
		if (name === 'scale' && (numbers.length === 1 || numbers.length === 2))
			next = [numbers[0], 0, 0, numbers[1] ?? numbers[0], 0, 0];
		if (name === 'rotate' && (numbers.length === 1 || numbers.length === 3)) {
			const radians = (numbers[0] * Math.PI) / 180;
			const cosine = Math.cos(radians);
			const sine = Math.sin(radians);
			const origin = { x: numbers[1] ?? 0, y: numbers[2] ?? 0 };
			next = multiplyMatrix(
				multiplyMatrix([1, 0, 0, 1, origin.x, origin.y], [cosine, sine, -sine, cosine, 0, 0]),
				[1, 0, 0, 1, -origin.x, -origin.y]
			);
			if (functions.length === 1) rotateOrigin = origin;
		}
		if (name === 'skewX' && numbers.length === 1)
			next = [1, 0, Math.tan((numbers[0] * Math.PI) / 180), 1, 0, 0];
		if (name === 'skewY' && numbers.length === 1)
			next = [1, Math.tan((numbers[0] * Math.PI) / 180), 0, 1, 0, 0];
		if (!next) {
			valid = false;
			break;
		}
		matrix = multiplyMatrix(matrix, next);
	}

	if (!valid) return { ...identity, raw: { value, signature: transformSignature(identity) } };
	const [a, b, c, d, e, f] = matrix;
	const scaleX = Math.hypot(a, b);
	const determinant = a * d - b * c;
	const scaleY = scaleX === 0 ? Math.hypot(c, d) : determinant / scaleX;
	const rotation = scaleX === 0 ? 0 : normalizeRotation((Math.atan2(b, a) * 180) / Math.PI);
	const skewX = scaleX === 0 ? 0 : (Math.atan2(a * c + b * d, scaleX * scaleX) * 180) / Math.PI;
	const transform: Transform = {
		translation: rotateOrigin ? { x: 0, y: 0 } : { x: e, y: f },
		rotation,
		scale: { x: scaleX === 0 ? 1 : scaleX, y: scaleY === 0 ? 1 : scaleY },
		skew: { x: skewX, y: 0 },
		origin: rotateOrigin ?? { x: 0, y: 0 }
	};
	if (scaleX !== 0 && scaleY !== 0)
		transform.raw = { value, signature: transformSignature(transform) };
	return transform;
};

const serializeTransform = (transform: Transform): string | null => {
	if (transform.raw?.signature === transformSignature(transform)) return transform.raw.value;
	const parts: string[] = [];
	if (transform.translation.x !== 0 || transform.translation.y !== 0)
		parts.push(`translate(${transform.translation.x} ${transform.translation.y})`);
	if (transform.rotation !== 0)
		parts.push(
			transform.origin.x !== 0 || transform.origin.y !== 0
				? `rotate(${transform.rotation} ${transform.origin.x} ${transform.origin.y})`
				: `rotate(${transform.rotation})`
		);
	if (transform.skew.x !== 0) parts.push(`skewX(${transform.skew.x})`);
	if (transform.skew.y !== 0) parts.push(`skewY(${transform.skew.y})`);
	if (transform.scale.x !== 1 || transform.scale.y !== 1)
		parts.push(`scale(${transform.scale.x} ${transform.scale.y})`);
	return parts.length ? parts.join(' ') : null;
};

const parsePaint = (value: string): Paint => {
	const trimmed = value.trim();
	if (trimmed === 'none') return { kind: 'none' };
	const resource = trimmed.match(/^url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)\s*(.*)$/);
	if (resource)
		return {
			kind: 'resource',
			sourceId: resource[2],
			resourceId: null,
			...(resource[3] ? { fallback: parsePaint(resource[3]) } : {})
		};
	if (
		/^#[0-9a-f]{3,8}$/i.test(trimmed) ||
		/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(trimmed) ||
		/^[a-z]+$/i.test(trimmed)
	)
		return { kind: 'color', value: trimmed };
	return { kind: 'raw', value };
};

const serializePaint = (paint: Paint): string => {
	switch (paint.kind) {
		case 'none':
			return 'none';
		case 'color':
		case 'raw':
			return paint.value;
		case 'resource':
			return `url(#${paint.sourceId})${paint.fallback ? ` ${serializePaint(paint.fallback)}` : ''}`;
	}
};

const parsePresentation = (attributes: Record<string, string>): Presentation => {
	const presentation: Presentation = {};
	if ('display' in attributes || 'visibility' in attributes)
		presentation.visible =
			attributes.display !== 'none' &&
			attributes.visibility !== 'hidden' &&
			attributes.visibility !== 'collapse';
	const opacity = takeNumber(attributes, 'opacity');
	if (opacity !== undefined) presentation.opacity = opacity;
	if ('fill' in attributes) {
		presentation.fill = parsePaint(attributes.fill);
		delete attributes.fill;
	}
	const fillOpacity = takeNumber(attributes, 'fill-opacity');
	if (fillOpacity !== undefined) presentation.fillOpacity = fillOpacity;
	const stroke: Stroke = {};
	if ('stroke' in attributes) {
		stroke.paint = parsePaint(attributes.stroke);
		delete attributes.stroke;
	}
	const width = takeNumber(attributes, 'stroke-width');
	if (width !== undefined) stroke.width = width;
	if (['butt', 'round', 'square'].includes(attributes['stroke-linecap'])) {
		stroke.lineCap = attributes['stroke-linecap'] as Stroke['lineCap'];
		delete attributes['stroke-linecap'];
	}
	if (['miter', 'round', 'bevel'].includes(attributes['stroke-linejoin'])) {
		stroke.lineJoin = attributes['stroke-linejoin'] as Stroke['lineJoin'];
		delete attributes['stroke-linejoin'];
	}
	const miterLimit = takeNumber(attributes, 'stroke-miterlimit');
	if (miterLimit !== undefined) stroke.miterLimit = miterLimit;
	if (attributes['stroke-dasharray'] === 'none') {
		stroke.dashArray = 'none';
		delete attributes['stroke-dasharray'];
	} else if ('stroke-dasharray' in attributes) {
		const values = attributes['stroke-dasharray']
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(finiteNumber);
		if (values.length > 0 && values.every((value) => value !== null)) {
			stroke.dashArray = values as number[];
			delete attributes['stroke-dasharray'];
		}
	}
	const dashOffset = takeNumber(attributes, 'stroke-dashoffset');
	if (dashOffset !== undefined) stroke.dashOffset = dashOffset;
	if (Object.keys(stroke).length > 0) presentation.stroke = stroke;
	const strokeOpacity = takeNumber(attributes, 'stroke-opacity');
	if (strokeOpacity !== undefined) presentation.strokeOpacity = strokeOpacity;
	return presentation;
};

const serializePresentation = (
	presentation: Presentation,
	attributes: Map<string, string>
): void => {
	if (presentation.visible === false) {
		if (attributes.get('visibility') !== 'hidden' && attributes.get('visibility') !== 'collapse')
			attributes.set('display', 'none');
	}
	if (presentation.visible === true) {
		if (attributes.get('display') === 'none') attributes.delete('display');
		if (attributes.get('visibility') === 'hidden' || attributes.get('visibility') === 'collapse')
			attributes.delete('visibility');
	}
	if (presentation.opacity !== undefined) attributes.set('opacity', String(presentation.opacity));
	if (presentation.fill) attributes.set('fill', serializePaint(presentation.fill));
	if (presentation.fillOpacity !== undefined)
		attributes.set('fill-opacity', String(presentation.fillOpacity));
	if (presentation.stroke) {
		const stroke = presentation.stroke;
		if (stroke.paint) attributes.set('stroke', serializePaint(stroke.paint));
		if (stroke.width !== undefined) attributes.set('stroke-width', String(stroke.width));
		if (stroke.lineCap) attributes.set('stroke-linecap', stroke.lineCap);
		if (stroke.lineJoin) attributes.set('stroke-linejoin', stroke.lineJoin);
		if (stroke.miterLimit !== undefined)
			attributes.set('stroke-miterlimit', String(stroke.miterLimit));
		if (stroke.dashArray)
			attributes.set(
				'stroke-dasharray',
				stroke.dashArray === 'none' ? 'none' : stroke.dashArray.join(' ')
			);
		if (stroke.dashOffset !== undefined)
			attributes.set('stroke-dashoffset', String(stroke.dashOffset));
	}
	if (presentation.strokeOpacity !== undefined)
		attributes.set('stroke-opacity', String(presentation.strokeOpacity));
};

const projectedIds = (value: string | undefined): ProjectedId[] => {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		const ids = parsed.filter(
			(entry): entry is ProjectedId =>
				typeof entry === 'object' &&
				entry !== null &&
				typeof (entry as ProjectedId).id === 'string' &&
				isPositionId((entry as ProjectedId).order)
		);
		if (ids.length !== parsed.length || new Set(ids.map((entry) => entry.id)).size !== ids.length)
			return [];
		for (let index = 1; index < ids.length; index += 1)
			if (comparePosition(ids[index - 1].order, ids[index].order) >= 0) return [];
		return ids;
	} catch {
		return [];
	}
};

const orderedValues = <Entry extends { id: string; order: PositionId; deleted: boolean }>(
	record: Record<string, Entry>
): Entry[] =>
	Object.values(record)
		.filter((entry) => !entry.deleted)
		.sort(
			(left, right) => comparePosition(left.order, right.order) || left.id.localeCompare(right.id)
		);

const pathCommandSignature = (geometry: PathGeometry): string =>
	JSON.stringify(
		orderedValues(geometry.commands).map(
			({ id: _id, order: _order, deleted: _deleted, ...command }) => command
		)
	);

const pathParameters: Record<string, number> = {
	M: 2,
	L: 2,
	H: 1,
	V: 1,
	C: 6,
	S: 4,
	Q: 4,
	T: 2,
	A: 7,
	Z: 0
};

const parsePath = (value: string, metadata: ProjectedId[], nodeId: NodeId): PathGeometry => {
	const tokens = value.match(pathTokenPattern) ?? [];
	const residue = value.replace(pathTokenPattern, '').replace(/[\s,]+/g, '');
	const parsed: ParsedPathCommand[] = [];
	let command = '';
	let index = 0;
	let valid = residue === '';
	while (valid && index < tokens.length) {
		if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
		if (!command) {
			valid = false;
			break;
		}
		const upper = command.toUpperCase();
		const count = pathParameters[upper];
		if (count === undefined) {
			valid = false;
			break;
		}
		if (upper === 'Z') {
			parsed.push({ type: 'close', relative: command === command.toLowerCase() });
			command = '';
			continue;
		}
		if (index + count > tokens.length || /^[a-zA-Z]$/.test(tokens[index])) {
			valid = false;
			break;
		}
		const values = tokens.slice(index, index + count).map(finiteNumber);
		if (values.some((part) => part === null)) {
			valid = false;
			break;
		}
		index += count;
		const numbers = values as number[];
		const relative = command === command.toLowerCase();
		if (upper === 'M' || upper === 'L' || upper === 'T')
			parsed.push({
				type: upper === 'M' ? 'move' : upper === 'T' ? 'smoothQuadratic' : 'line',
				relative,
				to: { x: numbers[0], y: numbers[1] }
			});
		if (upper === 'H') parsed.push({ type: 'horizontal', relative, x: numbers[0] });
		if (upper === 'V') parsed.push({ type: 'vertical', relative, y: numbers[0] });
		if (upper === 'C')
			parsed.push({
				type: 'cubic',
				relative,
				control1: { x: numbers[0], y: numbers[1] },
				control2: { x: numbers[2], y: numbers[3] },
				to: { x: numbers[4], y: numbers[5] }
			});
		if (upper === 'S')
			parsed.push({
				type: 'smoothCubic',
				relative,
				control2: { x: numbers[0], y: numbers[1] },
				to: { x: numbers[2], y: numbers[3] }
			});
		if (upper === 'Q')
			parsed.push({
				type: 'quadratic',
				relative,
				control: { x: numbers[0], y: numbers[1] },
				to: { x: numbers[2], y: numbers[3] }
			});
		if (upper === 'A') {
			if (![0, 1].includes(numbers[3]) || ![0, 1].includes(numbers[4])) valid = false;
			parsed.push({
				type: 'arc',
				relative,
				radius: { x: numbers[0], y: numbers[1] },
				xAxisRotation: numbers[2],
				largeArc: numbers[3] === 1,
				sweep: numbers[4] === 1,
				to: { x: numbers[5], y: numbers[6] }
			});
		}
		if (index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]) && upper === 'M')
			command = relative ? 'l' : 'L';
	}

	if (!valid || index !== tokens.length)
		parsed.splice(0, parsed.length, { type: 'raw', relative: false, value });
	const commands = {} as Record<PathCommandId, PathCommand>;
	const used = new Set<string>();
	let previous: PositionId | null = null;
	for (const [commandIndex, parsedCommand] of parsed.entries()) {
		const projected = metadata[commandIndex];
		const candidate =
			projected && !used.has(projected.id) ? projected.id : `${nodeId}:command:${commandIndex}`;
		const id = candidate as PathCommandId;
		used.add(id);
		const order: PositionId =
			projected?.order ??
			positionBetween(previous, null, `${nodeId}:command-order:${commandIndex}`);
		previous = order;
		commands[id] = { id, order, deleted: false, ...parsedCommand } as PathCommand;
	}
	const geometry: PathGeometry = { commands };
	geometry.raw = { value, signature: pathCommandSignature(geometry) };
	return geometry;
};

const serializePathCommand = (command: PathCommand): string => {
	const letter = (value: string): string => (command.relative ? value.toLowerCase() : value);
	const vec = (value: Vec2): string => `${value.x} ${value.y}`;
	switch (command.type) {
		case 'move':
			return `${letter('M')} ${vec(command.to)}`;
		case 'line':
			return `${letter('L')} ${vec(command.to)}`;
		case 'horizontal':
			return `${letter('H')} ${command.x}`;
		case 'vertical':
			return `${letter('V')} ${command.y}`;
		case 'cubic':
			return `${letter('C')} ${vec(command.control1)} ${vec(command.control2)} ${vec(command.to)}`;
		case 'smoothCubic':
			return `${letter('S')} ${vec(command.control2)} ${vec(command.to)}`;
		case 'quadratic':
			return `${letter('Q')} ${vec(command.control)} ${vec(command.to)}`;
		case 'smoothQuadratic':
			return `${letter('T')} ${vec(command.to)}`;
		case 'arc':
			return `${letter('A')} ${vec(command.radius)} ${command.xAxisRotation} ${command.largeArc ? 1 : 0} ${command.sweep ? 1 : 0} ${vec(command.to)}`;
		case 'close':
			return letter('Z');
		case 'raw':
			return command.value;
	}
};

const pointSignature = (geometry: PointGeometry): string =>
	JSON.stringify(orderedValues(geometry.points).map((point) => point.value));

const parsePoints = (value: string, metadata: ProjectedId[], nodeId: NodeId): PointGeometry => {
	const parts = value
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean);
	const numbers = parts.map(finiteNumber);
	const valid = numbers.length % 2 === 0 && numbers.every((part) => part !== null);
	const points = {} as Record<PointId, OrderedPoint>;
	const used = new Set<string>();
	let previous: PositionId | null = null;
	if (valid)
		for (let index = 0; index < numbers.length; index += 2) {
			const pointIndex = index / 2;
			const projected = metadata[pointIndex];
			const candidate =
				projected && !used.has(projected.id) ? projected.id : `${nodeId}:point:${pointIndex}`;
			const id = candidate as PointId;
			used.add(id);
			const order: PositionId =
				projected?.order ?? positionBetween(previous, null, `${nodeId}:point-order:${pointIndex}`);
			previous = order;
			points[id] = {
				id,
				order,
				deleted: false,
				value: { x: numbers[index] as number, y: numbers[index + 1] as number }
			};
		}
	const geometry: PointGeometry = { points };
	geometry.raw = { value, signature: pointSignature(geometry) };
	return geometry;
};

const parseSvgGeometry = (attributes: Record<string, string>): SvgGeometry => {
	const geometry: SvgGeometry = {};
	const position = takeVec(attributes, 'x', 'y');
	if (position) geometry.position = position;
	const size = takeVec(attributes, 'width', 'height');
	if (size) geometry.size = size;
	if ('viewBox' in attributes) {
		const values = attributes.viewBox
			.trim()
			.split(/[\s,]+/)
			.map(finiteNumber);
		if (values.length === 4 && values.every((value) => value !== null)) {
			geometry.viewBox = {
				min: { x: values[0] as number, y: values[1] as number },
				size: { x: values[2] as number, y: values[3] as number }
			};
			delete attributes.viewBox;
		}
	}
	return geometry;
};

const parseRectGeometry = (attributes: Record<string, string>): RectGeometry => {
	const geometry: RectGeometry = {};
	const position = takeVec(attributes, 'x', 'y');
	if (position) geometry.position = position;
	const size = takeVec(attributes, 'width', 'height');
	if (size) geometry.size = size;
	if ('rx' in attributes || 'ry' in attributes) {
		const x = 'rx' in attributes ? finiteNumber(attributes.rx) : finiteNumber(attributes.ry);
		const y = 'ry' in attributes ? finiteNumber(attributes.ry) : x;
		if (x !== null && y !== null) {
			geometry.cornerRadius = { x, y };
			delete attributes.rx;
			delete attributes.ry;
		}
	}
	return geometry;
};

const parseTextGeometry = (attributes: Record<string, string>): TextGeometry => {
	const geometry: TextGeometry = {};
	const position = takeVec(attributes, 'x', 'y');
	if (position) geometry.position = position;
	const offset = takeVec(attributes, 'dx', 'dy');
	if (offset) geometry.offset = offset;
	const rotation = takeNumber(attributes, 'rotate');
	if (rotation !== undefined) geometry.rotation = rotation;
	const textLength = takeNumber(attributes, 'textLength');
	if (textLength !== undefined) geometry.textLength = textLength;
	if (attributes.lengthAdjust === 'spacing' || attributes.lengthAdjust === 'spacingAndGlyphs') {
		geometry.lengthAdjust = attributes.lengthAdjust;
		delete attributes.lengthAdjust;
	}
	return geometry;
};

const parseImageSource = (attributes: Record<string, string>): SvgImageSource | null => {
	const attribute =
		'href' in attributes ? 'href' : 'xlink:href' in attributes ? 'xlink:href' : null;
	if (!attribute) return null;
	const value = attributes[attribute];
	delete attributes[attribute];
	return {
		kind: value.startsWith('data:') ? 'data' : value.trim() ? 'url' : 'raw',
		value,
		attribute
	};
};

const resolvePaint = (paint: Paint | undefined, resources: Map<string, ResourceId>): void => {
	if (!paint || paint.kind !== 'resource') return;
	paint.resourceId = resources.get(paint.sourceId) ?? null;
	resolvePaint(paint.fallback, resources);
};

export const parseSvg = (source: string, options: ParseSvgOptions = {}): SvgDocument => {
	const Parser = globalThis.DOMParser;
	const parser = options.parser ?? (Parser ? new Parser() : null);
	if (!parser) throw new Error('parseSvg requires DOMParser in the current browser environment.');
	const xml = parser.parseFromString(source, 'image/svg+xml');
	if (xml.getElementsByTagName('parsererror').length > 0)
		throw new SyntaxError('Unable to parse invalid SVG XML.');
	const root = xml.documentElement;
	if (root.localName !== 'svg')
		throw new TypeError('The parsed document root must be an svg element.');

	const nodes = {} as Record<NodeId, SvgNode>;
	const resources = {} as Record<ResourceId, SvgResource>;
	const resourceBySourceId = new Map<string, ResourceId>();
	const used = new Set<string>();
	const makeId = options.createNodeId ?? createRandomNodeId;
	let previous: PositionId | null = null;
	let generated = 0;

	const visit = (element: Element, parent: NodeId | null, inDefs: boolean): NodeId => {
		const preserved = element.getAttribute(SVG_NODE_ID_ATTRIBUTE)?.trim();
		let candidate = preserved && !used.has(preserved) ? preserved : '';
		while (!candidate || used.has(candidate)) {
			candidate = makeId();
			generated += 1;
			if (generated > 10_000) throw new Error('Unable to generate a unique SVG node ID.');
		}
		const id = candidate as NodeId;
		used.add(id);
		const kind = nodeType(element);
		const attributes = Object.fromEntries(
			Array.from(element.attributes, (attribute) => [attribute.name, attribute.value])
		);
		delete attributes[SVG_NODE_ID_ATTRIBUTE];
		const pathMetadata = projectedIds(attributes[SVG_PATH_COMMANDS_ATTRIBUTE]);
		const pointMetadata = projectedIds(attributes[SVG_POINTS_ATTRIBUTE]);
		if (pathMetadata.length > 0) delete attributes[SVG_PATH_COMMANDS_ATTRIBUTE];
		if (pointMetadata.length > 0) delete attributes[SVG_POINTS_ATTRIBUTE];
		const transform = parseTransform(attributes.transform);
		delete attributes.transform;
		const presentation = parsePresentation(attributes);
		const name = attributes['data-name'];
		delete attributes['data-name'];
		const order = positionBetween(previous, null, `${id}:${used.size}`);
		previous = order;
		const base = {
			id,
			kind,
			meta: { deleted: false, ...(name ? { name } : {}) },
			placement: { parent, order },
			transform,
			presentation,
			extras: attributes
		};
		const text = Array.from(element.childNodes)
			.filter((child) => child.nodeType === 3 || child.nodeType === 4)
			.map((child) => child.nodeValue ?? '')
			.join('');
		let node: SvgNode;
		switch (kind) {
			case 'svg':
				node = { ...base, kind, geometry: parseSvgGeometry(attributes) };
				break;
			case 'rect':
				node = { ...base, kind, geometry: parseRectGeometry(attributes) };
				break;
			case 'circle': {
				const geometry: CircleGeometry = {};
				const center = takeVec(attributes, 'cx', 'cy');
				if (center) geometry.center = center;
				const radius = takeNumber(attributes, 'r');
				if (radius !== undefined) geometry.radius = radius;
				node = { ...base, kind, geometry };
				break;
			}
			case 'ellipse': {
				const geometry: EllipseGeometry = {};
				const center = takeVec(attributes, 'cx', 'cy');
				if (center) geometry.center = center;
				const radius = takeVec(attributes, 'rx', 'ry');
				if (radius) geometry.radius = radius;
				node = { ...base, kind, geometry };
				break;
			}
			case 'line': {
				const geometry: LineGeometry = {};
				const start = takeVec(attributes, 'x1', 'y1');
				if (start) geometry.start = start;
				const end = takeVec(attributes, 'x2', 'y2');
				if (end) geometry.end = end;
				node = { ...base, kind, geometry };
				break;
			}
			case 'path': {
				const value = attributes.d ?? '';
				delete attributes.d;
				node = { ...base, kind, geometry: parsePath(value, pathMetadata, id) };
				break;
			}
			case 'polygon':
			case 'polyline': {
				const value = attributes.points ?? '';
				delete attributes.points;
				node = { ...base, kind, geometry: parsePoints(value, pointMetadata, id) };
				break;
			}
			case 'text':
			case 'tspan':
				node = { ...base, kind, geometry: parseTextGeometry(attributes), text };
				break;
			case 'image': {
				const geometry: ImageGeometry = {};
				const position = takeVec(attributes, 'x', 'y');
				if (position) geometry.position = position;
				const size = takeVec(attributes, 'width', 'height');
				if (size) geometry.size = size;
				node = { ...base, kind, geometry, source: parseImageSource(attributes) };
				break;
			}
			case 'title':
				node = { ...base, kind, text };
				break;
			case 'group':
			case 'defs':
				node = { ...base, kind };
				break;
			case 'unknown':
				node = { ...base, kind, tagName: element.tagName, text };
		}
		nodes[id] = node;

		const sourceId = element.getAttribute('id');
		if (inDefs && sourceId) {
			const resourceId = `resource:${id}` as ResourceId;
			resources[resourceId] = {
				id: resourceId,
				kind: paintServerTags.has(element.localName) ? 'paint-server' : 'definition',
				nodeId: id,
				sourceId,
				href: null,
				extras: { tagName: element.tagName }
			};
			resourceBySourceId.set(sourceId, resourceId);
		}
		if (node.kind === 'image' && node.source) {
			const resourceId = `resource:${id}` as ResourceId;
			resources[resourceId] = {
				id: resourceId,
				kind: 'image',
				nodeId: id,
				sourceId: sourceId || null,
				href: node.source.value,
				extras: {}
			};
		}
		const childInDefs = inDefs || kind === 'defs';
		for (const child of Array.from(element.childNodes))
			if (child.nodeType === 1) visit(child as Element, id, childInDefs);
		return id;
	};

	const rootId = visit(root, null, false);
	for (const node of Object.values(nodes)) {
		resolvePaint(node.presentation.fill, resourceBySourceId);
		resolvePaint(node.presentation.stroke?.paint, resourceBySourceId);
	}
	return { schemaVersion: SVG_DOCUMENT_SCHEMA_VERSION, rootId, nodes, resources };
};

const escapeAttribute = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');

const escapeText = (value: string): string =>
	value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const xmlName = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

const setVec = (
	attributes: Map<string, string>,
	value: Vec2 | undefined,
	xName: string,
	yName: string
): void => {
	if (!value) return;
	attributes.set(xName, String(value.x));
	attributes.set(yName, String(value.y));
};

const serializeGeometry = (node: SvgNode, attributes: Map<string, string>): void => {
	switch (node.kind) {
		case 'svg':
			setVec(attributes, node.geometry.position, 'x', 'y');
			setVec(attributes, node.geometry.size, 'width', 'height');
			if (node.geometry.viewBox)
				attributes.set(
					'viewBox',
					`${node.geometry.viewBox.min.x} ${node.geometry.viewBox.min.y} ${node.geometry.viewBox.size.x} ${node.geometry.viewBox.size.y}`
				);
			break;
		case 'rect':
			setVec(attributes, node.geometry.position, 'x', 'y');
			setVec(attributes, node.geometry.size, 'width', 'height');
			setVec(attributes, node.geometry.cornerRadius, 'rx', 'ry');
			break;
		case 'circle':
			setVec(attributes, node.geometry.center, 'cx', 'cy');
			if (node.geometry.radius !== undefined) attributes.set('r', String(node.geometry.radius));
			break;
		case 'ellipse':
			setVec(attributes, node.geometry.center, 'cx', 'cy');
			setVec(attributes, node.geometry.radius, 'rx', 'ry');
			break;
		case 'line':
			setVec(attributes, node.geometry.start, 'x1', 'y1');
			setVec(attributes, node.geometry.end, 'x2', 'y2');
			break;
		case 'path': {
			const commands = orderedValues(node.geometry.commands);
			const signature = pathCommandSignature(node.geometry);
			attributes.set(
				'd',
				node.geometry.raw?.signature === signature
					? node.geometry.raw.value
					: commands.map(serializePathCommand).join(' ')
			);
			attributes.set(
				SVG_PATH_COMMANDS_ATTRIBUTE,
				JSON.stringify(commands.map(({ id, order }) => ({ id, order })))
			);
			break;
		}
		case 'polygon':
		case 'polyline': {
			const points = orderedValues(node.geometry.points);
			const signature = pointSignature(node.geometry);
			attributes.set(
				'points',
				node.geometry.raw?.signature === signature
					? node.geometry.raw.value
					: points.map((point) => `${point.value.x},${point.value.y}`).join(' ')
			);
			attributes.set(
				SVG_POINTS_ATTRIBUTE,
				JSON.stringify(points.map(({ id, order }) => ({ id, order })))
			);
			break;
		}
		case 'text':
		case 'tspan':
			setVec(attributes, node.geometry.position, 'x', 'y');
			setVec(attributes, node.geometry.offset, 'dx', 'dy');
			if (node.geometry.rotation !== undefined)
				attributes.set('rotate', String(node.geometry.rotation));
			if (node.geometry.textLength !== undefined)
				attributes.set('textLength', String(node.geometry.textLength));
			if (node.geometry.lengthAdjust) attributes.set('lengthAdjust', node.geometry.lengthAdjust);
			break;
		case 'image':
			setVec(attributes, node.geometry.position, 'x', 'y');
			setVec(attributes, node.geometry.size, 'width', 'height');
			if (node.source) attributes.set(node.source.attribute, node.source.value);
			break;
		case 'group':
		case 'defs':
		case 'title':
		case 'unknown':
			break;
	}
};

export const serializeSvg = (document: SvgDocument, options: SerializeSvgOptions = {}): string => {
	validateSvgDocument(document);
	const hiddenByAncestor = (node: SvgNode): boolean => {
		const visited = new Set<NodeId>([node.id]);
		let parentId = node.placement.parent;
		while (parentId) {
			if (visited.has(parentId)) return false;
			visited.add(parentId);
			const parent = document.nodes[parentId];
			if (!parent) return false;
			if (parent.meta.deleted) return true;
			parentId = parent.placement.parent;
		}
		return false;
	};
	const active = new Map<NodeId, SvgNode>(
		Object.values(document.nodes)
			.filter((node) => !node.meta.deleted && !hiddenByAncestor(node))
			.map((node) => [node.id, node])
	);
	const root = active.get(document.rootId);
	if (!root || root.kind !== 'svg') throw new TypeError('The SVG root must be a live svg node.');
	if (root.placement.parent !== null) throw new TypeError('The SVG root cannot have a parent.');

	const parents = new Map<NodeId, NodeId>();
	for (const node of active.values()) {
		if (node.id === document.rootId) continue;
		const parent = node.placement.parent;
		parents.set(node.id, parent && active.has(parent) ? parent : document.rootId);
	}
	for (const start of [...parents.keys()].sort()) {
		const path: NodeId[] = [];
		const indexes = new Map<NodeId, number>();
		let cursor = start;
		while (cursor !== document.rootId) {
			const cycleStart = indexes.get(cursor);
			if (cycleStart !== undefined) {
				const cycle = path.slice(cycleStart).sort();
				parents.set(cycle[cycle.length - 1], document.rootId);
				break;
			}
			indexes.set(cursor, path.length);
			path.push(cursor);
			const parent = parents.get(cursor);
			if (!parent) throw new TypeError(`SVG node "${cursor}" has an invalid parent.`);
			cursor = parent;
		}
	}

	const children = new Map<NodeId, SvgNode[]>();
	for (const [id, parent] of parents) {
		const siblings = children.get(parent) ?? [];
		siblings.push(active.get(id) as SvgNode);
		children.set(parent, siblings);
	}
	for (const siblings of children.values())
		siblings.sort(
			(left, right) =>
				comparePosition(left.placement.order, right.placement.order) ||
				left.id.localeCompare(right.id)
		);

	const serializeNode = (node: SvgNode): string => {
		const tagName =
			node.kind === 'group' ? 'g' : node.kind === 'unknown' ? node.tagName : node.kind;
		if (!xmlName.test(tagName))
			throw new TypeError(`SVG node "${node.id}" has an invalid tag name.`);
		const attributes = new Map<string, string>(Object.entries(node.extras));
		if (node.meta.name) attributes.set('data-name', node.meta.name);
		serializePresentation(node.presentation, attributes);
		const transform = serializeTransform(node.transform);
		if (transform) attributes.set('transform', transform);
		else attributes.delete('transform');
		serializeGeometry(node, attributes);
		if (node.id === document.rootId && !attributes.has('xmlns'))
			attributes.set('xmlns', SVG_NAMESPACE);
		attributes.set(SVG_NODE_ID_ATTRIBUTE, node.id);
		const encodedAttributes = [...attributes.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([name, value]) => {
				if (!xmlName.test(name))
					throw new TypeError(`SVG node "${node.id}" has an invalid attribute name.`);
				return ` ${name}="${escapeAttribute(value)}"`;
			})
			.join('');
		const text = 'text' in node ? escapeText(node.text) : '';
		const content = `${text}${(children.get(node.id) ?? []).map(serializeNode).join('')}`;
		return content
			? `<${tagName}${encodedAttributes}>${content}</${tagName}>`
			: `<${tagName}${encodedAttributes}/>`;
	};

	const declaration = options.xmlDeclaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
	return `${declaration}${serializeNode(root)}`;
};

export const parseSvgDocument = parseSvg;
export const serializeSvgDocument = serializeSvg;
