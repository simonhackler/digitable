import type { Repo } from '@automerge/automerge-repo';
import {
	isGameMetadataDocument,
	isProjectDocument,
	type GameMetadataDocument,
	type JsonValue,
	type ProjectCheckpoint,
	type ProjectCheckpointMember,
	type ProjectComponent,
	type ProjectDocument,
	type ProjectMemberDocument
} from './model';
import { isProjectMemberDocument } from './project-graph';
import { classifyProjectFile } from './project-files';

type MemberChange = {
	id: string;
	previous?: ProjectCheckpointMember;
	next?: ProjectCheckpointMember;
};

type MemberDescription = {
	title: string;
	verb: string;
	subject: string;
};

export async function describeProjectCheckpoint(
	repo: Repo,
	previous: ProjectCheckpoint,
	next: ProjectCheckpoint
): Promise<string> {
	const [previousProject, nextProject] = await Promise.all([
		resolveCheckpointRoot(repo, previous),
		resolveCheckpointRoot(repo, next)
	]);
	const componentTitle = describeComponentStructure(previousProject, nextProject);
	if (componentTitle) return componentTitle;

	const memberIds = new Set([...Object.keys(previous.members), ...Object.keys(next.members)]);
	const changes: MemberChange[] = [...memberIds]
		.map((id) => ({ id, previous: previous.members[id], next: next.members[id] }))
		.filter(
			(change) =>
				!change.previous ||
				!change.next ||
				change.previous.kind !== change.next.kind ||
				change.previous.path !== change.next.path ||
				change.previous.url !== change.next.url ||
				change.previous.hash !== change.next.hash ||
				change.previous.componentId !== change.next.componentId ||
				!sameHeads(change.previous.heads, change.next.heads)
		);
	if (!changes.length) throw new Error('The checkpoint has no supported semantic difference.');

	const componentIds = new Set(
		changes.map((change) => change.next?.componentId ?? change.previous?.componentId)
	);
	if (changes.length > 1 && componentIds.size === 1) {
		const componentId = [...componentIds][0];
		if (componentId) {
			const component =
				nextProject.components[componentId] ?? previousProject.components[componentId];
			if (component) return `Updated deck ${quote(component.name)}`;
		}
	}

	const descriptions = await Promise.all(
		changes.map((change) => describeMemberChange(repo, previousProject, nextProject, change))
	);
	if (descriptions.length === 1) return descriptions[0].title;
	if (descriptions.length === 2) {
		const [first, second] = descriptions;
		const combined =
			first.verb === second.verb
				? `${first.verb} ${first.subject} and ${second.subject}`
				: `${first.title} and ${lowercaseFirst(second.title)}`;
		if (combined.length <= 100) return combined;
	}
	return `Updated ${changes.length} files`;
}

async function resolveCheckpointRoot(
	repo: Repo,
	checkpoint: ProjectCheckpoint
): Promise<ProjectDocument> {
	const source = await repo.find<ProjectDocument>(checkpoint.rootUrl);
	const project = source.view(checkpoint.rootHeads).doc();
	if (!isProjectDocument(project)) {
		throw new Error('The project root is unavailable at the checkpoint.');
	}
	const projectIds = Object.keys(project.members);
	const checkpointIds = Object.keys(checkpoint.members);
	if (
		projectIds.length !== checkpointIds.length ||
		projectIds.some((id) => !checkpoint.members[id])
	) {
		throw new Error('The checkpoint member manifest does not match its project root.');
	}
	for (const member of Object.values(project.members)) {
		if (member.componentId && !project.components[member.componentId]) {
			throw new Error(`Project member ${member.path} has no owning component.`);
		}
	}
	return project;
}

function describeComponentStructure(
	previous: ProjectDocument,
	next: ProjectDocument
): string | undefined {
	const previousIds = Object.keys(previous.components);
	const nextIds = Object.keys(next.components);
	const added = nextIds.filter((id) => !previous.components[id]);
	const removed = previousIds.filter((id) => !next.components[id]);
	const renamed = previousIds.filter(
		(id) => next.components[id] && previous.components[id].name !== next.components[id].name
	);
	const operations = added.length + removed.length + renamed.length;
	if (!operations) return undefined;
	if (operations !== 1) return 'Updated project structure';
	if (added.length === 1) return `Added deck ${quote(next.components[added[0]].name)}`;
	if (removed.length === 1) return `Deleted deck ${quote(previous.components[removed[0]].name)}`;
	const id = renamed[0];
	return `Renamed deck ${quote(previous.components[id].name)} to ${quote(next.components[id].name)}`;
}

