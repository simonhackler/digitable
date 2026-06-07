import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import { logWarn } from '$lib/server/otel-log';
import {
	DEFAULT_PLAYTEST_BYTE_LIMIT,
	getPlaytestProjectSize,
	parsePositiveByteCount
} from '$lib/server/playtest-project-size';
import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { tryAsync, type Result } from 'wellcrafted/result';
import type {
	IncomingPlaytestFile,
	LoadedPlaytestProject,
	PlaytestMetadata
} from './playtest-storage';

type PlaytestCacheMetadata = {
	version: 1;
	playtestId: string;
	projectSizeBytes: number;
	cachedAt: string;
	lastAccessedAt: string;
	metadata: PlaytestMetadata;
};

type CacheEntryInfo = {
	entryDir: string;
	lastAccessedAt: string;
	playtestId: string | null;
	sizeBytes: number;
	valid: boolean;
};

type LoadPlaytestProject = (playtestId: string) => Promise<LoadedPlaytestProject | null>;

const PlaytestCacheError = defineErrors({
	ReadFailed: ({ playtestId, cause }: { playtestId: string; cause: unknown }) => ({
		message: `Could not read playtest ${playtestId} from the local cache: ${extractErrorMessage(cause)}`,
		playtestId,
		cause
	}),

	WriteFailed: ({ playtestId, cause }: { playtestId: string; cause: unknown }) => ({
		message: `Could not write playtest ${playtestId} to the local cache: ${extractErrorMessage(cause)}`,
		playtestId,
		cause
	})
});
export type PlaytestCacheError = InferErrors<typeof PlaytestCacheError>;
type PlaytestCacheResult<T> = Result<T, PlaytestCacheError>;

const inFlightProjectLoads = new Map<string, Promise<LoadedPlaytestProject | null>>();

const PLAYTEST_CACHE_METADATA_FILE = 'cache-metadata.json';
const PLAYTEST_CACHE_FILES_DIR = 'files';

function getPlaytestDownloadCacheMaxBytes(): number {
	return parsePositiveByteCount(
		env.PLAYTEST_PROJECT_DOWNLOAD_CACHE_MAX_BYTES,
		'PLAYTEST_PROJECT_DOWNLOAD_CACHE_MAX_BYTES',
		DEFAULT_PLAYTEST_BYTE_LIMIT
	);
}

function getPlaytestDownloadCacheDir(): string {
	const configured = env.PLAYTEST_PROJECT_DOWNLOAD_CACHE_DIR;
	if (configured === undefined) {
		return path.join(tmpdir(), 'digitable-playtest-cache');
	}

	if (configured.trim().length === 0) {
		throw new Error('PLAYTEST_PROJECT_DOWNLOAD_CACHE_DIR must not be empty');
	}

	return path.resolve(configured);
}

function normalizeProjectPath(path: string): string {
	const normalized = path.replace(/\\/g, '/');
	const parts = normalized.split('/');

	if (
		!normalized ||
		normalized.startsWith('/') ||
		parts.some((part) => part === '' || part === '.' || part === '..')
	) {
		throw new Error(`Invalid project file path: ${path}`);
	}

	return parts.join('/');
}

function normalizePlaytestId(playtestId: string): string {
	if (!/^[0-9a-f-]{36}$/i.test(playtestId)) {
		throw new Error('Invalid playtest id');
	}
	return playtestId;
}

function clonePlaytestProject(project: LoadedPlaytestProject | null): LoadedPlaytestProject | null {
	if (!project) return null;

	return {
		metadata: {
			...project.metadata,
			files: project.metadata.files.map((file) => ({ ...file }))
		},
		files: project.files.map((file) => ({ ...file }))
	};
}

function normalizeLoadedPlaytestProject(project: LoadedPlaytestProject): LoadedPlaytestProject {
	const playtestId = normalizePlaytestId(project.metadata.id);
	const files = project.files.map((file) => ({
		path: normalizeProjectPath(file.path),
		contentBase64: file.contentBase64,
		contentType: file.contentType || 'application/octet-stream',
		size: file.size
	}));

	getPlaytestProjectSize(files);

	return {
		metadata: {
			...project.metadata,
			id: playtestId,
			files: files.map(({ path, contentType, size }) => ({ path, contentType, size }))
		},
		files
	};
}

function cacheEntryDir(playtestId: string): string {
	return path.join(getPlaytestDownloadCacheDir(), normalizePlaytestId(playtestId));
}

function cacheMetadataPath(entryDir: string): string {
	return path.join(entryDir, PLAYTEST_CACHE_METADATA_FILE);
}

function cacheFilePath(entryDir: string, projectPath: string): string {
	return path.join(
		entryDir,
		PLAYTEST_CACHE_FILES_DIR,
		...normalizeProjectPath(projectPath).split('/')
	);
}

function isNotFoundError(cause: unknown): boolean {
	return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT';
}

async function readTextFileOrNull(filePath: string): Promise<string | null> {
	try {
		return await readFile(filePath, 'utf8');
	} catch (cause) {
		if (!isNotFoundError(cause)) throw cause;
		return null;
	}
}

