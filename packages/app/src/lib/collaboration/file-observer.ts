export function createProjectFileObserver(
	onChange: () => void,
	options: { pollIntervalMs?: number } = {}
) {
	const pollIntervalMs = options.pollIntervalMs ?? 2000;
	const onVisibilityChange = () => {
		if (document.visibilityState === 'visible') onChange();
	};
	let interval: ReturnType<typeof setInterval> | undefined;

	return {
		start(): void {
			window.addEventListener('focus', onChange);
			document.addEventListener('visibilitychange', onVisibilityChange);
			if (pollIntervalMs > 0) interval = setInterval(onChange, pollIntervalMs);
		},
		stop(): void {
			window.removeEventListener('focus', onChange);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			if (interval) clearInterval(interval);
			interval = undefined;
		}
	};
}
