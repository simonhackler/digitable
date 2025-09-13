import "clsx";
import { S as await_outside_boundary, y as pop, w as push } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index3.js";
import "client-zip";
import { g as getFileSystemContext } from "../../../../../chunks/context.js";
import "papaparse";
import { s as setExportContext, P as ProjectData } from "../../../../../chunks/export-context.svelte.js";
function _layout($$payload, $$props) {
  push();
  page.params.gameName;
  getFileSystemContext();
  const projectData = new ProjectData();
  setExportContext(() => projectData);
  await_outside_boundary();
  await_outside_boundary();
  const { children } = $$props;
  children($$payload);
  $$payload.out.push(`<!---->`);
  pop();
}
export {
  _layout as default
};