async function readBinaryFileOrNull(filePath: string): Promise<Buffer | null> {
	try {
		return await readFile(filePath);
	} catch (cause) {
		if (!isNotFoundError(cause)) throw cause;
		return null;
	}
}

async function readDirectoryEntries(directory: string) {
	try {
		return await readdir(directory, { withFileTypes: true });
	} catch (cause) {
		if (!isNotFoundError(cause)) throw cause;
		return [];
	}
}

async function fileSize(filePath: string): Promise<number> {
	try {
		return (await stat(filePath)).size;
	} catch (cause) {
		if (!isNotFoundError(cause)) throw cause;
		return 0;
	}
}

async function removeDirectoryIfExists(directory: string): Promise<void> {
	try {
		await rm(directory, { recursive: true, force: true });
	} catch {
		// Best-effort cleanup must not hide the original cache write error.
	}
}

function parseCacheMetadata(value: string): PlaytestCacheMetadata | null {
	let metadata: unknown;
	try {
		metadata = JSON.parse(value);
	} catch {
		return null;
	}

	if (!metadata || typeof metadata !== 'object') return null;

	const input = metadata as Partial<PlaytestCacheMetadata>;
	if (
		input.version !== 1 ||
		typeof input.playtestId !== 'string' ||
		typeof input.projectSizeBytes !== 'number' ||
		typeof input.cachedAt !== 'string' ||
		typeof input.lastAccessedAt !== 'string' ||
		!input.metadata ||
		typeof input.metadata !== 'object' ||
		!Array.isArray(input.metadata.files)
	) {
		return null;
	}

	return input as PlaytestCacheMetadata;
}

async function readCacheMetadata(entryDir: string): Promise<PlaytestCacheMetadata | null> {
	const metadataJson = await readTextFileOrNull(cacheMetadataPath(entryDir));
	if (metadataJson === null) return null;
	return parseCacheMetadata(metadataJson);
}

async function directorySize(directory: string): Promise<number> {
	let size = 0;
	for (const entry of await readDirectoryEntries(directory)) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			size += await directorySize(entryPath);
			continue;
		}

		if (!entry.isFile()) continue;
		size += await fileSize(entryPath);
	}

	return size;
}

async function listCacheEntries(): Promise<CacheEntryInfo[]> {
	const cacheDir = getPlaytestDownloadCacheDir();

	const entries: CacheEntryInfo[] = [];
	for (const entry of await readDirectoryEntries(cacheDir)) {
		if (!entry.isDirectory()) continue;

		const entryDir = path.join(cacheDir, entry.name);
		const metadata = await readCacheMetadata(entryDir);
		if (!metadata) {
			entries.push({
				entryDir,
				lastAccessedAt: '',
				playtestId: null,
				sizeBytes: await directorySize(entryDir),
				valid: false
			});
			continue;
		}

		entries.push({
			entryDir,
			lastAccessedAt: metadata.lastAccessedAt,
			playtestId: metadata.playtestId,
			sizeBytes: metadata.projectSizeBytes,
			valid: true
		});
	}

	return entries;
}

async function makeRoomForCacheEntry(input: {
	playtestId: string;
	sizeBytes: number;
	maxBytes: number;
}): Promise<boolean> {
	if (input.sizeBytes > input.maxBytes) return false;

	const entries = await listCacheEntries();
	let currentSize = entries.reduce(
		(total, entry) => total + (entry.playtestId === input.playtestId ? 0 : entry.sizeBytes),
		0
	);

	if (currentSize + input.sizeBytes <= input.maxBytes) return true;

	const removableEntries = entries
		.filter((entry) => entry.playtestId !== input.playtestId)
		.sort((a, b) => {
			if (a.valid !== b.valid) return a.valid ? 1 : -1;
			return a.lastAccessedAt.localeCompare(b.lastAccessedAt);
		});

	for (const entry of removableEntries) {
		await rm(entry.entryDir, { recursive: true, force: true });
		currentSize -= entry.sizeBytes;
		if (currentSize + input.sizeBytes <= input.maxBytes) return true;
	}

	return currentSize + input.sizeBytes <= input.maxBytes;
}

async function touchCachedPlaytest(
	entryDir: string,
	metadata: PlaytestCacheMetadata
): Promise<void> {
	await writeFile(
		cacheMetadataPath(entryDir),
		JSON.stringify(
			{
				...metadata,
				lastAccessedAt: new Date().toISOString()
			},
			null,
			2
		)
	);
}

export function logPlaytestCacheError(error: PlaytestCacheError): void {
	logWarn('playtest cache error', {
		'error.name': error.name,
		'error.message': error.message,
		'playtest.id': error.playtestId
	});
}

