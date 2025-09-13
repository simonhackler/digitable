import { w as push, F as spread_props, y as pop, J as copy_payload, K as assign_payload, O as ensure_array_like, z as escape_html, M as attr, S as await_outside_boundary, Q as store_get, P as store_mutate, A as spread_attributes, R as unsubscribe_stores } from "../../../../chunks/index2.js";
import { F as Form_field, a as Form_field_errors, s as superForm, z as zod, d as defaults, C as Control, b as Form_label } from "../../../../chunks/zod4.js";
import { C as Card, a as Card_header, b as Card_title, c as Card_content, U as Upload } from "../../../../chunks/card-title.js";
import "clsx";
import { I as Icon, B as Button } from "../../../../chunks/Icon.js";
import { I as Input } from "../../../../chunks/popper-layer-force-mount.js";
import { B as Badge } from "../../../../chunks/badge.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "../../../../chunks/state.svelte.js";
import "ts-deepmerge";
import "@sveltejs/kit";
import "memoize-weak";
import "zod-to-json-schema";
import { P as Plus } from "../../../../chunks/plus.js";
import { X } from "../../../../chunks/x.js";
import { g as createGameSchema, F as Form_description } from "../../../../chunks/schemas.js";
import { g as getFileSystemContext } from "../../../../chunks/context.js";
import { p as page } from "../../../../chunks/index3.js";
function Circle_check_big($$payload, $$props) {
  push();
  /**
   * @license @lucide/svelte v0.515.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   */
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M21.801 10A10 10 0 1 1 17 3.335" }],
    ["path", { "d": "m9 11 3 3L22 4" }]
  ];
  Icon($$payload, spread_props([
    { name: "circle-check-big" },
    /**
     * @component @name CircleCheckBig
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjEuODAxIDEwQTEwIDEwIDAgMSAxIDE3IDMuMzM1IiAvPgogIDxwYXRoIGQ9Im05IDExIDMgM0wyMiA0IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/circle-check-big
     * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
     *
     * @param {Object} props - Lucide icons props and any valid SVG attribute
     * @returns {FunctionalComponent} Svelte component
     *
     */
    props,
    {
      iconNode,
      children: ($$payload2) => {
        props.children?.($$payload2);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
  pop();
}
function Image($$payload, $$props) {
  push();
  /**
   * @license @lucide/svelte v0.515.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   */
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "rect",
      {
        "width": "18",
        "height": "18",
        "x": "3",
        "y": "3",
        "rx": "2",
        "ry": "2"
      }
    ],
    ["circle", { "cx": "9", "cy": "9", "r": "2" }],
    ["path", { "d": "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
  ];
  Icon($$payload, spread_props([
    { name: "image" },
    /**
     * @component @name Image
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIgLz4KICA8Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iMiIgLz4KICA8cGF0aCBkPSJtMjEgMTUtMy4wODYtMy4wODZhMiAyIDAgMCAwLTIuODI4IDBMNiAyMSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/image
     * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
     *
     * @param {Object} props - Lucide icons props and any valid SVG attribute
     * @returns {FunctionalComponent} Svelte component
     *
     */
    props,
    {
      iconNode,
      children: ($$payload2) => {
        props.children?.($$payload2);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
  pop();
}
const suggestedTags = [
  "Fantasy",
  "Sci-Fi",
  "Historical",
  "Mystery",
  "Strategy",
  "Adventure",
  "Horror",
  "Educational",
  "Family",
  "Medieval",
  "Ancient Civilizations",
  "Post-Apocalyptic",
  "Cyberpunk",
  "Steampunk",
  "Underwater",
  "Outer Space",
  "Dystopian Future",
  "Wild West",
  "Feudal Japan",
  "Renaissance",
  "Prehistoric",
  "Victorian Era",
  "World War I",
  "World War II",
  "Cold War",
  "Modern Day",
  "Mythological",
  "Lost City",
  "Jungle",
  "Desert",
  "Arctic",
  "Island",
  "Pirate Seas",
  "Haunted House",
  "Urban Cityscape",
  "Space Colony",
  "Interdimensional",
  "Time Travel",
  "Alternate History",
  "High Seas Exploration",
  "Mountain Expedition",
  "Space Station",
  "Fantasy Kingdom",
  "Ancient Egypt",
  "Ancient Rome",
  "Ancient Greece",
  "Martian Frontier",
  "Deep Space Exploration"
];
function Tag_selector($$payload, $$props) {
  push();
  let { form, selectedTags, onTagsChange } = $$props;
  let newTagInput = "";
  let tagDisplayOffset = 0;
  const filteredSuggestedTags = (() => {
    if (!newTagInput.trim()) return suggestedTags.slice(tagDisplayOffset, tagDisplayOffset + 10);
    return suggestedTags.filter((tag) => tag.toLowerCase().includes(newTagInput.toLowerCase())).slice(0, 10);
  })();
  function addTag(tag) {
    if (!selectedTags.includes(tag) && selectedTags.length < 10) {
      const newTags = [...selectedTags, tag];
      onTagsChange(newTags);
    }
  }
  function addNewTag() {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag) && selectedTags.length < 10) {
      const newTags = [...selectedTags, trimmedTag];
      onTagsChange(newTags);
      newTagInput = "";
    }
  }
  function handleNewTagKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addNewTag();
    }
  }
  function cycleTags() {
    if (!newTagInput.trim()) {
      const maxOffset = Math.max(0, suggestedTags.length - 10);
      tagDisplayOffset = (tagDisplayOffset + 10) % (maxOffset + 10);
    }
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<div class="space-y-3"><!---->`);
    Form_field($$payload2, {
      form,
      name: "tags",
      children: ($$payload3) => {
        const each_array = ensure_array_like(filteredSuggestedTags);
        $$payload3.out.push(`<label class="text-sm font-medium">Setting (tags)</label> <div class="space-y-2"><div class="text-muted-foreground text-xs">Suggestions:</div> <div class="flex flex-wrap gap-2"><!--[-->`);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let tag = each_array[$$index];
          Button($$payload3, {
            variant: "outline",
            size: "sm",
            type: "button",
            onclick: () => addTag(tag),
            disabled: selectedTags.includes(tag) || selectedTags.length >= 10,
            class: "h-8 text-xs",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->${escape_html(tag)}`);
            },
            $$slots: { default: true }
          });
        }
        $$payload3.out.push(`<!--]--> `);
        Button($$payload3, {
          variant: "outline",
          size: "sm",
          type: "button",
          onclick: cycleTags,
          class: "text-muted-foreground hover:text-foreground h-8 px-2",
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->→`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----></div></div> <div class="flex gap-2">`);
        Input($$payload3, {
          placeholder: "Search or create tag...",
          onkeydown: handleNewTagKeydown,
          class: "flex-1",
          get value() {
            return newTagInput;
          },
          set value($$value) {
            newTagInput = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----> `);
        Button($$payload3, {
          type: "button",
          onclick: addNewTag,
          disabled: !newTagInput.trim() || selectedTags.includes(newTagInput.trim()) || selectedTags.length >= 10,
          size: "sm",
          children: ($$payload4) => {
            Plus($$payload4, { class: "h-4 w-4" });
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----></div> `);
        if (selectedTags.length > 0) {
          $$payload3.out.push("<!--[-->");
          const each_array_1 = ensure_array_like(selectedTags);
          $$payload3.out.push(`<div class="space-y-2"><div class="text-muted-foreground text-xs">Selected:</div> <div class="flex flex-wrap gap-2"><!--[-->`);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let tag = each_array_1[$$index_1];
            Badge($$payload3, {
              variant: "secondary",
              class: "flex items-center gap-1",
              children: ($$payload4) => {
                $$payload4.out.push(`<!---->${escape_html(tag)} <button type="button" class="hover:bg-muted-foreground/20 ml-1 h-3 w-3 rounded-sm">`);
                X($$payload4, { class: "h-3 w-3" });
                $$payload4.out.push(`<!----></button>`);
              },
              $$slots: { default: true }
            });
          }
          $$payload3.out.push(`<!--]--></div></div>`);
        } else {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--> <input type="hidden" name="tags"${attr("value", JSON.stringify(selectedTags))}/> <!---->`);
        Form_field_errors($$payload3, {});
        $$payload3.out.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div>`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  const fileSystem = getFileSystemContext();
  const gameName = page.params.gameName;
  const {
    data: initialData,
    isEditMode,
    thumbnailUrl: initialThumbnailUrl
  } = await_outside_boundary();
  const form = superForm(defaults(initialData, zod(createGameSchema)), {
    SPA: true,
    validators: zod(createGameSchema),
    async onUpdate({ form: form2 }) {
      if (form2.valid) {
        isSubmitting = true;
        showSuccessMessage = false;
        const data = form2.data;
        const folderName = data.name.replace(/\s+/g, "_");
        const gameData = JSON.stringify(data, null, 2);
        const gameFile = new File([gameData], "game.json", { type: "application/json" });
        const error = await fileSystem.upload(gameFile, gameName, true);
        if (error) {
          console.error("Failed to save game:", error);
          isSubmitting = false;
          return;
        }
        if (selectedThumbnail) {
          const thumbnailError = await fileSystem.upload(selectedThumbnail, folderName, true);
          if (thumbnailError) {
            console.error("Failed to save thumbnail:", thumbnailError);
          }
        }
        isSubmitting = false;
        showSuccessMessage = true;
        setTimeout(
          () => {
            showSuccessMessage = false;
          },
          3e3
        );
      }
    }
  });
  const { form: formData, enhance, validateForm } = form;
  let selectedTags = initialData.tags || [];
  let selectedThumbnail = null;
  let thumbnailPreviewUrl = initialThumbnailUrl || null;
  let showSuccessMessage = false;
  let isSubmitting = false;
  function handleTagsChange(tags) {
    selectedTags = tags;
    store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).tags = selectedTags);
  }
  function handleThumbnailChange(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }
      selectedThumbnail = new File([file], "thumbnail.jpg", { type: "image/jpeg" });
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
      thumbnailPreviewUrl = URL.createObjectURL(file);
    }
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<div class="mx-auto max-w-4xl p-6"><!---->`);
    Card($$payload2, {
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->`);
        Card_header($$payload3, {
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->`);
            Card_title($$payload4, {
              class: "text-center text-2xl font-bold",
              children: ($$payload5) => {
                $$payload5.out.push(`<!---->${escape_html(isEditMode ? "Edit Board Game" : "Create New Board Game")}`);
              },
              $$slots: { default: true }
            });
            $$payload4.out.push(`<!----> <hr class="border-t border-gray-300"/>`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----> <!---->`);
        Card_content($$payload3, {
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->`);
            {
              $$payload4.out.push(`<form class="space-y-6"><!---->`);
              Form_field($$payload4, {
                form,
                name: "name",
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->`);
                  {
                    let children = function($$payload6, { props }) {
                      $$payload6.out.push(`<!---->`);
                      Form_label($$payload6, {
                        class: "text-base font-medium",
                        children: ($$payload7) => {
                          $$payload7.out.push(`<!---->Game Name`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload6.out.push(`<!----> `);
                      Input($$payload6, spread_props([
                        props,
                        {
                          placeholder: "",
                          maxlength: 80,
                          class: "w-full",
                          get value() {
                            return store_get($$store_subs ??= {}, "$formData", formData).name;
                          },
                          set value($$value) {
                            store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).name = $$value);
                            $$settled = false;
                          }
                        }
                      ]));
                      $$payload6.out.push(`<!---->`);
                    };
                    Control($$payload5, { children });
                  }
                  $$payload5.out.push(`<!----> <!---->`);
                  Form_description($$payload5, {
                    class: "text-muted-foreground flex justify-between text-xs",
                    children: ($$payload6) => {
                      $$payload6.out.push(`<span>up to 80 characters · required</span> <span>${escape_html(store_get($$store_subs ??= {}, "$formData", formData).name?.length || 0)}/80</span>`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload5.out.push(`<!----> <!---->`);
                  Form_field_errors($$payload5, {});
                  $$payload5.out.push(`<!---->`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> <div class="space-y-2"><label class="text-base font-medium">Players</label> <div class="flex gap-4"><!---->`);
              Form_field($$payload4, {
                form,
                name: "minPlayers",
                class: "flex-1",
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->`);
                  {
                    let children = function($$payload6, { props }) {
                      $$payload6.out.push(`<div class="flex items-center gap-2"><span class="text-base">Min</span> `);
                      Input($$payload6, spread_props([
                        props,
                        {
                          type: "number",
                          min: 1,
                          max: 20,
                          class: "w-16",
                          get value() {
                            return store_get($$store_subs ??= {}, "$formData", formData).minPlayers;
                          },
                          set value($$value) {
                            store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).minPlayers = $$value);
                            $$settled = false;
                          }
                        }
                      ]));
                      $$payload6.out.push(`<!----></div>`);
                    };
                    Control($$payload5, { children });
                  }
                  $$payload5.out.push(`<!----> <!---->`);
                  Form_field_errors($$payload5, {});
                  $$payload5.out.push(`<!---->`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> <!---->`);
              Form_field($$payload4, {
                form,
                name: "maxPlayers",
                class: "flex-1",
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->`);
                  {
                    let children = function($$payload6, { props }) {
                      $$payload6.out.push(`<div class="flex items-center gap-2"><span class="text-base">Max</span> `);
                      Input($$payload6, spread_props([
                        props,
                        {
                          type: "number",
                          min: 1,
                          max: 20,
                          class: "w-16",
                          get value() {
                            return store_get($$store_subs ??= {}, "$formData", formData).maxPlayers;
                          },
                          set value($$value) {
                            store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).maxPlayers = $$value);
                            $$settled = false;
                          }
                        }
                      ]));
                      $$payload6.out.push(`<!----></div>`);
                    };
                    Control($$payload5, { children });
                  }
                  $$payload5.out.push(`<!----> <!---->`);
                  Form_field_errors($$payload5, {});
                  $$payload5.out.push(`<!---->`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----></div></div> <!---->`);
              Form_field($$payload4, {
                form,
                name: "description",
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->`);
                  {
                    let children = function($$payload6, { props }) {
                      $$payload6.out.push(`<!---->`);
                      Form_label($$payload6, {
                        class: "text-base font-medium",
                        children: ($$payload7) => {
                          $$payload7.out.push(`<!---->Game Description`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload6.out.push(`<!----> <textarea${spread_attributes(
                        {
                          ...props,
                          placeholder: "",
                          rows: 4,
                          maxlength: 500,
                          class: "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-base file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        }
                      )}>`);
                      const $$body = escape_html(store_get($$store_subs ??= {}, "$formData", formData).description);
                      if ($$body) {
                        $$payload6.out.push(`${$$body}`);
                      }
                      $$payload6.out.push(`</textarea>`);
                    };
                    Control($$payload5, { children });
                  }
                  $$payload5.out.push(`<!----> <!---->`);
                  Form_description($$payload5, {
                    class: "text-muted-foreground flex justify-between text-xs",
                    children: ($$payload6) => {
                      $$payload6.out.push(`<span>up to 500 characters · required</span> <span>${escape_html(store_get($$store_subs ??= {}, "$formData", formData).description?.length || 0)}/500</span>`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload5.out.push(`<!----> <!---->`);
                  Form_field_errors($$payload5, {});
                  $$payload5.out.push(`<!---->`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> `);
              Tag_selector($$payload4, { form, selectedTags, onTagsChange: handleTagsChange });
              $$payload4.out.push(`<!----> <div class="space-y-2"><label class="text-base font-medium">Game Thumbnail</label> <div class="space-y-4"><div class="relative"><div class="border-input bg-muted/50 w-full overflow-hidden rounded-lg border-2 border-dashed" style="aspect-ratio: 920 / 430;">`);
              if (thumbnailPreviewUrl) {
                $$payload4.out.push("<!--[-->");
                $$payload4.out.push(`<img${attr("src", thumbnailPreviewUrl)} alt="Game thumbnail preview" class="h-full w-full object-cover"/> <button type="button" class="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute top-2 right-2 rounded-full p-1"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>`);
              } else {
                $$payload4.out.push("<!--[!-->");
                $$payload4.out.push(`<div class="text-muted-foreground flex h-full flex-col items-center justify-center">`);
                Image($$payload4, { class: "mb-2 h-12 w-12" });
                $$payload4.out.push(`<!----> <p class="text-sm">920px × 430px thumbnail</p> <p class="text-xs">Will be stretched to fill</p></div>`);
              }
              $$payload4.out.push(`<!--]--></div></div> <div class="flex items-center gap-2">`);
              Input($$payload4, {
                type: "file",
                accept: "image/*",
                onchange: handleThumbnailChange,
                class: "flex-1"
              });
              $$payload4.out.push(`<!----> `);
              Button($$payload4, {
                type: "button",
                onclick: () => document.querySelector('input[type="file"]')?.click(),
                variant: "outline",
                size: "sm",
                children: ($$payload5) => {
                  Upload($$payload5, { class: "mr-2 h-4 w-4" });
                  $$payload5.out.push(`<!----> Browse`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----></div> <p class="text-muted-foreground text-xs">Recommended size: 920px × 430px. Larger images will be scaled to fit.</p></div></div> <div class="pt-4">`);
              if (showSuccessMessage) {
                $$payload4.out.push("<!--[-->");
                $$payload4.out.push(`<div class="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800">`);
                Circle_check_big($$payload4, { class: "h-5 w-5" });
                $$payload4.out.push(`<!----> <span>Game ${escape_html(isEditMode ? "updated" : "created")} successfully!</span></div>`);
              } else {
                $$payload4.out.push("<!--[!-->");
              }
              $$payload4.out.push(`<!--]--> `);
              Button($$payload4, {
                type: "submit",
                class: "w-full",
                disabled: isSubmitting,
                children: ($$payload5) => {
                  if (isSubmitting) {
                    $$payload5.out.push("<!--[-->");
                    $$payload5.out.push(`<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>`);
                  } else {
                    $$payload5.out.push("<!--[!-->");
                  }
                  $$payload5.out.push(`<!--]--> ${escape_html(isSubmitting ? "Saving..." : isEditMode ? "Update" : "Create")}`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----></div></form>`);
            }
            $$payload4.out.push(`<!---->`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div>`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
