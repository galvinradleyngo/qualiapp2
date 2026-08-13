/** Rasterizes a rendered SVG element to a PNG data URL, for embedding in Word exports. */
export async function renderSvgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  const width = svg.width.baseVal.value || svg.viewBox.baseVal.width || 640;
  const height = svg.height.baseVal.value || svg.viewBox.baseVal.height || 420;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // Explicit white background — the source SVG relies on its container's CSS background.
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  const svgMarkup = new XMLSerializer().serializeToString(clone);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to rasterize the relational map.'));
    image.src = svgDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
