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
		expect(svg).toContain('Western &amp; Co');
		expect(svg).toContain('Only &lt;aces&gt;');
		expect(svg).toContain('data-card-ids="[&quot;western:1&quot;,&quot;western:2&quot;]"');
		expect(svg).toContain('data-svgedit-resizable="false"');
		expect(svg).toContain('data-locked="true" pointer-events="none"');
		expect(svg).toContain('transform="translate(200 240) rotate(15)"');
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
		expect(svg).toContain('data-locked="true" pointer-events="none"');
		expect(svg).not.toContain('<text x="0" y="-6"');
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
});
