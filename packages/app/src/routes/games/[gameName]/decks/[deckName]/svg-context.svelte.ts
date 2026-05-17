import { createContext } from 'svelte';

export interface LoadedSvgTemplates {
	frontText: string;
	backText: string;
	front: SVGSVGElement | null;
	back: SVGSVGElement | null;
}

function normalizeSideIndex(nextSideIndex: number, sideCount: number) {
	const lastSideIndex = Math.max(0, sideCount - 1);
	if (!Number.isInteger(nextSideIndex)) return 0;
	return Math.min(Math.max(nextSideIndex, 0), lastSideIndex);
}

export function createDeckSideIndexState(initialSideIndex = 0) {
	let sideIndex = $state(normalizeSideIndex(initialSideIndex, 2));

	return {
		get sideIndex() {
			return sideIndex;
		},
		set sideIndex(nextSideIndex: number) {
			sideIndex = normalizeSideIndex(nextSideIndex, 2);
		},
		setSideIndex(nextSideIndex: number, sideCount = 2) {
			sideIndex = normalizeSideIndex(nextSideIndex, sideCount);
		},
		flipSideIndex(sideCount = 2) {
			const count = Math.max(1, sideCount);
			sideIndex = (sideIndex + 1) % count;
		}
	};
}

export type DeckSideIndexState = ReturnType<typeof createDeckSideIndexState>;

export const [getToLoadSvgsContext, setToLoadSvgsContext] =
	createContext<() => Promise<LoadedSvgTemplates>>();
export const [getDeckSideIndexContext, setDeckSideIndexContext] =
	createContext<DeckSideIndexState>();
