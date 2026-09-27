import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import {
	serializeProjectMember,
	type ProjectMemberKind,
	type ProjectSnapshot
} from '$lib/collaboration';

export type PlaytestUploadFile = {
	path: string;
	contentBase64: string;
	contentType: string;
	size: number;
};

export type PlaytestDownloadFile = PlaytestUploadFile;

async function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== 'string') {
				reject(new Error('Unexpected file reader result'));
				return;
			}
			resolve(result.slice(result.indexOf(',') + 1));
		};
		reader.readAsDataURL(blob);
	});
}

function base64ToBytes(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function exportProjectSnapshotForPlaytest(
	snapshot: ProjectSnapshot
): Promise<PlaytestUploadFile[]> {
	const kinds: ProjectMemberKind[] = [
		'game-metadata',
		'rules',
		'component-svg',
		'component-data',
		'table-setup',
		'feedback-registry',
		'feedback-markdown',
		'asset'
	];
	const files = kinds.flatMap((kind) => snapshot.members(kind));
	return Promise.all(
		files
			.sort((a, b) => a.path.localeCompare(b.path))
			.map(async (member) => {
				const bytes = serializeProjectMember(member.kind, member.document);
				const blob = new Blob([bytesToArrayBuffer(bytes)]);
				return {
					path: member.path,
					contentBase64: await blobToBase64(blob),
					contentType: contentType(member.path),
					size: bytes.byteLength
				};
			})
	);
}

function contentType(path: string): string {
	if (path.endsWith('.svg')) return 'image/svg+xml';
	if (path.endsWith('.csv')) return 'text/csv';
	if (path.endsWith('.json')) return 'application/json';
	if (path.endsWith('.md')) return 'text/markdown';
	if (path.endsWith('.png')) return 'image/png';
	if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
	return 'application/octet-stream';
}

export function playtestImportFolderName(projectName: string, playtestId: string): string {
	const safeProjectName = projectName
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return `${safeProjectName || 'playtest'}-playtest-${playtestId.slice(0, 8)}`;
}

export function isPlaytestImportFolderName(folderName: string): boolean {
	return /-playtest-[0-9a-f]{8}$/i.test(folderName);
}

export async function importPlaytestProject(
	fsDir: FsDir,
	folderName: string,
	files: PlaytestDownloadFile[]
) {
	const existing = await fsDir.remove(folderName, { recursive: true });
	if (existing.error && existing.error.name !== 'NotFoundError') {
		throw new Error(existing.error.message);
	}

	const projectDir = await fsDir.ensureDir(folderName);
	if (projectDir.error) {
		throw new Error(projectDir.error.message);
	}

	for (const file of files) {
		const write = await fsDir.write(
			joinFsPath(folderName, file.path),
			bytesToArrayBuffer(base64ToBytes(file.contentBase64))
		);
		if (write.error) {
			throw new Error(write.error.message);
		}
	}
}
