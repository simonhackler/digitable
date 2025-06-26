/*
	Installed from github/simonhackler/svelte-file-explorer
*/

import { downloadZip } from 'client-zip';
import {
	deepCopyExplorerNode,
	FileLeaf,
	isFolder,
	type ExplorerNode,
	type FileFunctions,
	type Folder
} from './types.svelte';

export class ExplorerNodeFunctions {
	private fileFunctions: FileFunctions;
	private homeFolderPath: string;

	constructor(fileFunctions: FileFunctions, homeFolderPath: string) {
		this.fileFunctions = fileFunctions;
		this.homeFolderPath = homeFolderPath;
	}

	private getPath(node: ExplorerNode): string[] {
		const path = [node.name];
		let parent = node.parent;
		while (parent !== null) {
			path.push(parent.name);
			parent = parent.parent;
		}
		return path.reverse();
	}

	public async onUpload(file: File, uploadTo: Folder, overwrite?: boolean) {
		const error = await this.fileFunctions.upload(
			file,
			this.getPath(uploadTo).slice(1).join('/'),
			overwrite
		);
		if (error) {
			console.error(error);
			return error;
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

	private getAllFiles(node: ExplorerNode, currentPath: string): string[] {
		if (isFolder(node)) {
			const paths: string[] = [];
			for (const child of node.children) {
				const childPaths = this.getAllFiles(child, currentPath + '/' + child.name);
				paths.push(...childPaths);
			}
			return paths;
		} else {
			return [currentPath];
		}
	}

	public async deleteNodes(nodes: ExplorerNode[]) {
		console.log(nodes);
		console.log('home folder path: ');
		console.log(this.homeFolderPath);
		const allFilesToDelete: string[] = [];

		for (const node of nodes) {
			const path = this.homeFolderPath + this.getPath(node).slice(1).join('/');
			const filePaths = this.getAllFiles(node, path);
			allFilesToDelete.push(...filePaths);
		}

		const error = await this.fileFunctions.delete(allFilesToDelete);
		if (error) {
			console.error(error);
			return error;
		} else {
			const nodeNames = new Set(nodes.map((n) => n.name));
			for (const node of nodes) {
				if (node.parent) {
					node.parent.children = node.parent.children.filter((f) => !nodeNames.has(f.name));
				}
			}
		}
		return null;
	}

	private getFullPath(node: ExplorerNode): string {
		return this.homeFolderPath + this.getPath(node).slice(1).join('/');
	}

	public async downloadNodes(nodes: ExplorerNode[]) {
		const allFilesToDownload: string[] = [];

		for (const node of nodes) {
			const filePaths = this.getAllFiles(node, this.getFullPath(node));
			allFilesToDownload.push(...filePaths);
		}

		const files = await this.fileFunctions.download(allFilesToDownload);
		if (files == undefined || files instanceof Error) {
			console.error(files);
			return;
		}

		let blob: Blob;
		let downloadName: string;

		if (files.length === 1 && nodes.length === 1) {
			const file = files[0];
			if (file.result) {
				blob = file.result.data;
				downloadName = nodes[0].name;
			} else {
				throw new Error(`error when downloading file ${nodes[0].name}`);
			}
		} else {
			blob = await downloadZip(
				files.map((f) => {
					if (f.result) {
						return { name: f.result.path, input: f.result.data };
					}
					throw new Error(`error when downloading file`);
				})
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
	}

	public async moveNodes(nodes: ExplorerNode[], newParent: Folder) {
		const moveOperations = nodes.map((node) => ({
			filePath: this.getFullPath(node),
			path: this.getFullPath(newParent) + '/' + node.name
		}));

		const error = await this.fileFunctions.move(moveOperations);
		if (error) {
			console.error(error);
			return error;
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

	public async copyNodes(nodes: ExplorerNode[], newParent: Folder) {
		const copyOperations: { filePath: string; path: string }[] = [];
		const newNodes: ExplorerNode[] = [];

		for (const node of nodes) {
			const originalName = node.name;

			let baseName = originalName;
			let extension = '';
			const dotIndex = originalName.lastIndexOf('.');
			if (dotIndex !== -1) {
				baseName = originalName.substring(0, dotIndex);
				extension = originalName.substring(dotIndex);
			}

			let name = originalName;
			let i = 1;
			while (
				newParent.children.find((f) => f.name === name) ||
				newNodes.find((n) => n.name === name)
			) {
				name = `${baseName}_copy_${i}${extension}`;
				i++;
			}

			copyOperations.push({
				filePath: this.getFullPath(node),
				path: this.getFullPath(newParent) + '/' + name
			});

			const newNode = deepCopyExplorerNode(node, newParent);
			newNode.name = name;
			newNodes.push(newNode);
		}

		const error = await this.fileFunctions.copy(copyOperations);
		if (error) {
			console.error(error);
			return error;
		}

		newParent.children = [...newParent.children, ...newNodes];
		return null;
	}

	public async deleteNode(node: ExplorerNode) {
		return this.deleteNodes([node]);
	}

	public async downloadNode(node: ExplorerNode) {
		return this.downloadNodes([node]);
	}
}
