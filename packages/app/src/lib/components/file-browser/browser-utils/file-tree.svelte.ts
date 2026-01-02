import { FileLeaf, Folder, type ExplorerNode, type FileData } from './types.svelte';
import { SvelteDate } from 'svelte/reactivity';

export interface InputPath {
	pathTokens: string[];
	fileData: FileData;
}

interface BuildFolder {
	name: string;
	children: Map<string, BuildNode>;
}

type BuildNode = BuildFolder | { name: string; fileData: FileData };

// Building a tree structure from a list of paths, especially for supabase
// It is done in 2 phases, first a tree structure is built with a map for fast access and then afterwards converted to a children array
// This might be an unnecessary micro optimization.
function buildTree(filePathList: InputPath[]) {
	const root: BuildFolder = { name: 'home', children: new Map<string, BuildNode>() };
	for (const { pathTokens, fileData } of filePathList) {
		subBuild(root, pathTokens, fileData);
	}
	return root;
}

function subBuild(current: BuildFolder, pathTokens: string[], fileData: FileData) {
	for (let i = 1; i < pathTokens.length; i++) {
		const token = pathTokens[i];
		let next = current.children.get(token);

		if (!next) {
			if (i === pathTokens.length - 1) {
				next = { name: token, fileData };
			} else {
				next = { name: token, children: new Map<string, BuildNode>() };
			}
			current.children.set(token, next);
		}
		if ('children' in next) current = next;
	}
}

function convertToArray(buildNode: BuildNode, parent: Folder | null): ExplorerNode {
	if (!('children' in buildNode)) {
		return new FileLeaf(buildNode.name, parent, buildNode.fileData);
	}
	const node = new Folder(buildNode.name, parent);
	for (const child of buildNode.children.values()) {
		node.children.push(convertToArray(child, node));
	}
	return node;
}

export function buildFileTree(filePathList: InputPath[]) {
	const tree = buildTree(filePathList);
	return convertToArray(tree, null) as Folder;
}

function base64Size(b64: string) {
	return Math.ceil((b64.length * 3) / 4);
}

export async function parseStoredFileData(stored: string) {
	let dataURL: string;
	let size = 0;
	let mimetype = 'application/octet-stream';
	let updatedAt = new SvelteDate(0);
	let blob: Blob | undefined = undefined;
	let url: Promise<string> | undefined = undefined;

	try {
		const obj = JSON.parse(stored);
		if (obj?.dataURL) {
			dataURL = obj.dataURL;
			size = obj.size ?? base64Size(dataURL.split(',')[1] ?? '');
			mimetype = obj.mimetype ?? mimetype;
			updatedAt = new SvelteDate(obj.updatedAt ?? Date.now());
			blob = await (await fetch(dataURL)).blob();
			url = Promise.resolve(URL.createObjectURL(blob));
		} else {
			dataURL = stored;
			size = base64Size(dataURL.split(',')[1] ?? '');
		}
	} catch (_e) {
		console.error(_e);
		dataURL = stored;
		size = base64Size(dataURL.split(',')[1] ?? '');
	}

	return { dataURL, size, mimetype, updatedAt, blob, url };
}

export async function buildTreeFromLocalStorage(prefix: string) {
	const filePathList: {
		pathTokens: string[];
		fileData: FileData;
	}[] = [];

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)!;
		if (!key.startsWith(prefix)) continue;

		const stored = localStorage.getItem(key)!;
		const { size, mimetype, updatedAt, url, blob } = await parseStoredFileData(stored);

		const rel = key.slice(prefix.length); // strip namespace
		const pathTokens = rel.split('/');

		filePathList.push({ pathTokens, fileData: { size, mimetype, updatedAt, url, blob } });
	}

	return buildFileTree(filePathList);
}
