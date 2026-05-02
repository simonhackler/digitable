import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface ImagePrompt {
	columnName: string;
	prompt: string;
	rowIndex: number;
	rowId: string;
	aspectRatio: string;
}

interface ReplicateResponse {
	id: string;
	output?: string[];
	error?: string;
	status: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { prompts }: { prompts: ImagePrompt[] } = await request.json();
	const replicateApiToken = env.REPLICATE_API_TOKEN;

	if (!replicateApiToken) {
		return json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
	}

	console.log('Starting image generation process...');
	console.log(`Generating ${prompts.length} images...`);
	console.log(prompts);

	const promises = prompts.map(async (promptData) => {
		try {
			const response = await fetch(
				'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${replicateApiToken}`,
						'Content-Type': 'application/json',
						Prefer: 'wait'
					},
					body: JSON.stringify({
						input: {
							prompt: promptData.prompt,
							go_fast: true,
							num_outputs: 1,
							aspect_ratio: promptData.aspectRatio,
							output_format: 'webp',
							output_quality: 80
						}
					})
				}
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result: ReplicateResponse = await response.json();

			if (result.error) {
				console.error(`Error generating image for "${promptData.prompt}":`, result.error);
				return null;
			}

			if (result.output && result.output[0]) {
				console.log(
					`Generated image for row ${promptData.rowIndex}, column ${promptData.columnName}:`,
					result.output[0]
				);
				return {
					...promptData,
					imageUrl: result.output[0]
				};
			}

			console.warn(`No image output for prompt: ${promptData.prompt}`);
			return null;
		} catch (error) {
			console.error(`Failed to generate image for "${promptData.prompt}":`, error);
			return null;
		}
	});

	const results = await Promise.all(promises);
	const successfulResults = results.filter((result) => result !== null);

	console.log(`Successfully generated ${successfulResults.length} out of ${prompts.length} images`);
	console.log(successfulResults);

	return json({
		success: true,
		results: successfulResults,
		total: prompts.length,
		successful: successfulResults.length
	});
};
