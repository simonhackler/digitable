import { a5 as noop, G as derived, w as push, E as props_id, A as spread_attributes, D as bind_props, y as pop, J as copy_payload, K as assign_payload, F as spread_props, Y as attr_style, I as stringify, a6 as state, a7 as render_effect, s as set, q as get } from "./index2.js";
import { c as cn } from "./utils2.js";
import { a as attachRef, d as createBitsAttrs, c as createId, b as box, m as mergeProps } from "./create-id.js";
import "style-to-object";
import "clsx";
const now = () => Date.now();
const raf = {
  // don't access requestAnimationFrame eagerly outside method
  // this allows basic testing of user code without JSDOM
  // bunder will eval and remove ternary when the user's app is built
  tick: (
    /** @param {any} _ */
    (_) => noop()
  ),
  now: () => now(),
  tasks: /* @__PURE__ */ new Set()
};
function loop(callback) {
  let task;
  if (raf.tasks.size === 0) ;
  return {
    promise: new Promise((fulfill) => {
      raf.tasks.add(task = { c: callback, f: fulfill });
    }),
    abort() {
      raf.tasks.delete(task);
    }
  };
}
const progressAttrs = createBitsAttrs({ component: "progress", parts: ["root"] });
class ProgressRootState {
  static create(opts) {
    return new ProgressRootState(opts);
  }
  opts;
  attachment;
  constructor(opts) {
    this.opts = opts;
    this.attachment = attachRef(this.opts.ref);
  }
  #props = derived(() => ({
    role: "progressbar",
    value: this.opts.value.current,
    "aria-valuemin": this.opts.min.current,
    "aria-valuemax": this.opts.max.current,
    "aria-valuenow": this.opts.value.current === null ? void 0 : this.opts.value.current,
    "data-value": this.opts.value.current === null ? void 0 : this.opts.value.current,
    "data-state": getProgressDataState(this.opts.value.current, this.opts.max.current),
    "data-max": this.opts.max.current,
    "data-min": this.opts.min.current,
    "data-indeterminate": this.opts.value.current === null ? "" : void 0,
    [progressAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function getProgressDataState(value, max) {
  if (value === null) return "indeterminate";
  return value === max ? "loaded" : "loading";
}
function Progress$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    child,
    children,
    value = 0,
    max = 100,
    min = 0,
    id = createId(uid),
    ref = null,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const rootState = ProgressRootState.create({
    value: box.with(() => value),
    max: box.with(() => max),
    min: box.with(() => min),
    id: box.with(() => id),
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
  bind_props($$props, { ref });
  pop();
}
function Progress($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    max = 100,
    value,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Progress$1($$payload2, spread_props([
      {
        "data-slot": "progress",
        class: cn("bg-primary/20 relative h-2 w-full overflow-hidden rounded-full", className),
        value,
        max
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
        children: ($$payload3) => {
          $$payload3.out.push(`<div data-slot="progress-indicator" class="bg-primary h-full w-full flex-1 transition-all"${attr_style(`transform: translateX(-${stringify(100 - 100 * (value ?? 0) / (max ?? 1))}%)`)}></div>`);
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
function is_date(obj) {
  return Object.prototype.toString.call(obj) === "[object Date]";
}
function linear(t) {
  return t;
}
function get_interpolator(a, b) {
  if (a === b || a !== a) return () => a;
  const type = typeof a;
  if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    throw new Error("Cannot interpolate values of different type");
  }
  if (Array.isArray(a)) {
    const arr = (
      /** @type {Array<any>} */
      b.map((bi, i) => {
        return get_interpolator(
          /** @type {Array<any>} */
          a[i],
          bi
        );
      })
    );
    return (t) => arr.map((fn) => fn(t));
  }
  if (type === "object") {
    if (!a || !b) {
      throw new Error("Object cannot be null");
    }
    if (is_date(a) && is_date(b)) {
      const an = a.getTime();
      const bn = b.getTime();
      const delta = bn - an;
      return (t) => new Date(an + t * delta);
    }
    const keys = Object.keys(b);
    const interpolators = {};
    keys.forEach((key) => {
      interpolators[key] = get_interpolator(a[key], b[key]);
    });
    return (t) => {
      const result = {};
      keys.forEach((key) => {
        result[key] = interpolators[key](t);
      });
      return result;
    };
  }
  if (type === "number") {
    const delta = (
      /** @type {number} */
      b - /** @type {number} */
      a
    );
    return (t) => a + t * delta;
  }
  return () => b;
}
class Tween {
  #current;
  #target;
  /** @type {TweenedOptions<T>} */
  #defaults;
  /** @type {import('../internal/client/types').Task | null} */
  #task = null;
  /**
   * @param {T} value
   * @param {TweenedOptions<T>} options
   */
  constructor(value, options = {}) {
    this.#current = state(value);
    this.#target = state(value);
    this.#defaults = options;
  }
  /**
   * Create a tween whose value is bound to the return value of `fn`. This must be called
   * inside an effect root (for example, during component initialisation).
   *
   * ```svelte
   * <script>
   * 	import { Tween } from 'svelte/motion';
   *
   * 	let { number } = $props();
   *
   * 	const tween = Tween.of(() => number);
   * <\/script>
   * ```
   * @template U
   * @param {() => U} fn
   * @param {TweenedOptions<U>} [options]
   */
  static of(fn, options) {
    const tween = new Tween(fn(), options);
    render_effect(() => {
      tween.set(fn());
    });
    return tween;
  }
  /**
   * Sets `tween.target` to `value` and returns a `Promise` that resolves if and when `tween.current` catches up to it.
   *
   * If `options` are provided, they will override the tween's defaults.
   * @param {T} value
   * @param {TweenedOptions<T>} [options]
   * @returns
   */
  set(value, options) {
    set(this.#target, value);
    let {
      delay = 0,
      duration = 400,
      easing = linear,
      interpolate = get_interpolator
    } = { ...this.#defaults, ...options };
    if (duration === 0) {
      this.#task?.abort();
      set(this.#current, value);
      return Promise.resolve();
    }
    const start = raf.now() + delay;
    let fn;
    let started = false;
    let previous_task = this.#task;
    this.#task = loop((now2) => {
      if (now2 < start) {
        return true;
      }
      if (!started) {
        started = true;
        const prev = this.#current.v;
        fn = interpolate(prev, value);
        if (typeof duration === "function") {
          duration = duration(prev, value);
        }
        previous_task?.abort();
      }
      const elapsed = now2 - start;
      if (elapsed > /** @type {number} */
      duration) {
        set(this.#current, value);
        return false;
      }
      set(this.#current, fn(easing(elapsed / /** @type {number} */
      duration)));
      return true;
    });
    return this.#task.promise;
  }
  get current() {
    return get(this.#current);
  }
  get target() {
    return get(this.#target);
  }
  set target(v) {
    this.set(v);
  }
}
export {
  Progress as P,
  Tween as T
};
