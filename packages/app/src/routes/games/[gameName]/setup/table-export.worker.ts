import {
	normalizeTableSvg,
	tableToSvg,
	type Table,
	type TableSvgAssets
} from './table';

type ExportRequest = {
	generation: number;
	table: Table;
	baseSvg: string | null;
	placementCardSvgs: Array<[string, string]>;
	cardSvgs: Array<[string, string]>;
	deckTopCardIds: Array<[string, string]>;
	cardLabels: Array<[string, string]>;
};

type ExportResponse = {
	generation: number;
	svg: string;
};

const worker = self as unknown as {
	onmessage: ((event: MessageEvent<ExportRequest>) => void) | null;
	postMessage(message: ExportResponse): void;
};

worker.onmessage = (event: MessageEvent<ExportRequest>) => {
	const { generation, table, baseSvg, placementCardSvgs, cardSvgs, deckTopCardIds, cardLabels } =
		event.data;
	const assets: TableSvgAssets = {
		placementCardSvgs: Object.fromEntries(placementCardSvgs),
		cardSvgs: Object.fromEntries(cardSvgs),
		deckTopCardIds: Object.fromEntries(deckTopCardIds),
		cardLabels: Object.fromEntries(cardLabels)
	};
	let svg: string;
	try {
		svg = baseSvg ? normalizeTableSvg(baseSvg, table, assets) : tableToSvg(table, assets);
	} catch {
		svg = tableToSvg(table, assets);
	}
	worker.postMessage({ generation, svg } satisfies ExportResponse);
};
