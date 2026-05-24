import { type FsDir, type FsResult } from '$lib/components/file-browser/adapters/adapter';
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
	digitableVersion?: string
): Promise<FsResult<void>> {
	for (const migration of projectMigrationsForVersion(digitableVersion)) {
		const migrated = await migration.migrate(fileSystem, projectName);
		if (migrated.error) return migrated;
	}

	return { data: undefined, error: null };
}

export async function listProjectComponents(projectDir: FsDir) {
	const componentsDir = await projectDir.openDir(COMPONENTS_DIR);
	return componentsDir.error ? componentsDir : componentsDir.data.list();
}
