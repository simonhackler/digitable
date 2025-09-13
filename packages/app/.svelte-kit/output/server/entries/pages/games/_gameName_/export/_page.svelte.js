import "clsx";
import { S as await_outside_boundary, z as escape_html, y as pop, w as push } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index3.js";
import "client-zip";
import { g as getFileSystemContext } from "../../../../../chunks/context.js";
import "papaparse";
import { T as Tween, P as Progress } from "../../../../../chunks/tweened.js";
import "html-to-image";
import { E as Export_pages } from "../../../../../chunks/export-pages.js";
function Bulk_export($$payload, $$props) {
  push();
  const projectName = page.params.gameName;
  getFileSystemContext();
  await_outside_boundary();
  const projects = [];
  await_outside_boundary();
  const sheets = projects.flatMap((p) => [
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
  $$payload.out.push(`<!----> <p class="text-lg">${escape_html(message)}</p></div> `);
  Export_pages($$payload, { projects, gameName: projectName });
  $$payload.out.push(`<!---->`);
  pop();
}
function _page($$payload) {
  Bulk_export($$payload);
}
export {
  _page as default
};
