import {
	CreateBucketCommand,
	GetObjectCommand,
	HeadBucketCommand,
	NoSuchKey,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

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
	if (!env.S3_ENDPOINT) {
		return env.MINIO_PORT ? `http://127.0.0.1:${env.MINIO_PORT}` : undefined;
	}

	if (env.MINIO_PORT && env.MINIO_CONSOLE_PORT) {
		try {
			const url = new URL(env.S3_ENDPOINT);
			if (url.hostname === '127.0.0.1' && url.port === env.MINIO_CONSOLE_PORT) {
				url.port = env.MINIO_PORT;
				return url.toString();
			}
		} catch {
			return env.S3_ENDPOINT;
		}
	}

	return env.S3_ENDPOINT;
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

export function validatePlaytestStorageConfig() {
	getS3Config();
}

async function ensureBucket() {
	const { bucket, client } = getS3Config();
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }));
	} catch {
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

export async function savePlaytestProject(input: {
	metadata: PlaytestMetadata;
	files: IncomingPlaytestFile[];
}) {
	await ensureBucketOnce();
	const { bucket, client } = getS3Config();
	const playtestId = normalizePlaytestId(input.metadata.id);
	const prefix = projectPrefix(playtestId);

	for (const file of input.files) {
		const path = normalizeProjectPath(file.path);
		await client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: `${prefix}/${path}`,
				Body: Buffer.from(file.contentBase64, 'base64'),
				ContentType: file.contentType || 'application/octet-stream'
			})
		);
	}

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: metadataKey(playtestId),
			Body: JSON.stringify(input.metadata, null, 2),
			ContentType: 'application/json'
		})
	);
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
	} catch (error) {
		if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') {
			return null;
		}
		throw error;
	}
}

export async function loadPlaytestProject(playtestId: string) {
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
			contentBase64: Buffer.from(bytes).toString('base64')
		});
	}

	return {
		metadata,
		files
	};
}
