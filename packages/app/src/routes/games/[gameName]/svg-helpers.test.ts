import { DOMParser as XmlDomParser, XMLSerializer } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import {
	createHighlightRect,
	generateSvg,
	updateSvg,
	getTextColumnValue,
	getTextFrameBounds,
	getSvgDataMap,
	getSvgDataMapForSides,
	initialSetupForSvgItem,
	loadSvgTemplate,
	parseSvg
} from './svg-helpers';

globalThis.DOMParser = XmlDomParser as typeof DOMParser;
Object.defineProperty(globalThis, 'OffscreenCanvas', {
	value: class {
		getContext() {
			return {
				font: '',
				measureText: (text: string) => ({ width: text.length * 6 })
			};
		}
	}
});
Object.defineProperty(globalThis, 'window', {
	value: {
		getComputedStyle: (element: Element) => ({
			fontStyle: element.getAttribute('font-style') || 'normal',
			fontWeight: element.getAttribute('font-weight') || 'normal',
			fontSize: element.getAttribute('font-size') || '16px',
			fontFamily: element.getAttribute('font-family') || 'sans-serif',
			lineHeight: element.getAttribute('line-height') || 'normal',
			textAlign: element.getAttribute('text-align') || 'left',
			getPropertyValue: (property: string) => element.getAttribute(property) || ''
		})
	}
});

const findById = (root: Element, elementId: string): Element | null => {
	if (root.getAttribute('id') === elementId) return root;
	for (const child of Array.from(root.childNodes)) {
		if (child.nodeType === 1) {
			const match = findById(child as Element, elementId);
			if (match) return match;
		}
	}
	return null;
};

const patchSvgRoot = (svg: SVGSVGElement) => {
	if (!svg.style) {
		Object.defineProperty(svg, 'style', {
			value: {}
		});
	}

	const createElementNS = svg.ownerDocument.createElementNS.bind(svg.ownerDocument);
	Object.defineProperty(svg.ownerDocument, 'createElementNS', {
		value: (namespaceURI: string | null, qualifiedName: string) => {
			const element = createElementNS(namespaceURI, qualifiedName) as SVGElement & {
				style?: Record<string, string>;
			};
			if (!element.style) {
				Object.defineProperty(element, 'style', {
					value: {}
				});
			}
			return element;
		},
		configurable: true
	});

	Object.defineProperty(globalThis, 'document', {
		value: svg.ownerDocument,
		configurable: true
	});

	Object.defineProperty(svg, 'getElementById', {
		value: (elementId: string) => findById(svg, elementId)
	});
	Object.defineProperty(svg, 'querySelectorAll', {
		value: ((selector: string) =>
			Array.from(svg.getElementsByTagName(selector))) as unknown as ParentNode['querySelectorAll']
	});
	const cloneNode = svg.cloneNode.bind(svg);
	Object.defineProperty(svg, 'cloneNode', {
		value: (deep?: boolean) => patchSvgRoot(cloneNode(deep) as SVGSVGElement)
	});
	return svg;
};

const patchHighlightGeometry = (svg: SVGSVGElement, el: SVGGraphicsElement) => {
	const identityMatrix = {
		inverse() {
			return identityMatrix;
		}
	} as unknown as DOMMatrix;
	const pointWithTransform = (x: number, y: number) => ({
		x,
		y,
		matrixTransform() {
			return pointWithTransform(x, y);
		}
	});

	Object.defineProperty(svg, 'getScreenCTM', {
		value: () => identityMatrix
	});
	Object.defineProperty(el, 'getScreenCTM', {
		value: () => identityMatrix
	});
	Object.defineProperty(svg, 'createSVGPoint', {
		value: () => {
			const point = {
				x: 0,
				y: 0,
				matrixTransform() {
					return pointWithTransform(point.x, point.y);
				}
			};
			return point;
		}
	});
};

const loadTextById = (svgText: string, id: string) => {
	const svg = patchSvgRoot(loadSvgTemplate(svgText));
	const text = svg.getElementById(id);
	if (!text || text.tagName.toLowerCase() !== 'text') {
		throw new Error(`Expected ${id} to be an SVGTextElement`);
	}
	return { svg, text: text as unknown as SVGTextElement };
};

