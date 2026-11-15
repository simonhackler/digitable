import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

type FixtureFile = { dest: string; base64: string };

const projects = fileURLToPath(new URL('../../projects/', import.meta.url));
const excluded = new Set(['.automerge', 'feedback', 'tts-export', 'system', 'files']);
const fixtures = new Map<string, Promise<FixtureFile[]>>();

async function readDirectory(
	directory: string,
	destination: string,
	includeFileAssets: boolean
): Promise<FixtureFile[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries
			.filter(
				(entry) => !excluded.has(entry.name) && (includeFileAssets || entry.name !== 'assets')
			)
			.map(async (entry) => {
				const source = join(directory, entry.name);
				const dest = `${destination}/${entry.name}`;
				if (entry.isDirectory()) return readDirectory(source, dest, includeFileAssets);
				return { dest, base64: await readFile(source, 'base64') };
			})
	);
	return files.flat();
}

// Source fixtures are immutable during a run; browser writes always go to fresh OPFS storage.
export function projectFiles(project: string, includeFileAssets: boolean) {
	const key = `${project}:${includeFileAssets}`;
	const cached = fixtures.get(key);
	if (cached) return cached;
	const files = readDirectory(join(projects, project), `/${project}`, includeFileAssets);
	fixtures.set(key, files);
	return files;
}
