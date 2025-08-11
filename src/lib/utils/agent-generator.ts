import { z } from 'zod';
import { createGameSchema } from '../../routes/games/schemas.js';
import type { Adapter } from '$lib/components/file-browser/adapters/adapter.js';

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
	return `---
description: Helps to create a new game.
---
You are an agent that helps users create a new game. You will ask the user for the necessary information to create a new game.
Then you will create a json file and folder in the top level directory.
First load the schema from .opencode/schemas/create-game-schema.json. This is the information the user will need to provide to create a new game.
Make sure to gather this information from the user in a conversational manner.
Once you have all the information, create a new folder in the top level directory with the name converting withespace to underscores.
Make sure your output json matches the json schema exactly and without errors.

`;
}

function generateSchemaJson(): string {
	const schema = z.toJSONSchema(createGameSchema);
	return JSON.stringify(schema, null, 2);
}
