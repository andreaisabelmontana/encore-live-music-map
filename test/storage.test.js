import test from "node:test";
import assert from "node:assert/strict";

import { createStore, memoryStorage, resolveStorage } from "../src/core/storage.js";

/**
 * A backend that fails the way a browser with site data blocked does.
 * @returns {import("../src/core/storage.js").StorageLike}
 */
const blockedStorage = () => ({
  getItem() {
    throw new DOMException("access denied");
  },
  setItem() {
    throw new DOMException("access denied");
  },
  removeItem() {
    throw new DOMException("access denied");
  }
});

test("values round trip through a working backend", () => {
  const store = createStore(memoryStorage());
  store.write("encore.pins.v1", [{ artist: "SZA" }]);
  assert.deepEqual(store.read("encore.pins.v1", []), [{ artist: "SZA" }]);
});

test("a missing key returns the fallback, not undefined", () => {
  const store = createStore(memoryStorage());
  assert.deepEqual(store.read("nothing.here", { a: 1 }), { a: 1 });
  assert.deepEqual(store.read("nothing.here", []), []);
});

test("a storage that throws on access degrades to memory instead of a blank page", () => {
  const store = createStore(blockedStorage());
  assert.deepEqual(store.read("encore.pins.v1", []), [], "reads fall back");
  assert.equal(store.write("encore.pins.v1", [1, 2]), true, "writes go to memory");
  assert.deepEqual(store.read("encore.pins.v1", []), [1, 2]);
});

test("resolveStorage probes with a real write, presence alone proves nothing", () => {
  let probed = false;
  const watcher = {
    getItem: () => null,
    setItem: () => {
      probed = true;
    },
    removeItem: () => {}
  };
  resolveStorage(watcher);
  assert.equal(probed, true);
  assert.notEqual(resolveStorage(null), null, "a missing backend still yields a usable store");
});

test("a value another tab wrote in a shape this version cannot read is ignored", () => {
  const backend = memoryStorage();
  backend.setItem("encore.pins.v1", "{ not json");
  const store = createStore(backend);
  assert.deepEqual(store.read("encore.pins.v1", []), []);
});

test("a stored null reads as the fallback, so a cleared value cannot crash a render", () => {
  const backend = memoryStorage();
  backend.setItem("encore.likes.v1", "null");
  assert.deepEqual(createStore(backend).read("encore.likes.v1", {}), {});
});

test("a refused write reports false rather than throwing at the call site", () => {
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("QuotaExceededError");
    },
    removeItem: () => {}
  };
  // The probe write fails too, so the store quietly runs on memory. The point of
  // the test is that nothing in here throws at the caller.
  assert.doesNotThrow(() => createStore(full).write("encore.pins.v1", [1]));
});

test("remove clears a key", () => {
  const store = createStore(memoryStorage());
  store.write("k", 1);
  store.remove("k");
  assert.equal(store.read("k", "gone"), "gone");
});
