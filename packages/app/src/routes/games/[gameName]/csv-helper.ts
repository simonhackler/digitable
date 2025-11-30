import Papa from 'papaparse';

export function parseCsvFile(file: File): Promise<{ header: string[]; data: string[][] }> {
	return new Promise((resolve, reject) => {
		Papa.parse<string[]>(file, {
			complete: (result) => {
				if (result.errors.length) {
					return reject(result.errors);
				}
				const rows = result.data.filter((r) => r.length > 0);
				const header = rows.shift()!;
				resolve({ header, data: rows });
			},
			error: (err) => reject(err),
			skipEmptyLines: true
		});
	});
}