async function readCachedPlaytestProject(
	playtestId: string
): Promise<LoadedPlaytestProject | null> {
	const normalizedPlaytestId = normalizePlaytestId(playtestId);
	const entryDir = cacheEntryDir(normalizedPlaytestId);
	const cacheMetadata = await readCacheMetadata(entryDir);
	if (!cacheMetadata || cacheMetadata.playtestId !== normalizedPlaytestId) return null;

	const files: IncomingPlaytestFile[] = [];
	for (const file of cacheMetadata.metadata.files) {
		const projectPath = normalizeProjectPath(file.path);
		const bytes = await readBinaryFileOrNull(cacheFilePath(entryDir, projectPath));

		if (bytes === null || bytes.byteLength !== file.size) return null;

		files.push({
			...file,
			path: projectPath,
			contentBase64: bytes.toString('base64')
		});
	}

	await touchCachedPlaytest(entryDir, cacheMetadata);

	return normalizeLoadedPlaytestProject({
		metadata: cacheMetadata.metadata,
		files
	});
}

async function readPlaytestProjectCache(
	playtestId: string
): Promise<PlaytestCacheResult<LoadedPlaytestProject | null>> {
	const normalizedPlaytestId = normalizePlaytestId(playtestId);
	return tryAsync({
		try: () => readCachedPlaytestProject(normalizedPlaytestId),
		catch: (cause) =>
			PlaytestCacheError.ReadFailed({
				playtestId: normalizedPlaytestId,
				cause
			})
	});
}

async function writePlaytestProjectCacheFiles(project: LoadedPlaytestProject): Promise<void> {
	const normalized = normalizeLoadedPlaytestProject(project);
	const playtestId = normalized.metadata.id;
	const projectSizeBytes = getPlaytestProjectSize(normalized.metadata.files);
	const maxBytes = getPlaytestDownloadCacheMaxBytes();
	if (projectSizeBytes > maxBytes) return;

	const cacheDir = getPlaytestDownloadCacheDir();
	await mkdir(cacheDir, { recursive: true });
	const hasRoom = await makeRoomForCacheEntry({
		playtestId,
		sizeBytes: projectSizeBytes,
		maxBytes
	});
	if (!hasRoom) return;

	const now = new Date().toISOString();
	const entryDir = cacheEntryDir(playtestId);
	const tempDir = path.join(
		cacheDir,
		`.${playtestId}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
	);

	let cacheWritten = false;
	try {
		await rm(tempDir, { recursive: true, force: true });
		await mkdir(path.join(tempDir, PLAYTEST_CACHE_FILES_DIR), { recursive: true });

		for (const file of normalized.files) {
			const bytes = Buffer.from(file.contentBase64, 'base64');
			if (bytes.byteLength !== file.size) {
				throw new Error(`Invalid content length for playtest file: ${file.path}`);
			}

			const destination = cacheFilePath(tempDir, file.path);
			await mkdir(path.dirname(destination), { recursive: true });
			await writeFile(destination, bytes);
		}

		const cacheMetadata: PlaytestCacheMetadata = {
			version: 1,
			playtestId,
			projectSizeBytes,
			cachedAt: now,
			lastAccessedAt: now,
			metadata: normalized.metadata
		};
		await writeFile(cacheMetadataPath(tempDir), JSON.stringify(cacheMetadata, null, 2));
		await rm(entryDir, { recursive: true, force: true });
		await rename(tempDir, entryDir);
		cacheWritten = true;
	} finally {
		if (!cacheWritten) {
			await removeDirectoryIfExists(tempDir);
		}
	}
}

export async function writePlaytestProjectCache(
	project: LoadedPlaytestProject
): Promise<PlaytestCacheResult<void>> {
	return tryAsync({
		try: () => writePlaytestProjectCacheFiles(project),
		catch: (cause) =>
			PlaytestCacheError.WriteFailed({
				playtestId: project.metadata.id,
				cause
			})
	});
}

async function loadPlaytestProjectUncached(
	playtestId: string,
	loadFromSource: LoadPlaytestProject
): Promise<LoadedPlaytestProject | null> {
	const cached = await readPlaytestProjectCache(playtestId);
	if (cached.error !== null) {
		logPlaytestCacheError(cached.error);
	} else if (cached.data) {
		return cached.data;
	}

	const project = await loadFromSource(playtestId);
	if (!project) return null;

	const cachedProject = await writePlaytestProjectCache(project);
	if (cachedProject.error !== null) {
		logPlaytestCacheError(cachedProject.error);
	}

	return project;
}

export function createPlaytestProjectCacheLoader(
	loadFromSource: LoadPlaytestProject
): LoadPlaytestProject {
	return async (playtestId) => {
		const normalizedPlaytestId = normalizePlaytestId(playtestId);
		const existingLoad = inFlightProjectLoads.get(normalizedPlaytestId);
		if (existingLoad) {
			return clonePlaytestProject(await existingLoad);
		}

		const load = loadPlaytestProjectUncached(normalizedPlaytestId, loadFromSource);
		inFlightProjectLoads.set(normalizedPlaytestId, load);

		try {
			return clonePlaytestProject(await load);
		} finally {
			if (inFlightProjectLoads.get(normalizedPlaytestId) === load) {
				inFlightProjectLoads.delete(normalizedPlaytestId);
			}
		}
	};
}
