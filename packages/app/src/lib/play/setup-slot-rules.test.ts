import { describe, expect, it } from 'vitest';
import type { SetupSlot } from '../../routes/games/[gameName]/setup/table-setup';
import {
	clampSetupItemPosition,
	findSetupSlotAtPoint,
	initialSetupSlotState,
	setupItemMetadataById,
	setupSlotAcceptsItem,
	setupSlotCapacity,
	setupSlotCellPosition
} from './setup-slot-rules';
import type { SetupPlayPlan } from './setup-play';

const baseSlot: SetupSlot = {
	id: 'slot-1',
	label: 'Slot',
	x: 100,
	y: 120,
	width: 110,
	height: 150,
	acceptedDeckNames: [],
	acceptedCardIds: [],
	layout: { mode: 'free' },
	contents: []
};

describe('setup slot rules', () => {
	it('matches decks by deck rule and individual cards by card rule', () => {
		const restrictedSlot: SetupSlot = {
			...baseSlot,
			acceptedDeckNames: ['western'],
			acceptedCardIds: ['western:ace']
		};

		expect(
			setupSlotAcceptsItem(restrictedSlot, {
				id: 'deck',
				type: 'stack',
				deckName: 'western',
				componentIds: ['ace', 'king']
			})
		).toBe(true);
		expect(
			setupSlotAcceptsItem(
				{ ...restrictedSlot, acceptedDeckNames: [] },
				{
					id: 'deck',
					type: 'stack',
					deckName: 'western',
					componentIds: ['ace', 'king']
				}
			)
		).toBe(false);
		expect(
			setupSlotAcceptsItem(
				{ ...restrictedSlot, acceptedDeckNames: [] },
				{
					id: 'ace',
					type: 'card',
					deckName: 'western',
					componentIds: ['ace']
				}
			)
		).toBe(true);
	});

	it('builds initial occupant state and metadata from setup play items', () => {
		const plan: SetupPlayPlan = {
			setup: {
				version: 1,
				table: { presetId: 'custom', width: 600, height: 400 },
				placements: [],
				slots: [baseSlot]
			},
			items: [
				{
					id: 'slot-stack',
					type: 'stack',
					deckName: 'western',
					componentIds: ['ace', 'king'],
					x: 100,
					y: 120,
					slotId: 'slot-1'
				}
			]
		};

		expect(initialSetupSlotState(plan).slotOccupants.get('slot-1')).toEqual(['slot-stack']);
		expect(setupItemMetadataById(plan).get('king')).toEqual({
			id: 'king',
			type: 'card',
			componentIds: ['king'],
			deckName: 'western'
		});
	});

	it('uses flex layout cells, capacity, hit testing, and table clamping', () => {
		const slot: SetupSlot = {
			...baseSlot,
			layout: {
				mode: 'horizontal-flex',
				visibleCount: 2,
				gap: 16,
				cardSize: 'content-card',
				maxItems: 4
			}
		};
		const setup = {
			version: 1 as const,
			table: { presetId: 'custom' as const, width: 320, height: 260 },
			placements: [],
			slots: [slot]
		};

		expect(setupSlotCapacity(slot)).toBe(4);
		expect(setupSlotCellPosition(slot, 1)).toEqual({ x: 226, y: 120 });
		expect(findSetupSlotAtPoint(setup, { x: 150, y: 180 })?.id).toBe('slot-1');
		expect(clampSetupItemPosition(setup, { x: 999, y: 999 })).toEqual({ x: 210, y: 110 });
	});
});
