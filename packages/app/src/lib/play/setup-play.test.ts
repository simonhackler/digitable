import { describe, expect, it } from 'vitest';
import type { TableSetup } from '../../routes/games/[gameName]/setup/table-setup';
import type { ParsedSvg } from './initComponent';
import {
	buildDefaultInitPayload,
	buildSetupInitPayload,
	buildSetupPlayPlan,
	setupReferencedDeckNames,
	type LoadedDeck
} from './setup-play';

function card(id: string): ParsedSvg {
	return { id } as ParsedSvg;
}

describe('setup play planning', () => {
	const loadedDecks: LoadedDeck[] = [
		{
			deckName: 'western',
			cards: [card('card-1'), card('card-2'), card('card-3')]
		}
	];

	it('keeps the default play payload as one stack per playable deck', () => {
		expect(buildDefaultInitPayload(loadedDecks)).toEqual({
			stacks: [{ componentIds: ['card-1', 'card-2', 'card-3'] }]
		});
	});

	it('converts setup placements and flex slot contents into explicit play items', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'deck-placement',
					type: 'deck',
					deckName: 'western',
					cardIds: ['western:card-1', 'western:card-2'],
					x: 155,
					y: 155,
					rotation: 0,
					label: 'western'
				}
			],
			slots: [
				{
					id: 'slot-1',
					label: 'Market',
					x: 500,
					y: 650,
					width: 236,
					height: 150,
					acceptedDeckNames: [],
					acceptedCardIds: [],
					layout: {
						mode: 'horizontal-flex',
						visibleCount: 2,
						gap: 16,
						cardSize: 'content-card',
						maxItems: 4
					},
					contents: [{ type: 'card', deckName: 'western', cardId: 'western:card-3' }]
				}
			]
		};

		const plan = buildSetupPlayPlan(setup, loadedDecks, () => {});

		expect(setupReferencedDeckNames(setup)).toEqual(new Set(['western']));
		expect(plan.items).toEqual([
			{
				id: 'deck-placement',
				type: 'stack',
				componentIds: ['card-1', 'card-2'],
				x: 100,
				y: 80,
				deckName: 'western'
			},
			{
				id: 'card-3',
				type: 'card',
				componentIds: ['card-3'],
				x: 500,
				y: 650,
				deckName: 'western',
				slotId: 'slot-1'
			}
		]);
		expect(buildSetupInitPayload(plan)).toEqual({
			setupItems: [
				{
					id: 'deck-placement',
					type: 'stack',
					componentIds: ['card-1', 'card-2'],
					x: 100,
					y: 80
				},
				{
					id: 'card-3',
					type: 'card',
					componentIds: ['card-3'],
					x: 500,
					y: 650
				}
			]
		});
	});

	it('keeps the first setup reference for duplicated cards', () => {
		const warnings: string[] = [];
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'card-placement',
					type: 'card',
					deckName: 'western',
					cardId: 'western:card-1',
					x: 155,
					y: 155,
					rotation: 0,
					label: 'card'
				}
			],
			slots: [
				{
					id: 'slot-1',
					label: 'Market',
					x: 500,
					y: 650,
					width: 110,
					height: 150,
					acceptedDeckNames: [],
					acceptedCardIds: [],
					layout: {
						mode: 'horizontal-flex',
						visibleCount: 1,
						gap: 16,
						cardSize: 'content-card',
						maxItems: 2
					},
					contents: [{ type: 'card', deckName: 'western', cardId: 'western:card-1' }]
				}
			]
		};

		const plan = buildSetupPlayPlan(setup, loadedDecks, (warning) => warnings.push(warning));

		expect(plan.items).toHaveLength(1);
		expect(plan.items[0].componentIds).toEqual(['card-1']);
		expect(warnings).toEqual(['Skipping duplicate setup card "western:card-1" in slot "Market".']);
	});

	it('removes explicitly placed cards from deck stacks', () => {
		const setup: TableSetup = {
			version: 1,
			table: { presetId: 'custom', width: 800, height: 600 },
			placements: [
				{
					id: 'deck-placement',
					type: 'deck',
					deckName: 'western',
					cardIds: ['western:card-1', 'western:card-2', 'western:card-3'],
					x: 155,
					y: 155,
					rotation: 0,
					label: 'western'
				},
				{
					id: 'card-placement',
					type: 'card',
					deckName: 'western',
					cardId: 'western:card-2',
					x: 355,
					y: 155,
					rotation: 0,
					label: 'card'
				}
			],
			slots: [
				{
					id: 'slot-1',
					label: 'Market',
					x: 500,
					y: 650,
					width: 236,
					height: 150,
					acceptedDeckNames: [],
					acceptedCardIds: [],
					layout: {
						mode: 'horizontal-flex',
						visibleCount: 2,
						gap: 16,
						cardSize: 'content-card',
						maxItems: 4
					},
					contents: [{ type: 'card', deckName: 'western', cardId: 'western:card-3' }]
				}
			]
		};

		const plan = buildSetupPlayPlan(setup, loadedDecks, () => {});

		expect(plan.items).toEqual([
			{
				id: 'deck-placement',
				type: 'stack',
				componentIds: ['card-1'],
				x: 100,
				y: 80,
				deckName: 'western'
			},
			{
				id: 'card-2',
				type: 'card',
				componentIds: ['card-2'],
				x: 300,
				y: 80,
				deckName: 'western'
			},
			{
				id: 'card-3',
				type: 'card',
				componentIds: ['card-3'],
				x: 500,
				y: 650,
				deckName: 'western',
				slotId: 'slot-1'
			}
		]);
	});
});
