import {
	CreateBucketCommand,
	GetObjectCommand,
	HeadBucketCommand,
	ListObjectsV2Command,
	NoSuchKey,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';
import {
	createPlaytestProjectCacheLoader,
	logPlaytestCacheError,
	writePlaytestProjectCache
} from '$lib/server/playtest-project-cache';
import {
	formatByteLimit,
	getPlaytestProjectMaxBytes,
	getPlaytestProjectSize
} from '$lib/server/playtest-project-size';

export type StoredPlaytestFile = {
	path: string;
	contentType: string;
	size: number;
};

export type PlaytestMetadata = {
	version: 1;
	id: string;
	projectName: string;
	privateRoomId: string;
	createdByUserId: string;
	createdAt: string;
	files: StoredPlaytestFile[];
};

export type IncomingPlaytestFile = StoredPlaytestFile & {
	contentBase64: string;
};

export type PlaytestFeedback = {
	id: string;
	playtestId: string;
	title: string;
	authorUserId: string;
	authorName: string;
	submittedAt: string;
	markdown: string;
	fileName: string;
};

export type LoadedPlaytestProject = {
	metadata: PlaytestMetadata;
	files: IncomingPlaytestFile[];
};

let bucketReady: Promise<void> | null = null;

function required(value: string | undefined, name: string): string {
	if (!value) {
		throw new Error(`${name} is not configured`);
	}
	return value;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined) return fallback;
	return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function awsErrorName(cause: unknown): string | undefined {
	return typeof cause === 'object' && cause !== null && 'name' in cause
		? String(cause.name)
		: undefined;
}

function awsErrorStatus(cause: unknown): number | undefined {
	if (typeof cause !== 'object' || cause === null || !('$metadata' in cause)) return undefined;

	const metadata = cause.$metadata;
	if (typeof metadata !== 'object' || metadata === null || !('httpStatusCode' in metadata)) {
		return undefined;
	}

	return typeof metadata.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
}

function isMissingBucketError(cause: unknown): boolean {
	return (
		awsErrorName(cause) === 'NotFound' ||
		awsErrorName(cause) === 'NoSuchBucket' ||
		awsErrorStatus(cause) === 404
	);
}

function isNoSuchKeyError(cause: unknown): boolean {
	return cause instanceof NoSuchKey || awsErrorName(cause) === 'NoSuchKey';
}

export function validateS3AccessKeyId(accessKeyId: string | undefined): void {
	if (accessKeyId === undefined) return;

	if (accessKeyId.trim() !== accessKeyId || accessKeyId.length === 0) {
		throw new Error('S3_ACCESS_KEY_ID must not be empty or contain surrounding whitespace');
	}

	if (!/^[A-Za-z0-9]+$/.test(accessKeyId)) {
		throw new Error('S3_ACCESS_KEY_ID must be the provider key id, not a display name');
	}
}

function getEndpoint() {
	const s3Endpoint = env.S3_ENDPOINT;
	const minioPort = env.MINIO_PORT;
	const minioConsolePort = env.MINIO_CONSOLE_PORT;

	if (!s3Endpoint) {
		return env.MINIO_PORT ? `http://127.0.0.1:${env.MINIO_PORT}` : undefined;
	}

	if (minioPort && minioConsolePort) {
		try {
			const url = new URL(s3Endpoint);
			if (url.hostname === '127.0.0.1' && url.port === minioConsolePort) {
				url.port = minioPort;
				return url.toString();
			}
		} catch {
			return s3Endpoint;
		}
	}

	return s3Endpoint;
}

function getS3Config() {
	const endpoint = getEndpoint();
	const accessKeyId = env.S3_ACCESS_KEY_ID ?? env.MINIO_ROOT_USER;
	const secretAccessKey = env.S3_SECRET_ACCESS_KEY ?? env.MINIO_ROOT_PASSWORD;

	validateS3AccessKeyId(accessKeyId);

	return {
		bucket: required(env.S3_BUCKET, 'S3_BUCKET'),
		client: new S3Client({
			endpoint,
			region: env.S3_REGION ?? env.MINIO_REGION ?? 'us-east-1',
			forcePathStyle: parseBoolean(env.S3_FORCE_PATH_STYLE, Boolean(endpoint)),
			credentials:
				accessKeyId && secretAccessKey
					? {
							accessKeyId,
							secretAccessKey
						}
					: undefined
		})
	};
}

async function ensureBucket() {
	const { bucket, client } = getS3Config();
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }));
	} catch (cause) {
		if (!isMissingBucketError(cause)) throw cause;
		await client.send(new CreateBucketCommand({ Bucket: bucket }));
	}
}

