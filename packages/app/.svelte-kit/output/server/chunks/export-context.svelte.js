import "clsx";
import { x as setContext, T as getContext } from "./index2.js";
const key = "export";
class ProjectData {
  projects;
  constructor(projects = []) {
    this.projects = projects;
  }
}
function setExportContext(projectData) {
  setContext(key, projectData);
}
function getExportContext() {
  const contextFn = getContext(key);
  return contextFn();
}
export {
  ProjectData as P,
  getExportContext as g,
  setExportContext as s
};
