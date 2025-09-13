import { x as setContext, T as getContext, G as derived } from "./index2.js";
const key = "svgs";
class LoadSvgs {
  #loadTemplates;
  get loadTemplates() {
    return this.#loadTemplates();
  }
  set loadTemplates($$value) {
    return this.#loadTemplates($$value);
  }
  constructor(loadTemplates) {
    this.#loadTemplates = derived(() => loadTemplates);
  }
}
function setLoadSvgsContext(loadSvgs) {
  setContext(key, loadSvgs);
}
function getLoadSvgsContext() {
  return getContext(key)();
}
export {
  LoadSvgs as L,
  getLoadSvgsContext as g,
  setLoadSvgsContext as s
};
