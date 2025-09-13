import { x as setContext, T as getContext } from "./index2.js";
const key = "filesystem";
function setFileSystemContext(fileSystem) {
  setContext(key, fileSystem);
}
function getFileSystemContext() {
  const context = getContext(key);
  if (!context?.adapter) {
    throw new Error("File system context not set");
  }
  return context.adapter;
}
export {
  getFileSystemContext as g,
  setFileSystemContext as s
};
