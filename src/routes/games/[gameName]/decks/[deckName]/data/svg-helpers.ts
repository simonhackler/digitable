export interface SvgParseResult {
    cols: { title: string, type: 'text' | 'image' }[];
    data: string[][];
}

export interface ColumnWithData {
    title: string;
    type: 'text' | 'image';
    data: string[];
}

export function loadSvgTemplate(svgText: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    return doc.documentElement as unknown as SVGSVGElement;
}

export function parseSvg(svg: SVGSVGElement, prefix = ''): ColumnWithData[] {
    const doc = svg;
    const texts = Array.from(doc.querySelectorAll('text'));
    const images = Array.from(doc.querySelectorAll('image'));
    // Probably easiest to directly modify the ids instead of always parsing with prefix.
    // If this leads to issues, I can change it later.
    for (const el of texts) {
        if (el.id) el.id = `${prefix}${el.id}`;
    }
    for (const el of images) {
        if (el.id) el.id = `${prefix}${el.id}`;
    }
    const textColumns = texts.map((t) => {
        return {
            title: t.id,
            type: 'text',
            data: [t.textContent || '']
        } as ColumnWithData;
    });
    const imageColumns = images.map((im) => {
        return { title: im.id, type: 'image', data: [im.getAttribute('href') || im.getAttribute('xlink:href') || ''] } as ColumnWithData;
    });
    return textColumns.concat(imageColumns);
}

export function getSvgDataMap(frontSvg: SVGSVGElement, backSvg: SVGSVGElement): Map<string, ColumnWithData> {
    const frontData = parseSvg(frontSvg);
    const backData = parseSvg(backSvg, 'back_');
    const dataMap = new Map<string, ColumnWithData>();

    frontData.forEach(col => {
        dataMap.set(col.title, col);
    });
    backData.forEach(col => {
        dataMap.set(col.title, col);
    });

    return dataMap;
}


export function generateSvg(svgTemplate: SVGSVGElement, headers: string[], row: string[], imagePaths: Map<string, string>): SVGSVGElement {
    const svg = svgTemplate.cloneNode(true) as SVGSVGElement;
    // add a random id after date
    svg.id = `generated-svg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    headers.forEach((col, idx) => {
        const data = row[idx] || '';
        initialSetupForSvgItem(svg, col, data, imagePaths);
    });
    return svg;
}

export function initialSetupForSvgItem(svg: SVGSVGElement, elementId: string, data: string, imagePaths: Map<string, string>): SVGForeignObjectElement | null {
    const el = svg.getElementById(elementId) as SVGGraphicsElement | null;
    if (!el) {
        return null;
    } else if (el.tagName === 'image') {
        updateSvgImageLink(el, imagePaths.get(data));
    }
    if (el.tagName !== 'text') return null;

    const styleAttr = el.getAttribute('style') ?? '';
    const shapeMatch = /shape-inside\s*:\s*url\(\s*#([^)]+)\)/i.exec(styleAttr);

    // Let's see if this works without bbox. Would be incredible
    // let { x, y, width, height } = el.getBBox();
    let x = el.getAttribute('x');
    let y = el.getAttribute('y');
    let width = el.getAttribute('width');
    let height = el.getAttribute('height');

    if (shapeMatch) {
        const shapeId = shapeMatch[1];
        const shapeEl = svg.getElementById(shapeId) as SVGGraphicsElement | null;
        if (shapeEl) {
            x = shapeEl.getAttribute('x');
            y = shapeEl.getAttribute('y');
            width = shapeEl.getAttribute('width');
            height = shapeEl.getAttribute('height');
        } else {
            console.warn(`shape-inside target #${shapeId} not found; using glyph bbox`);
        }
    }

    const fo = document.createElementNS(svg.namespaceURI, 'foreignObject') as SVGForeignObjectElement;
    fo.setAttribute('x', x.toString());
    fo.setAttribute('y', y.toString());
    fo.setAttribute('width', width.toString());
    fo.setAttribute('height', height.toString());
    fo.id = elementId;
    const transform = el.getAttribute('transform');
    if (transform) fo.setAttribute('transform', transform);
    el.parentNode!.appendChild(fo);
    el.parentNode!.removeChild(el);

    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.overflow = 'hidden';
    div.style.whiteSpace = 'pre-wrap';

    // Copy styles from the original SVG text element
    const computedStyle = window.getComputedStyle(el);
    const stylesToCopy = [
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'color',
        'fill',
        'text-align',
        'text-decoration',
        'letter-spacing',
        'line-height',
        'text-transform'
    ];

    stylesToCopy.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'normal' && value !== 'none') {
            // Convert SVG 'fill' to CSS 'color' for HTML text
            if (prop === 'fill') {
                div.style.color = value;
            } else {
                div.style.setProperty(prop, value);
            }
        }
    });

    // Also copy any inline style attribute
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle) {
        // Parse and apply relevant inline styles
        const styleDeclarations = inlineStyle.split(';').filter(Boolean);
        styleDeclarations.forEach(declaration => {
            const [prop, value] = declaration.split(':').map(s => s.trim());
            if (prop && value && stylesToCopy.includes(prop)) {
                if (prop === 'fill') {
                    div.style.color = value;
                } else {
                    div.style.setProperty(prop, value);
                }
            }
        });
    }

    div.textContent = data;

    fo.appendChild(div);

    return fo;
}

