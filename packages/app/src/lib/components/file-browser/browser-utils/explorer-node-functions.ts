import { downloadZip } from 'client-zip';
import {
	deepCopyExplorerNode,
	FileLeaf,
	isFolder,
	type ExplorerNode,
	type Folder
} from './types.svelte';
import { joinFsPath, type FsDir, type FsError } from '../adapters/adapter';

export class ExplorerNodeFunctions {
	private fsDir: FsDir;
	private homeFolderPath: string;

	constructor(fsDir: FsDir, homeFolderPath: string) {
		this.fsDir = fsDir;
		this.homeFolderPath = homeFolderPath;
	}

	public static getPath(node: ExplorerNode): string[] {
		const path = [node.name];
		let parent = node.parent;
		while (parent !== null) {
			path.push(parent.name);
			parent = parent.parent;
		}
		return path.reverse();
	}

	public async onUpload(
		file: File,
		uploadTo: Folder,
		overwrite?: boolean
	): Promise<FsError | null> {
		const folderPath = this.getFullPath(uploadTo);
		const targetDir = folderPath ? await this.fsDir.ensureDir(folderPath) : null;
		if (targetDir?.error) {
			console.error(targetDir.error);
			return targetDir.error;
		}

		if (!overwrite && uploadTo.children.some((child) => child.name === file.name)) {
			return null;
		}

		const uploaded = await (targetDir?.data ?? this.fsDir).write(file.name, file);
		if (uploaded.error) {
			console.error(uploaded.error);
			return uploaded.error;
		}

		uploadTo.children = [
			...uploadTo.children.filter((f) => f.name !== file.name),
			new FileLeaf(file.name, uploadTo, {
				mimetype: file.type,
				size: file.size,
				updatedAt: new Date(file.lastModified),
				blob: file
			})
		];

		return null;
	}

	public static getAllFiles(node: ExplorerNode, currentPath: string): string[] {
		if (isFolder(node)) {
			const paths: string[] = [];
			for (const child of node.children) {
				const childPaths = ExplorerNodeFunctions.getAllFiles(child, currentPath + '/' + child.name);
				paths.push(...childPaths);
			}
			return paths;
		} else {
			return [currentPath];
		}
	}

	public async deleteNodes(nodes: ExplorerNode[]): Promise<FsError | null> {
		const allFilesToDelete: string[] = [];
		for (const node of nodes) {
			const path = this.getFullPath(node);
			const filePaths = ExplorerNodeFunctions.getAllFiles(node, path);
			allFilesToDelete.push(...filePaths);
		}

		for (const path of allFilesToDelete) {
			const removed = await this.fsDir.remove(path);
			if (removed.error) {
				console.error(removed.error);
				return removed.error;
			}
		}

		const nodeNames = new Set(nodes.map((n) => n.name));
		for (const node of nodes) {
			if (node.parent) {
				node.parent.children = node.parent.children.filter((f) => !nodeNames.has(f.name));
			}
		}

		return null;
	}

	private getFullPath(node: ExplorerNode): string {
		return joinFsPath(this.homeFolderPath, ExplorerNodeFunctions.getPath(node).slice(1).join('/'));
	}

	public async downloadNodes(nodes: ExplorerNode[]): Promise<FsError | null> {
		const allFilesToDownload: string[] = [];

		for (const node of nodes) {
			const filePaths = ExplorerNodeFunctions.getAllFiles(node, this.getFullPath(node));
			allFilesToDownload.push(...filePaths);
		}

		const files: { path: string; data: File }[] = [];

		for (const path of allFilesToDownload) {
			const file = await this.fsDir.read(path);
			if (file.error) {
				console.error(file.error);
				return file.error;
			}
			files.push({ path, data: file.data });
		}

		let blob: Blob;
		let downloadName: string;

		if (files.length === 1 && nodes.length === 1) {
			const file = files[0];
			if (file) {
				blob = file.data;
				downloadName = nodes[0].name;
			} else {
				throw new Error(`error when downloading file ${nodes[0].name}`);
			}
		} else {
			blob = await downloadZip(
				files.map((file) => ({
					name: file.path,
					input: file.data
				}))
			).blob();
			downloadName = nodes.length === 1 ? nodes[0].name + '.zip' : 'files.zip';
		}

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = downloadName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		return null;
	}

