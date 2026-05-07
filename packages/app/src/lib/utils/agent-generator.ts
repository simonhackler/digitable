import { z } from 'zod';
import { createGameSchema } from '../../routes/games/schemas.js';
import type { FsDir } from '$lib/components/file-browser/adapters/adapter.js';
import agentTemplate from '$lib/templates/agents/boardgame-discovery-agent.md?raw';
import componentExplorerSkill from '$lib/templates/skills/component-explorer/SKILL.md?raw';
import createSvgSkill from '$lib/templates/skills/create-svg/SKILL.md?raw';
import gameMetadataScaffoldSkill from '$lib/templates/skills/game-metadata-scaffold/SKILL.md?raw';
import newGameDiscoverySkill from '$lib/templates/skills/new-game-discovery/SKILL.md?raw';
import rulesExplorerSkill from '$lib/templates/skills/rules-explorer/SKILL.md?raw';
import placeholderFrontSvg from '../../../static/placeholder.svg?raw';

export async function generateAgentFiles(adapter: FsDir) {
	const schemaJson = generateSchemaJson();
	await removeObsoleteGeneratedFiles(adapter);

	const files = [
		{ content: agentTemplate, name: 'boardgame-discovery.md', path: '.opencode/agent' },
		{ content: newGameDiscoverySkill, name: 'SKILL.md', path: '.agents/skills/new-game-discovery' },
		{
			content: gameMetadataScaffoldSkill,
			name: 'SKILL.md',
			path: '.agents/skills/game-metadata-scaffold'
		},
		{
			content: schemaJson,
			name: 'game-metadata-schema.json',
			path: '.agents/skills/game-metadata-scaffold/references'
		},
		{ content: createSvgSkill, name: 'SKILL.md', path: '.agents/skills/create-svg' },
		{
			content: placeholderFrontSvg,
			name: 'placeholder_front.svg',
			path: '.agents/skills/create-svg/assets'
		},
		{ content: rulesExplorerSkill, name: 'SKILL.md', path: '.agents/skills/rules-explorer' },
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

async function removeObsoleteGeneratedFiles(adapter: FsDir) {
	const obsoletePaths = [
		'.opencode/agent/create-game.md',
		'.agents/skills/create-game',
		'.agents/skills/game-starter'
	];

	await Promise.all(
		obsoletePaths.map(async (path) => {
			const removed = await adapter.remove(path, { recursive: true });
			if (removed.error && removed.error.name !== 'NotFoundError') {
				console.error(`Failed to remove obsolete generated agent path ${path}:`, removed.error);
			}
		})
	);
}

function generateSchemaJson(): string {
	const schema = z.toJSONSchema(createGameSchema);
	return JSON.stringify(schema, null, 2);
}
