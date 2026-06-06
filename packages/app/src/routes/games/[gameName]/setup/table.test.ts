import { describe, expect, it } from 'vitest';
import {
	createDefaultTable,
	normalizeTableSvg,
	normalizeTableSlot,
	resolveTableSlotSize,
	tableToSvg,
	snapPlacementToGrid,
	slotToSvgElementJson,
	svgToTable,
	type Table
} from './table';
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
	it('renders table setup as deterministic svg', () => {
		const setup: Table = {
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

		const svg = tableToSvg(setup);
		expect(svg).toContain('viewBox="0 0 800 600"');
		expect(svg).not.toContain('#166534');
		expect(svg).not.toContain('#bbf7d0');
		expect(svg).toContain('Western &amp; Co');
		expect(svg).toContain('Only &lt;aces&gt;');
		expect(svg).toContain('data-card-ids="[&quot;western:2&quot;,&quot;western:1&quot;]"');
		expect(svg).toContain('data-deck-stack="true"');
		expect(svg).toContain('data-svgedit-resizable="false"');
		expect(svg).toContain('data-locked="true"');
		expect(svg).toContain('style="pointer-events:none;user-select:none"');
		expect(svg).not.toContain('pointer-events="none"');
		const deckGroup = groupById(svg, 'deck-1');
		const slotGroup = groupById(svg, 'slot-1');
		const slotRect = slotGroup.getElementsByTagName('rect')[0]!;
		expect(deckGroup.getAttribute('transform')).toBe('translate(140 160) rotate(15 55 75)');
		expect(slotGroup.getAttribute('transform')).toBe('translate(100 100)');
		expect(slotRect.getAttribute('x')).toBe('0');
		expect(slotRect.getAttribute('y')).toBe('0');
	});

	it('uses saved slot geometry for live svg editor slot updates', () => {
		const slot = slotToSvgElementJson({
			id: 'slot-1',
			label: 'Market',
			x: 50,
			y: 60,
			width: 200,
			height: 300,
			acceptedDeckNames: ['western'],
			acceptedCardIds: []
		});

		expect(slot.attr?.transform).toBe('translate(50 60)');
		expect(slot.children?.[0]).toEqual(
			expect.objectContaining({
				element: 'rect',
				attr: expect.objectContaining({ x: 0, y: 0, width: 200, height: 300 })
			})
		);
		expect(slot.children?.[1]).toEqual(
			expect.objectContaining({
				element: 'text',
				attr: expect.objectContaining({ x: 16, y: 32 })
			})
		);
	});

	it('sizes horizontal flex slots to the biggest accepted card', () => {
		const slot = resolveTableSlotSize({
			id: 'slot-1',
			label: 'Market',
			x: 50,
			y: 60,
			width: 999,
			height: 999,
			acceptedDeckNames: ['western'],
			acceptedCardIds: ['western:oversized'],
			layout: {
				mode: 'horizontal-flex',
				visibleCount: 3,
				gap: 12,
				cardSize: 'content-card'
			},
			contents: [
				{ type: 'deck', deckName: 'western' },
				{ type: 'card', deckName: 'western', cardId: 'western:1' },
				{ type: 'card', deckName: 'western', cardId: 'western:2' },
				{ type: 'card', deckName: 'western', cardId: 'western:3' }
			]
		}, {
			cardSvgs: new Map([
				['western:1', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"/>'],
				['western:oversized', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120"/>']
			]),
			deckCardIds: new Map([['western', ['western:1']]])
		});

		expect(slot).toEqual(
			expect.objectContaining({
				width: 264,
				height: 120,
				layout: expect.objectContaining({
					mode: 'horizontal-flex',
					visibleCount: 3,
					gap: 12
				}),
				contents: [
					{ type: 'deck', deckName: 'western' },
					{ type: 'card', deckName: 'western', cardId: 'western:1' },
					{ type: 'card', deckName: 'western', cardId: 'western:2' }
				]
			})
		);
	});

	it('renders horizontal flex slot contents as locked card-sized visuals', () => {
		const setup: Table = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [],
			slots: [
				{
					id: 'slot-1',
					label: 'Market',
					x: 50,
					y: 60,
					width: 0,
					height: 0,
					acceptedDeckNames: [],
					acceptedCardIds: [],
					layout: {
						mode: 'horizontal-flex',
						visibleCount: 2,
						gap: 20,
						cardSize: 'content-card'
					},
					contents: [
						{ type: 'deck', deckName: 'western' },
						{ type: 'card', deckName: 'western', cardId: 'western:1' }
					]
				}
			]
		};

		const svg = tableToSvg(setup, {
			cardSvgs: new Map([
				['western:1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Ace</text></svg>']
			]),
			deckTopCardIds: new Map([['western', 'western:1']])
		});
		const group = groupById(svg, 'slot-1');
		const rects = Array.from(group.getElementsByTagName('rect'));

		expect(group.getAttribute('data-svgedit-resizable')).toBe('false');
		expect(group.getAttribute('data-slot-layout-mode')).toBe('horizontal-flex');
		expect(group.getAttribute('data-slot-contents')).toContain('western:1');
		expect(rects[0]?.getAttribute('width')).toBe('240');
		expect(rects[0]?.getAttribute('height')).toBe('150');
		expect(svg).toContain('<image');
		expect(svg).toContain('data-deck-stack="true"');
		expect(svg).toContain('data-locked="true"');

		const parsed = svgToTable(svg, setup);
		expect(parsed.slots[0]).toEqual(
			expect.objectContaining({
				width: 240,
				height: 150,
				contents: setup.slots[0].contents
			})
		);
	});

	it('snaps placement visual top-left corners to the table grid', () => {
		const placement = snapPlacementToGrid({
			id: 'deck-1',
			type: 'deck',
			deckName: 'western',
			cardIds: ['western:1'],
			x: 160,
			y: 160,
			rotation: 0,
			label: 'Western'
		});

		expect(placement).toEqual(expect.objectContaining({ x: 155, y: 155 }));
		expect(tableToSvg({ ...createDefaultTable(), placements: [placement] })).toContain(
			'transform="translate(100 80) rotate(0 55 75)"'
		);
	});

	it('roundtrips generated slot and placement coordinates through svg markup', () => {
		const setup: Table = {
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

		const parsed = svgToTable(tableToSvg(setup), setup);

		expect(parsed.placements[0]).toEqual(expect.objectContaining({ x: 195, y: 235 }));
		expect(parsed.slots[0]).toEqual(expect.objectContaining({ x: 100, y: 110 }));
	});

	it('folds svg editor slot scale transforms into saved slot dimensions', () => {
		const setup: Table = {
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
		const svg = tableToSvg(setup).replace(
			'transform="translate(100 110)"',
			'transform="matrix(1.5 0 0 2 100 110)"'
		);

		const parsed = svgToTable(svg, setup);

		expect(parsed.slots[0]).toEqual(
			expect.objectContaining({ x: 100, y: 110, width: 330, height: 600 })
		);
	});

	it('snaps legacy centered placement coordinates when parsing saved svgs', () => {
		const setup: Table = {
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

		const parsed = svgToTable(svg, setup);

		expect(parsed.placements[0]).toEqual(expect.objectContaining({ x: 195, y: 235, rotation: 15 }));
	});

	it('renders placement card art as a locked image when card svg is available', () => {
		const setup: Table = {
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

		const svg = tableToSvg(setup, {
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
		const setup: Table = {
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

		const svg = tableToSvg(setup, {
			placementCardSvgs: new Map([
				['deck-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Top card</text></svg>'],
				['card-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Single card</text></svg>']
			])
		});

		expect(hasDeckStack(groupById(svg, 'deck-1'))).toBe(true);
		expect(hasDeckStack(groupById(svg, 'card-1'))).toBe(false);
	});

	it('keeps slot labels from metadata if visible slot text is edited', () => {
		const setup: Table = {
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
		const editedSvg = tableToSvg(setup).replace('>Slot 1</text>', '>Renamed</text>');

		expect(svgToTable(editedSvg, setup).slots[0]?.label).toBe('Slot 1');
	});

	it('normalizes svg editor canvas dimensions back to the setup table', () => {
		const setup: Table = {
			version: 1,
			table: { presetId: 'two-player', width: 1200, height: 700 },
			placements: [],
			slots: []
		};
		const svg = tableToSvg(setup).replace('viewBox="0 0 1200 700"', 'viewBox="0 0 12000 7000"');

		expect(svgToTable(svg, setup).table).toEqual(setup.table);
		expect(normalizeTableSvg(svg, setup)).toContain('viewBox="0 0 1200 700"');
	});

	it('removes the legacy green table background during normalization', () => {
		const setup: Table = {
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
