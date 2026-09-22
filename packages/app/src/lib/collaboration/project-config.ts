import { parseFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import { isValidAutomergeUrl, type AutomergeUrl, type UrlHeads } from '@automerge/automerge-repo';
import { readText, removeFile, writeFile } from './filesystem';

export const AUTOMERGE_DIR = '.automerge';
export const AUTOMERGE_STORAGE_DIR = '.automerge/storage';
export const PROJECT_CONFIG_FILE = '.automerge/config.json';
export const PENDING_BOOTSTRAP_FILE = '.automerge/pending-bootstrap.json';
export const PENDING_JOIN_FILE = '.automerge/pending-join.json';
export const PENDING_BRANCH_OPERATION_FILE = '.automerge/pending-branch-operation.json';
const PENDING_MATERIALIZATION_DIR = '.automerge/pending-materialization';

export type MaterializedState = {
	heads: UrlHeads;
	hash: string | null;
};

export type ProjectProjection = MaterializedState & {
	path: string;
	url: AutomergeUrl;
	materializeOnly?: boolean;
};

export type ProjectConfig = {
	version: 1 | 2 | 3;
	rootUrl: AutomergeUrl;
	historyUrl?: AutomergeUrl;
	branchId?: string;
	rootHeads?: UrlHeads;
	projections: Record<string, ProjectProjection>;
};

export type PendingMaterialization = {
	version: 1;
	memberId: string;
	path: string;
	before: MaterializedState;
	after: MaterializedState;
};

export type PendingBootstrap = {
	version: 1;
	sources: Record<string, string>;
	config?: ProjectConfig;
};

export type PendingJoin = {
	version: 1;
	historyUrl: AutomergeUrl;
	config?: ProjectConfig;
};

export type PendingBranchOperation = {
	version: 1;
	type: 'merge';
	sourceBranchId: string;
	targetBranchId: string;
};

export async function readProjectConfig(fs: FsDir): Promise<ProjectConfig | undefined> {
	const source = await readText(fs, PROJECT_CONFIG_FILE);
	return source === undefined ? undefined : validateConfig(parseJson(source, PROJECT_CONFIG_FILE));
}

export function writeProjectConfig(fs: FsDir, config: ProjectConfig): Promise<void> {
	return writeJson(fs, PROJECT_CONFIG_FILE, config);
}

export async function readPendingBootstrap(fs: FsDir): Promise<PendingBootstrap | undefined> {
	const source = await readText(fs, PENDING_BOOTSTRAP_FILE);
	if (source === undefined) return undefined;
	const value = parseJson(source, PENDING_BOOTSTRAP_FILE);
	if (!isObject(value) || value.version !== 1 || !isStringRecord(value.sources)) {
		throw new Error(`${PENDING_BOOTSTRAP_FILE} has an unsupported format.`);
	}
	return {
		version: 1,
		sources: value.sources,
		config: value.config === undefined ? undefined : validateConfig(value.config)
	};
}

export function writePendingBootstrap(fs: FsDir, pending: PendingBootstrap): Promise<void> {
	return writeJson(fs, PENDING_BOOTSTRAP_FILE, pending);
}

export function removePendingBootstrap(fs: FsDir): Promise<void> {
	return removeFile(fs, PENDING_BOOTSTRAP_FILE);
}

export async function readPendingJoin(fs: FsDir): Promise<PendingJoin | undefined> {
	const source = await readText(fs, PENDING_JOIN_FILE);
	if (source === undefined) return undefined;
	const value = parseJson(source, PENDING_JOIN_FILE);
	if (!isObject(value) || value.version !== 1 || !isValidAutomergeUrl(value.historyUrl)) {
		throw new Error(`${PENDING_JOIN_FILE} has an unsupported format.`);
	}
	const config = value.config === undefined ? undefined : validateConfig(value.config);
	if (config && config.historyUrl !== value.historyUrl) {
		throw new Error(`${PENDING_JOIN_FILE} does not match its project configuration.`);
	}
	return {
		version: 1,
		historyUrl: value.historyUrl,
		config
	};
}

export function writePendingJoin(fs: FsDir, pending: PendingJoin): Promise<void> {
	return writeJson(fs, PENDING_JOIN_FILE, pending);
}

export function removePendingJoin(fs: FsDir): Promise<void> {
	return removeFile(fs, PENDING_JOIN_FILE);
}

export async function readPendingBranchOperation(
	fs: FsDir
): Promise<PendingBranchOperation | undefined> {
	const source = await readText(fs, PENDING_BRANCH_OPERATION_FILE);
	if (source === undefined) return undefined;
	const value = parseJson(source, PENDING_BRANCH_OPERATION_FILE);
	if (
		!isObject(value) ||
		value.version !== 1 ||
		value.type !== 'merge' ||
		typeof value.sourceBranchId !== 'string' ||
		typeof value.targetBranchId !== 'string'
	) {
		throw new Error(`${PENDING_BRANCH_OPERATION_FILE} has an unsupported format.`);
	}
	return {
		version: 1,
		type: 'merge',
		sourceBranchId: value.sourceBranchId,
		targetBranchId: value.targetBranchId
	};
}

export function writePendingBranchOperation(
	fs: FsDir,
	pending: PendingBranchOperation
): Promise<void> {
	return writeJson(fs, PENDING_BRANCH_OPERATION_FILE, pending);
}

export function removePendingBranchOperation(fs: FsDir): Promise<void> {
	return removeFile(fs, PENDING_BRANCH_OPERATION_FILE);
}

export async function readPendingMaterialization(
	fs: FsDir,
	memberId: string
): Promise<PendingMaterialization | undefined> {
	const path = pendingMaterializationPath(memberId);
	const source = await readText(fs, path);
	if (source === undefined) return undefined;
	const value = parseJson(source, path);
	if (
		!isObject(value) ||
		value.version !== 1 ||
		value.memberId !== memberId ||
		typeof value.path !== 'string'
	) {
		throw new Error(`${path} has an unsupported format.`);
	}
	return {
		version: 1,
		memberId,
		path: value.path,
		before: validateMaterializedState(value.before),
		after: validateMaterializedState(value.after)
	};
}

export function writePendingMaterialization(
	fs: FsDir,
	pending: PendingMaterialization
): Promise<void> {
	return writeJson(fs, pendingMaterializationPath(pending.memberId), pending);
}

export function removePendingMaterialization(fs: FsDir, memberId: string): Promise<void> {
	return removeFile(fs, pendingMaterializationPath(memberId));
}

export function materializedStatesEqual(
	left: MaterializedState,
	right: MaterializedState
): boolean {
	return (
		left.hash === right.hash &&
		left.heads.length === right.heads.length &&
		left.heads.every((head) => right.heads.includes(head))
	);
}

function pendingMaterializationPath(memberId: string): string {
	if (!/^[A-Za-z0-9.$_-]+$/.test(memberId)) {
		throw new Error(`Invalid Automerge project member id: ${memberId}`);
	}
	return `${PENDING_MATERIALIZATION_DIR}/${memberId}.json`;
}

function validateConfig(value: unknown): ProjectConfig {
	if (
		!isObject(value) ||
		(value.version !== 1 && value.version !== 2 && value.version !== 3) ||
		!isValidAutomergeUrl(value.rootUrl)
	) {
		throw new Error(`${PROJECT_CONFIG_FILE} has an unsupported format.`);
	}
	if (!isObject(value.projections)) {
		throw new Error(`${PROJECT_CONFIG_FILE} has invalid projections.`);
	}

	const projections = Object.fromEntries(
		Object.entries(value.projections).map(([memberId, projection]) => {
			if (!isObject(projection) || !isValidAutomergeUrl(projection.url)) {
				throw new Error(`${PROJECT_CONFIG_FILE} has an invalid projection for ${memberId}.`);
			}
			if (typeof projection.path !== 'string' || parseFsPath('read', projection.path).error) {
				throw new Error(`${PROJECT_CONFIG_FILE} has an invalid path for ${memberId}.`);
			}
			return [
				memberId,
				{
					path: projection.path,
					url: projection.url,
					...(projection.materializeOnly === true ? { materializeOnly: true } : {}),
					...validateMaterializedState(projection)
				}
			];
		})
	);
	const rootHeads =
		value.rootHeads === undefined ? undefined : validateHeads(value.rootHeads, 'root heads');
	if (
		value.version === 3 &&
		(!isValidAutomergeUrl(value.historyUrl) || typeof value.branchId !== 'string')
	) {
		throw new Error(`${PROJECT_CONFIG_FILE} has invalid branch state.`);
	}
	return {
		version: value.version,
		rootUrl: value.rootUrl,
		...(value.historyUrl === undefined ? {} : { historyUrl: value.historyUrl as AutomergeUrl }),
		...(value.branchId === undefined ? {} : { branchId: value.branchId as string }),
		rootHeads,
		projections
	};
}

function validateMaterializedState(value: unknown): MaterializedState {
	if (
		!isObject(value) ||
		!Array.isArray(value.heads) ||
		!value.heads.every((head) => typeof head === 'string') ||
		(value.hash !== null && typeof value.hash !== 'string')
	) {
		throw new Error('Invalid materialized Automerge state.');
	}
	return { heads: value.heads as UrlHeads, hash: value.hash as string | null };
}

function validateHeads(value: unknown, label: string): UrlHeads {
	if (!Array.isArray(value) || !value.every((head) => typeof head === 'string')) {
		throw new Error(`Invalid Automerge ${label}.`);
	}
	return value as UrlHeads;
}

function parseJson(source: string, path: string): unknown {
	try {
		return JSON.parse(source);
	} catch (cause) {
		throw new Error(`${path} is not valid JSON.`, { cause });
	}
}

function writeJson(fs: FsDir, path: string, value: unknown): Promise<void> {
	return writeFile(fs, path, `${JSON.stringify(value, null, 2)}\n`);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return isObject(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
