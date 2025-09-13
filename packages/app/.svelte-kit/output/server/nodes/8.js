

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/games/_gameName_/decks/_deckName_/data/_page.svelte.js')).default;
export const universal = {
  "ssr": false
};
export const universal_id = "src/routes/games/[gameName]/decks/[deckName]/data/+page.ts";
export const imports = ["_app/immutable/nodes/8.DrotGzvc.js","_app/immutable/chunks/f00okDMd.js","_app/immutable/chunks/CcupEzEf.js","_app/immutable/chunks/BVPmkM9x.js","_app/immutable/chunks/DxYQc54M.js","_app/immutable/chunks/cfBV56z_.js","_app/immutable/chunks/BOSYInrQ.js","_app/immutable/chunks/D8ieNkJn.js","_app/immutable/chunks/DehnvxjX.js","_app/immutable/chunks/di3RH49S.js","_app/immutable/chunks/DasDILl7.js","_app/immutable/chunks/CguayBz6.js","_app/immutable/chunks/CqkleIqs.js","_app/immutable/chunks/BA9JEYNq.js","_app/immutable/chunks/C6TUt7Wx.js","_app/immutable/chunks/CYuW_oLx.js","_app/immutable/chunks/hCi9QD3O.js","_app/immutable/chunks/CpDvUZUT.js","_app/immutable/chunks/DBjFjSNq.js","_app/immutable/chunks/DnpZioqK.js","_app/immutable/chunks/CesmBmgU.js","_app/immutable/chunks/BYltgoTj.js","_app/immutable/chunks/CJzatOV0.js","_app/immutable/chunks/COiSFdZj.js"];
export const stylesheets = [];
export const fonts = [];
