import { updateText } from '@automerge/automerge-repo';
import { z } from 'zod';
import type { MemberMaterializer } from './materializer';
import { isGameMetadataDocument, type GameMetadataDocument, type JsonValue } from './model';

const knownKeys = new Set([
	'name',
	'minPlayers',
	'maxPlayers',
	'description',
	'tags',
	'digitableVersion'
]);

const metadataSchema = z
	.object({
		name: z.string().min(1).max(80),
		minPlayers: z.number().int().min(1).max(20),
		maxPlayers: z.number().int().min(1).max(20),
		description: z.string().max(500),
		tags: z.array(z.string()).optional().default([]),
		digitableVersion: z.string().optional()
	})
	.refine((metadata) => metadata.minPlayers <= metadata.maxPlayers, {
		message: 'minPlayers must be less than or equal to maxPlayers',
		path: ['maxPlayers']
	});

export const gameMetadataMaterializer: MemberMaterializer<GameMetadataDocument> = {
	kind: 'game-metadata',
	parse(source) {
		const parsed = parseJson(source, 'game.json');
		const metadata = metadataSchema.safeParse(parsed);
		if (!metadata.success) {
			const message = metadata.error.issues.map((issue) => issue.message).join('; ');
			throw new Error(`game.json has an unsupported format: ${message}`);
		}

		const { minPlayers, maxPlayers, ...fields } = metadata.data;
		return {
			type: 'game-metadata',
			schemaVersion: 1,
			...fields,
			players: { min: minPlayers, max: maxPlayers },
			extra: Object.fromEntries(
				Object.entries(parsed as Record<string, JsonValue>).filter(([key]) => !knownKeys.has(key))
			)
		};
	},
	apply(document, incoming) {
		if (document.name !== incoming.name) updateText(document, ['name'], incoming.name);
		if (document.description !== incoming.description) {
			updateText(document, ['description'], incoming.description);
		}
		if (
			document.players.min !== incoming.players.min ||
			document.players.max !== incoming.players.max
		) {
			document.players = { min: incoming.players.min, max: incoming.players.max };
		}
		if (
			document.tags.length !== incoming.tags.length ||
			document.tags.some((tag, index) => tag !== incoming.tags[index])
		) {
			document.tags.splice(0, document.tags.length, ...incoming.tags);
		}
		if (incoming.digitableVersion === undefined) {
			delete document.digitableVersion;
		} else if (document.digitableVersion !== incoming.digitableVersion) {
			if (document.digitableVersion === undefined) {
				document.digitableVersion = incoming.digitableVersion;
			} else {
				updateText(document, ['digitableVersion'], incoming.digitableVersion);
			}
		}
		for (const key of Object.keys(document.extra)) {
			if (!(key in incoming.extra)) delete document.extra[key];
		}
		for (const [key, value] of Object.entries(incoming.extra)) {
			if (JSON.stringify(document.extra[key]) !== JSON.stringify(value))
				document.extra[key] = value;
		}
	},
	serialize(document) {
		const fields = {
			name: document.name,
			minPlayers: document.players.min,
			maxPlayers: document.players.max,
			description: document.description,
			tags: document.tags,
			digitableVersion: document.digitableVersion
		};
		const validated = metadataSchema.safeParse(fields);
		if (!validated.success) {
			const message = validated.error.issues.map((issue) => issue.message).join('; ');
			throw new Error(`Cannot materialize invalid game metadata: ${message}`);
		}
		const metadata = {
			...document.extra,
			name: document.name,
			minPlayers: document.players.min,
			maxPlayers: document.players.max,
			description: document.description,
			tags: [...document.tags],
			...(document.digitableVersion === undefined
				? {}
				: { digitableVersion: document.digitableVersion })
		};
		return `${JSON.stringify(metadata, null, 2)}\n`;
	},
	isDocument: isGameMetadataDocument
};

function parseJson(source: string, path: string): unknown {
	try {
		return JSON.parse(source);
	} catch (cause) {
		throw new Error(`${path} is not valid JSON.`, { cause });
	}
}
