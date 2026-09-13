export async function withProjectLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
	if (!navigator.locks) return operation();
	return await navigator.locks.request(
		`digitable-automerge:${name}`,
		{ mode: 'exclusive' },
		operation
	);
}