async function ensureBucketOnce() {
	bucketReady ??= ensureBucket();
	await bucketReady;
}

function projectPrefix(playtestId: string) {
	return `playtests/${playtestId}/v1/project`;
}

function metadataKey(playtestId: string) {
	return `playtests/${playtestId}/metadata.json`;
}

function feedbackPrefix(playtestId: string) {
	return `playtests/${playtestId}/v1/feedback`;
}

function normalizeProjectPath(path: string): string {
	const normalized = path.replace(/\\/g, '/');
	const parts = normalized.split('/');

	if (
		!normalized ||
		normalized.startsWith('/') ||
		parts.some((part) => part === '' || part === '.' || part === '..')
	) {
		throw new Error(`Invalid project file path: ${path}`);
	}

	return parts.join('/');
}

function normalizePlaytestId(playtestId: string): string {
	if (!/^[0-9a-f-]{36}$/i.test(playtestId)) {
		throw new Error('Invalid playtest id');
	}
	return playtestId;
}

function sanitizeText(value: string, maxLength: number): string {
	return value
		.replace(/\r\n?/g, '\n')
		.replace(/[^\S\n\t ]+/g, ' ')
		.replace(/[\s\S]/g, (character) => {
			const code = character.charCodeAt(0);
			return code === 127 || (code < 32 && code !== 9 && code !== 10) ? '' : character;
		})
		.slice(0, maxLength)
		.trim();
}

function sanitizeTitle(title: string): string {
	const sanitized = sanitizeText(title, 120).replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return sanitized || 'Playtest note';
}

function safeFilePart(value: string): string {
	const safe = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return safe || 'note';
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function feedbackMarkdown(feedback: PlaytestFeedback): string {
	return [
		'---',
		`id: ${yamlString(feedback.id)}`,
		`playtestId: ${yamlString(feedback.playtestId)}`,
		`title: ${yamlString(feedback.title)}`,
		`authorUserId: ${yamlString(feedback.authorUserId)}`,
		`authorName: ${yamlString(feedback.authorName)}`,
		`submittedAt: ${yamlString(feedback.submittedAt)}`,
		'---',
		'',
		feedback.markdown,
		''
	].join('\n');
}

function parseFeedbackMarkdown(key: string, body: string): PlaytestFeedback | null {
	const match = body.match(/^---\n(?<frontmatter>[\s\S]*?)\n---\n\n?(?<markdown>[\s\S]*)$/);
	if (!match?.groups) return null;

	const metadata = new Map<string, string>();
	for (const line of match.groups.frontmatter.split('\n')) {
		const separator = line.indexOf(':');
		if (separator === -1) continue;
		const name = line.slice(0, separator).trim();
		const rawValue = line.slice(separator + 1).trim();
		try {
			const parsed = JSON.parse(rawValue);
			metadata.set(name, typeof parsed === 'string' ? parsed : rawValue);
		} catch {
			metadata.set(name, rawValue);
		}
	}

	const id = metadata.get('id');
	const playtestId = metadata.get('playtestId');
	const submittedAt = metadata.get('submittedAt');
	if (!id || !playtestId || !submittedAt) return null;

	const feedback: PlaytestFeedback = {
		id,
		playtestId,
		title: metadata.get('title') ?? 'Playtest note',
		authorUserId: metadata.get('authorUserId') ?? '',
		authorName: metadata.get('authorName') ?? '',
		submittedAt,
		markdown: match.groups.markdown.trimEnd(),
		fileName: key.split('/').at(-1) ?? `${id}.md`
	};

	return {
		...feedback,
		markdown: feedbackMarkdown(feedback)
	};
}

export async function savePlaytestProject(input: {
	metadata: PlaytestMetadata;
	files: IncomingPlaytestFile[];
}) {
	await ensureBucketOnce();
	const { bucket, client } = getS3Config();
	const playtestId = normalizePlaytestId(input.metadata.id);
	const prefix = projectPrefix(playtestId);
	const files = input.files.map((file) => ({
		...file,
		path: normalizeProjectPath(file.path),
		contentType: file.contentType || 'application/octet-stream'
	}));
	const metadata: PlaytestMetadata = {
		...input.metadata,
		id: playtestId,
		files: files.map(({ path, contentType, size }) => ({ path, contentType, size }))
	};
	const maxProjectBytes = getPlaytestProjectMaxBytes();
	const projectSize = getPlaytestProjectSize(files);
	if (projectSize >= maxProjectBytes) {
		throw new Error(`Playtest project must be smaller than ${formatByteLimit(maxProjectBytes)}`);
	}

	for (const file of files) {
		const body = Buffer.from(file.contentBase64, 'base64');
		if (body.byteLength !== file.size) {
			throw new Error(`Invalid content length for playtest file: ${file.path}`);
		}

		await client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: `${prefix}/${file.path}`,
				Body: body,
				ContentType: file.contentType || 'application/octet-stream'
			})
		);
	}

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: metadataKey(playtestId),
			Body: JSON.stringify(metadata, null, 2),
			ContentType: 'application/json'
		})
	);

	const cachedProject = await writePlaytestProjectCache({
		metadata,
		files
	});
	if (cachedProject.error !== null) {
		logPlaytestCacheError(cachedProject.error);
	}
}

