

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/5.CMxSxVfN.js","_app/immutable/chunks/f00okDMd.js","_app/immutable/chunks/CcupEzEf.js","_app/immutable/chunks/D7zXso-X.js"];
export const stylesheets = [];
export const fonts = [];
