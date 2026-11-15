import { member, optional } from '$lib/collaboration/dependencies';
import type { LayoutLoad } from './$types';

export const load = (({ params }) => ({
	componentNeeds: {
		front: optional(member('component-svg', `components/${params.deckName}/front.svg`)),
		back: optional(member('component-svg', `components/${params.deckName}/back.svg`)),
		data: optional(member('component-data', `components/${params.deckName}/data.csv`))
	}
})) satisfies LayoutLoad;
