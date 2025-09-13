import { w as push, M as attr, N as attr_class, B as clsx, z as escape_html, A as spread_attributes, y as pop, S as await_outside_boundary, J as copy_payload, K as assign_payload, P as store_mutate, Q as store_get, R as unsubscribe_stores } from "../../../../../../../chunks/index2.js";
import { g as getLoadSvgsContext } from "../../../../../../../chunks/svg-context.svelte.js";
import { s as superForm, z as zod, d as defaults, F as Form_field, C as Control, a as Form_field_errors, b as Form_label } from "../../../../../../../chunks/zod4.js";
import { R as Root, P as Popover_trigger, a as Popover_content } from "../../../../../../../chunks/index6.js";
import { U as Upload, C as Card, a as Card_header, b as Card_title, c as Card_content } from "../../../../../../../chunks/card-title.js";
import "clsx";
import { p as page } from "../../../../../../../chunks/index3.js";
import { B as Button } from "../../../../../../../chunks/Icon.js";
import { u as useId, I as Input } from "../../../../../../../chunks/popper-layer-force-mount.js";
import { c as cn } from "../../../../../../../chunks/utils2.js";
import { z } from "zod";
import "@sveltejs/kit/internal";
import "../../../../../../../chunks/exports.js";
import "../../../../../../../chunks/utils.js";
import "../../../../../../../chunks/state.svelte.js";
import "ts-deepmerge";
import "@sveltejs/kit";
import "memoize-weak";
import "zod-to-json-schema";
import { g as getFileSystemContext } from "../../../../../../../chunks/context.js";
import { P as Plus } from "../../../../../../../chunks/plus.js";
function File_drop_zone($$payload, $$props) {
  push();
  let {
    id = useId(),
    children,
    maxFiles,
    maxFileSize,
    fileCount,
    disabled = false,
    onUpload,
    onFileRejected,
    accept,
    class: className,
    $$slots,
    $$events,
    ...rest
  } = $$props;
  if (maxFiles !== void 0 && fileCount === void 0) {
    console.warn("Make sure to provide FileDropZone with `fileCount` when using the `maxFiles` prompt");
  }
  const canUploadFiles = !disabled && true && !(maxFiles !== void 0 && fileCount !== void 0 && fileCount >= maxFiles);
  $$payload.out.push(`<label${attr("for", id)}${attr("aria-disabled", !canUploadFiles)}${attr_class(clsx(cn("border-border hover:bg-accent/25 flex h-48 w-full place-items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all hover:cursor-pointer aria-disabled:opacity-50 aria-disabled:hover:cursor-not-allowed", className)))}>`);
  if (children) {
    $$payload.out.push("<!--[-->");
    children($$payload);
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div class="flex flex-col place-items-center justify-center gap-2"><div class="border-border text-muted-foreground flex size-14 place-items-center justify-center rounded-full border border-dashed">`);
    Upload($$payload, { class: "size-7" });
    $$payload.out.push(`<!----></div> <div class="flex flex-col gap-0.5 text-center"><span class="text-muted-foreground font-medium">Drag 'n' drop files here, or click to select files</span> `);
    if (maxFiles || maxFileSize) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<span class="text-muted-foreground/75 text-sm">`);
      if (maxFiles) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<span>You can upload ${escape_html(maxFiles)} files</span>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> `);
      if (maxFiles && maxFileSize) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<span>(up to ${escape_html(displaySize(maxFileSize))} each)</span>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> `);
      if (maxFileSize && !maxFiles) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<span>Maximum size ${escape_html(displaySize(maxFileSize))}</span>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--></span>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></div></div>`);
  }
  $$payload.out.push(`<!--]--> <input${spread_attributes(
    {
      ...rest,
      disabled: !canUploadFiles,
      id,
      accept,
      multiple: maxFiles === void 0 || maxFiles - (fileCount ?? 0) > 1,
      type: "file",
      class: "hidden"
    }
  )}/></label>`);
  pop();
}
const displaySize = (bytes) => {
  if (bytes < KILOBYTE) return `${bytes.toFixed(0)} B`;
  if (bytes < MEGABYTE) return `${(bytes / KILOBYTE).toFixed(0)} KB`;
  if (bytes < GIGABYTE) return `${(bytes / MEGABYTE).toFixed(0)} MB`;
  return `${(bytes / GIGABYTE).toFixed(0)} GB`;
};
const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;
const GIGABYTE = 1024 * MEGABYTE;
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  getLoadSvgsContext();
  let { front: templateFront, back: templateBack } = await_outside_boundary();
  const emptyCardSchema = z.object({
    side: z.enum(["front", "back"]),
    width: z.number().min(5, "Width must be greater than 5mm").max(1e3, "Width must be less than 1000mm"),
    height: z.number().min(5, "Height must be greater than 5mm").max(1e3, "Height must be less than 1000mm")
  });
  const form = superForm(defaults(zod(emptyCardSchema)), {
    SPA: true,
    validators: zod(emptyCardSchema),
    onUpdate({ form: form2 }) {
      if (form2.valid) {
        createEmptySvg(form2.data.side, form2.data.width, form2.data.height);
      }
    }
  });
  const { form: formData, enhance } = form;
  const currentProject = page.params.gameName;
  const currentCard = page.params.deckName;
  const fullFolderPath = `/${currentProject}/system/${currentCard}`;
  const fileSystem = getFileSystemContext();
  let { width, height } = (() => {
    let width2 = null;
    let height2 = null;
    if (templateFront) {
      width2 = templateFront.getAttribute("width");
      height2 = templateFront.getAttribute("height");
    } else if (templateBack) {
      width2 = templateBack.getAttribute("width");
      height2 = templateBack.getAttribute("height");
    }
    return {
      width: width2?.replace("mm", ""),
      height: height2?.replace("mm", "")
    };
  })();
  function buildUploadFunction(type) {
    const onUploadSvg = async (files) => {
      const file = files[0];
      const renamedFile = new File([file], `${type}.svg`, { type: file.type });
      await fileSystem.upload(renamedFile, fullFolderPath, true);
    };
    return onUploadSvg;
  }
  const onFileRejected = async ({ reason, file }) => {
    console.error(`File upload failed: ${file.name}`, reason);
    toast.error(`${file.name} failed to upload!`, { description: reason });
  };
  function createEmptySvg(side, width2, height2) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", width2 + "mm");
    svg.setAttribute("height", height2 + "mm");
    svg.setAttribute("viewBox", `0 0 ${width2 || 100} ${height2 || 100}`);
    const backgroundImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
    backgroundImage.id = "background";
    backgroundImage.setAttribute("href", "/placeholder.svg");
    backgroundImage.setAttribute("width", width2 + "px");
    backgroundImage.setAttribute("height", height2 + "px");
    svg.appendChild(backgroundImage);
    if (side === "front") {
      templateFront = svg;
    } else {
      templateBack = svg;
    }
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgFile = new File([svgString], `${side}.svg`, { type: "image/svg+xml" });
    fileSystem.upload(svgFile, fullFolderPath, true);
  }
  function svgOrUpload($$payload2, svgFile, side) {
    $$payload2.out.push(`<!---->`);
    Card($$payload2, {
      class: "w-full max-w-sm",
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->`);
        Card_header($$payload3, {
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->`);
            Card_title($$payload4, {
              class: "text-center text-2xl",
              children: ($$payload5) => {
                $$payload5.out.push(`<!---->${escape_html(side)} svg`);
              },
              $$slots: { default: true }
            });
            $$payload4.out.push(`<!---->`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----> <!---->`);
        Card_content($$payload3, {
          class: "flex h-full items-center justify-center",
          children: ($$payload4) => {
            if (svgFile) {
              $$payload4.out.push("<!--[-->");
              svgFile.cloneNode(true);
              $$payload4.out.push(`<div class="text-center"><div class="w-full max-w-sm border"></div> <div class="mt-2 flex items-center justify-between">`);
              if (width && height) {
                $$payload4.out.push("<!--[-->");
                $$payload4.out.push(`<!---->`);
                Root($$payload4, {
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->`);
                    Popover_trigger($$payload5, {
                      class: "w-full",
                      children: ($$payload6) => {
                        Button($$payload6, {
                          class: "w-full",
                          children: ($$payload7) => {
                            $$payload7.out.push(`<!---->Upload`);
                          },
                          $$slots: { default: true }
                        });
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!----> <!---->`);
                    Popover_content($$payload5, {
                      children: ($$payload6) => {
                        File_drop_zone($$payload6, {
                          onUpload: buildUploadFunction(side),
                          onFileRejected,
                          maxFileSize: 12 * MEGABYTE,
                          maxFiles: 1,
                          fileCount: 0,
                          class: "mb-4 h-full"
                        });
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!----> `);
                Button($$payload4, {
                  onclick: () => createEmptySvg(side, width, height),
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->Overwrite with empty`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!---->`);
              } else {
                $$payload4.out.push("<!--[!-->");
              }
              $$payload4.out.push(`<!--]--></div></div>`);
            } else {
              $$payload4.out.push("<!--[!-->");
              $$payload4.out.push(`<div class="flex h-full w-full flex-col">`);
              File_drop_zone($$payload4, {
                onUpload: buildUploadFunction(side),
                onFileRejected,
                maxFileSize: 12 * MEGABYTE,
                maxFiles: 1,
                fileCount: 0,
                class: "mb-4 h-full"
              });
              $$payload4.out.push(`<!----> `);
              if (width && height) {
                $$payload4.out.push("<!--[-->");
                Button($$payload4, {
                  onclick: () => createEmptySvg(side),
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->Create empty`);
                  },
                  $$slots: { default: true }
                });
              } else {
                $$payload4.out.push("<!--[!-->");
                $$payload4.out.push(`<!---->`);
                Root($$payload4, {
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->`);
                    Popover_trigger($$payload5, {
                      children: ($$payload6) => {
                        Button($$payload6, {
                          class: "w-full",
                          children: ($$payload7) => {
                            $$payload7.out.push(`<!---->Create empty`);
                          },
                          $$slots: { default: true }
                        });
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!----> <!---->`);
                    Popover_content($$payload5, {
                      children: ($$payload6) => {
                        $$payload6.out.push(`<form><input type="hidden" name="side"${attr("value", side)}/> <div class="class flex flex-col"><!---->`);
                        Form_field($$payload6, {
                          form,
                          name: "width",
                          class: "grid grid-cols-4 gap-2",
                          children: ($$payload7) => {
                            $$payload7.out.push(`<!---->`);
                            {
                              let children = function($$payload8, { props }) {
                                $$payload8.out.push(`<!---->`);
                                Form_label($$payload8, {
                                  children: ($$payload9) => {
                                    $$payload9.out.push(`<!---->Width:`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$payload8.out.push(`<!----> `);
                                Input($$payload8, {
                                  type: "number",
                                  placeholder: "width (mm)",
                                  class: "col-span-3",
                                  get value() {
                                    return store_get($$store_subs ??= {}, "$formData", formData).width;
                                  },
                                  set value($$value) {
                                    store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).width = $$value);
                                    $$settled = false;
                                  }
                                });
                                $$payload8.out.push(`<!---->`);
                              };
                              Control($$payload7, { children });
                            }
                            $$payload7.out.push(`<!----> <!---->`);
                            Form_field_errors($$payload7, { class: "col-span-4 mb-2" });
                            $$payload7.out.push(`<!---->`);
                          },
                          $$slots: { default: true }
                        });
                        $$payload6.out.push(`<!----> <!---->`);
                        Form_field($$payload6, {
                          form,
                          class: "grid grid-cols-4 gap-2",
                          name: "height",
                          children: ($$payload7) => {
                            $$payload7.out.push(`<!---->`);
                            {
                              let children = function($$payload8, { props }) {
                                $$payload8.out.push(`<!---->`);
                                Form_label($$payload8, {
                                  children: ($$payload9) => {
                                    $$payload9.out.push(`<!---->Height:`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$payload8.out.push(`<!----> `);
                                Input($$payload8, {
                                  type: "number",
                                  placeholder: "hegith (mm)",
                                  class: "col-span-3",
                                  get value() {
                                    return store_get($$store_subs ??= {}, "$formData", formData).height;
                                  },
                                  set value($$value) {
                                    store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).height = $$value);
                                    $$settled = false;
                                  }
                                });
                                $$payload8.out.push(`<!---->`);
                              };
                              Control($$payload7, { children });
                            }
                            $$payload7.out.push(`<!----> <!---->`);
                            Form_field_errors($$payload7, { class: "col-span-4 mb-2" });
                            $$payload7.out.push(`<!---->`);
                          },
                          $$slots: { default: true }
                        });
                        $$payload6.out.push(`<!----></div> `);
                        Button($$payload6, {
                          type: "submit",
                          children: ($$payload7) => {
                            Plus($$payload7, {});
                            $$payload7.out.push(`<!----> Create new empty ${escape_html(side)} deck`);
                          },
                          $$slots: { default: true }
                        });
                        $$payload6.out.push(`<!----></form>`);
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!---->`);
              }
              $$payload4.out.push(`<!--]--></div>`);
            }
            $$payload4.out.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!---->`);
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<div class="flex w-full flex-col items-center justify-center"><div class="grid w-1/2 grid-cols-2 grid-rows-2">`);
    svgOrUpload($$payload2, templateBack, "back");
    $$payload2.out.push(`<!----> `);
    svgOrUpload($$payload2, templateFront, "front");
    $$payload2.out.push(`<!----></div></div>`);
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
