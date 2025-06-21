async function svgToPng(svg: SVGSVGElement, scale = 1): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svg);   // keeps XHTML ns
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });

  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.decoding = 'async';          // avoids layout jank
  img.src = url;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width  = svg.width.baseVal.value * scale;
  canvas.height = svg.height.baseVal.value * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  return await new Promise<Blob>((res) => canvas.toBlob(res, 'image/png')!);
}

