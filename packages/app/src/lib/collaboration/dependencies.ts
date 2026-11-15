import type { ProjectMemberKind, ProjectMemberPathFor } from './model';
import type { ProjectMemberRef, ProjectSnapshot } from './project-session';

export type MemberDependency<K extends ProjectMemberKind = ProjectMemberKind> = {
	type: 'member';
	kind: K;
	path: ProjectMemberPathFor<K>;
	optional: boolean;
};

export function member<K extends ProjectMemberKind>(
	kind: K,
	path: ProjectMemberPathFor<NoInfer<K>>
) {
	return { type: 'member', kind, path, optional: false } as const;
}

export function optional<K extends ProjectMemberKind>(dependency: MemberDependency<K>) {
	return { ...dependency, optional: true } as const;
}

export function collection<K extends ProjectMemberKind>(kind: K, scope: string) {
	return { type: 'collection', kind, scope } as const;
}

export function snapshot() {
	return { type: 'snapshot' } as const;
}

export type ProjectDependency =
	| MemberDependency
	| {
			type: 'collection';
			kind: ProjectMemberKind;
			scope: string;
	  }
	| { type: 'snapshot' };
export type ProjectDependencies = Record<string, ProjectDependency>;
type RequiredDocument<D extends ProjectDependency> = D extends { type: 'snapshot' }
	? ProjectSnapshot
	: D extends { type: 'collection'; kind: infer K extends ProjectMemberKind }
		? ProjectMemberRef<K>[]
		: D extends MemberDependency<infer K>
			? ProjectMemberRef<K> | (true extends D['optional'] ? undefined : never)
			: never;
export type RequiredDocuments<D extends ProjectDependencies> = {
	[P in keyof D]: RequiredDocument<D[P]>;
};
