import {
	normalizeTableSvg,
	setupToSvg,
	type TableSetup,
	type TableSetupSvgAssets
} from './table-setup';

type ExportRequest = {
	generation: number;
	setup: TableSetup;
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
	const { generation, setup, baseSvg, placementCardSvgs, cardSvgs, deckTopCardIds, cardLabels } =
		event.data;
	const assets: TableSetupSvgAssets = {
		placementCardSvgs: Object.fromEntries(placementCardSvgs),
		cardSvgs: Object.fromEntries(cardSvgs),
		deckTopCardIds: Object.fromEntries(deckTopCardIds),
		cardLabels: Object.fromEntries(cardLabels)
	};
	let svg: string;
	try {
		svg = baseSvg ? normalizeTableSvg(baseSvg, setup, assets) : setupToSvg(setup, assets);
	} catch {
		svg = setupToSvg(setup, assets);
	}
	worker.postMessage({ generation, svg } satisfies ExportResponse);
};
