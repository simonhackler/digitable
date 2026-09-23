import { getContext, setContext } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { presenceSurfaceLayout, type PresencePointer } from './project-presence';

const DEFAULT_SURFACE_ID = 'project-page';
const contextKey = Symbol('presence-surfaces');

export type PresenceCoordinateSpace = 'box' | 'scroll' | 'visible';

type SurfaceRegistration = {
	node: HTMLElement;
	space: PresenceCoordinateSpace;
};

export type ResolvedPresencePointer = {
	x: number;
	y: number;
	regionId: string | null;
};

export type PresenceSurfaceRegistry = {
	surface(options?: { id?: string; space?: PresenceCoordinateSpace }): Attachment<HTMLElement>;
	region(options: {
		id: string;
		surfaceId?: string;
		space?: PresenceCoordinateSpace;
	}): Attachment<HTMLElement>;
	capture(event: PointerEvent): PresencePointer | null;
	resolve(pointer: PresencePointer): ResolvedPresencePointer | null;
	close(): void;
};

export function createPresenceSurfaceRegistry(): PresenceSurfaceRegistry {
	const surfaces = new Map<string, SurfaceRegistration>();
	const regions = new Map<string, SurfaceRegistration & { surfaceId: string }>();

	function register<T extends SurfaceRegistration>(
		entries: Map<string, T>,
		id: string,
		registration: T
	): () => void {
		entries.set(id, registration);
		return () => {
			if (entries.get(id)?.node === registration.node) entries.delete(id);
		};
	}

	function coordinates(
		registration: SurfaceRegistration,
		clientX: number,
		clientY: number
	): { x: number; y: number } | null {
		if (registration.space === 'visible') {
			const bounds = visibleBounds(registration.node);
			if (!bounds) return null;
			return {
				x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
				y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height))
			};
		}
		const rect = registration.node.getBoundingClientRect();
		const width = registration.space === 'scroll' ? registration.node.scrollWidth : rect.width;
		const height = registration.space === 'scroll' ? registration.node.scrollHeight : rect.height;
		if (width <= 0 || height <= 0) return null;
		const scrollLeft = registration.space === 'scroll' ? registration.node.scrollLeft : 0;
		const scrollTop = registration.space === 'scroll' ? registration.node.scrollTop : 0;
		return {
			x: Math.min(1, Math.max(0, (clientX - rect.left + scrollLeft) / width)),
			y: Math.min(1, Math.max(0, (clientY - rect.top + scrollTop) / height))
		};
	}

	function point(
		registration: SurfaceRegistration,
		x: number,
		y: number
	): { x: number; y: number } {
		if (registration.space === 'visible') {
			const bounds = visibleBounds(registration.node);
			if (!bounds) return { x: Number.NaN, y: Number.NaN };
			return { x: bounds.left + x * bounds.width, y: bounds.top + y * bounds.height };
		}
		const rect = registration.node.getBoundingClientRect();
		const width = registration.space === 'scroll' ? registration.node.scrollWidth : rect.width;
		const height = registration.space === 'scroll' ? registration.node.scrollHeight : rect.height;
		const scrollLeft = registration.space === 'scroll' ? registration.node.scrollLeft : 0;
		const scrollTop = registration.space === 'scroll' ? registration.node.scrollTop : 0;
		return {
			x: rect.left + x * width - scrollLeft,
			y: rect.top + y * height - scrollTop
		};
	}

	function visibleBounds(node: HTMLElement): {
		left: number;
		top: number;
		right: number;
		bottom: number;
		width: number;
		height: number;
	} | null {
		const viewport = window.visualViewport;
		const rect = node.getBoundingClientRect();
		const viewportLeft = viewport?.offsetLeft ?? 0;
		const viewportTop = viewport?.offsetTop ?? 0;
		let left = Math.max(viewportLeft, rect.left);
		let top = Math.max(viewportTop, rect.top);
		let right = Math.min(viewportLeft + (viewport?.width ?? window.innerWidth), rect.right);
		let bottom = Math.min(viewportTop + (viewport?.height ?? window.innerHeight), rect.bottom);
		for (let current = node.parentElement; current; current = current.parentElement) {
			const style = getComputedStyle(current);
			if (
				!/(auto|scroll|hidden|clip)/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)
			) {
				continue;
			}
			const rect = current.getBoundingClientRect();
			left = Math.max(left, rect.left);
			top = Math.max(top, rect.top);
			right = Math.min(right, rect.right);
			bottom = Math.min(bottom, rect.bottom);
		}
		if (right <= left || bottom <= top) return null;
		return { left, top, right, bottom, width: right - left, height: bottom - top };
	}

	function isVisible(node: HTMLElement, x: number, y: number): boolean {
		const bounds = visibleBounds(node);
		if (!bounds) return false;
		return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
	}

	return {
		surface:
			(options = {}) =>
			(node) =>
				register(surfaces, options.id ?? DEFAULT_SURFACE_ID, {
					node,
					space: options.space ?? 'box'
				}),
		region: (options) => (node) =>
			register(regions, options.id, {
				node,
				space: options.space ?? 'box',
				surfaceId: options.surfaceId ?? DEFAULT_SURFACE_ID
			}),
		capture(event) {
			const hit = document.elementFromPoint(event.clientX, event.clientY);
			if (!hit) return null;
			let surfaceEntry: [string, SurfaceRegistration] | undefined;
			for (const entry of surfaces) {
				if (!entry[1].node.contains(hit)) continue;
				if (!surfaceEntry || surfaceEntry[1].node.contains(entry[1].node)) surfaceEntry = entry;
			}
			if (!surfaceEntry) return null;
			let regionEntry: [string, SurfaceRegistration & { surfaceId: string }] | undefined;
			for (const entry of regions) {
				if (entry[1].surfaceId !== surfaceEntry[0] || !entry[1].node.contains(hit)) continue;
				if (!regionEntry || regionEntry[1].node.contains(entry[1].node)) regionEntry = entry;
			}
			if (regionEntry) {
				const value = coordinates(regionEntry[1], event.clientX, event.clientY);
				return value
					? {
							kind: 'region',
							surfaceId: surfaceEntry[0],
							regionId: regionEntry[0],
							...value
						}
					: null;
			}
			const value = coordinates(surfaceEntry[1], event.clientX, event.clientY);
			return value
				? {
						kind: 'surface',
						surfaceId: surfaceEntry[0],
						layout: presenceSurfaceLayout(window.innerWidth),
						...value
					}
				: null;
		},
		resolve(pointer) {
			const registration =
				pointer.kind === 'region' ? regions.get(pointer.regionId) : surfaces.get(pointer.surfaceId);
			if (!registration) return null;
			if ('surfaceId' in registration && registration.surfaceId !== pointer.surfaceId) return null;
			if (
				pointer.kind === 'surface' &&
				pointer.layout !== presenceSurfaceLayout(window.innerWidth)
			) {
				return null;
			}
			const resolved = point(registration, pointer.x, pointer.y);
			if (!isVisible(registration.node, resolved.x, resolved.y)) return null;
			return {
				...resolved,
				regionId: pointer.kind === 'region' ? pointer.regionId : null
			};
		},
		close() {
			surfaces.clear();
			regions.clear();
		}
	};
}

export function setPresenceSurfaceRegistry(registry: PresenceSurfaceRegistry): void {
	setContext(contextKey, registry);
}

export function createPresenceRegionAttachment(options: {
	id: string | (() => string);
	surfaceId?: string;
	space?: PresenceCoordinateSpace | (() => PresenceCoordinateSpace);
}): Attachment<HTMLElement> {
	const registry = getContext<PresenceSurfaceRegistry | undefined>(contextKey);
	return registry
		? (node) =>
				registry.region({
					...options,
					id: typeof options.id === 'function' ? options.id() : options.id,
					space: typeof options.space === 'function' ? options.space() : options.space
				})(node)
		: () => undefined;
}