	public async moveNodes(nodes: ExplorerNode[], newParent: Folder): Promise<FsError | null> {
		const copied = await this.copyFiles(
			nodes.map((node) => ({ node, targetName: node.name })),
			newParent
		);
		if (copied) return copied;

		for (const node of nodes) {
			const sourceFiles = ExplorerNodeFunctions.getAllFiles(node, this.getFullPath(node));
			for (const path of sourceFiles) {
				const removed = await this.fsDir.remove(path);
				if (removed.error) {
					console.error(removed.error);
					return removed.error;
				}
			}
		}

		for (const node of nodes) {
			if (node.parent) {
				node.parent.children = node.parent.children.filter((f) => f.name !== node.name);
			}
			node.parent = newParent;
		}
		newParent.children = [...newParent.children, ...nodes];
		return null;
	}

	public async copyNodes(nodes: ExplorerNode[], newParent: Folder): Promise<FsError | null> {
		const copiedNodes = this.withCopyNames(nodes, newParent);
		const copied = await this.copyFiles(copiedNodes, newParent);
		if (copied) return copied;

		const newNodes: ExplorerNode[] = [];

		for (const { node, targetName } of copiedNodes) {
			const newNode = deepCopyExplorerNode(node, newParent);
			newNode.name = targetName;
			newNodes.push(newNode);
		}

		newParent.children = [...newParent.children, ...newNodes];
		return null;
	}

	private async copyFiles(
		nodes: { node: ExplorerNode; targetName: string }[],
		newParent: Folder
	): Promise<FsError | null> {
		for (const { node, targetName } of nodes) {
			const sourceRoot = this.getFullPath(node);
			const targetRoot = joinFsPath(this.getFullPath(newParent), targetName);
			const sourceFiles = ExplorerNodeFunctions.getAllFiles(node, sourceRoot);

			for (const sourcePath of sourceFiles) {
				const relativePath = sourcePath.slice(sourceRoot.length).replace(/^\//, '');
				const targetPath = joinFsPath(targetRoot, relativePath);
				const file = await this.fsDir.read(sourcePath);
				if (file.error) {
					console.error(file.error);
					return file.error;
				}

				const parentPath = targetPath.split('/').slice(0, -1).join('/');
				const targetDir = parentPath ? await this.fsDir.ensureDir(parentPath) : null;
				if (targetDir?.error) {
					console.error(targetDir.error);
					return targetDir.error;
				}

				const written = await (targetDir?.data ?? this.fsDir).write(
					targetPath.split('/').at(-1) ?? targetPath,
					file.data
				);
				if (written.error) {
					console.error(written.error);
					return written.error;
				}
			}
		}

		return null;
	}

	private withCopyNames(
		nodes: ExplorerNode[],
		newParent: Folder
	): { node: ExplorerNode; targetName: string }[] {
		const reserved = new Set(newParent.children.map((node) => node.name));
		const copiedNodes: { node: ExplorerNode; targetName: string }[] = [];

		for (const node of nodes) {
			const targetName = this.nextCopyName(node.name, reserved);
			reserved.add(targetName);
			copiedNodes.push({ node, targetName });
		}

		return copiedNodes;
	}

	private nextCopyName(name: string, reserved: Set<string>): string {
		let baseName = name;
		let extension = '';
		const dotIndex = name.lastIndexOf('.');
		if (dotIndex !== -1) {
			baseName = name.substring(0, dotIndex);
			extension = name.substring(dotIndex);
		}

		let nextName = name;
		let i = 1;
		while (reserved.has(nextName)) {
			nextName = `${baseName}_copy_${i}${extension}`;
			i++;
		}

		return nextName;
	}

	public async deleteNode(node: ExplorerNode): Promise<FsError | null> {
		return this.deleteNodes([node]);
	}

	public async downloadNode(node: ExplorerNode): Promise<FsError | null> {
		return this.downloadNodes([node]);
	}
}