export async function updateSvg(
    svg: SVGSVGElement,
    textId: string,
    newText: string,
    imagePaths: Map<string, string>
): Promise<void> {
    const el = svg.getElementById(textId) as SVGGraphicsElement | null;
    if (!el) {
        return;
    }
    if (el.tagName == 'foreignObject') {
        const div = el.querySelector('div');
        if (!div) {
            throw new Error('div not found');
        }
        div.textContent = newText;
    } else if (el.tagName == 'image') {
        updateSvgImageLink(el, imagePaths.get(newText));
    }
}

function updateSvgImageLink(el: SVGGraphicsElement, url: string) {
    el.setAttribute('href', url);
    el.setAttribute('xlink:href', url);
}

export function createHighlightRect(el: SVGGraphicsElement, svg: SVGSVGElement, scale = 1, pad = 4): SVGRectElement | null {
    const rootToScreen = svg.getScreenCTM();
    const elemToScreen = el.getScreenCTM();
    if (!rootToScreen || !elemToScreen) return null;

    const screenToRoot = rootToScreen.inverse();

    // element's bbox in its own coord-sys
    const bb = el.getBBox();
    const p1 = svg.createSVGPoint();
    const p2 = svg.createSVGPoint();
    p1.x = bb.x - pad; // top-left (with padding)
    p1.y = bb.y - pad;
    p2.x = bb.x + bb.width + pad; // bottom-right
    p2.y = bb.y + bb.height + pad;

    // -> screen space -> root space
    const r1 = p1.matrixTransform(elemToScreen).matrixTransform(screenToRoot);
    const r2 = p2.matrixTransform(elemToScreen).matrixTransform(screenToRoot);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(r1.x));
    rect.setAttribute('y', String(r1.y));
    rect.setAttribute('width', String(r2.x - r1.x));
    rect.setAttribute('height', String(r2.y - r1.y));
    rect.setAttribute('rx', '4');
    rect.setAttribute('ry', '4');
    rect.style.fill = 'none';
    rect.style.stroke = 'dodgerblue';
    const strokeWidth = 4 * scale; // Adjust stroke width based on scale
    rect.style.strokeWidth = strokeWidth.toString();

    return rect;
}

export function appendHighlightToSvg(rect: SVGRectElement, svg: SVGSVGElement): void {
    let layer = svg.querySelector<SVGGElement>('g.cell-highlight-layer');
    if (!layer) {
        layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        layer.classList.add('cell-highlight-layer');
        layer.style.pointerEvents = 'none';
        svg.append(layer); // on top
    }
    layer.append(rect);
}
