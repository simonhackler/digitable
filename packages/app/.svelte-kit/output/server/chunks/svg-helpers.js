function loadSvgTemplate(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  return doc.documentElement;
}
function generateSvg(svgTemplate, headers, row, imagePaths) {
  const svg = svgTemplate.cloneNode(true);
  svg.id = `generated-svg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  headers.forEach((col, idx) => {
    const data = row[idx] || "";
    initialSetupForSvgItem(svg, col, data, imagePaths);
  });
  return svg;
}
function initialSetupForSvgItem(svg, elementId, data, imagePaths) {
  const el = svg.getElementById(elementId);
  if (!el) {
    return null;
  } else if (el.tagName === "image") {
    updateSvgImageLink(el, imagePaths.get(data));
  }
  if (el.tagName !== "text") return null;
  const styleAttr = el.getAttribute("style") ?? "";
  const shapeMatch = /shape-inside\s*:\s*url\(\s*#([^)]+)\)/i.exec(styleAttr);
  let x = el.getAttribute("x");
  let y = el.getAttribute("y");
  let width = el.getAttribute("width");
  let height = el.getAttribute("height");
  if (shapeMatch) {
    const shapeId = shapeMatch[1];
    const shapeEl = svg.getElementById(shapeId);
    if (shapeEl) {
      x = shapeEl.getAttribute("x");
      y = shapeEl.getAttribute("y");
      width = shapeEl.getAttribute("width");
      height = shapeEl.getAttribute("height");
    } else {
      console.warn(`shape-inside target #${shapeId} not found; using glyph bbox`);
    }
  }
  if (width === null || height === null) {
    const bbox = el.getBBox();
    width = bbox.width.toString();
    height = bbox.height.toString();
    console.log(width, height, x, y);
  }
  const fo = document.createElementNS(svg.namespaceURI, "foreignObject");
  fo.setAttribute("x", x.toString());
  fo.setAttribute("y", y.toString());
  fo.setAttribute("width", width.toString());
  fo.setAttribute("height", height.toString());
  fo.id = elementId;
  const transform = el.getAttribute("transform");
  if (transform) fo.setAttribute("transform", transform);
  el.parentNode.appendChild(fo);
  el.parentNode.removeChild(el);
  const div = document.createElement("div");
  div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  div.style.width = "100%";
  div.style.height = "100%";
  div.style.overflow = "hidden";
  div.style.whiteSpace = "pre-wrap";
  const computedStyle = window.getComputedStyle(el);
  const stylesToCopy = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "fill",
    "text-align",
    "text-decoration",
    "letter-spacing",
    "line-height",
    "text-transform"
  ];
  stylesToCopy.forEach((prop) => {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== "normal" && value !== "none") {
      if (prop === "fill") {
        div.style.color = value;
      } else {
        div.style.setProperty(prop, value);
      }
    }
  });
  const inlineStyle = el.getAttribute("style");
  if (inlineStyle) {
    const styleDeclarations = inlineStyle.split(";").filter(Boolean);
    styleDeclarations.forEach((declaration) => {
      const [prop, value] = declaration.split(":").map((s) => s.trim());
      if (prop && value && stylesToCopy.includes(prop)) {
        if (prop === "fill") {
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
function updateSvgImageLink(el, url) {
  el.setAttribute("href", url);
  el.setAttribute("xlink:href", url);
}
function createHighlightRect(el, svg, scale = 1, pad = 4) {
  const rootToScreen = svg.getScreenCTM();
  const elemToScreen = el.getScreenCTM();
  if (!rootToScreen || !elemToScreen) return null;
  const screenToRoot = rootToScreen.inverse();
  const bb = el.getBBox();
  const p1 = svg.createSVGPoint();
  const p2 = svg.createSVGPoint();
  p1.x = bb.x - pad;
  p1.y = bb.y - pad;
  p2.x = bb.x + bb.width + pad;
  p2.y = bb.y + bb.height + pad;
  const r1 = p1.matrixTransform(elemToScreen).matrixTransform(screenToRoot);
  const r2 = p2.matrixTransform(elemToScreen).matrixTransform(screenToRoot);
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(r1.x));
  rect.setAttribute("y", String(r1.y));
  rect.setAttribute("width", String(r2.x - r1.x));
  rect.setAttribute("height", String(r2.y - r1.y));
  rect.setAttribute("rx", "4");
  rect.setAttribute("ry", "4");
  rect.style.fill = "none";
  rect.style.stroke = "dodgerblue";
  const strokeWidth = 4 * scale;
  rect.style.strokeWidth = strokeWidth.toString();
  return rect;
}
function appendHighlightToSvg(rect, svg) {
  let layer = svg.querySelector("g.cell-highlight-layer");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.classList.add("cell-highlight-layer");
    layer.style.pointerEvents = "none";
    svg.append(layer);
  }
  layer.append(rect);
}
export {
  appendHighlightToSvg as a,
  createHighlightRect as c,
  generateSvg as g,
  initialSetupForSvgItem as i,
  loadSvgTemplate as l
};
