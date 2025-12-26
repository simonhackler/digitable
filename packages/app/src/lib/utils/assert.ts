import { page } from '$app/state';

export function assert(condition: unknown, msg?: string): asserts condition {
	if (!condition) {
		throw new Error(msg ?? 'Assertion failed');
	}
}

export function requireParam<K extends keyof typeof page.params>(key: K): string {
	const value = page.params[key];
	if (value === undefined) {
		throw new Error(`Missing required route param "${String(key)}"`);
	}
	return value;
}
