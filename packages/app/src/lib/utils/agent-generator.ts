import { z } from 'zod';
import { createGameSchema } from '../../routes/games/schemas.js';
import type { Adapter } from '$lib/components/file-browser/adapters/adapter.js';
import agentTemplate from '$lib/templates/create-game-agent.md?raw';

export async function generateAgentFiles(adapter: Adapter) {
	await generateCreateGameAgent(adapter);
}

async function generateCreateGameAgent(adapter: Adapter) {
	const agentMarkdown = generateAgentMarkdown();
	const schemaJson = generateSchemaJson();

	const mdFile = new File([agentMarkdown], 'create-game.md', { type: 'text/markdown' });
	const jsonFile = new File([schemaJson], 'create-game-schema.json', { type: 'application/json' });

	const res = await adapter.upload(mdFile, '/.opencode/agent/', true);
	if (res) {
		console.error('Failed to upload agent markdown:', res);
	}
	const res2 = await adapter.upload(jsonFile, '/.opencode/schemas/', true);
	if (res2) {
		console.error('Failed to upload agent schema:', res2);
	}
}
function generateAgentMarkdown(): string {
	return agentTemplate;
}

function generateSchemaJson(): string {
	const schema = z.toJSONSchema(createGameSchema);
	return JSON.stringify(schema, null, 2);
}
