import type { SvgCanvasConfig, SvgString } from './types';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;

const isValidDimension = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0;

const getDimensions = (config?: SvgCanvasConfig) => {
	const dims = config?.dimensions;
	if (Array.isArray(dims) && dims.length >= 2) {
		const [width, height] = dims;
		if (isValidDimension(width) && isValidDimension(height)) {
			return { width, height };
		}
	}

	return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
};

export const createMinimalSvg = (config?: SvgCanvasConfig): SvgString => {
	const { width, height } = getDimensions(config);
	return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
};

export const normalizeSvg = (value: string, config?: SvgCanvasConfig): SvgString => {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) {
		return createMinimalSvg(config);
	}

	return value;
};
