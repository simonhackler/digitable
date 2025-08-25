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
		} catch (e) {
			// Keep defaults if getBBox fails
		}
	}

	// Calculate aspect ratio
	const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
	const divisor = gcd(width, height);
	const aspectRatio = `${width / divisor}:${height / divisor}`;

	return { width, height, aspectRatio };
}
