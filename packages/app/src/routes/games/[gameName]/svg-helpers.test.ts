import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import { getTextColumnValue, getTextFrameBounds, loadSvgTemplate, parseSvg } from './svg-helpers';

globalThis.DOMParser = XmlDomParser as typeof DOMParser;

const patchSvgRoot = (svg: SVGSVGElement) => {
	const doc = svg.ownerDocument;
	Object.defineProperty(svg, 'getElementById', {
		value: (elementId: string) => {
			const element = doc.getElementById(elementId);
			if (!element) {
				throw new Error(`Expected #${elementId} to exist`);
			}
			return element;
		}
	});
	Object.defineProperty(svg, 'querySelectorAll', {
		value: ((selector: string) =>
			Array.from(doc.getElementsByTagName(selector))) as unknown as ParentNode['querySelectorAll']
	});
	return svg;
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
});
