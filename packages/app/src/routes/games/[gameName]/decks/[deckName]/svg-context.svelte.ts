import { createContext } from 'svelte';

export interface LoadedSvgTemplates {
    front: SVGSVGElement | null;
    back: SVGSVGElement | null;
}

export const [getToLoadSvgsContext, setToLoadSvgsContext] = createContext<() => Promise<LoadedSvgTemplates>>();