export async function loadPlaytestMetadata(playtestId: string): Promise<PlaytestMetadata | null> {
	await ensureBucketOnce();
	const { bucket, client } = getS3Config();

	try {
		const response = await client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: metadataKey(normalizePlaytestId(playtestId))
			})
		);
		const body = await response.Body?.transformToString();
		return body ? (JSON.parse(body) as PlaytestMetadata) : null;
	} catch (cause) {
		if (isNoSuchKeyError(cause)) return null;
		throw cause;
	}
}

async function loadPlaytestProjectFromS3(
	playtestId: string
): Promise<LoadedPlaytestProject | null> {
	const metadata = await loadPlaytestMetadata(playtestId);
	if (!metadata) return null;

	const { bucket, client } = getS3Config();
	const prefix = projectPrefix(normalizePlaytestId(playtestId));
	const files: IncomingPlaytestFile[] = [];

	for (const file of metadata.files) {
		const path = normalizeProjectPath(file.path);
		const response = await client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: `${prefix}/${path}`
			})
		);
		const bytes = await response.Body?.transformToByteArray();
		if (!bytes) {
			throw new Error(`Could not read playtest file: ${path}`);
		}

		files.push({
			...file,
			path,
			contentBase64: Buffer.from(bytes).toString('base64')
		});
	}

	return {
		metadata,
		files
	};
}

export const loadPlaytestProject = createPlaytestProjectCacheLoader(loadPlaytestProjectFromS3);

export async function savePlaytestFeedback(input: {
	playtestId: string;
	id: string;
	title: string;
	markdown: string;
	authorUserId: string;
	authorName: string | null | undefined;
	submittedAt: Date;
}): Promise<PlaytestFeedback> {
	await ensureBucketOnce();
	const { bucket, client } = getS3Config();
	const playtestId = normalizePlaytestId(input.playtestId);
	const submittedAt = input.submittedAt.toISOString();
	const title = sanitizeTitle(input.title);
	const feedback: PlaytestFeedback = {
		id: input.id,
		playtestId,
		title,
		authorUserId: input.authorUserId,
		authorName: sanitizeText(input.authorName ?? '', 120),
		submittedAt,
		markdown: sanitizeText(input.markdown, 20_000).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
		fileName: `${submittedAt.replace(/[:.]/g, '-')}-${safeFilePart(title)}-${input.id.slice(0, 8)}.md`
	};

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: `${feedbackPrefix(playtestId)}/${feedback.fileName}`,
			Body: feedbackMarkdown(feedback),
			ContentType: 'text/markdown; charset=utf-8'
		})
	);

	return feedback;
}

export async function listPlaytestFeedback(playtestId: string): Promise<PlaytestFeedback[]> {
	await ensureBucketOnce();
	const { bucket, client } = getS3Config();
	const normalizedPlaytestId = normalizePlaytestId(playtestId);
	const prefix = `${feedbackPrefix(normalizedPlaytestId)}/`;
	const feedback: PlaytestFeedback[] = [];
	let continuationToken: string | undefined;

	do {
		const listed = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken
			})
		);

		for (const item of listed.Contents ?? []) {
			if (!item.Key || !item.Key.endsWith('.md')) continue;
			const response = await client.send(
				new GetObjectCommand({
					Bucket: bucket,
					Key: item.Key
				})
			);
			const body = await response.Body?.transformToString();
			if (!body) continue;
			const parsed = parseFeedbackMarkdown(item.Key, body);
			if (parsed) feedback.push(parsed);
		}

		continuationToken = listed.NextContinuationToken;
	} while (continuationToken);

	return feedback.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}
