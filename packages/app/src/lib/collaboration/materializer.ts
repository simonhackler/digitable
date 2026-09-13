import type { ProjectMemberKind } from './model';

export type MaterializerContext = {
	hash: string;
	allowMissingIds?: boolean;
};

export type MemberMaterializer<T extends object> = {
	kind: Exclude<ProjectMemberKind, 'asset'>;
	parse(source: string, context: MaterializerContext): T;
	apply(document: T, incoming: T): void;
	serialize(document: T): string;
	isDocument(value: unknown): value is T;
};
