/**
 * A very small observable store.
 *
 * The original build kept filter state in module level `let` bindings and had
 * every handler remember to call three render functions. This replaces that with
 * one source of truth: handlers describe the change, subscribers redraw.
 *
 * @module core/state
 */

/**
 * @template {object} S
 * @typedef {(state: S) => void} Listener
 */

/**
 * @template {object} S
 * @param {S} initial
 * @returns {{
 *   get: () => S,
 *   set: (patch: Partial<S> | ((state: S) => Partial<S>)) => S,
 *   subscribe: (listener: Listener<S>) => () => void
 * }}
 */
export function createAppState(initial) {
  let state = { ...initial };
  /** @type {Set<Listener<S>>} */
  const listeners = new Set();

  return {
    get: () => state,

    /**
     * Apply a patch and notify. Returns the new state so a caller can act on it
     * without a second `get()`.
     *
     * @param {Partial<S> | ((state: S) => Partial<S>)} patch
     */
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener(state);
      return state;
    },

    /**
     * @param {Listener<S>} listener
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    }
  };
}

/**
 * Trailing edge debounce.
 *
 * The search box re-renders every marker on the map, so firing on each keystroke
 * turned typing into visible jank on a mid range phone. One render after the
 * typing settles is indistinguishable to the person and much cheaper.
 *
 * @template {(...args: never[]) => void} F
 * @param {F} fn
 * @param {number} waitMs
 * @param {(handler: () => void, ms: number) => number} [schedule]
 * @param {(id: number) => void} [cancel]
 * @returns {(...args: Parameters<F>) => void}
 */
export function debounce(fn, waitMs, schedule, cancel) {
  const start = schedule ?? ((handler, ms) => Number(setTimeout(handler, ms)));
  const stop = cancel ?? ((id) => clearTimeout(id));
  /** @type {number|null} */
  let timer = null;

  return (...args) => {
    if (timer !== null) stop(timer);
    timer = start(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}
