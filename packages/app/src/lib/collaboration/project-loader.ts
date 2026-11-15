/** A session-owned queue: one background task, up to four tasks for foreground requests. */
export function createProjectLoader<T>(load: (key: string) => Promise<T>) {
	const pending = new Map<
		string,
		{
			priority: boolean;
			started: boolean;
			promise: Promise<T>;
			resolve: (value: T) => void;
			reject: (cause: unknown) => void;
		}
	>();
	let running = 0;
	let stopped = false;
	function pump(): void {
		if (stopped || running >= 4) return;
		const queued = [...pending.entries()].filter(([, task]) => !task.started);
		const next =
			queued.find(([, task]) => task.priority) ?? (running === 0 ? queued[0] : undefined);
		if (!next) return;
		const [key, task] = next;
		task.started = true;
		running += 1;
		function complete(): void {
			pending.delete(key);
			running -= 1;
			pump();
		}
		void load(key).then(
			(value) => {
				complete();
				task.resolve(value);
			},
			(cause) => {
				complete();
				task.reject(cause);
			}
		);
		pump();
	}
	return {
		promote(): void {
			for (const task of pending.values()) task.priority = true;
			pump();
		},
		demote(): void {
			for (const task of pending.values()) task.priority = false;
		},
		request(key: string, priority = false): Promise<T> {
			if (stopped) return Promise.reject(new Error('The project session is closing.'));
			const existing = pending.get(key);
			if (existing) {
				existing.priority ||= priority;
				pump();
				return existing.promise;
			}
			const deferred = Promise.withResolvers<T>();
			pending.set(key, { ...deferred, priority, started: false });
			pump();
			return deferred.promise;
		},
		async close(): Promise<void> {
			stopped = true;
			for (const [key, task] of pending) {
				if (task.started) continue;
				task.reject(new Error('The project session is closing.'));
				pending.delete(key);
			}
			await Promise.allSettled([...pending.values()].map((task) => task.promise));
		}
	};
}
