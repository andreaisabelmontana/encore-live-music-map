import test from "node:test";
import assert from "node:assert/strict";

import { createAppState, debounce } from "../src/core/state.js";

test("a patch merges into the state and reaches every subscriber", () => {
  const state = createAppState({ genre: "all", query: "" });
  /** @type {object[]} */
  const seen = [];
  state.subscribe((next) => seen.push(next));

  state.set({ genre: "rock" });

  assert.deepEqual(state.get(), { genre: "rock", query: "" });
  assert.deepEqual(seen, [{ genre: "rock", query: "" }]);
});

test("a patch can be computed from the state it replaces", () => {
  const state = createAppState({ moments: [1, 2] });
  state.set((current) => ({ moments: [0, ...current.moments] }));
  assert.deepEqual(state.get().moments, [0, 1, 2]);
});

test("state is copied on write, so a held reference cannot be edited from outside", () => {
  const state = createAppState({ genre: "all" });
  const before = state.get();
  state.set({ genre: "pop" });
  assert.equal(before.genre, "all");
});

test("unsubscribing stops the notifications", () => {
  const state = createAppState({ n: 0 });
  let calls = 0;
  const off = state.subscribe(() => calls++);

  state.set({ n: 1 });
  off();
  state.set({ n: 2 });

  assert.equal(calls, 1);
  assert.equal(state.get().n, 2);
});

test("a subscriber that unsubscribes during a notification does not break the loop", () => {
  const state = createAppState({ n: 0 });
  let second = 0;
  const off = state.subscribe(() => off());
  state.subscribe(() => second++);

  assert.doesNotThrow(() => state.set({ n: 1 }));
  assert.equal(second, 1);
});

test("debounce fires once, after the typing settles", () => {
  const clock = createClock();
  let calls = 0;
  const run = debounce(() => calls++, 160, clock.schedule, clock.cancel);

  run();
  run();
  run();
  assert.equal(calls, 0, "nothing has fired while the keys are still coming");

  clock.advance();
  assert.equal(calls, 1);
});

test("debounce passes the last arguments it was given", () => {
  const clock = createClock();
  /** @type {string[]} */
  const seen = [];
  const run = debounce((/** @type {string} */ value) => seen.push(value), 100, clock.schedule, clock.cancel);

  run("ro");
  run("rosa");
  run("rosalia");
  clock.advance();

  assert.deepEqual(seen, ["rosalia"]);
});

/**
 * A hand rolled clock, so the test suite never sleeps.
 */
function createClock() {
  /** @type {Map<number, () => void>} */
  const timers = new Map();
  let nextId = 1;

  return {
    /**
     * @param {() => void} handler
     * @returns {number}
     */
    schedule(handler) {
      const id = nextId++;
      timers.set(id, handler);
      return id;
    },
    /** @param {number} id */
    cancel(id) {
      timers.delete(id);
    },
    advance() {
      const due = [...timers.values()];
      timers.clear();
      for (const handler of due) handler();
    }
  };
}
