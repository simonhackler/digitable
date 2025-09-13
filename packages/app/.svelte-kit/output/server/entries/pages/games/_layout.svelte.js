import "clsx";
import { A as spread_attributes, B as clsx, D as bind_props, y as pop, w as push, E as props_id, F as spread_props, G as derived, I as stringify, J as copy_payload, K as assign_payload, M as attr, N as attr_class, O as ensure_array_like, P as store_mutate, Q as store_get, z as escape_html, R as unsubscribe_stores } from "../../../chunks/index2.js";
import { s as setSidebar, P as Provider, S as SIDEBAR_COOKIE_NAME, a as SIDEBAR_COOKIE_MAX_AGE, b as SIDEBAR_WIDTH, c as SIDEBAR_WIDTH_ICON, u as useSidebar, d as Sheet_content, e as SIDEBAR_WIDTH_MOBILE, F as Form_description, f as Sidebar_menu_button } from "../../../chunks/schemas.js";
import { c as cn } from "../../../chunks/utils2.js";
import { I as Icon, B as Button, b as buttonVariants } from "../../../chunks/Icon.js";
import { D as Dialog_title, a as Dialog_description, b as Dialog, R as Root$2, c as Dialog_content, d as Dialog_header, e as Dialog_title$1, f as Dialog_trigger, M as Menu_separator } from "../../../chunks/index4.js";
import { s as superForm, z as zod, d as defaults, F as Form_field, C as Control, a as Form_field_errors, b as Form_label } from "../../../chunks/zod4.js";
import { b as box, c as createId, m as mergeProps, a as attachRef, d as createBitsAttrs, g as getDataDisabled, e as getDataOpenClosed, f as getAriaExpanded } from "../../../chunks/create-id.js";
import "style-to-object";
import { n as noop, P as Presence_layer, F as Focus_scope, a as afterSleep, E as Escape_layer, D as Dismissible_layer, T as Text_selection_layer, S as Scroll_lock, C as Context, O as OpenChangeComplete, b as SPACE, c as ENTER, w as watch, d as afterTick, I as Input, t as tick, e as Portal } from "../../../chunks/popper-layer-force-mount.js";
import { z } from "zod";
import { g as goto, p as page } from "../../../chunks/index3.js";
import "ts-deepmerge";
import "@sveltejs/kit";
import "memoize-weak";
import "zod-to-json-schema";
import { P as Plus } from "../../../chunks/plus.js";
import { R as Root$3, D as Dropdown_menu_trigger, a as Dropdown_menu_content, b as Dropdown_menu_item } from "../../../chunks/index5.js";
import { D as DialogRootState, a as DialogActionState, A as AlertDialogCancelState, b as DialogContentState, s as shouldEnableFocusTrap, c as Dialog_overlay } from "../../../chunks/x.js";
import { s as setFileSystemContext } from "../../../chunks/context.js";
function Sidebar_content($$payload, $$props) {
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
      "data-slot": "sidebar-content",
      "data-sidebar": "content",
      class: clsx(cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_footer($$payload, $$props) {
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
      "data-slot": "sidebar-footer",
      "data-sidebar": "footer",
      class: clsx(cn("flex flex-col gap-2 p-2", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_group_label($$payload, $$props) {
  push();
  let {
    ref = null,
    children,
    child,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const mergedProps = {
    class: cn("text-sidebar-foreground/70 ring-sidebar-ring outline-hidden flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0", "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0", className),
    "data-slot": "sidebar-group-label",
    "data-sidebar": "group-label",
    ...restProps
  };
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
function Sidebar_group($$payload, $$props) {
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
      "data-slot": "sidebar-group",
      "data-sidebar": "group",
      class: clsx(cn("relative flex w-full min-w-0 flex-col p-2", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_header($$payload, $$props) {
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
      "data-slot": "sidebar-header",
      "data-sidebar": "header",
      class: clsx(cn("flex flex-col gap-2 p-2", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Alert_dialog($$payload, $$props) {
  push();
  let {
    open = false,
    onOpenChange = noop,
    onOpenChangeComplete = noop,
    children
  } = $$props;
  DialogRootState.create({
    variant: box.with(() => "alert-dialog"),
    open: box.with(() => open, (v) => {
      open = v;
      onOpenChange(v);
    }),
    onOpenChangeComplete: box.with(() => onOpenChangeComplete)
  });
  children?.($$payload);
  $$payload.out.push(`<!---->`);
  bind_props($$props, { open });
  pop();
}
function Alert_dialog_action$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    children,
    child,
    id = createId(uid),
    ref = null,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const actionState = DialogActionState.create({
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, actionState.props);
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
function Alert_dialog_cancel$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    id = createId(uid),
    ref = null,
    children,
    child,
    disabled = false,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const cancelState = AlertDialogCancelState.create({
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v),
    disabled: box.with(() => Boolean(disabled))
  });
  const mergedProps = mergeProps(restProps, cancelState.props);
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
function Alert_dialog_content$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    id = createId(uid),
    children,
    child,
    ref = null,
    forceMount = false,
    interactOutsideBehavior = "ignore",
    onCloseAutoFocus = noop,
    onEscapeKeydown = noop,
    onOpenAutoFocus = noop,
    onInteractOutside = noop,
    preventScroll = true,
    trapFocus = true,
    restoreScrollDelay = null,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const contentState = DialogContentState.create({
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v)
  });
  const mergedProps = mergeProps(restProps, contentState.props);
  {
    let presence = function($$payload2) {
      {
        let focusScope = function($$payload3, { props: focusScopeProps }) {
          Escape_layer($$payload3, spread_props([
            mergedProps,
            {
              enabled: contentState.root.opts.open.current,
              ref: contentState.opts.ref,
              onEscapeKeydown: (e) => {
                onEscapeKeydown(e);
                if (e.defaultPrevented) return;
                contentState.root.handleClose();
              },
              children: ($$payload4) => {
                Dismissible_layer($$payload4, spread_props([
                  mergedProps,
                  {
                    ref: contentState.opts.ref,
                    enabled: contentState.root.opts.open.current,
                    interactOutsideBehavior,
                    onInteractOutside: (e) => {
                      onInteractOutside(e);
                      if (e.defaultPrevented) return;
                      contentState.root.handleClose();
                    },
                    children: ($$payload5) => {
                      Text_selection_layer($$payload5, spread_props([
                        mergedProps,
                        {
                          ref: contentState.opts.ref,
                          enabled: contentState.root.opts.open.current,
                          children: ($$payload6) => {
                            if (child) {
                              $$payload6.out.push("<!--[-->");
                              if (contentState.root.opts.open.current) {
                                $$payload6.out.push("<!--[-->");
                                Scroll_lock($$payload6, { preventScroll, restoreScrollDelay });
                              } else {
                                $$payload6.out.push("<!--[!-->");
                              }
                              $$payload6.out.push(`<!--]--> `);
                              child($$payload6, {
                                props: mergeProps(mergedProps, focusScopeProps),
                                ...contentState.snippetProps
                              });
                              $$payload6.out.push(`<!---->`);
                            } else {
                              $$payload6.out.push("<!--[!-->");
                              Scroll_lock($$payload6, { preventScroll });
                              $$payload6.out.push(`<!----> <div${spread_attributes({ ...mergeProps(mergedProps, focusScopeProps) })}>`);
                              children?.($$payload6);
                              $$payload6.out.push(`<!----></div>`);
                            }
                            $$payload6.out.push(`<!--]-->`);
                          },
                          $$slots: { default: true }
                        }
                      ]));
                    },
                    $$slots: { default: true }
                  }
                ]));
              },
              $$slots: { default: true }
            }
          ]));
        };
        Focus_scope($$payload2, {
          ref: contentState.opts.ref,
          loop: true,
          trapFocus,
          enabled: shouldEnableFocusTrap({
            forceMount,
            present: contentState.root.opts.open.current,
            open: contentState.root.opts.open.current
          }),
          onCloseAutoFocus: (e) => {
            onCloseAutoFocus(e);
            if (e.defaultPrevented) return;
            afterSleep(0, () => contentState.root.triggerNode?.focus());
          },
          onOpenAutoFocus: (e) => {
            onOpenAutoFocus(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            afterSleep(0, () => contentState.opts.ref.current?.focus());
          },
          focusScope
        });
      }
    };
    Presence_layer($$payload, {
      forceMount,
      open: contentState.root.opts.open.current || forceMount,
      ref: contentState.opts.ref,
      presence
    });
  }
  bind_props($$props, { ref });
  pop();
}
const collapsibleAttrs = createBitsAttrs({
  component: "collapsible",
  parts: ["root", "content", "trigger"]
});
const CollapsibleRootContext = new Context("Collapsible.Root");
class CollapsibleRootState {
  static create(opts) {
    return CollapsibleRootContext.set(new CollapsibleRootState(opts));
  }
  opts;
  attachment;
  contentNode = null;
  contentId = void 0;
  constructor(opts) {
    this.opts = opts;
    this.toggleOpen = this.toggleOpen.bind(this);
    this.attachment = attachRef(this.opts.ref);
    new OpenChangeComplete({
      ref: box.with(() => this.contentNode),
      open: this.opts.open,
      onComplete: () => {
        this.opts.onOpenChangeComplete.current(this.opts.open.current);
      }
    });
  }
  toggleOpen() {
    this.opts.open.current = !this.opts.open.current;
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-state": getDataOpenClosed(this.opts.open.current),
    "data-disabled": getDataDisabled(this.opts.disabled.current),
    [collapsibleAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class CollapsibleContentState {
  static create(opts) {
    return new CollapsibleContentState(opts, CollapsibleRootContext.get());
  }
  opts;
  root;
  attachment;
  #present = derived(() => this.opts.forceMount.current || this.root.opts.open.current);
  get present() {
    return this.#present();
  }
  set present($$value) {
    return this.#present($$value);
  }
  #originalStyles;
  #isMountAnimationPrevented = false;
  #width = 0;
  #height = 0;
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.#isMountAnimationPrevented = root.opts.open.current;
    this.root.contentId = this.opts.id.current;
    this.attachment = attachRef(this.opts.ref, (v) => this.root.contentNode = v);
    watch.pre(() => this.opts.id.current, (id) => {
      this.root.contentId = id;
    });
    watch([() => this.opts.ref.current, () => this.present], ([node]) => {
      if (!node) return;
      afterTick(() => {
        if (!this.opts.ref.current) return;
        this.#originalStyles = this.#originalStyles || {
          transitionDuration: node.style.transitionDuration,
          animationName: node.style.animationName
        };
        node.style.transitionDuration = "0s";
        node.style.animationName = "none";
        const rect = node.getBoundingClientRect();
        this.#height = rect.height;
        this.#width = rect.width;
        if (!this.#isMountAnimationPrevented) {
          const { animationName, transitionDuration } = this.#originalStyles;
          node.style.transitionDuration = transitionDuration;
          node.style.animationName = animationName;
        }
      });
    });
  }
  #snippetProps = derived(() => ({ open: this.root.opts.open.current }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    style: {
      "--bits-collapsible-content-height": this.#height ? `${this.#height}px` : void 0,
      "--bits-collapsible-content-width": this.#width ? `${this.#width}px` : void 0
    },
    "data-state": getDataOpenClosed(this.root.opts.open.current),
    "data-disabled": getDataDisabled(this.root.opts.disabled.current),
    [collapsibleAttrs.content]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class CollapsibleTriggerState {
  static create(opts) {
    return new CollapsibleTriggerState(opts, CollapsibleRootContext.get());
  }
  opts;
  root;
  attachment;
  #isDisabled = derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(this.opts.ref);
    this.onclick = this.onclick.bind(this);
    this.onkeydown = this.onkeydown.bind(this);
  }
  onclick(e) {
    if (this.#isDisabled()) return;
    if (e.button !== 0) return e.preventDefault();
    this.root.toggleOpen();
  }
  onkeydown(e) {
    if (this.#isDisabled()) return;
    if (e.key === SPACE || e.key === ENTER) {
      e.preventDefault();
      this.root.toggleOpen();
    }
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    type: "button",
    disabled: this.#isDisabled(),
    "aria-controls": this.root.contentId,
    "aria-expanded": getAriaExpanded(this.root.opts.open.current),
    "data-state": getDataOpenClosed(this.root.opts.open.current),
    "data-disabled": getDataDisabled(this.#isDisabled()),
    [collapsibleAttrs.trigger]: "",
    //
    onclick: this.onclick,
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
function Collapsible$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    children,
    child,
    id = createId(uid),
    ref = null,
    open = false,
    disabled = false,
    onOpenChange = noop,
    onOpenChangeComplete = noop,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const rootState = CollapsibleRootState.create({
    open: box.with(() => open, (v) => {
      open = v;
      onOpenChange(v);
    }),
    disabled: box.with(() => disabled),
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v),
    onOpenChangeComplete: box.with(() => onOpenChangeComplete)
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
  bind_props($$props, { ref, open });
  pop();
}
function Collapsible_content$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    child,
    ref = null,
    forceMount = false,
    children,
    id = createId(uid),
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const contentState = CollapsibleContentState.create({
    id: box.with(() => id),
    forceMount: box.with(() => forceMount),
    ref: box.with(() => ref, (v) => ref = v)
  });
  {
    let presence = function($$payload2, { present }) {
      const mergedProps = mergeProps(restProps, contentState.props, { hidden: forceMount ? void 0 : !present });
      if (child) {
        $$payload2.out.push("<!--[-->");
        child($$payload2, { ...contentState.snippetProps, props: mergedProps });
        $$payload2.out.push(`<!---->`);
      } else {
        $$payload2.out.push("<!--[!-->");
        $$payload2.out.push(`<div${spread_attributes({ ...mergedProps })}>`);
        children?.($$payload2);
        $$payload2.out.push(`<!----></div>`);
      }
      $$payload2.out.push(`<!--]-->`);
    };
    Presence_layer($$payload, {
      forceMount: true,
      open: contentState.present,
      ref: contentState.opts.ref,
      presence
    });
  }
  bind_props($$props, { ref });
  pop();
}
function Collapsible_trigger$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    children,
    child,
    ref = null,
    id = createId(uid),
    disabled = false,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const triggerState = CollapsibleTriggerState.create({
    id: box.with(() => id),
    ref: box.with(() => ref, (v) => ref = v),
    disabled: box.with(() => disabled)
  });
  const mergedProps = mergeProps(restProps, triggerState.props);
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
function Sidebar_menu_item($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<li${spread_attributes(
    {
      "data-slot": "sidebar-menu-item",
      "data-sidebar": "menu-item",
      class: clsx(cn("group/menu-item relative", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></li>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_menu_sub_button($$payload, $$props) {
  push();
  let {
    ref = null,
    children,
    child,
    class: className,
    size = "md",
    isActive = false,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const mergedProps = {
    class: cn("text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground outline-hidden flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0", "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground", size === "sm" && "text-xs", size === "md" && "text-sm", "group-data-[collapsible=icon]:hidden", className),
    "data-slot": "sidebar-menu-sub-button",
    "data-sidebar": "menu-sub-button",
    "data-size": size,
    "data-active": isActive,
    ...restProps
  };
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<a${spread_attributes({ ...mergedProps })}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></a>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_menu_sub_item($$payload, $$props) {
  push();
  let {
    ref = null,
    children,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<li${spread_attributes(
    {
      "data-slot": "sidebar-menu-sub-item",
      "data-sidebar": "menu-sub-item",
      class: clsx(cn("group/menu-sub-item relative", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></li>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_menu_sub($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<ul${spread_attributes(
    {
      "data-slot": "sidebar-menu-sub",
      "data-sidebar": "menu-sub",
      class: clsx(cn("border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5", "group-data-[collapsible=icon]:hidden", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></ul>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_menu($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<ul${spread_attributes(
    {
      "data-slot": "sidebar-menu",
      "data-sidebar": "menu",
      class: clsx(cn("flex w-full min-w-0 flex-col gap-1", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></ul>`);
  bind_props($$props, { ref });
  pop();
}
function Sidebar_provider($$payload, $$props) {
  push();
  let {
    ref = null,
    open = true,
    onOpenChange = () => {
    },
    class: className,
    style,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  setSidebar({
    open: () => open,
    setOpen: (value) => {
      open = value;
      onOpenChange(value);
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    }
  });
  $$payload.out.push(`<!---->`);
  Provider($$payload, {
    delayDuration: 0,
    children: ($$payload2) => {
      $$payload2.out.push(`<div${spread_attributes(
        {
          "data-slot": "sidebar-wrapper",
          style: `--sidebar-width: ${stringify(SIDEBAR_WIDTH)}; --sidebar-width-icon: ${stringify(SIDEBAR_WIDTH_ICON)}; ${stringify(style)}`,
          class: clsx(cn("group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full", className)),
          ...restProps
        }
      )}>`);
      children?.($$payload2);
      $$payload2.out.push(`<!----></div>`);
    }
  });
  $$payload.out.push(`<!---->`);
  bind_props($$props, { ref, open });
  pop();
}
function Panel_left($$payload, $$props) {
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
      { "width": "18", "height": "18", "x": "3", "y": "3", "rx": "2" }
    ],
    ["path", { "d": "M9 3v18" }]
  ];
  Icon($$payload, spread_props([
    { name: "panel-left" },
    /**
     * @component @name PanelLeft
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiAvPgogIDxwYXRoIGQ9Ik05IDN2MTgiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/panel-left
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
function Sidebar_trigger($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    onclick,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const sidebar = useSidebar();
  Button($$payload, spread_props([
    {
      "data-sidebar": "trigger",
      "data-slot": "sidebar-trigger",
      variant: "ghost",
      size: "icon",
      class: cn("size-7", className),
      type: "button",
      onclick: (e) => {
        onclick?.(e);
        sidebar.toggle();
      }
    },
    restProps,
    {
      children: ($$payload2) => {
        Panel_left($$payload2, {});
        $$payload2.out.push(`<!----> <span class="sr-only">Toggle Sidebar</span>`);
      },
      $$slots: { default: true }
    }
  ]));
  bind_props($$props, { ref });
  pop();
}
function Sheet_header($$payload, $$props) {
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
      "data-slot": "sheet-header",
      class: clsx(cn("flex flex-col gap-1.5 p-4", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Sheet_title($$payload, $$props) {
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
    Dialog_title($$payload2, spread_props([
      {
        "data-slot": "sheet-title",
        class: cn("text-foreground font-semibold", className)
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
function Sheet_description($$payload, $$props) {
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
    Dialog_description($$payload2, spread_props([
      {
        "data-slot": "sheet-description",
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
const Root$1 = Dialog;
function Sidebar($$payload, $$props) {
  push();
  let {
    ref = null,
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const sidebar = useSidebar();
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    if (collapsible === "none") {
      $$payload2.out.push("<!--[-->");
      $$payload2.out.push(`<div${spread_attributes(
        {
          class: clsx(cn("bg-sidebar text-sidebar-foreground w-(--sidebar-width) flex h-full flex-col", className)),
          ...restProps
        }
      )}>`);
      children?.($$payload2);
      $$payload2.out.push(`<!----></div>`);
    } else {
      $$payload2.out.push("<!--[!-->");
      if (sidebar.isMobile) {
        $$payload2.out.push("<!--[-->");
        var bind_get = () => sidebar.openMobile;
        var bind_set = (v) => sidebar.setOpenMobile(v);
        $$payload2.out.push(`<!---->`);
        Root$1($$payload2, spread_props([
          {
            get open() {
              return bind_get();
            },
            set open($$value) {
              bind_set($$value);
            }
          },
          restProps,
          {
            children: ($$payload3) => {
              $$payload3.out.push(`<!---->`);
              Sheet_content($$payload3, {
                "data-sidebar": "sidebar",
                "data-slot": "sidebar",
                "data-mobile": "true",
                class: "bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden",
                style: `--sidebar-width: ${stringify(SIDEBAR_WIDTH_MOBILE)};`,
                side,
                children: ($$payload4) => {
                  $$payload4.out.push(`<!---->`);
                  Sheet_header($$payload4, {
                    class: "sr-only",
                    children: ($$payload5) => {
                      $$payload5.out.push(`<!---->`);
                      Sheet_title($$payload5, {
                        children: ($$payload6) => {
                          $$payload6.out.push(`<!---->Sidebar`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload5.out.push(`<!----> <!---->`);
                      Sheet_description($$payload5, {
                        children: ($$payload6) => {
                          $$payload6.out.push(`<!---->Displays the mobile sidebar.`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload5.out.push(`<!---->`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload4.out.push(`<!----> <div class="flex h-full w-full flex-col">`);
                  children?.($$payload4);
                  $$payload4.out.push(`<!----></div>`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!---->`);
            },
            $$slots: { default: true }
          }
        ]));
        $$payload2.out.push(`<!---->`);
      } else {
        $$payload2.out.push("<!--[!-->");
        $$payload2.out.push(`<div class="text-sidebar-foreground group peer hidden md:block"${attr("data-state", sidebar.state)}${attr("data-collapsible", sidebar.state === "collapsed" ? collapsible : "")}${attr("data-variant", variant)}${attr("data-side", side)} data-slot="sidebar"><div data-slot="sidebar-gap"${attr_class(clsx(cn("w-(--sidebar-width) relative bg-transparent transition-[width] duration-200 ease-linear", "group-data-[collapsible=offcanvas]:w-0", "group-data-[side=right]:rotate-180", variant === "floating" || variant === "inset" ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)")))}></div> <div${spread_attributes(
          {
            "data-slot": "sidebar-container",
            class: clsx(cn(
              "w-(--sidebar-width) fixed inset-y-0 z-10 hidden h-svh transition-[left,right,width] duration-200 ease-linear md:flex",
              side === "left" ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]" : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
              variant === "floating" || variant === "inset" ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
              className
            )),
            ...restProps
          }
        )}><div data-sidebar="sidebar" data-slot="sidebar-inner" class="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm">`);
        children?.($$payload2);
        $$payload2.out.push(`<!----></div></div></div>`);
      }
      $$payload2.out.push(`<!--]-->`);
    }
    $$payload2.out.push(`<!--]-->`);
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
function Collapsible($$payload, $$props) {
  push();
  let { ref = null, open = false, $$slots, $$events, ...restProps } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Collapsible$1($$payload2, spread_props([
      { "data-slot": "collapsible" },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        },
        get open() {
          return open;
        },
        set open($$value) {
          open = $$value;
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
  bind_props($$props, { ref, open });
  pop();
}
function Collapsible_trigger($$payload, $$props) {
  push();
  let { ref = null, $$slots, $$events, ...restProps } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Collapsible_trigger$1($$payload2, spread_props([
      { "data-slot": "collapsible-trigger" },
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
function Collapsible_content($$payload, $$props) {
  push();
  let { ref = null, $$slots, $$events, ...restProps } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Collapsible_content$1($$payload2, spread_props([
      { "data-slot": "collapsible-content" },
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
function Chevron_right($$payload, $$props) {
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
  const iconNode = [["path", { "d": "m9 18 6-6-6-6" }]];
  Icon($$payload, spread_props([
    { name: "chevron-right" },
    /**
     * @component @name ChevronRight
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtOSAxOCA2LTYtNi02IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/chevron-right
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
function Chevrons_up_down($$payload, $$props) {
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
    ["path", { "d": "m7 15 5 5 5-5" }],
    ["path", { "d": "m7 9 5-5 5 5" }]
  ];
  Icon($$payload, spread_props([
    { name: "chevrons-up-down" },
    /**
     * @component @name ChevronsUpDown
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtNyAxNSA1IDUgNS01IiAvPgogIDxwYXRoIGQ9Im03IDkgNS01IDUgNSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/chevrons-up-down
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
function Download($$payload, $$props) {
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
    ["path", { "d": "M12 15V3" }],
    ["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { "d": "m7 10 5 5 5-5" }]
  ];
  Icon($$payload, spread_props([
    { name: "download" },
    /**
     * @component @name Download
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgMTVWMyIgLz4KICA8cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCIgLz4KICA8cGF0aCBkPSJtNyAxMCA1IDUgNS01IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/download
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
function Gamepad_2($$payload, $$props) {
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
    ["line", { "x1": "6", "x2": "10", "y1": "11", "y2": "11" }],
    ["line", { "x1": "8", "x2": "8", "y1": "9", "y2": "13" }],
    [
      "line",
      { "x1": "15", "x2": "15.01", "y1": "12", "y2": "12" }
    ],
    [
      "line",
      { "x1": "18", "x2": "18.01", "y1": "10", "y2": "10" }
    ],
    [
      "path",
      {
        "d": "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
      }
    ]
  ];
  Icon($$payload, spread_props([
    { name: "gamepad-2" },
    /**
     * @component @name Gamepad2
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8bGluZSB4MT0iNiIgeDI9IjEwIiB5MT0iMTEiIHkyPSIxMSIgLz4KICA8bGluZSB4MT0iOCIgeDI9IjgiIHkxPSI5IiB5Mj0iMTMiIC8+CiAgPGxpbmUgeDE9IjE1IiB4Mj0iMTUuMDEiIHkxPSIxMiIgeTI9IjEyIiAvPgogIDxsaW5lIHgxPSIxOCIgeDI9IjE4LjAxIiB5MT0iMTAiIHkyPSIxMCIgLz4KICA8cGF0aCBkPSJNMTcuMzIgNUg2LjY4YTQgNCAwIDAgMC0zLjk3OCAzLjU5Yy0uMDA2LjA1Mi0uMDEuMTAxLS4wMTcuMTUyQzIuNjA0IDkuNDE2IDIgMTQuNDU2IDIgMTZhMyAzIDAgMCAwIDMgM2MxIDAgMS41LS41IDItMWwxLjQxNC0xLjQxNEEyIDIgMCAwIDEgOS44MjggMTZoNC4zNDRhMiAyIDAgMCAxIDEuNDE0LjU4NkwxNyAxOGMuNS41IDEgMSAyIDFhMyAzIDAgMCAwIDMtM2MwLTEuNTQ1LS42MDQtNi41ODQtLjY4NS03LjI1OC0uMDA3LS4wNS0uMDExLS4xLS4wMTctLjE1MUE0IDQgMCAwIDAgMTcuMzIgNXoiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/gamepad-2
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
function Layers($$payload, $$props) {
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
      "path",
      {
        "d": "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
      }
    ],
    [
      "path",
      {
        "d": "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
      }
    ],
    [
      "path",
      {
        "d": "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
      }
    ]
  ];
  Icon($$payload, spread_props([
    { name: "layers" },
    /**
     * @component @name Layers
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIuODMgMi4xOGEyIDIgMCAwIDAtMS42NiAwTDIuNiA2LjA4YTEgMSAwIDAgMCAwIDEuODNsOC41OCAzLjkxYTIgMiAwIDAgMCAxLjY2IDBsOC41OC0zLjlhMSAxIDAgMCAwIDAtMS44M3oiIC8+CiAgPHBhdGggZD0iTTIgMTJhMSAxIDAgMCAwIC41OC45MWw4LjYgMy45MWEyIDIgMCAwIDAgMS42NSAwbDguNTgtMy45QTEgMSAwIDAgMCAyMiAxMiIgLz4KICA8cGF0aCBkPSJNMiAxN2ExIDEgMCAwIDAgLjU4LjkxbDguNiAzLjkxYTIgMiAwIDAgMCAxLjY1IDBsOC41OC0zLjlBMSAxIDAgMCAwIDIyIDE3IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/layers
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
function Printer($$payload, $$props) {
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
      "path",
      {
        "d": "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
      }
    ],
    ["path", { "d": "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" }],
    [
      "rect",
      { "x": "6", "y": "14", "width": "12", "height": "8", "rx": "1" }
    ]
  ];
  Icon($$payload, spread_props([
    { name: "printer" },
    /**
     * @component @name Printer
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNiAxOEg0YTIgMiAwIDAgMS0yLTJ2LTVhMiAyIDAgMCAxIDItMmgxNmEyIDIgMCAwIDEgMiAydjVhMiAyIDAgMCAxLTIgMmgtMiIgLz4KICA8cGF0aCBkPSJNNiA5VjNhMSAxIDAgMCAxIDEtMWgxMGExIDEgMCAwIDEgMSAxdjYiIC8+CiAgPHJlY3QgeD0iNiIgeT0iMTQiIHdpZHRoPSIxMiIgaGVpZ2h0PSI4IiByeD0iMSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/printer
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
function Create_menu($$payload, $$props) {
  push();
  var $$store_subs;
  let { activeGame } = $$props;
  let openCreateDeckDialog = false;
  const newDeckSchema = z.object({
    deckName: z.string().min(3, "Deck name must be at least 3 characters long").regex(/^[A-Za-z0-9_-]+$/, "Deck name can only contain letters and numbers without spaces")
  });
  const form = superForm(defaults(zod(newDeckSchema)), {
    SPA: true,
    validators: zod(newDeckSchema),
    onUpdate({ form: form2 }) {
      if (form2.valid) {
        const path = `/games/${activeGame?.name}/decks/${form2.data.deckName}/data`;
        console.log("Form is valid, navigating to new deck", path);
        switchPath();
      }
    }
  });
  async function switchPath(path) {
    await tick();
    await goto();
    openCreateDeckDialog = false;
  }
  const { form: formData, enhance } = form;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Sidebar_group($$payload2, {
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->`);
        Sidebar_group_label($$payload3, {
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->Create`);
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----> <!---->`);
        Sidebar_menu($$payload3, {
          children: ($$payload4) => {
            $$payload4.out.push(`<!---->`);
            Collapsible($$payload4, {
              class: "group/collapsible",
              children: ($$payload5) => {
                $$payload5.out.push(`<!---->`);
                Sidebar_menu_item($$payload5, {
                  children: ($$payload6) => {
                    $$payload6.out.push(`<!---->`);
                    {
                      let child = function($$payload7, { props }) {
                        $$payload7.out.push(`<!---->`);
                        Sidebar_menu_button($$payload7, spread_props([
                          props,
                          {
                            tooltipContent: "d",
                            children: ($$payload8) => {
                              Layers($$payload8, {});
                              $$payload8.out.push(`<!----> <span>Decks</span> `);
                              Chevron_right($$payload8, {
                                class: "ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                              });
                              $$payload8.out.push(`<!---->`);
                            },
                            $$slots: { default: true }
                          }
                        ]));
                        $$payload7.out.push(`<!---->`);
                      };
                      Collapsible_trigger($$payload6, { child, $$slots: { child: true } });
                    }
                    $$payload6.out.push(`<!----> <!---->`);
                    Collapsible_content($$payload6, {
                      children: ($$payload7) => {
                        $$payload7.out.push(`<!---->`);
                        Sidebar_menu_sub($$payload7, {
                          children: ($$payload8) => {
                            const each_array = ensure_array_like(activeGame?.decks ?? []);
                            $$payload8.out.push(`<!---->`);
                            Sidebar_menu_sub_item($$payload8, {
                              children: ($$payload9) => {
                                $$payload9.out.push(`<!---->`);
                                Root$2($$payload9, {
                                  get open() {
                                    return openCreateDeckDialog;
                                  },
                                  set open($$value) {
                                    openCreateDeckDialog = $$value;
                                    $$settled = false;
                                  },
                                  children: ($$payload10) => {
                                    $$payload10.out.push(`<!---->`);
                                    Dialog_content($$payload10, {
                                      children: ($$payload11) => {
                                        $$payload11.out.push(`<!---->`);
                                        Dialog_header($$payload11, {
                                          children: ($$payload12) => {
                                            $$payload12.out.push(`<!---->`);
                                            Dialog_title$1($$payload12, {
                                              children: ($$payload13) => {
                                                $$payload13.out.push(`<!---->New deck name`);
                                              },
                                              $$slots: { default: true }
                                            });
                                            $$payload12.out.push(`<!----> <form><!---->`);
                                            Form_field($$payload12, {
                                              form,
                                              name: "deckName",
                                              children: ($$payload13) => {
                                                $$payload13.out.push(`<!---->`);
                                                {
                                                  let children = function($$payload14, { props }) {
                                                    $$payload14.out.push(`<!---->`);
                                                    Form_label($$payload14, {
                                                      children: ($$payload15) => {
                                                        $$payload15.out.push(`<!---->Email`);
                                                      },
                                                      $$slots: { default: true }
                                                    });
                                                    $$payload14.out.push(`<!----> `);
                                                    Input($$payload14, {
                                                      placeholder: "deck name",
                                                      get value() {
                                                        return store_get($$store_subs ??= {}, "$formData", formData).deckName;
                                                      },
                                                      set value($$value) {
                                                        store_mutate($$store_subs ??= {}, "$formData", formData, store_get($$store_subs ??= {}, "$formData", formData).deckName = $$value);
                                                        $$settled = false;
                                                      }
                                                    });
                                                    $$payload14.out.push(`<!---->`);
                                                  };
                                                  Control($$payload13, { children });
                                                }
                                                $$payload13.out.push(`<!----> <!---->`);
                                                Form_description($$payload13, {});
                                                $$payload13.out.push(`<!----> <!---->`);
                                                Form_field_errors($$payload13, {});
                                                $$payload13.out.push(`<!---->`);
                                              },
                                              $$slots: { default: true }
                                            });
                                            $$payload12.out.push(`<!----> `);
                                            Button($$payload12, {
                                              type: "submit",
                                              children: ($$payload13) => {
                                                Plus($$payload13, {});
                                                $$payload13.out.push(`<!----> Create new deck`);
                                              },
                                              $$slots: { default: true }
                                            });
                                            $$payload12.out.push(`<!----></form>`);
                                          },
                                          $$slots: { default: true }
                                        });
                                        $$payload11.out.push(`<!---->`);
                                      },
                                      $$slots: { default: true }
                                    });
                                    $$payload10.out.push(`<!----> <!---->`);
                                    {
                                      let child = function($$payload11, { props }) {
                                        $$payload11.out.push(`<!---->`);
                                        {
                                          let child2 = function($$payload12, { props: props2 }) {
                                            Button($$payload12, spread_props([
                                              props2,
                                              {
                                                variant: "outline",
                                                class: "w-full",
                                                children: ($$payload13) => {
                                                  Plus($$payload13, {});
                                                  $$payload13.out.push(`<!----> New`);
                                                },
                                                $$slots: { default: true }
                                              }
                                            ]));
                                          };
                                          Dialog_trigger($$payload11, { child: child2, $$slots: { child: true } });
                                        }
                                        $$payload11.out.push(`<!---->`);
                                      };
                                      Sidebar_menu_sub_button($$payload10, { child, $$slots: { child: true } });
                                    }
                                    $$payload10.out.push(`<!---->`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$payload9.out.push(`<!---->`);
                              },
                              $$slots: { default: true }
                            });
                            $$payload8.out.push(`<!----> <!--[-->`);
                            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                              let deck = each_array[$$index];
                              $$payload8.out.push(`<!---->`);
                              Sidebar_menu_sub_item($$payload8, {
                                children: ($$payload9) => {
                                  $$payload9.out.push(`<!---->`);
                                  {
                                    let child = function($$payload10, { props }) {
                                      $$payload10.out.push(`<a${spread_attributes(
                                        {
                                          href: `/games/${activeGame?.name}/decks/${deck.name}/data`,
                                          ...props
                                        }
                                      )}><span class="text-muted-foreground">${escape_html(deck.name)}</span></a>`);
                                    };
                                    Sidebar_menu_sub_button($$payload9, { child, $$slots: { child: true } });
                                  }
                                  $$payload9.out.push(`<!---->`);
                                },
                                $$slots: { default: true }
                              });
                              $$payload8.out.push(`<!---->`);
                            }
                            $$payload8.out.push(`<!--]-->`);
                          },
                          $$slots: { default: true }
                        });
                        $$payload7.out.push(`<!---->`);
                      },
                      $$slots: { default: true }
                    });
                    $$payload6.out.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$payload5.out.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$payload4.out.push(`<!---->`);
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
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
function Export_menu($$payload, $$props) {
  push();
  let { activeGame } = $$props;
  $$payload.out.push(`<!---->`);
  Sidebar_group($$payload, {
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->`);
      Sidebar_group_label($$payload2, {
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->Actions`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> <!---->`);
      Sidebar_menu($$payload2, {
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->`);
          Collapsible($$payload3, {
            class: "group/collapsible",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->`);
              Sidebar_menu_item($$payload4, {
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->`);
                  {
                    let child = function($$payload6, { props }) {
                      $$payload6.out.push(`<!---->`);
                      Sidebar_menu_button($$payload6, spread_props([
                        props,
                        {
                          tooltipContent: "Export options",
                          children: ($$payload7) => {
                            Download($$payload7, {});
                            $$payload7.out.push(`<!----> <span>Export</span> `);
                            Chevron_right($$payload7, {
                              class: "ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                            });
                            $$payload7.out.push(`<!---->`);
                          },
                          $$slots: { default: true }
                        }
                      ]));
                      $$payload6.out.push(`<!---->`);
                    };
                    Collapsible_trigger($$payload5, { child, $$slots: { child: true } });
                  }
                  $$payload5.out.push(`<!----> <!---->`);
                  Collapsible_content($$payload5, {
                    children: ($$payload6) => {
                      $$payload6.out.push(`<!---->`);
                      Sidebar_menu_sub($$payload6, {
                        children: ($$payload7) => {
                          $$payload7.out.push(`<!---->`);
                          Sidebar_menu_sub_item($$payload7, {
                            children: ($$payload8) => {
                              $$payload8.out.push(`<!---->`);
                              {
                                let child = function($$payload9, { props }) {
                                  $$payload9.out.push(`<a${spread_attributes({ href: `/games/${activeGame?.name}/export/tts`, ...props })}>`);
                                  Gamepad_2($$payload9, { class: "mr-2 h-4 w-4" });
                                  $$payload9.out.push(`<!----> TTS</a>`);
                                };
                                Sidebar_menu_sub_button($$payload8, { child, $$slots: { child: true } });
                              }
                              $$payload8.out.push(`<!---->`);
                            },
                            $$slots: { default: true }
                          });
                          $$payload7.out.push(`<!----> <!---->`);
                          Sidebar_menu_sub_item($$payload7, {
                            children: ($$payload8) => {
                              $$payload8.out.push(`<!---->`);
                              {
                                let child = function($$payload9, { props }) {
                                  $$payload9.out.push(`<a${spread_attributes({ href: `/games/${activeGame?.name}/export/paper`, ...props })}>`);
                                  Printer($$payload9, { class: "mr-2 h-4 w-4" });
                                  $$payload9.out.push(`<!----> Paper</a>`);
                                };
                                Sidebar_menu_sub_button($$payload8, { child, $$slots: { child: true } });
                              }
                              $$payload8.out.push(`<!---->`);
                            },
                            $$slots: { default: true }
                          });
                          $$payload7.out.push(`<!---->`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload6.out.push(`<!---->`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload5.out.push(`<!---->`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!---->`);
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
function Dropdown_menu_label($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    inset,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<div${spread_attributes(
    {
      "data-slot": "dropdown-menu-label",
      "data-inset": inset,
      class: clsx(cn("px-2 py-1.5 text-sm font-semibold data-[inset]:pl-8", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Dropdown_menu_separator($$payload, $$props) {
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
        "data-slot": "dropdown-menu-separator",
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
function Dropdown_menu_shortcut($$payload, $$props) {
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
      "data-slot": "dropdown-menu-shortcut",
      class: clsx(cn("text-muted-foreground ml-auto text-xs tracking-widest", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></span>`);
  bind_props($$props, { ref });
  pop();
}
function Project_switcher($$payload, $$props) {
  push();
  let { games, activeProject, onProjectChange } = $$props;
  const sidebar = useSidebar();
  $$payload.out.push(`<!---->`);
  Sidebar_menu($$payload, {
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->`);
      Sidebar_menu_item($$payload2, {
        children: ($$payload3) => {
          if (activeProject != null) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<!---->`);
            Root$3($$payload3, {
              children: ($$payload4) => {
                $$payload4.out.push(`<!---->`);
                {
                  let child = function($$payload5, { props }) {
                    $$payload5.out.push(`<!---->`);
                    Sidebar_menu_button($$payload5, spread_props([
                      props,
                      {
                        size: "lg",
                        class: "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                        children: ($$payload6) => {
                          $$payload6.out.push(`<div class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"></div> <div class="grid flex-1 text-left text-sm leading-tight"><span class="truncate font-medium">${escape_html(activeProject.name)}</span></div> `);
                          Chevrons_up_down($$payload6, { class: "ml-auto" });
                          $$payload6.out.push(`<!---->`);
                        },
                        $$slots: { default: true }
                      }
                    ]));
                    $$payload5.out.push(`<!---->`);
                  };
                  Dropdown_menu_trigger($$payload4, { child, $$slots: { child: true } });
                }
                $$payload4.out.push(`<!----> <!---->`);
                Dropdown_menu_content($$payload4, {
                  class: "w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg",
                  align: "start",
                  side: sidebar.isMobile ? "bottom" : "right",
                  sideOffset: 4,
                  children: ($$payload5) => {
                    const each_array = ensure_array_like(games);
                    $$payload5.out.push(`<!---->`);
                    Dropdown_menu_label($$payload5, {
                      class: "text-muted-foreground text-xs",
                      children: ($$payload6) => {
                        $$payload6.out.push(`<!---->Games`);
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!----> <!--[-->`);
                    for (let index = 0, $$length = each_array.length; index < $$length; index++) {
                      let game = each_array[index];
                      $$payload5.out.push(`<!---->`);
                      Dropdown_menu_item($$payload5, {
                        onSelect: () => onProjectChange(game),
                        class: "gap-2 p-2",
                        children: ($$payload6) => {
                          $$payload6.out.push(`<div class="flex size-6 items-center justify-center rounded-md border"></div> ${escape_html(game.name)} <!---->`);
                          Dropdown_menu_shortcut($$payload6, {
                            children: ($$payload7) => {
                              $$payload7.out.push(`<!---->⌘${escape_html(index + 1)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$payload6.out.push(`<!---->`);
                        },
                        $$slots: { default: true }
                      });
                      $$payload5.out.push(`<!---->`);
                    }
                    $$payload5.out.push(`<!--]--> <!---->`);
                    Dropdown_menu_separator($$payload5, {});
                    $$payload5.out.push(`<!----> <!---->`);
                    Dropdown_menu_item($$payload5, {
                      class: "gap-2 p-2",
                      children: ($$payload6) => {
                        $$payload6.out.push(`<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">`);
                        Plus($$payload6, { class: "size-4" });
                        $$payload6.out.push(`<!----></div> <div class="text-muted-foreground font-medium">New Game</div>`);
                      },
                      $$slots: { default: true }
                    });
                    $$payload5.out.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$payload4.out.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$payload3.out.push(`<!---->`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--> `);
          Button($$payload3, {
            class: "w-full",
            variant: "default",
            children: ($$payload4) => {
              Plus($$payload4, {});
              $$payload4.out.push(`<!----> Create Game`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!---->`);
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
function App_sidebar($$payload, $$props) {
  push();
  let { games } = $$props;
  let activeProject = (() => {
    const game = games.find((game2) => game2.name === page.params.gameName);
    if (game) return game;
    return games.length > 0 ? games[0] : null;
  })();
  function onProjectChange(project) {
    activeProject = project;
    goto(`/games/${project.name}`);
  }
  $$payload.out.push(`<!---->`);
  Sidebar($$payload, {
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->`);
      Sidebar_header($$payload2, {
        children: ($$payload3) => {
          Project_switcher($$payload3, { games, activeProject, onProjectChange });
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> <!---->`);
      Sidebar_content($$payload2, {
        children: ($$payload3) => {
          Create_menu($$payload3, { activeGame: activeProject });
          $$payload3.out.push(`<!----> `);
          Export_menu($$payload3, { activeGame: activeProject });
          $$payload3.out.push(`<!----> <!---->`);
          Sidebar_group($$payload3, {});
          $$payload3.out.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> <!---->`);
      Sidebar_footer($$payload2, {});
      $$payload2.out.push(`<!---->`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!---->`);
  pop();
}
class ExplorerNodeBase {
  name = "";
  parent = null;
  constructor(name, parent = null) {
    this.name = name;
    this.parent = parent;
  }
}
class FileLeaf extends ExplorerNodeBase {
  fileData = void 0;
  constructor(name, parent = null, fileData) {
    super(name, parent);
    this.fileData = fileData;
    if (this.fileData?.blob && this.fileData?.mimetype.startsWith("image")) {
      this.fileData.url = Promise.resolve(URL.createObjectURL(this.fileData.blob));
    }
  }
}
class Folder extends ExplorerNodeBase {
  children = [];
  #isEmpty = derived(() => this.children.length === 0);
  get isEmpty() {
    return this.#isEmpty();
  }
  set isEmpty($$value) {
    return this.#isEmpty($$value);
  }
  constructor(name, parent = null, children = []) {
    super(name, parent);
    this.children = children;
  }
}
function buildTree(filePathList) {
  const root = { name: "home", children: /* @__PURE__ */ new Map() };
  for (const { pathTokens, fileData } of filePathList) {
    subBuild(root, pathTokens, fileData);
  }
  return root;
}
function subBuild(current, pathTokens, fileData) {
  for (let i = 1; i < pathTokens.length; i++) {
    const token = pathTokens[i];
    let next = current.children.get(token);
    if (!next) {
      if (i === pathTokens.length - 1) {
        next = { name: token, fileData };
      } else {
        next = { name: token, children: /* @__PURE__ */ new Map() };
      }
      current.children.set(token, next);
    }
    if ("children" in next) current = next;
  }
}
function convertToArray(buildNode, parent) {
  if (!("children" in buildNode)) {
    return new FileLeaf(buildNode.name, parent, buildNode.fileData);
  }
  const node = new Folder(buildNode.name, parent);
  for (const child of buildNode.children.values()) {
    node.children.push(convertToArray(child, node));
  }
  return node;
}
function buildFileTree(filePathList) {
  const tree = buildTree(filePathList);
  return convertToArray(tree, null);
}
class OPFSAdapter {
  root;
  folder = null;
  constructor(root) {
    this.root = root;
  }
  static async create() {
    const root = await navigator.storage.getDirectory();
    return new OPFSAdapter(root);
  }
  /**
   * Navigates a slash-delimited folder path, optionally creating directories.
   */
  async _getDirectoryHandle(path, create = false) {
    const parts = path.split("/").filter(Boolean);
    let dir = this.root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }
  _splitPath(path) {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    const parent = parts.join("/");
    return { parent, name };
  }
  async download(paths) {
    return await Promise.all(
      paths.map(async (path) => {
        try {
          const { parent, name } = this._splitPath(path);
          const dir = parent ? await this._getDirectoryHandle(parent) : this.root;
          const fileHandle = await dir.getFileHandle(name);
          const file = await fileHandle.getFile();
          return { result: { path, data: file }, error: null };
        } catch (error) {
          return { result: null, error };
        }
      })
    );
  }
  async upload(file, fullFolderPath, overwrite = false) {
    try {
      const folder = await this._getDirectoryHandle(fullFolderPath, true);
      if (!overwrite) {
        try {
          await folder.getFileHandle(file.name);
          return new Error(`File exists: ${fullFolderPath}${file.name}`);
        } catch {
        }
      }
      const handle = await folder.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      this.folder = null;
      return null;
    } catch (error) {
      return error;
    }
  }
  async copy(files) {
    try {
      for (const { filePath, path } of files) {
        const { parent: srcParent, name: srcName } = this._splitPath(filePath);
        const srcDir = srcParent ? await this._getDirectoryHandle(srcParent) : this.root;
        const srcHandle = await srcDir.getFileHandle(srcName);
        const fileData = await srcHandle.getFile();
        const { parent: dstParent, name: dstName } = this._splitPath(path);
        const dstDir = await this._getDirectoryHandle(dstParent, true);
        const dstHandle = await dstDir.getFileHandle(dstName, { create: true });
        const writable = await dstHandle.createWritable();
        await writable.write(fileData);
        await writable.close();
      }
      return null;
    } catch (error) {
      return error;
    }
  }
  async move(files) {
    try {
      await this.copy(files);
      for (const { filePath } of files) {
        const { parent, name } = this._splitPath(filePath);
        const dir = parent ? await this._getDirectoryHandle(parent) : this.root;
        await dir.removeEntry(name);
      }
      return null;
    } catch (error) {
      return error;
    }
  }
  async delete(paths) {
    try {
      for (const path of paths) {
        const { parent, name } = this._splitPath(path);
        const dir = parent ? await this._getDirectoryHandle(parent) : this.root;
        await dir.removeEntry(name);
      }
      return null;
    } catch (error) {
      return error;
    }
  }
  async getRootFolder() {
    if (this.folder) {
      return { result: this.folder, error: null };
    }
    try {
      const filePathList = [];
      const walk = async (dir, tokens = []) => {
        for await (const [name, handle] of dir.entries()) {
          const nextTokens = [...tokens, name];
          if (handle.kind === "directory") {
            await walk(handle, nextTokens);
          } else {
            const file = await handle.getFile();
            filePathList.push({
              // I don't really like this "home" stuff, build tree skips the root folder and create it's own root folder for the new tree
              pathTokens: ["home", ...nextTokens],
              fileData: {
                size: file.size,
                mimetype: file.type || "application/octet-stream",
                updatedAt: new Date(file.lastModified),
                blob: file,
                url: Promise.resolve(URL.createObjectURL(file))
              }
            });
          }
        }
      };
      await walk(this.root);
      this.folder = buildFileTree(filePathList);
      return { result: this.folder, error: null };
    } catch (error) {
      return { result: null, error };
    }
  }
}
function Alert_dialog_title($$payload, $$props) {
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
    Dialog_title($$payload2, spread_props([
      {
        "data-slot": "alert-dialog-title",
        class: cn("text-lg font-semibold", className)
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
function Alert_dialog_action($$payload, $$props) {
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
    Alert_dialog_action$1($$payload2, spread_props([
      {
        "data-slot": "alert-dialog-action",
        class: cn(buttonVariants(), className)
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
function Alert_dialog_cancel($$payload, $$props) {
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
    Alert_dialog_cancel$1($$payload2, spread_props([
      {
        "data-slot": "alert-dialog-cancel",
        class: cn(buttonVariants({ variant: "outline" }), className)
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
function Alert_dialog_footer($$payload, $$props) {
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
      "data-slot": "alert-dialog-footer",
      class: clsx(cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Alert_dialog_header($$payload, $$props) {
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
      "data-slot": "alert-dialog-header",
      class: clsx(cn("flex flex-col gap-2 text-center sm:text-left", className)),
      ...restProps
    }
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></div>`);
  bind_props($$props, { ref });
  pop();
}
function Alert_dialog_overlay($$payload, $$props) {
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
    Dialog_overlay($$payload2, spread_props([
      {
        "data-slot": "alert-dialog-overlay",
        class: cn("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50", className)
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
function Alert_dialog_content($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    portalProps,
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
          Alert_dialog_overlay($$payload3, {});
          $$payload3.out.push(`<!----> <!---->`);
          Alert_dialog_content$1($$payload3, spread_props([
            {
              "data-slot": "alert-dialog-content",
              class: cn("bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg", className)
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
function Alert_dialog_description($$payload, $$props) {
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
    Dialog_description($$payload2, spread_props([
      {
        "data-slot": "alert-dialog-description",
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
const Root = Alert_dialog;
function Pick_folder($$payload, $$props) {
  push();
  async function useOpfs() {
    await OPFSAdapter.create();
  }
  $$payload.out.push(`<!---->`);
  Root($$payload, {
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->`);
      Alert_dialog_content($$payload2, {
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->`);
          Alert_dialog_header($$payload3, {
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->`);
              Alert_dialog_title($$payload4, {
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Are you absolutely sure?`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> <!---->`);
              Alert_dialog_description($$payload4, {
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Picking a local folder means once you delete Browser data you will lose your work.`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!----> <!---->`);
          Alert_dialog_footer($$payload3, {
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->`);
              Alert_dialog_cancel($$payload4, {
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Cancel`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!----> <!---->`);
              Alert_dialog_action($$payload4, {
                onclick: (e) => useOpfs(),
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->Use Browser storage`);
                },
                $$slots: { default: true }
              });
              $$payload4.out.push(`<!---->`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> `);
      {
        $$payload2.out.push("<!--[!-->");
        {
          $$payload2.out.push("<!--[!-->");
        }
        $$payload2.out.push(`<!--]-->`);
      }
      $$payload2.out.push(`<!--]-->`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!---->`);
  pop();
}
function _layout($$payload, $$props) {
  push();
  let fileSystemState = { adapter: null };
  const fileSystem = fileSystemState.adapter;
  let games = [];
  setFileSystemContext(fileSystemState);
  let { children } = $$props;
  $$payload.out.push(`<!---->`);
  Sidebar_provider($$payload, {
    children: ($$payload2) => {
      App_sidebar($$payload2, { games });
      $$payload2.out.push(`<!----> <main class="w-full"><!---->`);
      Sidebar_trigger($$payload2, {});
      $$payload2.out.push(`<!----> `);
      if (!fileSystem) {
        $$payload2.out.push("<!--[-->");
        $$payload2.out.push(`<div class="mt-12 flex w-full flex-col items-center justify-center gap-4 text-xl">`);
        Pick_folder($$payload2);
        $$payload2.out.push(`<!----></div>`);
      } else {
        $$payload2.out.push("<!--[!-->");
        $$payload2.out.push(`<!--[-->`);
        {
          $$payload2.out.push(`<p>loading...</p>`);
        }
        $$payload2.out.push(`<!--]-->`);
      }
      $$payload2.out.push(`<!--]--></main>`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!---->`);
  pop();
}
export {
  _layout as default
};
