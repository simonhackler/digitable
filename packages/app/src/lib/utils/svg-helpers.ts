export function createEmptySvg(width: number, height: number) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	svg.setAttribute('width', width + 'mm');
	svg.setAttribute('height', height + 'mm');
	svg.setAttribute('viewBox', `0 0 ${width || 100} ${height || 100}`);
	// Add static/placeholder.svg as child background image
	const backgroundImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
	backgroundImage.id = 'background';
	backgroundImage.setAttribute('href', '/placeholder.svg');
	backgroundImage.setAttribute('width', width + 'px');
	backgroundImage.setAttribute('height', height + 'px');
	svg.appendChild(backgroundImage);
	return svg;
}
