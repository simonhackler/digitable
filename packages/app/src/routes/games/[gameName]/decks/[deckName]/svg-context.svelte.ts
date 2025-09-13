import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
import { getContext, setContext } from 'svelte';

const key = 'svgs';

export class LoadSvgs {
	loadTemplates: Promise<{ front: SVGSVGElement | null; back: SVGSVGElement | null }>;
	constructor(loadTemplates: Promise<{ front: SVGSVGElement | null; back: SVGSVGElement | null }>) {
		this.loadTemplates = $derived(loadTemplates);
	}
}

export function setLoadSvgsContext(loadSvgs: () => LoadSvgs) {
	setContext(key, loadSvgs);
}

export function getLoadSvgsContext() {
	return getContext(key)() as LoadSvgs;
}

export class Svgs {
	frontSvg: SVGSVGElement | null;
	backSvg: SVGSVGElement | null;

	constructor(frontSvg: SVGSVGElement | null, backSvg: SVGSVGElement | null) {
		this.frontSvg = $state(frontSvg);
		this.backSvg = $state(backSvg);
	}
}

export function setSvgContext(svgs: () => Svgs) {
	setContext(key, svgs);
}

export function getUserContext() {
	return getContext(key)() as Svgs;
}
