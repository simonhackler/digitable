import { z } from 'zod';
import { createGameSchema } from '../../routes/games/schemas.js';
import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter.js';
import agentTemplate from '$lib/templates/agents/boardgame-discovery-agent.md?raw';
import createGameCommand from '$lib/templates/commands/create-game.md?raw';
import createSvgCommand from '$lib/templates/commands/create-svg.md?raw';
import placeholderFrontSvg from '../../../static/placeholder.svg?raw';

export async function generateAgentFiles(adapter: FsDir) {
	const schemaJson = generateSchemaJson();
	const opencodeRoot = '.opencode';

	const files = [
		{ content: agentTemplate, name: 'create-game.md', path: joinFsPath(opencodeRoot, 'agent') },
		{
			content: schemaJson,
			name: 'create-game-schema.json',
			path: joinFsPath(opencodeRoot, 'schemas')
		},
		{ content: createGameCommand, name: 'create-game.md', path: joinFsPath(opencodeRoot, 'command') },
		{ content: createSvgCommand, name: 'create-svg.md', path: joinFsPath(opencodeRoot, 'command') },
		{
			content: placeholderFrontSvg,
			name: 'placeholder_front.svg',
			path: joinFsPath(opencodeRoot, 'assets')
		}
	];

	const uploadPromises = files.map(async ({ content, name, path }) => {
		const dir = await adapter.ensureDir(path);
		if (dir.error) {
			console.error(`Failed to open ${path}:`, dir.error);
			return;
		}

		const file = new File([content], name, {
			type: name.endsWith('.json')
				? 'application/json'
				: name.endsWith('.svg')
					? 'image/svg+xml'
					: 'text/markdown'
		});
		const result = await dir.data.write(name, file);
		if (result.error) {
			console.error(`Failed to upload ${name}:`, result.error);
		}
	});

	await Promise.all(uploadPromises);
}

function generateSchemaJson(): string {
	const schema = z.toJSONSchema(createGameSchema);
	return JSON.stringify(schema, null, 2);
}
