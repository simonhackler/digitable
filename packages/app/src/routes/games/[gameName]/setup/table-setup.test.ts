import { describe, expect, it } from 'vitest';
import {
	createDefaultTableSetup,
	normalizeTableSvg,
	parseTableSetup,
	serializeTableSetup,
	setupToSvg,
	svgToTableSetup,
	type TableSetup
} from './table-setup';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
globalThis.XMLSerializer = XMLSerializer as unknown as typeof globalThis.XMLSerializer;

function groupById(svg: string, id: string) {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const group = Array.from(doc.getElementsByTagName('g')).find(
		(element) => element.getAttribute('id') === id
	);
	expect(group).toBeTruthy();
	return group!;
}

function hasDeckStack(group: Element) {
	return Array.from(group.getElementsByTagName('*')).some(
		(element) => element.getAttribute('data-deck-stack') === 'true'
	);
}

describe('table setup', () => {
	it('parses invalid setup data into a default setup', () => {
		expect(parseTableSetup(null)).toEqual(createDefaultTableSetup());
		expect(parseTableSetup({ table: { width: -1, height: 0 } }).table).toEqual({
			presetId: 'four-player',
			width: 1400,
			height: 900
		});
	});

	it('serializes slot rules deterministically', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'placement-1',
					type: 'card',
					deckName: 'western',
					cardId: 'western:card-1',
					x: 100,
					y: 120,
					rotation: 0,
					label: 'Ace'
				}
			],
			slots: [
				{
					id: 'slot-1',
					label: 'Market',
					x: 50,
					y: 60,
					width: 200,
					height: 300,
					acceptedDeckNames: ['z', 'a'],
					acceptedCardIds: ['western:2', 'western:1']
				}
			]
		};

		expect(serializeTableSetup(setup)).toContain(
			'"acceptedDeckNames": [\n        "a",\n        "z"'
		);
		expect(serializeTableSetup(setup)).toContain(
			'"acceptedCardIds": [\n        "western:1",\n        "western:2"'
		);
	});

	it('renders table setup as deterministic svg', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'deck-1',
					type: 'deck',
					deckName: 'western',
					cardIds: ['western:2', 'western:1'],
					x: 200,
					y: 240,
					rotation: 15,
					label: 'Western & Co'
				}
			],
			slots: [
				{
					id: 'slot-1',
					label: 'Only <aces>',
					x: 100,
					y: 100,
					width: 220,
					height: 300,
					acceptedDeckNames: [],
					acceptedCardIds: []
				}
			]
		};

		const svg = setupToSvg(setup);
		expect(svg).toContain('viewBox="0 0 800 600"');
		expect(svg).not.toContain('#166534');
		expect(svg).not.toContain('#bbf7d0');
		expect(svg).toContain('Western &amp; Co');
		expect(svg).toContain('Only &lt;aces&gt;');
		expect(svg).toContain('data-card-ids="[&quot;western:1&quot;,&quot;western:2&quot;]"');
		expect(svg).toContain('data-deck-stack="true"');
		expect(svg).toContain('data-svgedit-resizable="false"');
		expect(svg).toContain('data-locked="true"');
		expect(svg).not.toContain('pointer-events="none"');
		const deckGroup = groupById(svg, 'deck-1');
		const slotGroup = groupById(svg, 'slot-1');
		const slotRect = slotGroup.getElementsByTagName('rect')[0]!;
		expect(deckGroup.getAttribute('transform')).toBe('translate(145 165) rotate(15 55 75)');
		expect(slotGroup.getAttribute('transform')).toBe('translate(100 100)');
		expect(slotRect.getAttribute('x')).toBe('0');
		expect(slotRect.getAttribute('y')).toBe('0');
	});

	it('roundtrips generated slot and placement coordinates through svg markup', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'deck-1',
					type: 'deck',
					deckName: 'western',
					cardIds: ['western:1'],
					x: 200,
					y: 240,
					rotation: 15,
					label: 'Western'
				}
			],
			slots: [
				{
					id: 'slot-1',
					label: 'Slot 1',
					x: 100,
					y: 110,
					width: 220,
					height: 300,
					acceptedDeckNames: [],
					acceptedCardIds: []
				}
			]
		};

		const parsed = svgToTableSetup(setupToSvg(setup), setup);

		expect(parsed.placements[0]).toEqual(expect.objectContaining({ x: 200, y: 240 }));
		expect(parsed.slots[0]).toEqual(expect.objectContaining({ x: 100, y: 110 }));
	});

	it('folds svg editor slot scale transforms into saved slot dimensions', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [],
			slots: [
				{
					id: 'slot-1',
					label: 'Slot 1',
					x: 100,
					y: 110,
					width: 220,
					height: 300,
					acceptedDeckNames: [],
					acceptedCardIds: []
				}
			]
		};
		const svg = setupToSvg(setup).replace(
			'transform="translate(100 110)"',
			'transform="matrix(1.5 0 0 2 100 110)"'
		);

		const parsed = svgToTableSetup(svg, setup);

		expect(parsed.slots[0]).toEqual(
			expect.objectContaining({ x: 100, y: 110, width: 330, height: 600 })
		);
	});

	it('keeps legacy centered placement coordinates compatible when parsing saved svgs', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [],
			slots: []
		};
		const svg = [
			'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-digitable-table="true" data-preset-id="custom">',
			'  <g id="deck-1" data-digitable-kind="placement" data-digitable-type="deck" data-deck-name="western" data-card-ids="[&quot;western:1&quot;]" data-label="Western" transform="translate(200 240) rotate(15)">',
			'    <rect x="-55" y="-75" width="110" height="150" rx="10"/>',
			'  </g>',
			'</svg>'
		].join('\n');

		const parsed = svgToTableSetup(svg, setup);

		expect(parsed.placements[0]).toEqual(expect.objectContaining({ x: 200, y: 240, rotation: 15 }));
	});

	it('renders placement card art as a locked image when card svg is available', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'deck-1',
					type: 'deck',
					deckName: 'western',
					cardIds: ['western:1'],
					x: 200,
					y: 240,
					rotation: 0,
					label: 'Western'
				}
			],
			slots: []
		};

		const svg = setupToSvg(setup, {
			placementCardSvgs: new Map([
				['deck-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Top card</text></svg>']
			])
		});

		expect(svg).toContain('<image');
		expect(svg).toContain('data:image/svg+xml');
		expect(svg).toContain('data-deck-stack="true"');
		expect(svg).toContain('data-locked="true"');
		expect(svg).not.toContain('pointer-events="none"');
		expect(svg).not.toContain('<text x="0" y="-6"');
	});

	it('renders decks as stacks and individual cards as one card face', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'deck-1',
					type: 'deck',
					deckName: 'western',
					cardIds: ['western:1'],
					x: 200,
					y: 240,
					rotation: 0,
					label: 'Western'
				},
				{
					id: 'card-1',
					type: 'card',
					deckName: 'western',
					cardId: 'western:1',
					x: 360,
					y: 240,
					rotation: 0,
					label: 'Ace'
				}
			],
			slots: []
		};

		const svg = setupToSvg(setup, {
			placementCardSvgs: new Map([
				['deck-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Top card</text></svg>'],
				['card-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Single card</text></svg>']
			])
		});

		expect(hasDeckStack(groupById(svg, 'deck-1'))).toBe(true);
		expect(hasDeckStack(groupById(svg, 'card-1'))).toBe(false);
	});

	it('keeps slot labels from metadata if visible slot text is edited', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [],
			slots: [
				{
					id: 'slot-1',
					label: 'Slot 1',
					x: 50,
					y: 60,
					width: 200,
					height: 300,
					acceptedDeckNames: [],
					acceptedCardIds: []
				}
			]
		};
		const editedSvg = setupToSvg(setup).replace('>Slot 1</text>', '>Renamed</text>');

		expect(svgToTableSetup(editedSvg, setup).slots[0]?.label).toBe('Slot 1');
	});

	it('normalizes svg editor canvas dimensions back to the setup table', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'two-player', width: 1200, height: 700 },
			placements: [],
			slots: []
		};
		const svg = setupToSvg(setup).replace('viewBox="0 0 1200 700"', 'viewBox="0 0 12000 7000"');

		expect(svgToTableSetup(svg, setup).table).toEqual(setup.table);
		expect(normalizeTableSvg(svg, setup)).toContain('viewBox="0 0 1200 700"');
	});

	it('removes the legacy green table background during normalization', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [],
			slots: []
		};
		const svg = [
			'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
			'  <rect width="100%" height="100%" rx="32" fill="#166534"/>',
			'  <rect x="24" y="24" width="752" height="552" rx="24" fill="none" stroke="#bbf7d0" stroke-width="6" stroke-opacity="0.8"/>',
			'</svg>'
		].join('\n');
		const normalized = normalizeTableSvg(svg, setup);

		expect(normalized).not.toContain('#166534');
		expect(normalized).not.toContain('#bbf7d0');
	});
});
