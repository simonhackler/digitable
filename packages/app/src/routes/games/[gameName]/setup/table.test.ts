import { describe, expect, it } from 'vitest';
import {
	placementToSvgElementJson,
	resolveTableSlotSize,
	snapPlacementToGrid,
	slotToSvgElementJson,
	svgToTable,
	type Table,
	type TablePlacement,
	type TableSvgElementJson
} from './table';
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;

function elementChildren(node: TableSvgElementJson): TableSvgElementJson[] {
	return (
		node.children?.filter((child): child is TableSvgElementJson => typeof child !== 'string') ?? []
	);
}

function hasDeckStack(node: TableSvgElementJson) {
	return elementChildren(node).some((child) => child.attr?.['data-deck-stack'] === 'true');
}

const legacyCardSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 150"/>';

function placementCardAssets(...placementIds: string[]) {
	return {
		placementCardSvgs: new Map(placementIds.map((id) => [id, legacyCardSvg]))
	};
}

describe('table setup', () => {
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
		const slot = resolveTableSlotSize(
			{
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
			},
			{
				cardSvgs: new Map([
					['western:1', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"/>'],
					['western:oversized', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120"/>']
				]),
				deckCardIds: new Map([['western', ['western:1']]])
			}
		);

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

	it('renders horizontal flex slot contents as locked card-sized editor elements', () => {
		const slot = slotToSvgElementJson(
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
			},
			{
				cardSvgs: new Map([
					['western:1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Ace</text></svg>']
				]),
				deckTopCardIds: new Map([['western', 'western:1']])
			}
		);
		const children = elementChildren(slot);
		const rects = children.filter((child) => child.element === 'rect');

		expect(slot.attr?.['data-svgedit-resizable']).toBe('false');
		expect(slot.attr?.['data-slot-layout-mode']).toBe('horizontal-flex');
		expect(String(slot.attr?.['data-slot-contents'])).toContain('western:1');
		expect(rects[0]?.attr).toEqual(expect.objectContaining({ width: 240, height: 150 }));
		expect(children.some((child) => child.element === 'image')).toBe(true);
		expect(hasDeckStack(slot)).toBe(true);
		expect(children.some((child) => child.attr?.['data-locked'] === 'true')).toBe(true);
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
		expect(
			placementToSvgElementJson(placement, placementCardAssets('deck-1')).attr?.transform
		).toBe('translate(100 80) rotate(0 55 75)');
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
		const svg = [
			'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-digitable-table="true" data-preset-id="custom">',
			'  <g id="slot-1" data-digitable-kind="slot" data-label="Slot 1" data-slot-layout-mode="free" transform="matrix(1.5 0 0 2 100 110)">',
			'    <rect x="0" y="0" width="220" height="300"/>',
			'  </g>',
			'</svg>'
		].join('\n');

		const parsed = svgToTable(svg, setup);

		expect(parsed.slots[0]).toEqual(
			expect.objectContaining({ x: 100, y: 110, width: 330, height: 600 })
		);
	});

	it('parses saved placement transforms as top-left visual geometry', () => {
		const setup: Table = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [],
			slots: []
		};
		const svg = [
			'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-digitable-table="true" data-preset-id="custom">',
			'  <g id="deck-1" data-digitable-kind="placement" data-digitable-type="deck" data-deck-name="western" data-card-ids="[&quot;western:1&quot;]" data-label="Western" transform="matrix(1 0 0 1 240 220)">',
			'    <image x="0" y="0" width="63" height="88"/>',
			'  </g>',
			'</svg>'
		].join('\n');

		const parsed = svgToTable(svg, setup);

		expect(parsed.placements[0]).toEqual(
			expect.objectContaining({ x: 271.5, y: 264, rotation: 0 })
		);
	});

	it('renders placement card art as a locked image when card svg is available', () => {
		const placement: TablePlacement = {
			id: 'deck-1',
			type: 'deck',
			deckName: 'western',
			cardIds: ['western:1'],
			x: 200,
			y: 240,
			rotation: 0,
			label: 'Western'
		};
		const group = placementToSvgElementJson(placement, {
			placementCardSvgs: new Map([
				['deck-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Top card</text></svg>']
			])
		});
		const children = elementChildren(group);

		expect(children.some((child) => child.element === 'image')).toBe(true);
		expect(
			children.some((child) => String(child.attr?.href).startsWith('data:image/svg+xml'))
		).toBe(true);
		expect(hasDeckStack(group)).toBe(true);
		expect(children.some((child) => child.attr?.['data-locked'] === 'true')).toBe(true);
		expect(children.some((child) => child.element === 'text')).toBe(false);
	});

	it('renders decks as stacks and individual cards as one card face', () => {
		const assets = {
			placementCardSvgs: new Map([
				['deck-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Top card</text></svg>'],
				['card-1', '<svg xmlns="http://www.w3.org/2000/svg"><text>Single card</text></svg>']
			])
		};
		const deck = placementToSvgElementJson(
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
			assets
		);
		const card = placementToSvgElementJson(
			{
				id: 'card-1',
				type: 'card',
				deckName: 'western',
				cardId: 'western:1',
				x: 360,
				y: 240,
				rotation: 0,
				label: 'Ace'
			},
			assets
		);

		expect(hasDeckStack(deck)).toBe(true);
		expect(hasDeckStack(card)).toBe(false);
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
		const editedSvg = [
			'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" data-digitable-table="true" data-preset-id="custom">',
			'  <g id="slot-1" data-digitable-kind="slot" data-label="Slot 1" transform="translate(50 60)">',
			'    <rect x="0" y="0" width="200" height="300"/>',
			'    <text>Renamed</text>',
			'  </g>',
			'</svg>'
		].join('\n');

		expect(svgToTable(editedSvg, setup).slots[0]?.label).toBe('Slot 1');
	});

	it('normalizes svg editor canvas dimensions back to the setup table', () => {
		const setup: Table = {
			version: 1,
			table: { presetId: 'two-player', width: 1200, height: 700 },
			placements: [],
			slots: []
		};
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" width="12000" height="7000" viewBox="0 0 12000 7000" data-digitable-table="true" data-preset-id="two-player"></svg>';

		expect(svgToTable(svg, setup).table).toEqual(setup.table);
	});
});
