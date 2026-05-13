import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';

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

async function walkFiles(
	fsDir: FsDir,
	rootPath: string,
	currentPath = ''
): Promise<PlaytestUploadFile[]> {
	const listPath = currentPath ? joinFsPath(rootPath, currentPath) : rootPath;
	const entries = listPath ? await fsDir.list(listPath) : await fsDir.list();
	if (entries.error) {
		throw new Error(entries.error.message);
	}

	const files: PlaytestUploadFile[] = [];
	for (const entry of entries.data) {
		const relativePath = currentPath ? joinFsPath(currentPath, entry.name) : entry.name;
		const sourcePath = joinFsPath(rootPath, relativePath);

		if (entry.kind === 'directory') {
			files.push(...(await walkFiles(fsDir, rootPath, relativePath)));
			continue;
		}

		const file = await fsDir.read(sourcePath);
		if (file.error) {
			throw new Error(file.error.message);
		}

		files.push({
			path: relativePath,
			contentBase64: await blobToBase64(file.data),
			contentType: file.data.type || 'application/octet-stream',
			size: file.data.size
		});
	}

	return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function exportProjectForPlaytest(
	fsDir: FsDir,
	projectName = ''
): Promise<PlaytestUploadFile[]> {
	return walkFiles(fsDir, projectName);
}

export function playtestImportFolderName(projectName: string, playtestId: string): string {
	const safeProjectName = projectName
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return `${safeProjectName || 'playtest'}-playtest-${playtestId.slice(0, 8)}`;
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
