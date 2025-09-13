/*
	Installed from github/simonhackler/svelte-file-explorer
*/

export interface FileFunctions {
	delete: (files: string[]) => Promise<Error | null>;
	download: (
		files: string[]
	) => Promise<{ result: { path: string; data: Blob } | null; error: Error | null }[]>;
	upload: (file: File, fullFolderPath: string, overwrite?: boolean) => Promise<Error | null>;
	move: (files: { filePath: string; path: string }[]) => Promise<Error | null>;
	copy: (files: { filePath: string; path: string }[]) => Promise<Error | null>;
}

export interface FileData {
	size: number;
	mimetype: string;
	updatedAt: Date;
	url?: Promise<string>;
	blob?: Blob;
}

export abstract class ExplorerNodeBase {
	name = $state<string>('');
	parent = $state<Folder | null>(null);

	constructor(name: string, parent: Folder | null = null) {
		this.name = name;
		this.parent = parent;
	}
}

export class FileLeaf extends ExplorerNodeBase {
	fileData = $state<FileData | undefined>(undefined);
	constructor(name: string, parent: Folder | null = null, fileData?: FileData) {
		super(name, parent);
		this.fileData = fileData;
		if (this.fileData?.blob && this.fileData?.mimetype.startsWith('image')) {
			this.fileData.url = Promise.resolve(URL.createObjectURL(this.fileData.blob));
		}
	}
}

export class Folder extends ExplorerNodeBase {
	children = $state<ExplorerNode[]>([]);
	isEmpty = $derived(this.children.length === 0);

	constructor(name: string, parent: Folder | null = null, children: ExplorerNode[] = []) {
		super(name, parent);
		this.children = children;
	}
}

export type ExplorerNode = Folder | FileLeaf;

export function isFolder(node: ExplorerNode): node is Folder {
	return node instanceof Folder;
}

export function deepCopyExplorerNode(
	node: ExplorerNode,
	parent: Folder | null = null
): ExplorerNode {
	if (isFolder(node)) {
		const copyFolder = new Folder(node.name, parent);

		const newChildren: ExplorerNode[] = [];
		for (const child of node.children) {
			const childCopy = deepCopyExplorerNode(child, copyFolder);
			newChildren.push(childCopy);
		}

		copyFolder.children = newChildren;

		return copyFolder;
	} else {
		const originalData = node.fileData;
		let fileDataCopy: FileData | undefined = undefined;

		if (originalData) {
			fileDataCopy = {
				size: originalData.size,
				mimetype: originalData.mimetype,
				updatedAt: new Date(originalData.updatedAt.getTime()),
				url: originalData.url
			};
		}

		const copyFile = new FileLeaf(node.name, parent, fileDataCopy);
		return copyFile;
	}
}
