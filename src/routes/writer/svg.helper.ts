export async function svgToPng(svg: SVGElement | string, dpi = 300): Promise<Blob> {
    const xml = typeof svg === 'string'
        ? svg
        : new XMLSerializer().serializeToString(svg);

    const svgString = `<?xml version="1.0" encoding="utf-8"?>${xml}`;
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const url = `data:image/svg+xml;base64,${svgBase64}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG load failed'));
        img.src = url;
    });

    const CSS_DPI = 96;                        // 1 CSS pixel ≈ 1/96 inch
    const scale = dpi / CSS_DPI;               // e.g. 300 / 96 ≈ 3.125

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(img.width * scale);
    canvas.height = Math.ceil(img.height * scale);

    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);                   // logical view stays the same size
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(
            (b) => b ? res(b) : rej(new Error('Canvas toBlob failed')),
            'image/png'
        );
    });

    return blob;
}

