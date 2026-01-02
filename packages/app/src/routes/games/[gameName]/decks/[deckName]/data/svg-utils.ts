export function extractImageDimensions(
	svg: SVGSVGElement,
	columnName: string
): { width: number; height: number; aspectRatio: string } {
	const element = svg.getElementById(columnName);
	if (!element) {
		return { width: 512, height: 512, aspectRatio: '1:1' };
	}

	let width = 512;
	let height = 512;

	// Try to get width and height from attributes
	const widthAttr = element.getAttribute('width');
	const heightAttr = element.getAttribute('height');

	if (widthAttr && heightAttr) {
		width = parseFloat(widthAttr);
		height = parseFloat(heightAttr);
	} else {
		// Fallback to getBBox if available
		try {
			const bbox = (element as SVGGraphicsElement).getBBox();
			width = bbox.width || 512;
			height = bbox.height || 512;
		} catch (_e) {
			// Keep defaults if getBBox fails
		}
	}

	// Map to closest standard aspect ratio supported by Flux
	const ratio = width / height;
	let aspectRatio: string;

	if (ratio >= 1.7) {
		aspectRatio = '16:9'; // Wide landscape
	} else if (ratio >= 1.4) {
		aspectRatio = '3:2'; // Standard landscape
	} else if (ratio >= 1.2) {
		aspectRatio = '4:3'; // Classic landscape
	} else if (ratio >= 0.8) {
		aspectRatio = '1:1'; // Square
	} else if (ratio >= 0.7) {
		aspectRatio = '3:4'; // Portrait
	} else if (ratio >= 0.6) {
		aspectRatio = '2:3'; // Standard portrait
	} else {
		aspectRatio = '9:16'; // Tall portrait
	}

	return { width, height, aspectRatio };
}
