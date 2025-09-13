import { V as is_array, W as get_prototype_of, X as object_prototype, G as derived, w as push, A as spread_attributes, D as bind_props, y as pop, F as spread_props, E as props_id, J as copy_payload, K as assign_payload, z as escape_html, O as ensure_array_like, N as attr_class, M as attr, Y as attr_style, I as stringify } from "./index2.js";
import "./index3.js";
import { I as Icon, B as Button } from "./Icon.js";
import { c as cn } from "./utils2.js";
import { a as attachRef, d as createBitsAttrs, o as getDataReadonly, g as getDataDisabled, p as getAriaReadonly, q as getAriaRequired, r as getAriaChecked, m as mergeProps, s as srOnlyStylesString, c as createId, b as box } from "./create-id.js";
import "style-to-object";
import "clsx";
import { C as Context, w as watch, c as ENTER, b as SPACE, I as Input } from "./popper-layer-force-mount.js";
import { C as Check } from "./check.js";
import { R as Root, D as Dropdown_menu_trigger, a as Dropdown_menu_content, b as Dropdown_menu_item } from "./index5.js";
const empty = [];
function snapshot(value, skip_warning = false, no_tojson = false) {
  return clone(value, /* @__PURE__ */ new Map(), "", empty, null, no_tojson);
}
function clone(value, cloned, path, paths, original = null, no_tojson = false) {
  if (typeof value === "object" && value !== null) {
    var unwrapped = cloned.get(value);
    if (unwrapped !== void 0) return unwrapped;
    if (value instanceof Map) return (
      /** @type {Snapshot<T>} */
      new Map(value)
    );
    if (value instanceof Set) return (
      /** @type {Snapshot<T>} */
      new Set(value)
    );
    if (is_array(value)) {
      var copy = (
        /** @type {Snapshot<any>} */
        Array(value.length)
      );
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var i = 0; i < value.length; i += 1) {
        var element = value[i];
        if (i in value) {
          copy[i] = clone(element, cloned, path, paths, null, no_tojson);
        }
      }
      return copy;
    }
    if (get_prototype_of(value) === object_prototype) {
      copy = {};
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var key in value) {
        copy[key] = clone(
          // @ts-expect-error
          value[key],
          cloned,
          path,
          paths,
          null,
          no_tojson
        );
      }
      return copy;
    }
    if (value instanceof Date) {
      return (
        /** @type {Snapshot<T>} */
        structuredClone(value)
      );
    }
    if (typeof /** @type {T & { toJSON?: any } } */
    value.toJSON === "function" && !no_tojson) {
      return clone(
        /** @type {T & { toJSON(): any } } */
        value.toJSON(),
        cloned,
        path,
        paths,
        // Associate the instance with the toJSON clone
        value
      );
    }
  }
  if (value instanceof EventTarget) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
  try {
    return (
      /** @type {Snapshot<T>} */
      structuredClone(value)
    );
  } catch (e) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
}
const checkboxAttrs = createBitsAttrs({
  component: "checkbox",
  parts: ["root", "group", "group-label", "input"]
});
const CheckboxGroupContext = new Context("Checkbox.Group");
const CheckboxRootContext = new Context("Checkbox.Root");
class CheckboxRootState {
  static create(opts, group = null) {
    return CheckboxRootContext.set(new CheckboxRootState(opts, group));
  }
  opts;
  group;
  #trueName = derived(() => {
    if (this.group && this.group.opts.name.current) return this.group.opts.name.current;
    return this.opts.name.current;
  });
  get trueName() {
    return this.#trueName();
  }
  set trueName($$value) {
    return this.#trueName($$value);
  }
  #trueRequired = derived(() => {
    if (this.group && this.group.opts.required.current) return true;
    return this.opts.required.current;
  });
  get trueRequired() {
    return this.#trueRequired();
  }
  set trueRequired($$value) {
    return this.#trueRequired($$value);
  }
  #trueDisabled = derived(() => {
    if (this.group && this.group.opts.disabled.current) return true;
    return this.opts.disabled.current;
  });
  get trueDisabled() {
    return this.#trueDisabled();
  }
  set trueDisabled($$value) {
    return this.#trueDisabled($$value);
  }
  #trueReadonly = derived(() => {
    if (this.group && this.group.opts.readonly.current) return true;
    return this.opts.readonly.current;
  });
  get trueReadonly() {
    return this.#trueReadonly();
  }
  set trueReadonly($$value) {
    return this.#trueReadonly($$value);
  }
  attachment;
  constructor(opts, group) {
    this.opts = opts;
    this.group = group;
    this.attachment = attachRef(this.opts.ref);
    this.onkeydown = this.onkeydown.bind(this);
    this.onclick = this.onclick.bind(this);
    watch.pre(
      [
        () => snapshot(this.group?.opts.value.current),
        () => this.opts.value.current
      ],
      ([groupValue, value]) => {
        if (!groupValue || !value) return;
        this.opts.checked.current = groupValue.includes(value);
      }
    );
    watch.pre(() => this.opts.checked.current, (checked) => {
      if (!this.group) return;
      if (checked) {
        this.group?.addValue(this.opts.value.current);
      } else {
        this.group?.removeValue(this.opts.value.current);
      }
    });
  }
  onkeydown(e) {
    if (this.trueDisabled || this.trueReadonly) return;
    if (e.key === ENTER) e.preventDefault();
    if (e.key === SPACE) {
      e.preventDefault();
      this.#toggle();
    }
  }
  #toggle() {
    if (this.opts.indeterminate.current) {
      this.opts.indeterminate.current = false;
      this.opts.checked.current = true;
    } else {
      this.opts.checked.current = !this.opts.checked.current;
    }
  }
  onclick(e) {
    if (this.trueDisabled || this.trueReadonly) return;
    if (this.opts.type.current === "submit") {
      this.#toggle();
      return;
    }
    e.preventDefault();
    this.#toggle();
  }
  #snippetProps = derived(() => ({
    checked: this.opts.checked.current,
    indeterminate: this.opts.indeterminate.current
  }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "checkbox",
    type: this.opts.type.current,
    disabled: this.trueDisabled,
    "aria-checked": getAriaChecked(this.opts.checked.current, this.opts.indeterminate.current),
    "aria-required": getAriaRequired(this.trueRequired),
    "aria-readonly": getAriaReadonly(this.trueReadonly),
    "data-disabled": getDataDisabled(this.trueDisabled),
    "data-readonly": getDataReadonly(this.trueReadonly),
    "data-state": getCheckboxDataState(this.opts.checked.current, this.opts.indeterminate.current),
    [checkboxAttrs.root]: "",
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
class CheckboxInputState {
  static create() {
    return new CheckboxInputState(CheckboxRootContext.get());
  }
  root;
  #trueChecked = derived(() => {
    if (!this.root.group) return this.root.opts.checked.current;
    if (this.root.opts.value.current !== void 0 && this.root.group.opts.value.current.includes(this.root.opts.value.current)) {
      return true;
    }
    return false;
  });
  get trueChecked() {
    return this.#trueChecked();
  }
  set trueChecked($$value) {
    return this.#trueChecked($$value);
  }
  #shouldRender = derived(() => Boolean(this.root.trueName));
  get shouldRender() {
    return this.#shouldRender();
  }
  set shouldRender($$value) {
    return this.#shouldRender($$value);
  }
  constructor(root) {
    this.root = root;
  }
  #props = derived(() => ({
    type: "checkbox",
    checked: this.root.opts.checked.current === true,
    disabled: this.root.trueDisabled,
    required: this.root.trueRequired,
    name: this.root.trueName,
    value: this.root.opts.value.current,
    readonly: this.root.trueReadonly
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function getCheckboxDataState(checked, indeterminate) {
  if (indeterminate) return "indeterminate";
  return checked ? "checked" : "unchecked";
}
function Hidden_input($$payload, $$props) {
  push();
  let { value = void 0, $$slots, $$events, ...restProps } = $$props;
  const mergedProps = mergeProps(restProps, {
    "aria-hidden": "true",
    tabindex: -1,
    style: srOnlyStylesString
  });
  if (mergedProps.type === "checkbox") {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<input${spread_attributes({ ...mergedProps, value })}/>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<input${spread_attributes({ value, ...mergedProps })}/>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { value });
  pop();
}
function Checkbox_input($$payload, $$props) {
  push();
  const inputState = CheckboxInputState.create();
  if (inputState.shouldRender) {
    $$payload.out.push("<!--[-->");
    Hidden_input($$payload, spread_props([inputState.props]));
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  pop();
}
function Checkbox$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    checked = false,
    ref = null,
    onCheckedChange,
    children,
    disabled = false,
    required = false,
    name = void 0,
    value = "on",
    id = createId(uid),
    indeterminate = false,
    onIndeterminateChange,
    child,
    type = "button",
    readonly,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const group = CheckboxGroupContext.getOr(null);
  if (group && value) {
    if (group.opts.value.current.includes(value)) {
      checked = true;
    } else {
      checked = false;
    }
  }
  watch.pre(() => value, () => {
    if (group && value) {
      if (group.opts.value.current.includes(value)) {
        checked = true;
      } else {
        checked = false;
      }
    }
  });
  const rootState = CheckboxRootState.create(
    {
      checked: box.with(() => checked, (v) => {
        checked = v;
        onCheckedChange?.(v);
      }),
      disabled: box.with(() => disabled ?? false),
      required: box.with(() => required),
      name: box.with(() => name),
      value: box.with(() => value),
      id: box.with(() => id),
      ref: box.with(() => ref, (v) => ref = v),
      indeterminate: box.with(() => indeterminate, (v) => {
        indeterminate = v;
        onIndeterminateChange?.(v);
      }),
      type: box.with(() => type),
      readonly: box.with(() => Boolean(readonly))
    },
    group
  );
  const mergedProps = mergeProps({ ...restProps }, rootState.props);
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps, ...rootState.snippetProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<button${spread_attributes({ ...mergedProps })}>`);
    children?.($$payload, rootState.snippetProps);
    $$payload.out.push(`<!----></button>`);
  }
  $$payload.out.push(`<!--]--> `);
  Checkbox_input($$payload);
  $$payload.out.push(`<!---->`);
  bind_props($$props, { checked, ref, indeterminate });
  pop();
}
function Chevron_down($$payload, $$props) {
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
  const iconNode = [["path", { "d": "m6 9 6 6 6-6" }]];
  Icon($$payload, spread_props([
    { name: "chevron-down" },
    /**
     * @component @name ChevronDown
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtNiA5IDYgNiA2LTYiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/chevron-down
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
function Club($$payload, $$props) {
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
        "d": "M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z"
      }
    ],
    ["path", { "d": "M12 17.66L12 22" }]
  ];
  Icon($$payload, spread_props([
    { name: "club" },
    /**
     * @component @name Club
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTcuMjggOS4wNWE1LjUgNS41IDAgMSAwLTEwLjU2IDBBNS41IDUuNSAwIDEgMCAxMiAxNy42NmE1LjUgNS41IDAgMSAwIDUuMjgtOC42WiIgLz4KICA8cGF0aCBkPSJNMTIgMTcuNjZMMTIgMjIiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/club
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
function Diamond($$payload, $$props) {
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
        "d": "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"
      }
    ]
  ];
  Icon($$payload, spread_props([
    { name: "diamond" },
    /**
     * @component @name Diamond
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMi43IDEwLjNhMi40MSAyLjQxIDAgMCAwIDAgMy40MWw3LjU5IDcuNTlhMi40MSAyLjQxIDAgMCAwIDMuNDEgMGw3LjU5LTcuNTlhMi40MSAyLjQxIDAgMCAwIDAtMy40MWwtNy41OS03LjU5YTIuNDEgMi40MSAwIDAgMC0zLjQxIDBaIiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/diamond
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
function Heart($$payload, $$props) {
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
        "d": "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      }
    ]
  ];
  Icon($$payload, spread_props([
    { name: "heart" },
    /**
     * @component @name Heart
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTkgMTRjMS40OS0xLjQ2IDMtMy4yMSAzLTUuNUE1LjUgNS41IDAgMCAwIDE2LjUgM2MtMS43NiAwLTMgLjUtNC41IDItMS41LTEuNS0yLjc0LTItNC41LTJBNS41IDUuNSAwIDAgMCAyIDguNWMwIDIuMyAxLjUgNC4wNSAzIDUuNWw3IDdaIiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/heart
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
function Minus($$payload, $$props) {
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
  const iconNode = [["path", { "d": "M5 12h14" }]];
  Icon($$payload, spread_props([
    { name: "minus" },
    /**
     * @component @name Minus
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNSAxMmgxNCIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/minus
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
function Spade($$payload, $$props) {
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
        "d": "M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z"
      }
    ],
    ["path", { "d": "M12 18v4" }]
  ];
  Icon($$payload, spread_props([
    { name: "spade" },
    /**
     * @component @name Spade
     * @description Lucide SVG icon component, renders SVG Element with children.
     *
     * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNSA5Yy0xLjUgMS41LTMgMy4yLTMgNS41QTUuNSA1LjUgMCAwIDAgNy41IDIwYzEuOCAwIDMtLjUgNC41LTIgMS41IDEuNSAyLjcgMiA0LjUgMmE1LjUgNS41IDAgMCAwIDUuNS01LjVjMC0yLjMtMS41LTQtMy01LjVsLTctNy03IDdaIiAvPgogIDxwYXRoIGQ9Ik0xMiAxOHY0IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/spade
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
function Checkbox($$payload, $$props) {
  push();
  let {
    ref = null,
    checked = false,
    indeterminate = false,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    {
      let children = function($$payload3, { checked: checked2, indeterminate: indeterminate2 }) {
        $$payload3.out.push(`<div data-slot="checkbox-indicator" class="text-current transition-none">`);
        if (checked2) {
          $$payload3.out.push("<!--[-->");
          Check($$payload3, { class: "size-3.5" });
        } else {
          $$payload3.out.push("<!--[!-->");
          if (indeterminate2) {
            $$payload3.out.push("<!--[-->");
            Minus($$payload3, { class: "size-3.5" });
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]-->`);
        }
        $$payload3.out.push(`<!--]--></div>`);
      };
      Checkbox$1($$payload2, spread_props([
        {
          "data-slot": "checkbox",
          class: cn("border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50", className)
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
          get checked() {
            return checked;
          },
          set checked($$value) {
            checked = $$value;
            $$settled = false;
          },
          get indeterminate() {
            return indeterminate;
          },
          set indeterminate($$value) {
            indeterminate = $$value;
            $$settled = false;
          },
          children,
          $$slots: { default: true }
        }
      ]));
    }
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref, checked, indeterminate });
  pop();
}
function Print_configuration_bar($$payload, $$props) {
  push();
  let {
    paperSize = "A4",
    orientation = "Portrait",
    fronts = true,
    backs = false,
    margin = 10,
    cropMarks = false
  } = $$props;
  const paperSizes = ["A3", "A4", "A5", "US Letter", "US Legal"];
  function toggleOrientation() {
    orientation = orientation === "Portrait" ? "Landscape" : "Portrait";
  }
  function handlePrint() {
    window.print();
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<div class="bg-background flex items-center gap-4 rounded-lg border p-4"><div class="flex items-center gap-2"><label class="text-sm font-medium">Paper size:</label> <!---->`);
    Root($$payload2, {
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->`);
        Dropdown_menu_trigger($$payload3, {
          asChild: true,
          children: ($$payload4) => {
            Button($$payload4, {
              variant: "outline",
              class: "min-w-[120px] justify-between",
              children: ($$payload5) => {
                $$payload5.out.push(`<!---->${escape_html(paperSize)} `);
                Chevron_down($$payload5, { class: "size-4" });
                $$payload5.out.push(`<!---->`);
              },
              $$slots: { default: true }
            });
          },
          $$slots: { default: true }
        });
        $$payload3.out.push(`<!----> <!---->`);
        Dropdown_menu_content($$payload3, {
          children: ($$payload4) => {
            const each_array = ensure_array_like(paperSizes);
            $$payload4.out.push(`<!--[-->`);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let size = each_array[$$index];
              $$payload4.out.push(`<!---->`);
              Dropdown_menu_item($$payload4, {
                onclick: () => paperSize = size,
                children: ($$payload5) => {
                  $$payload5.out.push(`<!---->${escape_html(size)}`);
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
    $$payload2.out.push(`<!----></div> <div class="flex items-center gap-2"><label class="text-sm font-medium">Orientation:</label> `);
    Button($$payload2, {
      variant: "outline",
      onclick: toggleOrientation,
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->${escape_html(orientation)}
			⇄`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div> <div class="flex items-center gap-2">`);
    Checkbox($$payload2, {
      get checked() {
        return fronts;
      },
      set checked($$value) {
        fronts = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <label class="text-sm font-medium">Fronts</label></div> <div class="flex items-center gap-2">`);
    Checkbox($$payload2, {
      get checked() {
        return backs;
      },
      set checked($$value) {
        backs = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <label class="text-sm font-medium">Backs</label></div> <div class="flex items-center gap-2">`);
    Checkbox($$payload2, {
      get checked() {
        return cropMarks;
      },
      set checked($$value) {
        cropMarks = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <label class="text-sm font-medium">Crop marks</label></div> <div class="flex items-center gap-2"><label class="text-sm font-medium">Margin (mm):</label> `);
    Input($$payload2, {
      type: "number",
      min: "0",
      max: "50",
      class: "w-20",
      get value() {
        return margin;
      },
      set value($$value) {
        margin = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----></div> `);
    Button($$payload2, {
      onclick: handlePrint,
      class: "ml-auto",
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->Print`);
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
  bind_props($$props, { paperSize, orientation, fronts, backs, margin, cropMarks });
  pop();
}
function Export_pages($$payload, $$props) {
  push();
  let { projects, gameName } = $$props;
  let paperSize = "A4";
  let orientation = "Portrait";
  let fronts = true;
  let backs = false;
  let margin = 10;
  let cropMarks = false;
  const paperSizes = {
    A3: { width: 297, height: 420 },
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    "US Letter": { width: 216, height: 279 },
    "US Legal": { width: 216, height: 356 }
  };
  const pageDimensions = () => {
    const size = paperSizes[paperSize];
    return orientation === "Portrait" ? { width: `${size.width}mm`, height: `${size.height}mm` } : { width: `${size.height}mm`, height: `${size.width}mm` };
  };
  function calculateFitForSize(cardWidth, cardHeight) {
    const size = paperSizes[paperSize];
    const pageWidth = orientation === "Portrait" ? size.width : size.height;
    const pageHeight = orientation === "Portrait" ? size.height : size.width;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    const svgWidth = parseFloat(cardWidth.replace("mm", ""));
    const svgHeight = parseFloat(cardHeight.replace("mm", ""));
    const horizontalFit = Math.floor(availableWidth / svgWidth);
    const verticalFit = Math.floor(availableHeight / svgHeight);
    return {
      horizontal: horizontalFit,
      vertical: verticalFit,
      total: horizontalFit * verticalFit
    };
  }
  const pages = () => {
    const allPages = [];
    projects.forEach((project) => {
      const cardWidth = project.svgsFront[0]?.width.baseVal.valueAsString || "63mm";
      const cardHeight = project.svgsFront[0]?.height.baseVal.valueAsString || "89mm";
      const fitCalculation = calculateFitForSize(cardWidth, cardHeight);
      const svgsPerPage = fitCalculation.total;
      if (fronts && backs) {
        const frontSvgs = project.svgsFront;
        const backSvgs = project.svgsBack;
        const frontPageCount = Math.ceil(frontSvgs.length / svgsPerPage);
        const backPageCount = Math.ceil(backSvgs.length / svgsPerPage);
        const totalPages = frontPageCount + backPageCount;
        const projectPages = Array.from({ length: totalPages }, (_, pageIndex) => {
          const isFrontPage = pageIndex % 2 === 0;
          const pageTypeIndex = Math.floor(pageIndex / 2);
          if (isFrontPage) {
            const startIndex = pageTypeIndex * svgsPerPage;
            const endIndex = Math.min(startIndex + svgsPerPage, frontSvgs.length);
            return {
              svgs: frontSvgs.slice(startIndex, endIndex),
              width: cardWidth,
              height: cardHeight,
              fitCalculation
            };
          } else {
            const startIndex = pageTypeIndex * svgsPerPage;
            const endIndex = Math.min(startIndex + svgsPerPage, backSvgs.length);
            return {
              svgs: backSvgs.slice(startIndex, endIndex),
              width: cardWidth,
              height: cardHeight,
              fitCalculation
            };
          }
        });
        allPages.push(...projectPages);
      } else if (fronts) {
        const frontSvgs = project.svgsFront;
        const pageCount = Math.ceil(frontSvgs.length / svgsPerPage);
        const projectPages = Array.from({ length: pageCount }, (_, pageIndex) => {
          const startIndex = pageIndex * svgsPerPage;
          const endIndex = Math.min(startIndex + svgsPerPage, frontSvgs.length);
          return {
            svgs: frontSvgs.slice(startIndex, endIndex),
            width: cardWidth,
            height: cardHeight,
            fitCalculation
          };
        });
        allPages.push(...projectPages);
      } else if (backs) {
        const backSvgs = project.svgsBack;
        const pageCount = Math.ceil(backSvgs.length / svgsPerPage);
        const projectPages = Array.from({ length: pageCount }, (_, pageIndex) => {
          const startIndex = pageIndex * svgsPerPage;
          const endIndex = Math.min(startIndex + svgsPerPage, backSvgs.length);
          return {
            svgs: backSvgs.slice(startIndex, endIndex),
            width: cardWidth,
            height: cardHeight,
            fitCalculation
          };
        });
        allPages.push(...projectPages);
      }
    });
    return allPages;
  };
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<div class="mx-4 flex flex-col gap-4">`);
    Print_configuration_bar($$payload2, {
      get paperSize() {
        return paperSize;
      },
      set paperSize($$value) {
        paperSize = $$value;
        $$settled = false;
      },
      get orientation() {
        return orientation;
      },
      set orientation($$value) {
        orientation = $$value;
        $$settled = false;
      },
      get fronts() {
        return fronts;
      },
      set fronts($$value) {
        fronts = $$value;
        $$settled = false;
      },
      get backs() {
        return backs;
      },
      set backs($$value) {
        backs = $$value;
        $$settled = false;
      },
      get margin() {
        return margin;
      },
      set margin($$value) {
        margin = $$value;
        $$settled = false;
      },
      get cropMarks() {
        return cropMarks;
      },
      set cropMarks($$value) {
        cropMarks = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    if (!fronts && !backs) {
      $$payload2.out.push("<!--[-->");
      $$payload2.out.push(`<div class="flex flex-col items-center justify-center px-4 py-16 text-center"><div class="mb-6 flex items-center gap-2">`);
      Club($$payload2, { class: "h-8 w-8 fill-gray-800 text-gray-800" });
      $$payload2.out.push(`<!----> `);
      Heart($$payload2, { class: "h-8 w-8 fill-red-500 text-red-500" });
      $$payload2.out.push(`<!----> `);
      Spade($$payload2, { class: "h-8 w-8 fill-gray-800 text-gray-800" });
      $$payload2.out.push(`<!----> `);
      Diamond($$payload2, { class: "h-8 w-8 fill-red-500 text-red-500" });
      $$payload2.out.push(`<!----></div> <h3 class="mb-3 text-2xl font-semibold">Select cards to print</h3> <p class="text-muted-foreground mb-8 max-w-md text-lg">Choose which sides of your cards you'd like to include in the print layout.</p> <div class="flex gap-3">`);
      Button($$payload2, {
        variant: fronts ? "default" : "outline",
        onclick: () => fronts = !fronts,
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->Print Front Sides`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> `);
      Button($$payload2, {
        variant: backs ? "default" : "outline",
        onclick: () => backs = !backs,
        children: ($$payload3) => {
          $$payload3.out.push(`<!---->Print Back Sides`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----></div></div>`);
    } else {
      $$payload2.out.push("<!--[!-->");
      const each_array = ensure_array_like(pages());
      $$payload2.out.push(`<div class="sheets"><!--[-->`);
      for (let pageIndex = 0, $$length = each_array.length; pageIndex < $$length; pageIndex++) {
        let page = each_array[pageIndex];
        $$payload2.out.push(`<div${attr_class("sheet border border-gray-300 svelte-hr14h", void 0, { "crop-marks": cropMarks })}${attr("id", `con-${stringify(pageIndex)}`)}${attr_style("", {
          width: pageDimensions().width,
          height: pageDimensions().height,
          "grid-template-columns": `repeat(${page.fitCalculation.horizontal}, ${page.width})`,
          "--svg-w": page.width,
          "--svg-h": page.height,
          padding: `${margin}mm`,
          "--margin": `${margin}mm`
        })}></div>`);
      }
      $$payload2.out.push(`<!--]--></div>`);
    }
    $$payload2.out.push(`<!--]--></div>`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
export {
  Export_pages as E
};