async function describeMemberChange(
	repo: Repo,
	previousProject: ProjectDocument,
	nextProject: ProjectDocument,
	change: MemberChange
): Promise<MemberDescription> {
	const before = change.previous;
	const after = change.next;
	if (!before && after) {
		if (after.kind === 'asset') return description('Added', `asset ${quote(filename(after.path))}`);
		return description('Added', quote(after.path));
	}
	if (before && !after) {
		if (before.kind === 'asset') {
			return description('Deleted', `asset ${quote(filename(before.path))}`);
		}
		return description('Deleted', quote(before.path));
	}
	if (!before || !after) throw new Error('Invalid project member change.');
	if (before.path !== after.path) {
		return description('Renamed', `${quote(before.path)} to ${quote(after.path)}`);
	}
	if (after.kind === 'asset' && (before.url !== after.url || before.hash !== after.hash)) {
		return description('Replaced', `asset ${quote(filename(after.path))}`);
	}
	if (
		before.kind !== after.kind ||
		before.url !== after.url ||
		before.componentId !== after.componentId
	) {
		return description('Replaced', quote(after.path));
	}

	const [previousDocument, nextDocument] = await Promise.all([
		resolveMemberDocument(repo, before),
		resolveMemberDocument(repo, after)
	]);
	if (after.kind === 'game-metadata') {
		if (!isGameMetadataDocument(previousDocument) || !isGameMetadataDocument(nextDocument)) {
			throw new Error('The game metadata is unavailable at the checkpoint.');
		}
		return describeMetadata(previousDocument, nextDocument);
	}
	if (after.kind === 'rules') return description('Edited', 'rules');
	if (after.kind === 'table-setup') return description('Edited', 'table setup');
	if (after.kind === 'feedback-registry') return description('Updated', 'playtests');
	if (after.kind === 'feedback-markdown') {
		return description('Edited', `playtest ${quote(filename(after.path).replace(/\.md$/i, ''))}`);
	}
	if (after.kind === 'asset') {
		return description('Updated', `asset ${quote(filename(after.path))}`);
	}
	const component = componentForMember(previousProject, nextProject, after);
	if (after.kind === 'component-data' && component) {
		return description('Edited', `${quote(component.name)} spreadsheet`);
	}
	if (after.kind === 'component-svg' && component) {
		const side = classifyProjectFile(after.path)?.side;
		if (side) return description('Edited', `${quote(component.name)} ${side} layout`);
	}
	return description('Edited', quote(after.path));
}

async function resolveMemberDocument(
	repo: Repo,
	member: ProjectCheckpointMember
): Promise<ProjectMemberDocument> {
	const source = await repo.find<ProjectMemberDocument>(member.url);
	const document = source.view(member.heads).doc();
	if (!isProjectMemberDocument(member.kind, document)) {
		throw new Error(`Project member ${member.path} is unavailable at the checkpoint.`);
	}
	return document as ProjectMemberDocument;
}

function describeMetadata(
	previous: GameMetadataDocument,
	next: GameMetadataDocument
): MemberDescription {
	const changed = [
		previous.name !== next.name ? 'name' : undefined,
		previous.players.min !== next.players.min || previous.players.max !== next.players.max
			? 'players'
			: undefined,
		previous.description !== next.description ? 'description' : undefined,
		!sameStrings(previous.tags, next.tags) ? 'tags' : undefined,
		previous.digitableVersion !== next.digitableVersion ? 'digitableVersion' : undefined,
		!sameJson(previous.extra, next.extra) ? 'extra' : undefined
	].filter((field): field is string => field !== undefined);
	if (changed.length === 1 && changed[0] === 'name') {
		return description('Renamed', `game to ${quote(next.name, 80)}`);
	}
	if (changed.length === 1 && changed[0] === 'players') {
		return description('Updated', 'player count');
	}
	if (changed.length === 1 && changed[0] === 'description') {
		return description('Updated', 'game description');
	}
	if (changed.length === 1 && changed[0] === 'tags') return description('Updated', 'game tags');
	if (changed.length) return description('Updated', 'game details');
	throw new Error('The game metadata has no supported semantic difference.');
}

function componentForMember(
	previous: ProjectDocument,
	next: ProjectDocument,
	member: ProjectCheckpointMember
): ProjectComponent | undefined {
	if (member.componentId) {
		return next.components[member.componentId] ?? previous.components[member.componentId];
	}
	return undefined;
}

function description(verb: string, subject: string): MemberDescription {
	return { title: `${verb} ${subject}`, verb, subject };
}

function quote(value: string, maximum = 120): string {
	const truncated =
		value.length <= maximum ? value : `${value.slice(0, Math.max(0, maximum - 3))}...`;
	return JSON.stringify(truncated);
}

function filename(path: string): string {
	return path.split('/').at(-1) ?? path;
}

function lowercaseFirst(value: string): string {
	return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function sameHeads(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((head) => right.includes(head));
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameJson(left: JsonValue, right: JsonValue): boolean {
	if (left === right) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => sameJson(value, right[index]))
		);
	}
	if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every((key) => key in right && sameJson(left[key], right[key]))
	);
}
