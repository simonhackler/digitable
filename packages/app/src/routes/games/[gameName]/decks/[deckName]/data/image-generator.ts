import { Result, Ok, tryAsync, Err } from 'wellcrafted/result';

export interface ImagePrompt {
	columnName: string;
	prompt: string;
	rowIndex: number;
	rowId: string;
	aspectRatio: string;
}

export interface ImageGenResponse {
	success: boolean;
	results: Array<ImagePrompt & { imageUrl: string }>;
	total: number;
	successful: number;
	error?: string;
}

export async function generateImages(prompts: ImagePrompt[]) {
	console.log('Starting image generation process...');
	console.log(`Generating ${prompts.length} images...`);
	console.log(prompts);

	try {
		const response = await fetch('/api/generate-images', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ prompts })
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result: ImageGenResponse = await response.json();

		if (!result.success) {
			console.error('Image generation failed:', result.error);
			return Err(result.error);
		}

		return Ok(result);
	} catch (error) {
		console.error('Failed to generate images:', error);
		return Err(error instanceof Error ? error.message : String(error));
	}
}
