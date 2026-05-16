import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { Err, Ok, tryAsync, trySync, type Result } from 'wellcrafted/result';
import type { FsDir, FsEntry } from '$lib/components/file-browser/adapters/adapter';
import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
import { saveFolderHandle } from '$lib/components/file-browser/adapters/opfs/storage-preference';

export const PROJECTS_ROOT_MARKER = '.digitable.json';
export const PROJECTS_ROOT_SCHEMA_VERSION = 1;

export type ProjectsRootMarker = {
	schemaVersion: typeof PROJECTS_ROOT_SCHEMA_VERSION;
	lastOpenedAppVersion: string;
	updatedAt: string;
};

type ProjectsRootOptions = {
	appVersion: string;
	now?: () => Date;
};

type RootScope = 'selected' | 'saved';
type ProjectsRootRejectedReason = 'missing-marker' | 'unknown-root';

const ProjectsRootError = defineErrors({
	InspectFailed: ({ scope, cause }: { scope: RootScope; cause: unknown }) => ({
		message:
			scope === 'saved'
				? `Digitable could not inspect the saved projects folder: ${extractErrorMessage(cause)}`
				: `Digitable could not inspect the selected folder: ${extractErrorMessage(cause)}`,
		scope,
		cause
	}),

	MarkerReadFailed: ({ cause }: { cause: unknown }) => ({
		message: `Digitable could not read the .digitable.json file in the selected folder: ${extractErrorMessage(cause)}`,
		cause
	}),

	MarkerJsonInvalid: ({ cause }: { cause: unknown }) => ({
		message: `The .digitable.json file must contain valid JSON: ${extractErrorMessage(cause)}`,
		cause
	}),

	MarkerInvalid: ({ message, reason }: { message: string; reason: string }) => ({
		message,
		reason
	}),

	MarkerWriteFailed: ({ cause }: { cause: unknown }) => ({
		message: `Digitable could not write .digitable.json in the selected folder: ${extractErrorMessage(cause)}`,
		cause
	}),

	PreferenceSaveFailed: ({ cause }: { cause: unknown }) => ({
		message: `Digitable could not remember the selected projects folder: ${extractErrorMessage(cause)}`,
		cause
	}),

	Rejected: ({ message, reason }: { message: string; reason: ProjectsRootRejectedReason }) => ({
		message,
		reason
	})
});
export type ProjectsRootError = InferErrors<typeof ProjectsRootError>;
export type ProjectsRootResult = Result<void, ProjectsRootError>;
export type PickProjectsRootResult = Result<OPFSAdapter, ProjectsRootError>;

export function projectsRootMarker(options: ProjectsRootOptions): ProjectsRootMarker {
	return {
		schemaVersion: PROJECTS_ROOT_SCHEMA_VERSION,
		lastOpenedAppVersion: options.appVersion,
		updatedAt: (options.now ?? (() => new Date()))().toISOString()
	};
}

export function projectsRootMarkerJson(options: ProjectsRootOptions): string {
	return JSON.stringify(projectsRootMarker(options), null, 2);
}

export function isMissingProjectsRootMarkerError(error: ProjectsRootError): boolean {
	return error.name === 'Rejected' && error.reason === 'missing-marker';
}

function validMarker(value: unknown): value is ProjectsRootMarker {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'schemaVersion' in value &&
		'lastOpenedAppVersion' in value &&
		'updatedAt' in value &&
		value.schemaVersion === PROJECTS_ROOT_SCHEMA_VERSION &&
		typeof value.lastOpenedAppVersion === 'string' &&
		typeof value.updatedAt === 'string'
	);
}

async function listRoot(
	root: FsDir,
	scope: RootScope
): Promise<Result<FsEntry[], ProjectsRootError>> {
	const entries = await root.list();
	if (entries.error) return ProjectsRootError.InspectFailed({ scope, cause: entries.error });
	return Ok(entries.data);
}

async function readMarker(root: FsDir): Promise<ProjectsRootResult> {
	const text = await root.readText(PROJECTS_ROOT_MARKER);
	if (text.error) return ProjectsRootError.MarkerReadFailed({ cause: text.error });

	const parsed = trySync({
		try: () => JSON.parse(text.data) as unknown,
		catch: (cause) => ProjectsRootError.MarkerJsonInvalid({ cause })
	});
	if (parsed.error) return Err(parsed.error);

	if (!validMarker(parsed.data)) {
		return ProjectsRootError.MarkerInvalid({
			message: 'The .digitable.json file is not valid Digitable projects metadata.',
			reason: 'invalid-metadata'
		});
	}

	return Ok(undefined);
}

async function writeMarker(root: FsDir, options: ProjectsRootOptions): Promise<ProjectsRootResult> {
	const written = await root.write(PROJECTS_ROOT_MARKER, projectsRootMarkerJson(options));
	if (written.error) return ProjectsRootError.MarkerWriteFailed({ cause: written.error });
	return Ok(undefined);
}

async function acceptMarkedRoot(
	root: FsDir,
	options: ProjectsRootOptions
): Promise<ProjectsRootResult> {
	const marker = await readMarker(root);
	if (marker.error) return Err(marker.error);
	return writeMarker(root, options);
}

export async function preparePickedProjectsRoot(
	root: FsDir,
	options: ProjectsRootOptions
): Promise<ProjectsRootResult> {
	const entries = await listRoot(root, 'selected');
	if (entries.error) return Err(entries.error);

	const marker = entries.data.find((entry) => entry.name === PROJECTS_ROOT_MARKER);
	if (marker?.kind === 'directory') {
		return ProjectsRootError.MarkerInvalid({
			message: 'The .digitable.json workspace marker must be a file.',
			reason: 'wrong-kind'
		});
	}

	if (marker) return acceptMarkedRoot(root, options);

	if (entries.data.length === 0) return writeMarker(root, options);

	return ProjectsRootError.Rejected({
		message:
			'This folder is not a Digitable projects folder. Choose an empty folder or one with a .digitable.json file.',
		reason: 'unknown-root'
	});
}

export async function pickProjectsRoot(
	options: ProjectsRootOptions
): Promise<PickProjectsRootResult> {
	const handle = await window.showDirectoryPicker({ mode: 'readwrite' as const });
	const root = new OPFSAdapter(handle);
	const prepared = await preparePickedProjectsRoot(root, options);
	if (prepared.error) return Err(prepared.error);

	const saved = await tryAsync({
		try: async () => {
			await saveFolderHandle(handle);
		},
		catch: (cause) => ProjectsRootError.PreferenceSaveFailed({ cause })
	});
	if (saved.error) return Err(saved.error);

	return Ok(root);
}

export async function prepareSavedProjectsRoot(
	root: FsDir,
	options: ProjectsRootOptions
): Promise<ProjectsRootResult> {
	const entries = await listRoot(root, 'saved');
	if (entries.error) return Err(entries.error);

	const marker = entries.data.find((entry) => entry.name === PROJECTS_ROOT_MARKER);
	if (!marker) {
		return ProjectsRootError.Rejected({
			message: 'Pick your projects folder again. Digitable now requires a .digitable.json file.',
			reason: 'missing-marker'
		});
	}

	if (marker.kind === 'directory') {
		return ProjectsRootError.MarkerInvalid({
			message: 'The .digitable.json workspace marker must be a file.',
			reason: 'wrong-kind'
		});
	}

	return acceptMarkedRoot(root, options);
}
