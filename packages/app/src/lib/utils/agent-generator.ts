import { z } from 'zod';
import { createGameSchema } from '../../routes/games/schemas.js';
import type { Adapter } from '$lib/components/file-browser/adapters/adapter.js';
import agentTemplate from '$lib/templates/agents/boardgame-discovery-agent.md?raw';
import createGameCommand from '$lib/templates/commands/create-game.md?raw';
import createSvgCommand from '$lib/templates/commands/create-svg.md?raw';
import placeholderFrontSvg from '../../../static/placeholder_front.svg?raw';

export async function generateAgentFiles(adapter: Adapter) {
	const schemaJson = generateSchemaJson();

	const files = [
		{ content: agentTemplate, name: 'create-game.md', path: '/.opencode/agent/' },
		{ content: schemaJson, name: 'create-game-schema.json', path: '/.opencode/schemas/' },
		{ content: createGameCommand, name: 'create-game.md', path: '/.opencode/command/' },
		{ content: createSvgCommand, name: 'create-svg.md', path: '/.opencode/command/' },
		{ content: placeholderFrontSvg, name: 'placeholder_front.svg', path: '/.opencode/assets/' }
	];

	const uploadPromises = files.map(async ({ content, name, path }) => {
		const file = new File([content], name, {
			type: name.endsWith('.json')
				? 'application/json'
				: name.endsWith('.svg')
					? 'image/svg+xml'
					: 'text/markdown'
		});
		const result = await adapter.upload(file, path, true);
		if (result) {
			console.error(`Failed to upload ${name}:`, result);
		}
	});

	await Promise.all(uploadPromises);
}

function generateSchemaJson(): string {
	const schema = z.toJSONSchema(createGameSchema);
	return JSON.stringify(schema, null, 2);
}
