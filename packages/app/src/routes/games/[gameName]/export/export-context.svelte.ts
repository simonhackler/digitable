import { getContext, setContext, createContext } from 'svelte';
import type { Project } from './types';

const key = 'export';

export class ProjectData {
	projects: Project[];

	constructor(projects: Project[] = []) {
		this.projects = $state(projects);
	}
}

export function setExportContext(projectData: () => ProjectData) {
	setContext(key, projectData);
}

export function getExportContext(): ProjectData {
	const contextFn = getContext<() => ProjectData>(key);
	return contextFn();
}

export const [getProjectDataContext, setProjectDataContext] =
	createContext<() => Promise<ProjectData>>();
