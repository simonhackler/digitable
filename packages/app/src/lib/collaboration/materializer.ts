import type { ProjectMemberKind } from './model';

export type MaterializerContext = {
	hash: string;
	allowMissingIds?: boolean;
};

export type MemberMaterializer<T extends object, Source = T> = {
	kind: Exclude<ProjectMemberKind, 'asset'>;
	parse(source: string, context: MaterializerContext): Source;
	apply(document: T, incoming: Source): void;
	serialize(document: T): string;
	isDocument(value: unknown): value is T;
};
