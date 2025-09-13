import "clsx";
import { y as pop, w as push } from "../../../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../../../chunks/exports.js";
import "../../../../../../chunks/utils.js";
import "../../../../../../chunks/state.svelte.js";
import { p as page } from "../../../../../../chunks/index3.js";
import { g as getFileSystemContext } from "../../../../../../chunks/context.js";
import { l as loadSvgTemplate } from "../../../../../../chunks/svg-helpers.js";
import { s as setLoadSvgsContext, L as LoadSvgs } from "../../../../../../chunks/svg-context.svelte.js";
function _layout($$payload, $$props) {
  push();
  let { children } = $$props;
  const currentProject = page.params.gameName;
  const currentCard = page.params.deckName;
  const fullFolderPath = `/${currentProject}/system/${currentCard}`;
  const fileSystem = getFileSystemContext();
  async function loadSvgTemplates(fileSystem2, fullFolderPath2) {
    const [front, back] = await fileSystem2.download([`${fullFolderPath2}/front.svg`, `${fullFolderPath2}/back.svg`]);
    const svgFileFront = await front.result?.data.text();
    const svgFileBack = await back.result?.data.text();
    return {
      front: svgFileFront ? loadSvgTemplate(svgFileFront) : null,
      back: svgFileBack ? loadSvgTemplate(svgFileBack) : null
    };
  }
  const svgsProm = loadSvgTemplates(fileSystem, fullFolderPath);
  const loadSvgs = new LoadSvgs(svgsProm);
  setLoadSvgsContext(() => loadSvgs);
  children($$payload);
  $$payload.out.push(`<!---->`);
  pop();
}
export {
  _layout as default
};
