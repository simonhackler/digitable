import { FsError, type FsDir, type FsResult } from '$lib/components/file-browser/adapters/adapter';
import {
	readProjectsRootMarker,
	writeProjectsRootMarker,
	PROJECTS_ROOT_MARKER
} from './projects-root';
import { withProjectLock } from '$lib/collaboration/project-lock';
import { DIGITABLE_VERSION } from './digitable-version';
import { migrateLegacyProjectLayout } from './migrations/legacy-project-layout';

export const COMPONENTS_DIR = 'components';
export const ASSETS_DIR = 'assets';

type ProjectMigration = {
	targetVersion: string;
	migrate: (fileSystem: FsDir, projectName: string) => Promise<FsResult<void>>;
};

const projectMigrations: ProjectMigration[] = [
	{
		targetVersion: '0.0.1',
		migrate: migrateLegacyProjectLayout
	}
];

export function projectMigrationsForVersion(digitableVersion?: string) {
	const currentVersionIndex = projectMigrations.findIndex(
		(migration) => migration.targetVersion === DIGITABLE_VERSION
	);
	if (currentVersionIndex === -1) return [];
	if (!digitableVersion) return projectMigrations.slice(0, currentVersionIndex + 1);

	const workspaceVersionIndex = projectMigrations.findIndex(
		(migration) => migration.targetVersion === digitableVersion
	);
	if (workspaceVersionIndex === -1) return [];

	return projectMigrations.slice(workspaceVersionIndex + 1, currentVersionIndex + 1);
}

export async function migrateProjectLayout(
	fileSystem: FsDir,
	projectName: string,
	appVersion = 'dev'
): Promise<FsResult<void>> {
	return withProjectLock(`migration:${projectName}`, async () => {
		const project = await fileSystem.openDir(projectName);
		if (project.error) return project;
		const marker = await project.data.readText(PROJECTS_ROOT_MARKER);
		if (marker.error && marker.error.name !== 'NotFoundError') return marker;
		const version = marker.error ? undefined : await readProjectsRootMarker(project.data);
		if (version?.error)
			return FsError.Failed({
				operation: 'readText',
				path: PROJECTS_ROOT_MARKER,
				cause: version.error
			});
		const current = version?.data?.digitableVersion;
		if (current === DIGITABLE_VERSION) return { data: undefined, error: null };
		if (current && !projectMigrations.some((migration) => migration.targetVersion === current)) {
			return FsError.Failed({
				operation: 'readText',
				path: PROJECTS_ROOT_MARKER,
				cause: new Error(`Unsupported project version ${current}.`)
			});
		}
		// Unmarked projects run the idempotent migration, even inside an already migrated workspace.
		for (const migration of projectMigrationsForVersion(current)) {
			const migrated = await migration.migrate(fileSystem, projectName);
			if (migrated.error) return migrated;
		}
		const written = await writeProjectsRootMarker(project.data, { appVersion });
		if (written.error)
			return FsError.Failed({
				operation: 'write',
				path: PROJECTS_ROOT_MARKER,
				cause: written.error
			});
		return { data: undefined, error: null };
	});
}

export async function listProjectComponents(projectDir: FsDir) {
	const componentsDir = await projectDir.openDir(COMPONENTS_DIR);
	return componentsDir.error ? componentsDir : componentsDir.data.list();
}