describe('svg-helpers', () => {
	it('reconstructs multiline text from tspans when raw text metadata is absent', () => {
		const { text } = loadTextById(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
				<text id="effect_zone">
					<tspan x="0" y="10">Shoot</tspan>
					<tspan x="0" y="20">Again</tspan>
				</text>
			</svg>`,
			'effect_zone'
		);

		expect(getTextColumnValue(text)).toBe('Shoot\nAgain');
	});

	it('resolves frame bounds from an inkscape shape-inside rect', () => {
		const { svg, text } = loadTextById(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
				<defs>
					<rect id="rect1" x="20" y="10" width="23" height="30" />
				</defs>
				<text
					id="effect_zone"
					font-size="16"
					style="shape-inside:url(#rect1);white-space:pre;display:inline">
					<tspan x="22" y="24">Shoot</tspan>
				</text>
			</svg>`,
			'effect_zone'
		);

		expect(getTextFrameBounds(svg, text)).toEqual({
			x: '20',
			y: '10',
			width: '23',
			height: '30',
			shapeId: 'rect1'
		});
	});

	it('prefers svgedit wrap metadata over the shape-inside rect', () => {
		const { svg, text } = loadTextById(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
				<defs>
					<rect id="rect1" x="50" y="210" width="180" height="120" />
				</defs>
				<text
					id="effect_zone"
					data-svgedit-shape-inside-ref="#rect1"
					data-svgedit-wrap-width="180"
					data-svgedit-wrap-height="120"
					font-size="42.67"
					x="43.03"
					y="252.67">
					<tspan x="43.03" y="252.67">Shoot</tspan>
				</text>
			</svg>`,
			'effect_zone'
		);

		expect(getTextFrameBounds(svg, text)).toEqual({
			x: '43.03',
			y: '210',
			width: '180',
			height: '120',
			shapeId: 'rect1'
		});
	});

	it('parses inkscape multiline text columns with newline separators', () => {
		const svg = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
				<defs>
					<rect id="rect1" x="20" y="10" width="23" height="30" />
				</defs>
				<text
					id="effect_zone"
					font-size="16"
					style="shape-inside:url(#rect1);white-space:pre;display:inline">
					<tspan x="22" y="24">Shoot</tspan>
					<tspan x="22" y="40">Again</tspan>
				</text>
			</svg>`
			)
		);

		expect(parseSvg(svg)).toContainEqual({
			title: 'effect_zone',
			type: 'text',
			data: ['Shoot\nAgain']
		});
	});

	it('does not mutate front or back templates when extracting data columns', () => {
		const front = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<text
						id="effect_zone"
						data-svgedit-multiline="true"
						data-svgedit-raw-text="Front text"
						data-svgedit-wrap-width="120"
						data-svgedit-wrap-height="40">Front text</text>
				</svg>`
			)
		);
		const back = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<text
						id="effect_zone"
						data-svgedit-multiline="true"
						data-svgedit-raw-text="Back text"
						data-svgedit-wrap-width="120"
						data-svgedit-wrap-height="40">Back text</text>
				</svg>`
			)
		);

		const data = getSvgDataMap(front, back);

		expect(data.has('effect_zone')).toBe(true);
		expect(data.has('back_effect_zone')).toBe(true);
		expect((back.getElementsByTagName('text')[0] as SVGTextElement).id).not.toBe(
			'back_effect_zone'
		);
		expect(front.getElementById('effect_zone')).not.toBeNull();
		expect(back.getElementById('effect_zone')).not.toBeNull();
		expect(back.getElementById('back_effect_zone')).toBeNull();
		expect(back.getElementById('effect_zone')?.getAttribute('data-svgedit-multiline')).toBe('true');
		expect(back.getElementById('effect_zone')?.getAttribute('data-svgedit-raw-text')).toBe(
			'Back text'
		);
	});

	it('extracts columns for arbitrary prefixed sides', () => {
		const front = patchSvgRoot(
			loadSvgTemplate(`<svg xmlns="http://www.w3.org/2000/svg"><text id="label">Front</text></svg>`)
		);
		const die = patchSvgRoot(
			loadSvgTemplate(`<svg xmlns="http://www.w3.org/2000/svg"><text id="face">One</text></svg>`)
		);

		const data = getSvgDataMapForSides([
			{ template: front },
			{ template: die, columnPrefix: 'die_' }
		]);

		expect(data.has('label')).toBe(true);
		expect(data.has('die_face')).toBe(true);
		expect(die.getElementById('face')).not.toBeNull();
		expect(die.getElementById('die_face')).toBeNull();
	});

	it('generates svg text with tspans instead of foreignObject', () => {
		const template = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<text
						id="effect_zone"
						data-svgedit-wrap-width="120"
						data-svgedit-wrap-height="40"
						font-family="serif"
						font-size="10"
						x="5"
						y="15">Template</text>
				</svg>`
			)
		);

		const generated = generateSvg(
			template,
			['effect_zone'],
			['first line\nsecond line'],
			new Map()
		);
		const text = generated.getElementById('effect_zone') as SVGTextElement;
		const tspans = Array.from(text.getElementsByTagName('tspan'));

		expect(generated.getElementsByTagName('foreignObject')).toHaveLength(0);
		expect(text.tagName).toBe('text');
		expect(text.getAttribute('data-svgedit-raw-text')).toBe('first line\nsecond line');
		expect(tspans.map((tspan) => tspan.textContent)).toEqual(['first line', 'second line']);
	});

	it('uses svgedit frame metadata when generating wrapped text', () => {
		const template = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<defs>
						<rect id="rect1" x="20" y="10" width="60" height="30" />
					</defs>
					<text
						id="effect_zone"
						data-svgedit-shape-inside-ref="#rect1"
						data-svgedit-wrap-width="60"
						data-svgedit-wrap-height="30"
						font-size="10"
						x="20"
						y="20">Template</text>
				</svg>`
			)
		);

		const generated = generateSvg(template, ['effect_zone'], ['wrapped text value'], new Map());
		const text = generated.getElementById('effect_zone') as SVGTextElement;

		expect(text.getAttribute('x')).toBe('20');
		expect(text.getAttribute('y')).toBe('20');
		expect(text.getAttribute('data-svgedit-shape-inside-ref')).toBe('#rect1');
		expect(text.getAttribute('data-svgedit-wrap-width')).toBe('60');
		expect(text.getAttribute('data-svgedit-wrap-height')).toBe('30');
		expect(text.getElementsByTagName('tspan').length).toBeGreaterThan(0);
	});

	it('updates generated text by replacing tspans on the existing text node', async () => {
		const template = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<text
						id="effect_zone"
						data-svgedit-wrap-width="120"
						data-svgedit-wrap-height="40"
						font-size="10"
						x="5"
						y="15">Template</text>
				</svg>`
			)
		);
		const generated = generateSvg(template, ['effect_zone'], ['old'], new Map());
		const text = generated.getElementById('effect_zone') as SVGTextElement;

		await updateSvg(generated, 'effect_zone', 'new\nvalue', new Map());

		expect(generated.getElementById('effect_zone')).toBe(text);
		expect(generated.getElementsByTagName('foreignObject')).toHaveLength(0);
		expect(
			Array.from(text.getElementsByTagName('tspan')).map((tspan) => tspan.textContent)
		).toEqual(['new', 'value']);
	});

	it('creates highlight rects around text boxes instead of rendered glyph bounds', () => {
		const { svg, text } = loadTextById(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
				<text
					id="title"
					data-svgedit-wrap-width="60"
					data-svgedit-wrap-height="30"
					font-size="10"
					x="20"
					y="20">Small</text>
			</svg>`,
			'title'
		);
		patchHighlightGeometry(svg, text);
		Object.defineProperty(text, 'getBBox', {
			value: () => ({ x: 20, y: 12, width: 20, height: 10 })
		});

		const rect = createHighlightRect(text, svg, 1, 4);

		expect(rect?.getAttribute('x')).toBe('16');
		expect(rect?.getAttribute('y')).toBe('6');
		expect(rect?.getAttribute('width')).toBe('68');
		expect(rect?.getAttribute('height')).toBe('38');
	});

	it('adds a namespaced xlink href when replacing href-only image links', () => {
		const svg = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<image id="background" href="../../assets/template_blank.png" />
				</svg>`
			)
		);
		const imagePaths = new Map([['template_blank.png', 'data:image/png;base64,AA==']]);

		initialSetupForSvgItem(svg, 'background', 'template_blank.png', imagePaths);

		const image = svg.getElementById('background');
		expect(image.getAttribute('href')).toBe('data:image/png;base64,AA==');
		expect(image.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(
			'data:image/png;base64,AA=='
		);
		const serialized = new XMLSerializer().serializeToString(svg);
		expect(serialized).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
		expect(serialized).toContain('xlink:href="data:image/png;base64,AA=="');
	});

	it('updates existing xlink image links without losing the namespace', () => {
		const svg = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg"
					xmlns:xlink="http://www.w3.org/1999/xlink"
					viewBox="0 0 63 88">
					<image id="dice_image" xlink:href="../../assets/dice_6.png" />
				</svg>`
			)
		);
		const imagePaths = new Map([['dice_1.png', 'data:image/png;base64,AQ==']]);

		initialSetupForSvgItem(svg, 'dice_image', 'dice_1.png', imagePaths);

		const image = svg.getElementById('dice_image');
		expect(image.getAttribute('href')).toBe('data:image/png;base64,AQ==');
		expect(image.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(
			'data:image/png;base64,AQ=='
		);
		const serialized = new XMLSerializer().serializeToString(svg);
		expect(serialized.match(/xmlns:xlink=/g)).toHaveLength(1);
		expect(serialized).toContain('xlink:href="data:image/png;base64,AQ=="');
	});

	it('uses prefixed back image columns for unprefixed back template ids', () => {
		const svg = patchSvgRoot(
			loadSvgTemplate(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88">
					<image id="background" href="../../assets/template_blank.png" />
				</svg>`
			)
		);
		const imagePaths = new Map([
			['front.png', 'data:image/png;base64,FRONT=='],
			['back.png', 'data:image/png;base64,BACK==']
		]);

		const generated = generateSvg(
			svg,
			['background', 'back_background'],
			['front.png', 'back.png'],
			imagePaths,
			{ columnPrefix: 'back_' }
		);

		const image = generated.getElementById('background');
		expect(image?.getAttribute('href')).toBe('data:image/png;base64,BACK==');
	});
});
