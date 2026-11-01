import Papa from 'papaparse';

export async function parseCsvFile(file: File): Promise<{ header: string[]; data: string[][] }> {
	const source = (await file.text()).replace(/\r\n/g, '\n');
	const result = Papa.parse<string[]>(source, { skipEmptyLines: true });
	if (result.errors.length) throw result.errors;
	const rows = result.data.filter((row) => row.length > 0);
	const header = rows.shift()!;
	return { header, data: rows };
}
