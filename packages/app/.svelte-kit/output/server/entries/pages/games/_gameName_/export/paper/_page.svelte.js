import "clsx";
import { y as pop, w as push } from "../../../../../../chunks/index2.js";
import { p as page } from "../../../../../../chunks/index3.js";
import { E as Export_pages } from "../../../../../../chunks/export-pages.js";
import { g as getExportContext } from "../../../../../../chunks/export-context.svelte.js";
function _page($$payload, $$props) {
  push();
  const projectName = page.params.gameName;
  const projectData = getExportContext();
  Export_pages($$payload, { projects: projectData.projects, gameName: projectName });
  pop();
}
export {
  _page as default
};
