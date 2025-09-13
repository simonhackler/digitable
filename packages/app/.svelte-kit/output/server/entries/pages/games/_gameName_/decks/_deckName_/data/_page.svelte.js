import "clsx";
import { D as bind_props, y as pop, w as push, F as spread_props, A as spread_attributes, G as derived, E as props_id, B as clsx, J as copy_payload, K as assign_payload, O as ensure_array_like, z as escape_html, I as stringify, N as attr_class, S as await_outside_boundary } from "../../../../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../../../../chunks/exports.js";
import "../../../../../../../chunks/utils.js";
import "../../../../../../../chunks/state.svelte.js";
import { p as page } from "../../../../../../../chunks/index3.js";
import { g as getLoadSvgsContext } from "../../../../../../../chunks/svg-context.svelte.js";
import { b as box, m as mergeProps, S as SvelteMap, a as attachRef, d as createBitsAttrs, h as getDataOrientation, g as getDataDisabled, i as getAriaOrientation, j as getDisabled, k as getAriaSelected, l as getHidden, c as createId, n as createSubscriber } from "../../../../../../../chunks/create-id.js";
import "style-to-object";
import { n as noop$1, j as Floating_layer, u as useId, k as Popper_layer_force_mount, l as Popper_layer, m as getFloatingContentCSSVars, o as Floating_layer_anchor, C as Context, w as watch, b as SPACE, c as ENTER, e as Portal, I as Input } from "../../../../../../../chunks/popper-layer-force-mount.js";
import { M as MenuRootState, a as MenuMenuState, b as MenuContentState, C as CONTEXT_MENU_TRIGGER_ATTR, c as ContextMenuTriggerState, R as RovingFocusGroup, d as Menu_item } from "../../../../../../../chunks/is-using-keyboard.svelte.js";
import Papa from "papaparse";
import "jspreadsheet-ce";
import { I as Icon, b as buttonVariants, B as Button } from "../../../../../../../chunks/Icon.js";
import { g as getFileSystemContext } from "../../../../../../../chunks/context.js";
import { g as generateSvg, i as initialSetupForSvgItem, c as createHighlightRect, a as appendHighlightToSvg } from "../../../../../../../chunks/svg-helpers.js";
import "jsuites";
import { R as Root$2, P as Popover_trigger, a as Popover_content } from "../../../../../../../chunks/index6.js";
import { a as Dialog_description$1, M as Menu_separator, R as Root$1, f as Dialog_trigger, c as Dialog_content, d as Dialog_header, e as Dialog_title } from "../../../../../../../chunks/index4.js";
import { L as Label } from "../../../../../../../chunks/label.js";
import { c as cn } from "../../../../../../../chunks/utils2.js";
import { Err, Ok } from "wellcrafted/result";
import { C as Check } from "../../../../../../../chunks/check.js";
function Context_menu($$payload, $$props) {
  push();
  let {
    open = false,
    dir = "ltr",
    onOpenChange = noop$1,
    onOpenChangeComplete = noop$1,
    children
  } = $$props;
  const root = MenuRootState.create({
    variant: box.with(() => "context-menu"),
    dir: box.with(() => dir),
    onClose: () => {
      open = false;
      onOpenChange?.(false);
    }
  });
  MenuMenuState.create(
    {
      open: box.with(() => open, (v) => {
        open = v;
        onOpenChange(v);
      }),
      onOpenChangeComplete: box.with(() => onOpenChangeComplete)
    },
    root
  );
  Floating_layer($$payload, {
    children: ($$payload2) => {
      children?.($$payload2);
      $$payload2.out.push(`<!---->`);
    }
  });
  bind_props($$props, { open });
  pop();
}
function Context_menu_content$1($$payload, $$props) {
  push();
  let {
    id = useId(),
    child,
    children,
    ref = null,
    loop = true,
    onInteractOutside = noop$1,
    onCloseAutoFocus = noop$1,
    onOpenAutoFocus = noop$1,
    preventScroll = true,
    // we need to explicitly pass this prop to the PopperLayer to override
    // the default menu behavior of handling outside interactions on the trigger
    onEscapeKeydown = noop$1,
    forceMount = false,
    trapFocus = false,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const contentState = MenuContentState.create({
    id: box.with(() => id),
    loop: box.with(() => loop),
    ref: box.with(() => ref, (v) => ref = v),
    onCloseAutoFocus: box.with(() => onCloseAutoFocus)
  });
  const mergedProps = mergeProps(restProps, contentState.props);
  function handleInteractOutside(e) {
    onInteractOutside(e);
    if (e.defaultPrevented) return;
    if (e.target && e.target instanceof Element) {
      const subContentSelector = `[${contentState.parentMenu.root.getBitsAttr("sub-content")}]`;
      if (e.target.closest(subContentSelector)) return;
    }
    contentState.parentMenu.onClose();
  }
  function handleEscapeKeydown(e) {
    onEscapeKeydown(e);
    if (e.defaultPrevented) return;
    contentState.parentMenu.onClose();
  }
  function isValidEvent(e) {
    if ("button" in e && e.button === 2) {
      const target = e.target;
      if (!target) return false;
      const isAnotherContextTrigger = target.closest(`[${CONTEXT_MENU_TRIGGER_ATTR}]`) !== contentState.parentMenu.triggerNode;
      return isAnotherContextTrigger;
    }
    return false;
  }
  if (forceMount) {
    $$payload.out.push("<!--[-->");
    {
      let popper = function($$payload2, { props, wrapperProps }) {
        const finalProps = mergeProps(props, { style: getFloatingContentCSSVars("context-menu") });
        if (child) {
          $$payload2.out.push("<!--[-->");
          child($$payload2, {
            props: finalProps,
            wrapperProps,
            ...contentState.snippetProps
          });
          $$payload2.out.push(`<!---->`);
        } else {
          $$payload2.out.push("<!--[!-->");
          $$payload2.out.push(`<div${spread_attributes({ ...wrapperProps })}><div${spread_attributes({ ...finalProps })}>`);
          children?.($$payload2);
          $$payload2.out.push(`<!----></div></div>`);
        }
        $$payload2.out.push(`<!--]-->`);
      };
      Popper_layer_force_mount($$payload, spread_props([
        mergedProps,
        contentState.popperProps,
        {
          ref: contentState.opts.ref,
          side: "right",
          sideOffset: 2,
          align: "start",
          enabled: contentState.parentMenu.opts.open.current,
          preventScroll,
          onInteractOutside: handleInteractOutside,
          onEscapeKeydown: handleEscapeKeydown,
          onOpenAutoFocus,
          isValidEvent,
          trapFocus,
          loop,
          id,
          popper,
          $$slots: { popper: true }
        }
      ]));
    }
  } else {
    $$payload.out.push("<!--[!-->");
    if (!forceMount) {
      $$payload.out.push("<!--[-->");
      {
        let popper = function($$payload2, { props, wrapperProps }) {
          const finalProps = mergeProps(props, { style: getFloatingContentCSSVars("context-menu") });
          if (child) {
            $$payload2.out.push("<!--[-->");
            child($$payload2, {
              props: finalProps,
              wrapperProps,
              ...contentState.snippetProps
            });
            $$payload2.out.push(`<!---->`);
          } else {
            $$payload2.out.push("<!--[!-->");
            $$payload2.out.push(`<div${spread_attributes({ ...wrapperProps })}><div${spread_attributes({ ...finalProps })}>`);
            children?.($$payload2);
            $$payload2.out.push(`<!----></div></div>`);
          }
          $$payload2.out.push(`<!--]-->`);
        };
        Popper_layer($$payload, spread_props([
          mergedProps,
          contentState.popperProps,
          {
            ref: contentState.opts.ref,
            side: "right",
            sideOffset: 2,
            align: "start",
            open: contentState.parentMenu.opts.open.current,
            preventScroll,
            onInteractOutside: handleInteractOutside,
            onEscapeKeydown: handleEscapeKeydown,
            onOpenAutoFocus,
            isValidEvent,
            trapFocus,
            loop,
            id,
            popper,
            $$slots: { popper: true }
          }
        ]));
      }
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
function Context_menu_trigger$1($$payload, $$props) {
  push();
  let {
    id = useId(),
    ref = null,
    child,
    children,
    disabled = false,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const triggerState = ContextMenuTriggerState.create({
    id: box.with(() => id),
    disabled: box.with(() => disabled),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, triggerState.props, { style: { pointerEvents: "auto" } });
  $$payload.out.push(`<!---->`);
  Floating_layer_anchor($$payload, {
    id,
    virtualEl: triggerState.virtualElement,
    ref: triggerState.opts.ref,
    children: ($$payload2) => {
      if (child) {
        $$payload2.out.push("<!--[-->");
        child($$payload2, { props: mergedProps });
        $$payload2.out.push(`<!---->`);
      } else {
        $$payload2.out.push("<!--[!-->");
        $$payload2.out.push(`<div${spread_attributes({ ...mergedProps })}>`);
        children?.($$payload2);
        $$payload2.out.push(`<!----></div>`);
      }
      $$payload2.out.push(`<!--]-->`);
    }
  });
  $$payload.out.push(`<!---->`);
  bind_props($$props, { ref });
  pop();
}
const tabsAttrs = createBitsAttrs({
  component: "tabs",
  parts: ["root", "list", "trigger", "content"]
});
const TabsRootContext = new Context("Tabs.Root");
class TabsRootState {
  static create(opts) {
    return TabsRootContext.set(new TabsRootState(opts));
  }
  opts;
  attachment;
  rovingFocusGroup;
  triggerIds = [];
  // holds the trigger ID for each value to associate it with the content
  valueToTriggerId = new SvelteMap();
  // holds the content ID for each value to associate it with the trigger
  valueToContentId = new SvelteMap();
  constructor(opts) {
    this.opts = opts;
    this.attachment = attachRef(opts.ref);
    this.rovingFocusGroup = new RovingFocusGroup({
      candidateAttr: tabsAttrs.trigger,
      rootNode: this.opts.ref,
      loop: this.opts.loop,
      orientation: this.opts.orientation
    });
  }
  registerTrigger(id, value) {
    this.triggerIds.push(id);
    this.valueToTriggerId.set(value, id);
    return () => {
      this.triggerIds = this.triggerIds.filter((triggerId) => triggerId !== id);
      this.valueToTriggerId.delete(value);
    };
  }
  registerContent(id, value) {
    this.valueToContentId.set(value, id);
    return () => {
      this.valueToContentId.delete(value);
    };
  }
  setValue(v) {
    this.opts.value.current = v;
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-orientation": getDataOrientation(this.opts.orientation.current),
    [tabsAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TabsListState {
  static create(opts) {
    return new TabsListState(opts, TabsRootContext.get());
  }
  opts;
  root;
  attachment;
  #isDisabled = derived(() => this.root.opts.disabled.current);
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(opts.ref);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "tablist",
    "aria-orientation": getAriaOrientation(this.root.opts.orientation.current),
    "data-orientation": getDataOrientation(this.root.opts.orientation.current),
    [tabsAttrs.list]: "",
    "data-disabled": getDataDisabled(this.#isDisabled()),
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TabsTriggerState {
  static create(opts) {
    return new TabsTriggerState(opts, TabsRootContext.get());
  }
  opts;
  root;
  attachment;
  #tabIndex = 0;
  #isActive = derived(() => this.root.opts.value.current === this.opts.value.current);
  #isDisabled = derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
  #ariaControls = derived(() => this.root.valueToContentId.get(this.opts.value.current));
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(opts.ref);
    watch([() => this.opts.id.current, () => this.opts.value.current], ([id, value]) => {
      return this.root.registerTrigger(id, value);
    });
    this.onfocus = this.onfocus.bind(this);
    this.onclick = this.onclick.bind(this);
    this.onkeydown = this.onkeydown.bind(this);
  }
  #activate() {
    if (this.root.opts.value.current === this.opts.value.current) return;
    this.root.setValue(this.opts.value.current);
  }
  onfocus(_) {
    if (this.root.opts.activationMode.current !== "automatic" || this.#isDisabled()) return;
    this.#activate();
  }
  onclick(_) {
    if (this.#isDisabled()) return;
    this.#activate();
  }
  onkeydown(e) {
    if (this.#isDisabled()) return;
    if (e.key === SPACE || e.key === ENTER) {
      e.preventDefault();
      this.#activate();
      return;
    }
    this.root.rovingFocusGroup.handleKeydown(this.opts.ref.current, e);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "tab",
    "data-state": getTabDataState(this.#isActive()),
    "data-value": this.opts.value.current,
    "data-orientation": getDataOrientation(this.root.opts.orientation.current),
    "data-disabled": getDataDisabled(this.#isDisabled()),
    "aria-selected": getAriaSelected(this.#isActive()),
    "aria-controls": this.#ariaControls(),
    [tabsAttrs.trigger]: "",
    disabled: getDisabled(this.#isDisabled()),
    tabindex: this.#tabIndex,
    //
    onclick: this.onclick,
    onfocus: this.onfocus,
    onkeydown: this.onkeydown,
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TabsContentState {
  static create(opts) {
    return new TabsContentState(opts, TabsRootContext.get());
  }
  opts;
  root;
  attachment;
  #isActive = derived(() => this.root.opts.value.current === this.opts.value.current);
  #ariaLabelledBy = derived(() => this.root.valueToTriggerId.get(this.opts.value.current));
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(opts.ref);
    watch([() => this.opts.id.current, () => this.opts.value.current], ([id, value]) => {
      return this.root.registerContent(id, value);
    });
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "tabpanel",
    hidden: getHidden(!this.#isActive()),
    tabindex: 0,
    "data-value": this.opts.value.current,
    "data-state": getTabDataState(this.#isActive()),
    "aria-labelledby": this.#ariaLabelledBy(),
    "data-orientation": getDataOrientation(this.root.opts.orientation.current),
    [tabsAttrs.content]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function getTabDataState(condition) {
  return condition ? "active" : "inactive";
}
function Tabs$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    id = createId(uid),
    ref = null,
    value = "",
    onValueChange = noop$1,
    orientation = "horizontal",
    loop = true,
    activationMode = "automatic",
    disabled = false,
    children,
    child,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const rootState = TabsRootState.create({
    id: box.with(() => id),
    value: box.with(() => value, (v) => {
      value = v;
      onValueChange(v);
    }),
    orientation: box.with(() => orientation),
    loop: box.with(() => loop),
    activationMode: box.with(() => activationMode),
    disabled: box.with(() => disabled),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, rootState.props);
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div${spread_attributes({ ...mergedProps })}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></div>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref, value });
  pop();
}
function Tabs_content$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    children,
    child,
    id = createId(uid),
    ref = null,
    value,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const contentState = TabsContentState.create({
    value: box.with(() => value),
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, contentState.props);
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div${spread_attributes({ ...mergedProps })}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></div>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
function Tabs_list$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    child,
    children,
    id = createId(uid),
    ref = null,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const listState = TabsListState.create({
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, listState.props);
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div${spread_attributes({ ...mergedProps })}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></div>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
function Tabs_trigger$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    child,
    children,
    disabled = false,
    id = createId(uid),
    type = "button",
    value,
    ref = null,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const triggerState = TabsTriggerState.create({
    id: box.with(() => id),
    disabled: box.with(() => disabled ?? false),
    value: box.with(() => value),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, triggerState.props, { type });
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<button${spread_attributes({ ...mergedProps })}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></button>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
function Dialog_footer($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<div${spread_attributes(
    {
      "data-slot": "dialog-footer",
      class: clsx(cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Dialog_description($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Dialog_description$1($$payload2, spread_props([
      {
        "data-slot": "dialog-description",
        class: cn("text-muted-foreground text-sm", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function Loader_circle($$payload, $$props) {
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
  const iconNode = [["path", { "d": "M21 12a9 9 0 1 1-6.219-8.56" }]];
  Icon($$payload, spread_props([
    { name: "loader-circle" },
    /**
     * @component @name LoaderCircle
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjEgMTJhOSA5IDAgMSAxLTYuMjE5LTguNTYiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/loader-circle
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
const ImageEditor = {};
function Context_menu_trigger($$payload, $$props) {
  push();
  let { ref = null, $$slots, $$events, ...restProps } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Context_menu_trigger$1($$payload2, spread_props([
      { "data-slot": "context-menu-trigger" },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function Context_menu_item($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    inset,
    variant = "default",
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Menu_item($$payload2, spread_props([
      {
        "data-slot": "context-menu-item",
        "data-inset": inset,
        "data-variant": variant,
        class: cn("data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground outline-hidden relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function Context_menu_content($$payload, $$props) {
  push();
  let {
    ref = null,
    portalProps,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Portal($$payload2, spread_props([
      portalProps,
      {
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->`);
          Context_menu_content$1($$payload3, spread_props([
            {
              "data-slot": "context-menu-content",
              class: cn("bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-h-(--bits-context-menu-content-available-height) origin-(--bits-context-menu-content-transform-origin) z-50 min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border p-1 shadow-md", className)
            },
            restProps,
            {
              get ref() {
                return ref;
              },
              set ref($$value) {
                ref = $$value;
                $$settled = false;
              }
            }
          ]));
          $$payload3.out.push(`<!---->`);
        },
        $$slots: { default: true }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function Context_menu_shortcut($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<span${spread_attributes(
    {
      "data-slot": "context-menu-shortcut",
      class: clsx(cn("text-muted-foreground ml-auto text-xs tracking-widest", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></span>`);
  bind_props($$props, { ref });
  pop();
}
function Context_menu_separator($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Menu_separator($$payload2, spread_props([
      {
        "data-slot": "context-menu-separator",
        class: cn("bg-border -mx-1 my-1 h-px", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
const Root = Context_menu;
const defaultWindow = void 0;
function getActiveElement(document) {
  let activeElement = document.activeElement;
  while (activeElement?.shadowRoot) {
    const node = activeElement.shadowRoot.activeElement;
    if (node === activeElement)
      break;
    else
      activeElement = node;
  }
  return activeElement;
}
class ActiveElement {
  #document;
  #subscribe;
  constructor(options = {}) {
    const { window: window2 = defaultWindow, document = window2?.document } = options;
    if (window2 === void 0) return;
    this.#document = document;
    this.#subscribe = createSubscriber();
  }
  get current() {
    this.#subscribe?.();
    if (!this.#document) return null;
    return getActiveElement(this.#document);
  }
}
new ActiveElement();
function isFunction(value) {
  return typeof value === "function";
}
function extract(value, defaultValue) {
  if (isFunction(value)) {
    const getter = value;
    const gotten = getter();
    if (gotten === void 0) return defaultValue;
    return gotten;
  }
  if (value === void 0) return defaultValue;
  return value;
}
class AnimationFrames {
  #callback;
  #fpsLimitOption = 0;
  #fpsLimit = derived(() => extract(this.#fpsLimitOption) ?? 0);
  #previousTimestamp = null;
  #frame = null;
  #fps = 0;
  #running = false;
  #window = defaultWindow;
  constructor(callback, options = {}) {
    if (options.window) this.#window = options.window;
    this.#fpsLimitOption = options.fpsLimit;
    this.#callback = callback;
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.toggle = this.toggle.bind(this);
  }
  #loop(timestamp) {
    if (!this.#running || !this.#window) return;
    if (this.#previousTimestamp === null) {
      this.#previousTimestamp = timestamp;
    }
    const delta = timestamp - this.#previousTimestamp;
    const fps = 1e3 / delta;
    if (this.#fpsLimit() && fps > this.#fpsLimit()) {
      this.#frame = this.#window.requestAnimationFrame(this.#loop.bind(this));
      return;
    }
    this.#fps = fps;
    this.#previousTimestamp = timestamp;
    this.#callback({ delta, timestamp });
    this.#frame = this.#window.requestAnimationFrame(this.#loop.bind(this));
  }
  start() {
    if (!this.#window) return;
    this.#running = true;
    this.#previousTimestamp = 0;
    this.#frame = this.#window.requestAnimationFrame(this.#loop.bind(this));
  }
  stop() {
    if (!this.#frame || !this.#window) return;
    this.#running = false;
    this.#window.cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }
  toggle() {
    this.#running ? this.stop() : this.start();
  }
  get fps() {
    return !this.#running ? 0 : this.#fps;
  }
  get running() {
    return this.#running;
  }
}
function useDebounce(callback, wait) {
  let context = null;
  const wait$ = extract(wait, 250);
  function debounced(...args) {
    if (context) {
      if (context.timeout) {
        clearTimeout(context.timeout);
      }
    } else {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      context = { timeout: null, runner: null, promise, resolve, reject };
    }
    context.runner = async () => {
      if (!context) return;
      const ctx = context;
      context = null;
      try {
        ctx.resolve(await callback.apply(this, args));
      } catch (error) {
        ctx.reject(error);
      }
    };
    context.timeout = setTimeout(context.runner, wait$);
    return context.promise;
  }
  debounced.cancel = async () => {
    if (!context || context.timeout === null) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!context || context.timeout === null) return;
    }
    clearTimeout(context.timeout);
    context.reject("Cancelled");
    context = null;
  };
  debounced.runScheduledNow = async () => {
    if (!context || !context.timeout) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!context || !context.timeout) return;
    }
    clearTimeout(context.timeout);
    context.timeout = null;
    await context.runner?.();
  };
  Object.defineProperty(debounced, "pending", {
    enumerable: true,
    get() {
      return !!context?.timeout;
    }
  });
  return debounced;
}
function noop() {
}
function useEventListener(_target, _events, handler, options) {
}
const ARRIVED_STATE_THRESHOLD_PIXELS = 1;
class ScrollState {
  #options;
  #element = derived(() => extract(this.#options.element));
  get element() {
    return this.#element();
  }
  set element($$value) {
    return this.#element($$value);
  }
  #idle = derived(() => extract(this.#options?.idle, 200));
  get idle() {
    return this.#idle();
  }
  set idle($$value) {
    return this.#idle($$value);
  }
  #offset = derived(() => extract(this.#options.offset, { left: 0, right: 0, top: 0, bottom: 0 }));
  get offset() {
    return this.#offset();
  }
  set offset($$value) {
    return this.#offset($$value);
  }
  #onScroll = derived(() => this.#options.onScroll ?? noop);
  get onScroll() {
    return this.#onScroll();
  }
  set onScroll($$value) {
    return this.#onScroll($$value);
  }
  #onStop = derived(() => this.#options.onStop ?? noop);
  get onStop() {
    return this.#onStop();
  }
  set onStop($$value) {
    return this.#onStop($$value);
  }
  #eventListenerOptions = derived(() => this.#options.eventListenerOptions ?? { capture: false, passive: true });
  get eventListenerOptions() {
    return this.#eventListenerOptions();
  }
  set eventListenerOptions($$value) {
    return this.#eventListenerOptions($$value);
  }
  #behavior = derived(() => extract(this.#options.behavior, "auto"));
  get behavior() {
    return this.#behavior();
  }
  set behavior($$value) {
    return this.#behavior($$value);
  }
  #onError = derived(() => this.#options.onError ?? ((e) => {
    console.error(e);
  }));
  get onError() {
    return this.#onError();
  }
  set onError($$value) {
    return this.#onError($$value);
  }
  internalX = 0;
  internalY = 0;
  #x = derived(() => this.internalX);
  get x() {
    return this.#x();
  }
  set x(v) {
    this.scrollTo(v, void 0);
  }
  #y = derived(() => this.internalY);
  get y() {
    return this.#y();
  }
  set y(v) {
    this.scrollTo(void 0, v);
  }
  isScrolling = false;
  arrived = { left: true, right: false, top: true, bottom: false };
  directions = { left: false, right: false, top: false, bottom: false };
  constructor(options) {
    this.#options = options;
    useEventListener(() => this.element, "scroll", this.#onScrollHandler, this.eventListenerOptions);
    useEventListener(() => this.element, "scrollend", (e) => this.onScrollEnd(e), this.eventListenerOptions);
    new AnimationFrames(() => this.setArrivedState());
  }
  /**
   * Updates direction and edge arrival states based on the current scroll position.
   * Takes into account writing mode, flex direction, and RTL layouts.
   */
  setArrivedState = () => {
    if (!window || !this.element) return;
    const el = this.element?.document?.documentElement || this.element?.documentElement || this.element;
    const { display, flexDirection, direction } = getComputedStyle(el);
    const directionMultiplier = direction === "rtl" ? -1 : 1;
    const scrollLeft = el.scrollLeft;
    if (scrollLeft !== this.internalX) {
      this.directions.left = scrollLeft < this.internalX;
      this.directions.right = scrollLeft > this.internalX;
    }
    const left = scrollLeft * directionMultiplier <= (this.offset.left || 0);
    const right = scrollLeft * directionMultiplier + el.clientWidth >= el.scrollWidth - (this.offset.right || 0) - ARRIVED_STATE_THRESHOLD_PIXELS;
    if (display === "flex" && flexDirection === "row-reverse") {
      this.arrived.left = right;
      this.arrived.right = left;
    } else {
      this.arrived.left = left;
      this.arrived.right = right;
    }
    this.internalX = scrollLeft;
    let scrollTop = el.scrollTop;
    if (this.element === window.document && !scrollTop) scrollTop = window.document.body.scrollTop;
    if (scrollTop !== this.internalY) {
      this.directions.top = scrollTop < this.internalY;
      this.directions.bottom = scrollTop > this.internalY;
    }
    const top = scrollTop <= (this.offset.top || 0);
    const bottom = scrollTop + el.clientHeight >= el.scrollHeight - (this.offset.bottom || 0) - ARRIVED_STATE_THRESHOLD_PIXELS;
    if (display === "flex" && flexDirection === "column-reverse") {
      this.arrived.top = bottom;
      this.arrived.bottom = top;
    } else {
      this.arrived.top = top;
      this.arrived.bottom = bottom;
    }
    this.internalY = scrollTop;
  };
  #onScrollHandler = (e) => {
    if (!window) return;
    this.setArrivedState();
    this.isScrolling = true;
    this.onScrollEndDebounced(e);
    this.onScroll(e);
  };
  /**
   * Programmatically scroll to a specific position.
   */
  scrollTo(x, y) {
    if (!window) return;
    (this.element instanceof Document ? window.document.body : this.element)?.scrollTo({ top: y ?? this.y, left: x ?? this.x, behavior: this.behavior });
    const scrollContainer = this.element?.document?.documentElement || this.element?.documentElement || this.element;
    if (x != null) this.internalX = scrollContainer.scrollLeft;
    if (y != null) this.internalY = scrollContainer.scrollTop;
  }
  /**
   * Scrolls to the top of the element.
   */
  scrollToTop() {
    this.scrollTo(void 0, 0);
  }
  /**
   * Scrolls to the bottom of the element.
   */
  scrollToBottom() {
    if (!window) return;
    const scrollContainer = this.element?.document?.documentElement || this.element?.documentElement || this.element;
    if (!scrollContainer) return;
    this.scrollTo(void 0, scrollContainer.scrollHeight);
  }
  onScrollEnd = (e) => {
    if (!this.isScrolling) return;
    this.isScrolling = false;
    this.directions.left = false;
    this.directions.right = false;
    this.directions.top = false;
    this.directions.bottom = false;
    this.onStop(e);
  };
  onScrollEndDebounced = useDebounce(this.onScrollEnd, () => this.idle);
}
function Tabs($$payload, $$props) {
  push();
  let {
    ref = null,
    value = "",
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Tabs$1($$payload2, spread_props([
      {
        "data-slot": "tabs",
        class: cn("flex flex-col gap-2", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        },
        get value() {
          return value;
        },
        set value($$value) {
          value = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref, value });
  pop();
}
function Tabs_content($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Tabs_content$1($$payload2, spread_props([
      {
        "data-slot": "tabs-content",
        class: cn("flex-1 outline-none", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function Tabs_list($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Tabs_list$1($$payload2, spread_props([
      {
        "data-slot": "tabs-list",
        class: cn("bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function Tabs_trigger($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Tabs_trigger$1($$payload2, spread_props([
      {
        "data-slot": "tabs-trigger",
        class: cn("data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
async function generateImages(prompts) {
  console.log("Starting image generation process...");
  console.log(`Generating ${prompts.length} images...`);
  console.log(prompts);
  try {
    const response = await fetch("/api/generate-images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompts })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      console.error("Image generation failed:", result.error);
      return Err(result.error);
    }
    return Ok(result);
  } catch (error) {
    console.error("Failed to generate images:", error);
    return Err(error instanceof Error ? error.message : String(error));
  }
}
function extractImageDimensions(svg, columnName) {
  const element = svg.getElementById(columnName);
  if (!element) {
    return { width: 512, height: 512, aspectRatio: "1:1" };
  }
  let width = 512;
  let height = 512;
  const widthAttr = element.getAttribute("width");
  const heightAttr = element.getAttribute("height");
  if (widthAttr && heightAttr) {
    width = parseFloat(widthAttr);
    height = parseFloat(heightAttr);
  } else {
    try {
      const bbox = element.getBBox();
      width = bbox.width || 512;
      height = bbox.height || 512;
    } catch (e) {
    }
  }
  const ratio = width / height;
  let aspectRatio;
  if (ratio >= 1.7) {
    aspectRatio = "16:9";
  } else if (ratio >= 1.4) {
    aspectRatio = "3:2";
  } else if (ratio >= 1.2) {
    aspectRatio = "4:3";
  } else if (ratio >= 0.8) {
    aspectRatio = "1:1";
  } else if (ratio >= 0.7) {
    aspectRatio = "3:4";
  } else if (ratio >= 0.6) {
    aspectRatio = "2:3";
  } else {
    aspectRatio = "9:16";
  }
  return { width, height, aspectRatio };
}
function columnBadge$1($$payload, name, type = "primary") {
  $$payload.out.push(`<span${attr_class(`bg-primary text-primary-foreground rounded px-2 py-1 text-xs ${stringify(type === "column" ? "font-medium" : "")}`)}>${escape_html(name)}</span>`);
}
function columnHeader$1($$payload, columnName) {
  $$payload.out.push(`<div class="mb-2 flex items-center gap-2">`);
  columnBadge$1($$payload, columnName, "column");
  $$payload.out.push(`<!----></div>`);
}
function promptPreviewCard($$payload, preview) {
  $$payload.out.push(`<div class="rounded-lg border p-3">`);
  columnHeader$1($$payload, preview.columnName);
  $$payload.out.push(`<!----> <div class="bg-muted rounded p-2 font-mono text-sm">${escape_html(preview.prompt || "No prompt specified")}</div></div>`);
}
function Generate_images_modal($$payload, $$props) {
  push();
  let {
    selection = null,
    spreadsheet,
    svgTemplate,
    onGenerateImages = () => {
    }
  } = $$props;
  let open = false;
  let isGenerating = false;
  let generationComplete = false;
  let columnPrompts = {};
  const selectionData = (() => {
    if (!selection) return {
      hasImageColumns: false,
      imageColumns: [],
      totalRows: 0,
      availableColumns: []
    };
    const headers = spreadsheet.getHeaders(true);
    const columns = spreadsheet.getConfig()?.columns;
    if (!columns) return {
      hasImageColumns: false,
      imageColumns: [],
      totalRows: 0,
      availableColumns: []
    };
    const imageColumns = [];
    for (let x = selection.borderLeftIndex; x <= selection.borderRightIndex; x++) {
      const column = columns[x];
      if (column && column.type === ImageEditor) {
        imageColumns.push({ index: x, name: headers[x] });
      }
    }
    const totalRows = selection.borderBottomIndex - selection.borderTopIndex + 1;
    const availableColumns = headers.map((header, index) => ({ name: header, index }));
    return {
      hasImageColumns: imageColumns.length > 0,
      imageColumns,
      totalRows,
      availableColumns
    };
  })();
  const isValidPrompt = Object.values(columnPrompts).some((prompt) => prompt.trim().length > 0);
  const totalImages = selectionData.imageColumns.length * selectionData.totalRows;
  const previewPrompts = (() => {
    if (!selection) return [];
    const headers = spreadsheet.getHeaders(true);
    const allPrompts = [];
    for (let rowIndex = selection.borderTopIndex; rowIndex <= selection.borderBottomIndex; rowIndex++) {
      const rowData = spreadsheet.getRowData(rowIndex);
      const rowId = rowData[0];
      for (const imageColumn of selectionData.imageColumns) {
        const dimensions = extractImageDimensions(svgTemplate, imageColumn.name);
        const promptToUse = columnPrompts[imageColumn.name] || "";
        if (!promptToUse.trim()) {
          allPrompts.push({
            columnName: imageColumn.name,
            prompt: "",
            rowIndex,
            rowId,
            aspectRatio: dimensions.aspectRatio
          });
          continue;
        }
        const prompt = promptToUse.replace(/{(\w+)}/g, (match, columnName) => {
          const columnIndex = headers.findIndex((header) => header === columnName);
          if (columnIndex !== -1 && rowData[columnIndex]) {
            return rowData[columnIndex];
          }
          return match;
        });
        allPrompts.push({
          columnName: imageColumn.name,
          prompt,
          rowIndex,
          rowId,
          aspectRatio: dimensions.aspectRatio
        });
      }
    }
    return allPrompts;
  })();
  function insertColumnPlaceholderToField(targetColumn, columnName) {
    columnPrompts[targetColumn] = (columnPrompts[targetColumn] || "") + `{${columnName}}`;
  }
  async function handleGenerate() {
    if (!isValidPrompt) return;
    isGenerating = true;
    generationComplete = false;
    const imagePrompts = previewPrompts.filter((p) => p.prompt.trim().length > 0);
    generateImages(imagePrompts).then((images) => {
      const { data, error } = images;
      if (data) {
        onGenerateImages(data);
        generationComplete = true;
        setTimeout(
          () => {
            generationComplete = false;
          },
          2e3
        );
      }
      isGenerating = false;
    });
    open = false;
  }
  function quickInsertButtons($$payload2, targetColumnName) {
    const each_array = ensure_array_like(selectionData.availableColumns);
    $$payload2.out.push(`<div class="flex flex-wrap gap-1"><span class="text-muted-foreground mr-2 text-xs">Quick insert:</span> <!--[-->`);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let availableColumn = each_array[$$index];
      Button($$payload2, {
        variant: "outline",
        size: "sm",
        onclick: () => insertColumnPlaceholderToField(targetColumnName, availableColumn.name),
        class: "h-6 px-2 text-xs",
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->${escape_html(availableColumn.name)}`);
        },
        $$slots: { default: true }
      });
    }
    $$payload2.out.push(`<!--]--></div>`);
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Root$1($$payload2, {
      get open() {
        return open;
      },
      set open($$value) {
        open = $$value;
        $$settled = false;
      },
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->`);
        Dialog_trigger($$payload3, {
          class: buttonVariants({ variant: "outline" }),
          disabled: !selectionData.hasImageColumns || isGenerating,
          children: ($$payload4) => {
            if (isGenerating) {
              $$payload4.out.push("<!--[-->");
              Loader_circle($$payload4, { class: "mr-2 h-4 w-4 animate-spin" });
              $$payload4.out.push(`<!----> Generating...`);
            } else {
              $$payload4.out.push("<!--[!-->");
              if (generationComplete) {
                $$payload4.out.push("<!--[-->");
                Check($$payload4, { class: "mr-2 h-4 w-4" });
                $$payload4.out.push(`<!----> Generated!`);
              } else {
                $$payload4.out.push("<!--[!-->");
                $$payload4.out.push(`Generate Images`);
              }
              $$payload4.out.push(`<!--]-->`);
            }
            $$payload4.out.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----> <!---->`);
        Dialog_content($$payload3, {
          class: "max-h-[90vh] overflow-y-auto sm:max-w-[900px]",
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->`);
            Dialog_header($$payload4, {
              children: ($$payload5) => {
                $$payload5.out.push(`<!---->`);
                Dialog_title($$payload5, {
                  children: ($$payload6) => {
                    $$payload6.out.push(`<!---->Generate Images`);
                  },
                  $$slots: { default: true }
                });
                $$payload5.out.push(`<!----> <!---->`);
                Dialog_description($$payload5, {
                  children: ($$payload6) => {
                    $$payload6.out.push(`<!---->Generate AI images for selected image columns in your cards.`);
                  },
                  $$slots: { default: true }
                });
                $$payload5.out.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$payload4.out.push(`<!----> `);
            if (selectionData.hasImageColumns) {
              $$payload4.out.push("<!--[-->");
              const each_array_1 = ensure_array_like(selectionData.imageColumns);
              $$payload4.out.push(`<div class="grid gap-4 py-4"><div class="bg-muted rounded-lg p-3"><h4 class="mb-2 text-sm font-medium">Selection Summary</h4> <p class="text-muted-foreground text-sm">Generating ${escape_html(totalImages)} images for ${escape_html(selectionData.totalRows)} rows across ${escape_html(selectionData.imageColumns.length)} image columns</p> <div class="mt-2"><span class="text-xs font-medium">Image columns:</span> <!--[-->`);
              for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
                let column = each_array_1[i];
                columnBadge$1($$payload4, column.name);
              }
              $$payload4.out.push(`<!--]--></div></div> `);
              if (selectionData.imageColumns.length === 1) {
                $$payload4.out.push("<!--[-->");
                $$payload4.out.push(`<div class="space-y-4"><div class="space-y-2">`);
                Label($$payload4, {
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->Prompt Template for ${escape_html(selectionData.imageColumns[0].name)}`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!----> `);
                Input($$payload4, {
                  id: `prompt-${stringify(selectionData.imageColumns[0].name)}`,
                  placeholder: `Enter prompt for ${stringify(selectionData.imageColumns[0].name)}, e.g., 'A fantasy character holding a ${stringify("{weapon}")}'`,
                  class: "w-full",
                  get value() {
                    return columnPrompts[selectionData.imageColumns[0].name];
                  },
                  set value($$value) {
                    columnPrompts[selectionData.imageColumns[0].name] = $$value;
                    $$settled = false;
                  }
                });
                $$payload4.out.push(`<!----> `);
                quickInsertButtons($$payload4, selectionData.imageColumns[0].name);
                $$payload4.out.push(`<!----></div> `);
                if (previewPrompts.some((p) => p.prompt.trim())) {
                  $$payload4.out.push("<!--[-->");
                  $$payload4.out.push(`<div class="space-y-2">`);
                  Label($$payload4, {
                    children: ($$payload5) => {
                      $$payload5.out.push(`<!---->Prompt Preview (with real data from first row)`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload4.out.push(`<!----> `);
                  promptPreviewCard($$payload4, previewPrompts.find((p) => p.columnName === selectionData.imageColumns[0].name) || {
                    columnName: selectionData.imageColumns[0].name,
                    prompt: "No prompt specified"
                  });
                  $$payload4.out.push(`<!----> <p class="text-muted-foreground text-xs">Preview shows how your template will look with actual data from row ${escape_html((selection?.borderTopIndex ?? 0) + 1)}</p></div>`);
                } else {
                  $$payload4.out.push("<!--[!-->");
                  $$payload4.out.push(`<div class="space-y-2">`);
                  Label($$payload4, {
                    children: ($$payload5) => {
                      $$payload5.out.push(`<!---->Prompt Preview (with real data from first row)`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload4.out.push(`<!----> `);
                  promptPreviewCard($$payload4, {
                    columnName: selectionData.imageColumns[0].name,
                    prompt: "No prompt specified"
                  });
                  $$payload4.out.push(`<!----> <p class="text-muted-foreground text-xs">Preview shows how your template will look with actual data from row ${escape_html((selection?.borderTopIndex ?? 0) + 1)}</p></div>`);
                }
                $$payload4.out.push(`<!--]--></div>`);
              } else {
                $$payload4.out.push("<!--[!-->");
                $$payload4.out.push(`<!---->`);
                Tabs($$payload4, {
                  value: selectionData.imageColumns[0].name,
                  class: "w-full",
                  children: ($$payload5) => {
                    const each_array_3 = ensure_array_like(selectionData.imageColumns);
                    $$payload5.out.push(`<!---->`);
                    Tabs_list($$payload5, {
                      class: "grid w-full",
                      style: `grid-template-columns: repeat(${stringify(selectionData.imageColumns.length)}, minmax(0, 1fr))`,
                      children: ($$payload6) => {
                        const each_array_2 = ensure_array_like(selectionData.imageColumns);
                        $$payload6.out.push(`<!--[-->`);
                        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                          let column = each_array_2[$$index_2];
                          $$payload6.out.push(`<!---->`);
                          Tabs_trigger($$payload6, {
                            value: column.name,
                            class: "text-xs",
                            children: ($$payload7) => {
                              $$payload7.out.push(`<!---->${escape_html(column.name)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$payload6.out.push(`<!---->`);
                        }
                        $$payload6.out.push(`<!--]-->`);
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!----> <!--[-->`);
                    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                      let column = each_array_3[$$index_3];
                      $$payload5.out.push(`<!---->`);
                      Tabs_content($$payload5, {
                        value: column.name,
                        class: "mt-4 space-y-4",
                        children: ($$payload6) => {
                          const previewData = previewPrompts.find((p) => p.columnName === column.name && p.rowIndex === selection?.borderTopIndex);
                          $$payload6.out.push(`<div class="space-y-2"><div class="flex items-center gap-2">`);
                          Label($$payload6, {
                            for: `prompt-${stringify(column.name)}`,
                            class: "text-sm font-medium",
                            children: ($$payload7) => {
                              $$payload7.out.push(`<!---->${escape_html(column.name)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$payload6.out.push(`<!----> `);
                          columnBadge$1($$payload6, "image column");
                          $$payload6.out.push(`<!----></div> `);
                          Input($$payload6, {
                            id: `prompt-${stringify(column.name)}`,
                            placeholder: `Enter prompt for ${stringify(column.name)}, e.g., 'A fantasy character holding a ${stringify("{weapon}")}'`,
                            class: "w-full",
                            get value() {
                              return columnPrompts[column.name];
                            },
                            set value($$value) {
                              columnPrompts[column.name] = $$value;
                              $$settled = false;
                            }
                          });
                          $$payload6.out.push(`<!----> `);
                          quickInsertButtons($$payload6, column.name);
                          $$payload6.out.push(`<!----></div>  <div class="space-y-2">`);
                          Label($$payload6, {
                            children: ($$payload7) => {
                              $$payload7.out.push(`<!---->Prompt Preview (with real data from first row)`);
                            },
                            $$slots: { default: true }
                          });
                          $$payload6.out.push(`<!----> `);
                          promptPreviewCard($$payload6, previewData || { columnName: column.name, prompt: "No prompt specified" });
                          $$payload6.out.push(`<!----> <p class="text-muted-foreground text-xs">Preview shows how your template will look with actual data from row ${escape_html((selection?.borderTopIndex ?? 0) + 1)}</p></div>`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload5.out.push(`<!---->`);
                    }
                    $$payload5.out.push(`<!--]-->`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!---->`);
              }
              $$payload4.out.push(`<!--]--></div> <!---->`);
              Dialog_footer($$payload4, {
                class: "flex justify-between",
                children: ($$payload5) => {
                  Button($$payload5, {
                    variant: "outline",
                    onclick: () => open = false,
                    children: ($$payload6) => {
                      $$payload6.out.push(`<!---->Cancel`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload5.out.push(`<!----> `);
                  Button($$payload5, {
                    onclick: handleGenerate,
                    disabled: !isValidPrompt,
                    class: "bg-primary",
                    children: ($$payload6) => {
                      $$payload6.out.push(`<!---->Generate ${escape_html(totalImages)} Images`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload5.out.push(`<!---->`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
            } else {
              $$payload4.out.push("<!--[!-->");
              $$payload4.out.push(`<div class="grid gap-4 py-4"><div class="text-muted-foreground text-center">No image columns selected. Please select cells containing image columns to generate
					images.</div></div> <!---->`);
              Dialog_footer($$payload4, {
                children: ($$payload5) => {
                  Button($$payload5, {
                    variant: "outline",
                    onclick: () => open = false,
                    children: ($$payload6) => {
                      $$payload6.out.push(`<!---->Cancel`);
                    },
                    $$slots: { default: true }
                  });
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
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
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
function columnBadge($$payload, name, type = "primary") {
  $$payload.out.push(`<span${attr_class(`bg-primary text-primary-foreground rounded px-2 py-1 text-xs ${stringify(type === "column" ? "font-medium" : "")}`)}>${escape_html(name)}</span>`);
}
function columnHeader($$payload, columnName) {
  $$payload.out.push(`<div class="mb-2 flex items-center gap-2">`);
  columnBadge($$payload, columnName, "column");
  $$payload.out.push(`<!----></div>`);
}
function Image_selection_modal($$payload, $$props) {
  push();
  let { selection = null, spreadsheet, cards, showFront } = $$props;
  let open = false;
  let currentCardIndex = 0;
  page.params.gameName;
  getFileSystemContext();
  let selectedImages = {};
  let availableImages = {};
  let imageIndices = {};
  const selectionData = (() => {
    if (!selection) return {
      hasImageColumns: false,
      imageColumns: [],
      totalRows: 0,
      availableColumns: []
    };
    const headers = spreadsheet.getHeaders(true);
    const columns = spreadsheet.getConfig()?.columns;
    if (!columns) return {
      hasImageColumns: false,
      imageColumns: [],
      totalRows: 0,
      availableColumns: []
    };
    const imageColumns = [];
    for (let x = selection.borderLeftIndex; x <= selection.borderRightIndex; x++) {
      const column = columns[x];
      if (column && column.type === ImageEditor) {
        imageColumns.push({ index: x, name: headers[x] });
      }
    }
    const totalRows = selection.borderBottomIndex - selection.borderTopIndex + 1;
    const availableColumns = headers.map((header, index) => ({ name: header, index }));
    return {
      hasImageColumns: imageColumns.length > 0,
      imageColumns,
      totalRows,
      availableColumns
    };
  })();
  const currentCardData = (() => {
    if (!selection || !selectionData.hasImageColumns) return null;
    const rowIndex = selection.borderTopIndex + currentCardIndex;
    const rowData = spreadsheet.getRowData(rowIndex);
    const rowId = rowData[0];
    return { rowIndex, rowId, rowData };
  })();
  const currentSvg = (() => {
    if (!currentCardData || !cards.length) return null;
    const cardIndex = currentCardData.rowIndex;
    if (cardIndex >= cards.length) return null;
    const card = cards[cardIndex];
    return showFront ? card.front.cloneNode(true) : card.back;
  })();
  function switchCard(direction) {
    if (!selection) return;
    const maxIndex = selection.borderBottomIndex - selection.borderTopIndex;
    currentCardIndex = Math.max(0, Math.min(maxIndex, currentCardIndex + direction));
  }
  function switchImage(columnName, step) {
    const availableImagesForColumn = availableImages[columnName] || [];
    const len = availableImagesForColumn.length;
    if (len <= 1) return;
    const cur = imageIndices[columnName] || 0;
    const next = (cur + step + len) % len;
    imageIndices[columnName] = next;
    const newImageUrl = availableImagesForColumn[next];
    selectedImages[columnName] = newImageUrl;
    handleImageSelection(columnName, newImageUrl);
  }
  function handleImageSelection(columnName, imageUrl) {
    selectedImages[columnName] = imageUrl;
    if (currentCardData) {
      const column = selectionData.imageColumns.find((col) => col.name === columnName);
      if (column) {
        spreadsheet.setValueFromCoords(column.index, currentCardData.rowIndex, imageUrl);
      }
    }
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Root$1($$payload2, {
      get open() {
        return open;
      },
      set open($$value) {
        open = $$value;
        $$settled = false;
      },
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->`);
        Dialog_trigger($$payload3, {
          class: buttonVariants({ variant: "outline" }),
          disabled: !selectionData.hasImageColumns,
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->Select Images`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----> <!---->`);
        Dialog_content($$payload3, {
          class: "max-h-[90vh] overflow-y-auto sm:max-w-[900px]",
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->`);
            Dialog_header($$payload4, {
              children: ($$payload5) => {
                $$payload5.out.push(`<!---->`);
                Dialog_title($$payload5, {
                  children: ($$payload6) => {
                    $$payload6.out.push(`<!---->Select Images`);
                  },
                  $$slots: { default: true }
                });
                $$payload5.out.push(`<!----> <!---->`);
                Dialog_description($$payload5, {
                  children: ($$payload6) => {
                    $$payload6.out.push(`<!---->Select images for selected image columns in your cards.`);
                  },
                  $$slots: { default: true }
                });
                $$payload5.out.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$payload4.out.push(`<!----> `);
            if (selectionData.hasImageColumns) {
              $$payload4.out.push("<!--[-->");
              const each_array = ensure_array_like(selectionData.imageColumns);
              const each_array_1 = ensure_array_like(selectionData.imageColumns);
              $$payload4.out.push(`<div class="grid gap-4 py-4"><div class="bg-muted rounded-lg p-3"><h4 class="mb-2 text-sm font-medium">Selection Summary</h4> <p class="text-muted-foreground text-sm">Selecting images for ${escape_html(selectionData.totalRows)} cards across ${escape_html(selectionData.imageColumns.length)} image columns</p> <div class="mt-2"><span class="text-xs font-medium">Image columns:</span> <!--[-->`);
              for (let i = 0, $$length = each_array.length; i < $$length; i++) {
                let column = each_array[i];
                columnBadge($$payload4, column.name);
              }
              $$payload4.out.push(`<!--]--></div></div> <div class="flex items-center justify-between">`);
              Button($$payload4, {
                variant: "outline",
                size: "sm",
                onclick: () => switchCard(-1),
                disabled: currentCardIndex === 0,
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Previous Card`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> <div class="text-sm font-medium">Card ${escape_html(currentCardIndex + 1)} of ${escape_html(selectionData.totalRows)} `);
              if (currentCardData) {
                $$payload4.out.push("<!--[-->");
                $$payload4.out.push(`(ID: ${escape_html(currentCardData.rowId)})`);
              } else {
                $$payload4.out.push("<!--[!-->");
              }
              $$payload4.out.push(`<!--]--></div> `);
              Button($$payload4, {
                variant: "outline",
                size: "sm",
                onclick: () => switchCard(1),
                disabled: currentCardIndex >= selectionData.totalRows - 1,
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Next Card`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----></div> <div class="rounded-lg border p-4">`);
              Label($$payload4, {
                class: "mb-2 block text-sm font-medium",
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Card Preview`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> <div class="flex justify-center">`);
              if (currentSvg) {
                $$payload4.out.push("<!--[-->");
                $$payload4.out.push(`<div class="max-w-md"></div>`);
              } else {
                $$payload4.out.push("<!--[!-->");
                $$payload4.out.push(`<div class="text-muted-foreground">No card data available</div>`);
              }
              $$payload4.out.push(`<!--]--></div></div> <div class="space-y-4"><!--[-->`);
              for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                let column = each_array_1[$$index_1];
                $$payload4.out.push(`<div class="space-y-2">`);
                columnHeader($$payload4, column.name);
                $$payload4.out.push(`<!----> <div class="flex items-center gap-2">`);
                Button($$payload4, {
                  variant: "outline",
                  size: "sm",
                  onclick: () => switchImage(column.name, -1),
                  disabled: !availableImages[column.name] || availableImages[column.name].length <= 1,
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->←`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!----> <div class="bg-muted flex min-h-[2rem] flex-1 items-center justify-center rounded px-2 py-1 text-center text-sm">`);
                if (availableImages[column.name] && availableImages[column.name].length > 0) {
                  $$payload4.out.push("<!--[-->");
                  $$payload4.out.push(`<span class="text-xs">${escape_html(imageIndices[column.name] + 1)} / ${escape_html(availableImages[column.name].length)}:
											${escape_html(selectedImages[column.name] || "No image selected")}</span>`);
                } else {
                  $$payload4.out.push("<!--[!-->");
                  $$payload4.out.push(`<span class="text-muted-foreground text-xs">No images available</span>`);
                }
                $$payload4.out.push(`<!--]--></div> `);
                Button($$payload4, {
                  variant: "outline",
                  size: "sm",
                  onclick: () => switchImage(column.name, 1),
                  disabled: !availableImages[column.name] || availableImages[column.name].length <= 1,
                  children: ($$payload5) => {
                    $$payload5.out.push(`<!---->→`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!----></div></div>`);
              }
              $$payload4.out.push(`<!--]--></div></div> <!---->`);
              Dialog_footer($$payload4, {
                class: "flex justify-between",
                children: ($$payload5) => {
                  Button($$payload5, {
                    variant: "outline",
                    onclick: () => open = false,
                    children: ($$payload6) => {
                      $$payload6.out.push(`<!---->Close`);
                    },
                    $$slots: { default: true }
                  });
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
            } else {
              $$payload4.out.push("<!--[!-->");
              $$payload4.out.push(`<div class="grid gap-4 py-4"><div class="text-muted-foreground text-center">No image columns selected. Please select cells containing image columns to select images.</div></div> <!---->`);
              Dialog_footer($$payload4, {
                children: ($$payload5) => {
                  Button($$payload5, {
                    variant: "outline",
                    onclick: () => open = false,
                    children: ($$payload6) => {
                      $$payload6.out.push(`<!---->Close`);
                    },
                    $$slots: { default: true }
                  });
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
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
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
function Toolbar($$payload, $$props) {
  push();
  let {
    deletedSvgColumns,
    onAddColumn,
    onHover,
    onExitHover,
    flip,
    selection = null,
    spreadsheet,
    svgTemplate,
    cards,
    showFront
  } = $$props;
  const gameName = page.params.gameName;
  page.params.deckName;
  const filesystem = getFileSystemContext();
  async function handleGenerateImages(images) {
    console.log("Generated images:", images);
    const timestamp = Date.now();
    for (const image of images.results) {
      const response = await fetch(image.imageUrl);
      const blob = await response.blob();
      const filename = `${image.rowId}_${timestamp}_${image.columnName}.png`;
      const file = new File([blob], filename, { type: blob.type });
      await filesystem.upload(file, `${gameName}/files/generated`);
      const headers = spreadsheet.getHeaders(true);
      const columnIndex = headers.findIndex((header) => header === image.columnName);
      if (columnIndex !== -1) {
        const data = spreadsheet.getConfig()?.data;
        let rowIndex = -1;
        if (data) {
          for (let i = 0; i < data.length; i++) {
            const rowData = spreadsheet.getRowData(i);
            if (rowData[0] === image.rowId) {
              rowIndex = i;
              break;
            }
          }
        }
        if (rowIndex !== -1) {
          const currentValue = spreadsheet.getValueFromCoords(columnIndex, rowIndex);
          if (!currentValue || currentValue.toString().trim() === "") {
            spreadsheet.setValueFromCoords(columnIndex, rowIndex, `generated/${filename}`);
          }
        }
      }
    }
  }
  $$payload.out.push(`<div class="flex w-full items-center gap-2"><!---->`);
  Root$2($$payload, {
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->`);
      Popover_trigger($$payload2, {
        children: ($$payload3) => {
          Button($$payload3, {
            variant: "outline",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->Add Svg data`);
            },
            $$slots: { default: true }
          });
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> <!---->`);
      Popover_content($$payload2, {
        class: "w-64",
        children: ($$payload3) => {
          if (deletedSvgColumns.length === 0) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<div class="text-muted-foreground p-2 text-center">No deleted SVG columns</div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            const each_array = ensure_array_like(deletedSvgColumns);
            $$payload3.out.push(`<div class="text-muted-foreground p-2 text-center">Add the following columns to the spreadsheet</div> <!--[-->`);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let column = each_array[$$index];
              $$payload3.out.push(`<div class="flex gap-2">`);
              Button($$payload3, {
                variant: "default",
                class: "w-full",
                onclick: () => onAddColumn(column),
                onmouseover: () => onHover(column),
                onmouseleave: () => onExitHover(column),
                children: ($$payload4) => {
                  $$payload4.out.push(`<!---->Add <b>${escape_html(column)}</b> to spreadsheet`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!----></div>`);
            }
            $$payload3.out.push(`<!--]-->`);
          }
          $$payload3.out.push(`<!--]-->`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!---->`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----> `);
  Button($$payload, {
    variant: "outline",
    onclick: () => flip(),
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->Flip cards`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----> `);
  Generate_images_modal($$payload, {
    selection,
    spreadsheet,
    svgTemplate,
    onGenerateImages: handleGenerateImages
  });
  $$payload.out.push(`<!----> `);
  Image_selection_modal($$payload, { selection, spreadsheet, cards, showFront });
  $$payload.out.push(`<!----></div>`);
  pop();
}
function Svg_data_editor($$payload, $$props) {
  push();
  const { svgTemplateFront, svgTemplateBack } = $$props;
  let el = null;
  new ScrollState({ element: () => el });
  const projectName = page.params.gameName;
  const cardName = page.params.deckName;
  const fileSystem = getFileSystemContext();
  const { svgData, spreadsheetData, imagePaths } = await_outside_boundary();
  let cards = spreadsheetData.data.map((row) => ({
    front: generateSvg(svgTemplateFront, spreadsheetData.cols.map((c) => c.title), row, imagePaths),
    back: generateSvg(svgTemplateBack, spreadsheetData.cols.map((c) => c.title).map((c) => c), row, imagePaths)
  }));
  let deletedSvgColumns = Array.from(svgData.values()).filter((col) => !spreadsheetData.cols.some((c) => c.title === col.title)).map((c) => c.title);
  let showFront = true;
  const svgsToShow = showFront ? cards.map((c) => c.front) : cards.map((c) => c.back);
  useDebounce(saveCsv, 1e3);
  let spreadsheet = [];
  let selectionRects = [];
  function flip() {
    showFront = !showFront;
  }
  async function saveCsv() {
    const rows = [];
    if (!rows.length) return;
    const header = spreadsheet[0].getHeaders(true);
    const csvText = Papa.unparse([header, ...rows]);
    const csvFile = new File([csvText], "data.csv", { type: "text/csv", lastModified: Date.now() });
    const res = await fileSystem.upload(csvFile, `/${projectName}/system/${cardName}`, true);
    if (res) throw new Error(`Upload failed for data.csv: ${res.message}`);
  }
  function clearSelectionRects() {
    for (const rect of selectionRects) rect.remove();
    selectionRects = [];
  }
  function highlight(el2, svg, pad = 4) {
    const scale = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
    const rect = createHighlightRect(el2, svg, scale, pad * scale);
    if (rect) {
      selectionRects.push(rect);
      appendHighlightToSvg(rect, svg);
    }
  }
  let contextItems = [];
  function highlightColumn(col) {
    const column = svgData.get(col);
    if (!column) {
      throw new Error(`Column ${col} not found in svgData.cols`);
    }
    for (const svg of svgsToShow) {
      highlight(svg.getElementById(col), svg);
    }
  }
  function addColumn(col) {
    clearSelectionRects();
    const column = svgData.get(col);
    if (!column) {
      throw new Error(`Column ${col} not found in svgData.cols`);
    }
    deletedSvgColumns = deletedSvgColumns.filter((c) => c !== col);
    const data = Array(cards.length).fill(column.data[0] || "");
    spreadsheet[0].insertColumn(
      1,
      spreadsheet[0].getHeaders(true).length,
      // how many columns
      false,
      // insert *after* column 1
      [
        {
          title: col,
          //type: 'text',
          // TODO choose correct type, text or ImageEditor
          //type: ImageEditor,
          width: 120
        }
      ]
    );
    spreadsheet[0].setColumnData(spreadsheet[0].getHeaders(true).length - 1, Array(cards.length).fill(column.data[0] || ""));
    for (const card of cards) {
      initialSetupForSvgItem(card.front, col, data[0], imagePaths);
      initialSetupForSvgItem(card.back, col, data[0], imagePaths);
    }
  }
  let selection = null;
  const each_array = ensure_array_like(svgsToShow);
  $$payload.out.push(`<div class="flex w-screen flex-nowrap gap-2 overflow-auto scroll-smooth rounded-md border whitespace-nowrap"><!--[-->`);
  for (let i = 0, $$length = each_array.length; i < $$length; i++) {
    each_array[i];
    $$payload.out.push(`<div class="h-full flex-shrink-0 rounded-lg border-8 border-zinc-950"></div>`);
  }
  $$payload.out.push(`<!--]--></div> <div class="px-2 py-2">`);
  Toolbar($$payload, {
    deletedSvgColumns,
    onAddColumn: addColumn,
    onHover: highlightColumn,
    onExitHover: (x) => clearSelectionRects(),
    flip,
    selection,
    spreadsheet: spreadsheet[0],
    svgTemplate: showFront ? svgTemplateFront : svgTemplateBack,
    cards,
    showFront
  });
  $$payload.out.push(`<!----></div> <!---->`);
  Root($$payload, {
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->`);
      Context_menu_trigger($$payload2, {
        children: ($$payload3) => {
          $$payload3.out.push(`<div id="spreadsheet"></div>`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> <!---->`);
      Context_menu_content($$payload2, {
        children: ($$payload3) => {
          const each_array_1 = ensure_array_like(contextItems);
          $$payload3.out.push(`<!--[-->`);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let item = each_array_1[$$index_1];
            if (item.type === "line") {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<!---->`);
              Context_menu_separator($$payload3, {});
              $$payload3.out.push(`<!---->`);
            } else {
              $$payload3.out.push("<!--[!-->");
              $$payload3.out.push(`<!---->`);
              Context_menu_item($$payload3, {
                onclick: item.onclick,
                children: ($$payload4) => {
                  if (item.icon) {
                    $$payload4.out.push("<!--[-->");
                    $$payload4.out.push(`<!---->`);
                    item.icon($$payload4, { class: "mr-2 h-4 w-4" });
                    $$payload4.out.push(`<!---->`);
                  } else {
                    $$payload4.out.push("<!--[!-->");
                  }
                  $$payload4.out.push(`<!--]--> ${escape_html(item.title)} `);
                  if (item.shortcut) {
                    $$payload4.out.push("<!--[-->");
                    $$payload4.out.push(`<!---->`);
                    Context_menu_shortcut($$payload4, {
                      children: ($$payload5) => {
                        $$payload5.out.push(`<!---->${escape_html(item.shortcut)}`);
                      },
                      $$slots: { default: true }
                    });
                    $$payload4.out.push(`<!---->`);
                  } else {
                    $$payload4.out.push("<!--[!-->");
                  }
                  $$payload4.out.push(`<!--]-->`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!---->`);
            }
            $$payload3.out.push(`<!--]-->`);
          }
          $$payload3.out.push(`<!--]-->`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!---->`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!---->`);
  pop();
}
function _page($$payload, $$props) {
  push();
  page.params.gameName;
  page.params.deckName;
  const loadSvgsContext = getLoadSvgsContext();
  loadSvgsContext.loadTemplates;
  if (await_outside_boundary().front && await_outside_boundary().back) {
    $$payload.out.push("<!--[-->");
    Svg_data_editor($$payload, {
      svgTemplateFront: await_outside_boundary().front,
      svgTemplateBack: await_outside_boundary().back
    });
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
export {
  _page as default
};
