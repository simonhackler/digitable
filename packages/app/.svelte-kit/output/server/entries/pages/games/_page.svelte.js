import "clsx";
import { y as pop, w as push } from "../../../chunks/index2.js";
import { B as Button } from "../../../chunks/Icon.js";
import "../../../chunks/badge.js";
import { g as getFileSystemContext } from "../../../chunks/context.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "../../../chunks/state.svelte.js";
import { P as Plus } from "../../../chunks/plus.js";
function _page($$payload, $$props) {
  push();
  getFileSystemContext();
  function createNewGame() {
    console.log("Create new game clicked");
  }
  $$payload.out.push(`<div class="container mx-auto max-w-4xl p-6"><div class="mb-6 flex items-center justify-between"><h1 class="text-3xl font-bold">Board Games</h1> `);
  Button($$payload, {
    onclick: createNewGame,
    class: "flex items-center gap-2",
    children: ($$payload2) => {
      Plus($$payload2, { class: "h-4 w-4" });
      $$payload2.out.push(`<!----> Create Game`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----></div> `);
  {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="flex items-center justify-center py-12"><div class="text-muted-foreground">Loading games...</div></div>`);
  }
  $$payload.out.push(`<!--]--></div>`);
  pop();
}
export {
  _page as default
};
