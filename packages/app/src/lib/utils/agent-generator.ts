import { z } from 'zod';
import { createGameSchema } from '../../routes/games/schemas.js';
import type { FsDir } from '$lib/components/file-browser/adapters/adapter.js';
import agentTemplate from '$lib/templates/agents/boardgame-discovery-agent.md?raw';
import componentExplorerSkill from '$lib/templates/skills/component-explorer/SKILL.md?raw';
import createGameSkill from '$lib/templates/skills/create-game/SKILL.md?raw';
import createSvgSkill from '$lib/templates/skills/create-svg/SKILL.md?raw';
import gameStarterSkill from '$lib/templates/skills/game-starter/SKILL.md?raw';
import rulesExplorerSkill from '$lib/templates/skills/rules-explorer/SKILL.md?raw';
import placeholderFrontSvg from '../../../static/placeholder.svg?raw';

export async function generateAgentFiles(adapter: FsDir) {
	const schemaJson = generateSchemaJson();

	const files = [
		{ content: agentTemplate, name: 'create-game.md', path: '.opencode/agent' },
		{ content: createGameSkill, name: 'SKILL.md', path: '.agents/skills/create-game' },
		{
			content: schemaJson,
			name: 'create-game-schema.json',
			path: '.agents/skills/create-game/references'
		},
		{ content: createSvgSkill, name: 'SKILL.md', path: '.agents/skills/create-svg' },
		{
			content: placeholderFrontSvg,
			name: 'placeholder_front.svg',
			path: '.agents/skills/create-svg/assets'
		},
		{ content: rulesExplorerSkill, name: 'SKILL.md', path: '.agents/skills/rules-explorer' },
		{ content: gameStarterSkill, name: 'SKILL.md', path: '.agents/skills/game-starter' },
		{
			content: componentExplorerSkill,
			name: 'SKILL.md',
			path: '.agents/skills/component-explorer'
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
