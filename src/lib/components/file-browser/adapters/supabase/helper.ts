/*
	Installed from github/simonhackler/svelte-file-explorer
*/

import type { SupabaseClient } from '@supabase/supabase-js';

// This will get all the files out of a bucket the user has rls access on
export async function getAllFilesMetadata(supabase: SupabaseClient, bucketId: string) {
	const { data, error } = await supabase
		.schema('storage')
		.from('objects')
		.select(
			`pathTokens: path_tokens,
            size: metadata->>size,
            mimetype: metadata->>mimetype,
            updatedAt: metadata->>updated_at
            `
		)
		.eq('bucket_id', bucketId);

	if (error) {
		console.error(error);
		return { data: null, error };
	}

	const filePathList = data!.filter(Boolean).map((row) => ({
		pathTokens: row.pathTokens as string[],
		fileData: {
			size: Number.parseInt(row.size),
			mimetype: row.mimetype,
			updatedAt: new Date(row.updatedAt)
		}
	}));

	return { data: filePathList, error: null };
}
