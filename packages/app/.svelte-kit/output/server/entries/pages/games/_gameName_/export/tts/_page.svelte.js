import { y as pop, w as push, z as escape_html } from "../../../../../../chunks/index2.js";
import "clsx";
import { p as page } from "../../../../../../chunks/index3.js";
import { T as Tween, P as Progress } from "../../../../../../chunks/tweened.js";
import "html-to-image";
import { g as getFileSystemContext } from "../../../../../../chunks/context.js";
import { g as getExportContext } from "../../../../../../chunks/export-context.svelte.js";
function Tts_export($$payload, $$props) {
  push();
  let { sheets } = $$props;
  sheets[0].svgs.map((svg) => {
    const clonedSvg = svg.cloneNode(true);
    return clonedSvg;
  });
  getFileSystemContext();
  $$payload.out.push(`<div class="sheet grid grid-cols-10 svelte-1bncv4i" id="sheet"></div>`);
  pop();
}
function Tts_preview($$payload, $$props) {
  push();
  let { sheet, isVisible } = $$props;
  sheet.svgs.map((svg) => {
    const clonedSvg = svg.cloneNode(true);
    return clonedSvg;
  });
  if (isVisible && sheet) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<!---->`);
    {
      $$payload.out.push(`<div class="flex items-center justify-center overflow-hidden rounded-lg border bg-white shadow-sm"><div class="preview-sheet grid grid-cols-10"></div></div>`);
    }
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function _page($$payload, $$props) {
  push();
  page.params.gameName;
  const projectData = getExportContext();
  getFileSystemContext();
  const sheets = projectData.projects.flatMap((p) => [
    { name: p.name, svgs: p.svgsFront },
    { name: `${p.name}_back`, svgs: p.svgsBack }
  ]);
  let exportIndex = 0;
  let progressValue = (() => exportIndex + 0)();
  let tweenedValue = (() => {
    const tween = new Tween(progressValue, { duration: 5e3 });
    tween.target = progressValue + 1;
    return tween;
  })();
  const exportingSheet = sheets[exportIndex];
  const message = (() => {
    if (exportIndex >= sheets.length) {
      return "generating TTS export…";
    }
    return `Exporting sheet ${exportIndex + 1} of ${sheets.length}: ${exportingSheet.name}`;
  })();
  $$payload.out.push(`<div class="m-4 flex flex-col items-center justify-center">`);
  Progress($$payload, {
    value: tweenedValue.current,
    max: sheets.length + 1,
    class: "w-[60%]"
  });
  $$payload.out.push(`<!----> <p class="text-lg">${escape_html(message)}</p></div> <div class="m-4 flex justify-center">`);
  Tts_preview($$payload, {
    sheet: exportingSheet,
    isVisible: exportIndex < sheets.length && true
  });
  $$payload.out.push(`<!----></div> <div class="hide svelte-8j21uk"><div>`);
  Tts_export($$payload, { sheets });
  $$payload.out.push(`<!----></div></div>`);
  pop();
}
export {
  _page as default
};
