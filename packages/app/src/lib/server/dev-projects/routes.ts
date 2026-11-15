import { dev } from '$app/environment';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { parseFsPath } from '$lib/components/file-browser/adapters/adapter';
import { includesFsPath } from '$lib/components/file-browser/adapters/watch';

function projectsPath() {
	if (!dev || !process.env.DEV_PROJECTS_ROOT) error(404, 'Local projects are unavailable.');
	return process.env.DEV_PROJECTS_ROOT;
}

async function pathInProjects(root: string, path: string, createParents = false) {
	if (!path) return root;
	const parts = parseFsPath('read', path);
	if (parts.error) error(400, parts.error.message);

	let current = root;
	for (const [index, part] of parts.data.entries()) {
		current = join(current, part);
		const existing = await lstat(current).catch((cause: NodeJS.ErrnoException) => {
			if (cause.code === 'ENOENT' || cause.code === 'ENOTDIR') return null;
			throw cause;
		});
		if (existing?.isSymbolicLink()) error(400, 'Symlinks are not allowed in local projects.');
		if (!existing && !createParents) error(404, 'Local projects path not found.');
		if (!existing && createParents && index < parts.data.length - 1) await mkdir(current);
	}

	// Never allow an absolute path, traversal, or a symlink to escape the selected root.
	if (!current.startsWith(`${root}${sep}`)) error(400, 'Path is outside local projects.');
	return current;
}

export const GET: RequestHandler = async ({ url, request }) => {
	const root = await realpath(projectsPath());
	const path = await pathInProjects(root, url.searchParams.get('path') ?? '');
	const operation = url.searchParams.get('operation');
	if (operation === 'watch') {
		const ignore = url.searchParams.getAll('ignore');
		const encoder = new TextEncoder();
		let stop = () => {};
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				let stopped = false;
				const watcher = watch(path, { recursive: true }, (_event, filename) => {
					if (stopped) return;
					const relative = filename?.toString().split(sep).join('/');
					if (relative && includesFsPath(ignore, relative)) return;
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(relative ? [relative] : null)}\n\n`)
					);
				});
				const heartbeat = setInterval(
					() => controller.enqueue(encoder.encode(': keepalive\n\n')),
					15000
				);
				stop = () => {
					if (stopped) return;
					stopped = true;
					watcher.close();
					clearInterval(heartbeat);
					request.signal.removeEventListener('abort', stop);
				};
				watcher.on('error', (cause) => {
					stop();
					controller.error(cause);
				});
				request.signal.addEventListener('abort', stop, { once: true });
				controller.enqueue(encoder.encode(': watching\n\n'));
				if (request.signal.aborted) stop();
			},
			cancel() {
				stop();
			}
		});
		return new Response(stream, {
			headers: {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache',
				'x-accel-buffering': 'no'
			}
		});
	}
	if (operation === 'list') {
		if (!(await lstat(path)).isDirectory()) error(409, 'Expected a directory.');
		const entries = await readdir(path, { withFileTypes: true });
		return json(
			entries
				.filter((entry) => !entry.isSymbolicLink())
				.map((entry) => ({
					name: entry.name,
					kind: entry.isDirectory() ? 'directory' : 'file'
				}))
		);
	}
	if (operation === 'read') {
		return new Response(new Uint8Array(await readFile(path)), {
			headers: { 'content-type': 'application/octet-stream' }
		});
	}
	error(400, 'Unknown local projects operation.');
};

export const POST: RequestHandler = async ({ request, url }) => {
	const root = await realpath(projectsPath());
	if (request.headers.get('origin') !== url.origin) error(403, 'Invalid origin.');
	const operation = url.searchParams.get('operation');
	const path = await pathInProjects(
		root,
		url.searchParams.get('path') ?? '',
		operation === 'write' || operation === 'ensureDir'
	);
	if (operation === 'ensureDir') {
		await mkdir(path, { recursive: true });
		return json(null);
	}
	if (operation === 'write') {
		if (path === root) error(400, 'Cannot write to the projects root.');
		const temporary = join(dirname(path), `.digitable-write-${crypto.randomUUID()}`);
		try {
			await writeFile(temporary, new Uint8Array(await request.arrayBuffer()));
			await rename(temporary, path);
		} finally {
			await rm(temporary, { force: true });
		}
		return json(null);
	}
	if (operation === 'move') {
		const { target, overwrite } = (await request.json()) as { target: string; overwrite?: boolean };
		if (path === root || typeof target !== 'string' || !target) error(400, 'Invalid move path.');
		const destination = await pathInProjects(root, target, true);
		if (destination === root) error(400, 'Cannot replace the projects root.');
		if (destination === path) return json(null);
		if (destination.startsWith(`${path}${sep}`)) error(400, 'Cannot move a directory into itself.');
		if (path.startsWith(`${destination}${sep}`)) error(400, 'Cannot replace a parent directory.');
		await lstat(path);
		const existing = await lstat(destination).catch((cause: NodeJS.ErrnoException) => {
			if (cause.code === 'ENOENT') return null;
			throw cause;
		});
		if (existing && !overwrite) error(409, 'Target already exists.');
		if (existing) await rm(destination, { recursive: true });
		await rename(path, destination);
		return json(null);
	}
	error(400, 'Unknown local projects operation.');
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const root = await realpath(projectsPath());
	if (request.headers.get('origin') !== url.origin) error(403, 'Invalid origin.');
	const path = await pathInProjects(root, url.searchParams.get('path') ?? '');
	if (path === root) error(400, 'Cannot remove the projects root.');
	await rm(path, { recursive: request.headers.get('X-Recursive') === 'true' });
	return json(null);
};
