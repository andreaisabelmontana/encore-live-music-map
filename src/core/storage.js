/**
 * A local storage wrapper that never throws.
 *
 * Storage fails in more situations than it is given credit for: private
 * browsing, a browser configured to block site data, a quota that is already
 * full, or another tab writing a value this version cannot parse. In all of them
 * ENCORE should keep working with nothing saved, and never show a broken page.
 *
 * The store takes its backend as an argument, which is what makes it testable in
 * Node with no browser and no mocking library.
 *
 * @module core/storage
 */

/**
 * @typedef {object} StorageLike
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * An in memory stand in, used when the real storage is unavailable.
 * @returns {StorageLike}
 */
export function memoryStorage() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key)
  };
}

/**
 * Resolve the storage to use, falling back to memory when the browser refuses.
 * The probe write matters: some browsers expose `localStorage` and then throw on
 * first use, so presence alone proves nothing.
 *
 * @param {StorageLike|null|undefined} candidate
 * @returns {StorageLike}
 */
export function resolveStorage(candidate) {
  if (!candidate) return memoryStorage();
  try {
    const probe = "encore.probe";
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return memoryStorage();
  }
}

/**
 * Create a JSON store over a storage backend.
 *
 * @param {StorageLike|null|undefined} backend
 * @returns {{
 *   read: <T>(key: string, fallback: T) => T,
 *   write: (key: string, value: unknown) => boolean,
 *   remove: (key: string) => void
 * }}
 */
export function createStore(backend) {
  const storage = resolveStorage(backend);

  return {
    /**
     * @template T
     * @param {string} key
     * @param {T} fallback
     * @returns {T}
     */
    read(key, fallback) {
      try {
        const raw = storage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch {
        return fallback;
      }
    },

    /**
     * @param {string} key
     * @param {unknown} value
     * @returns {boolean} false when the write was refused, for example on a full quota
     */
    write(key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    /** @param {string} key */
    remove(key) {
      try {
        storage.removeItem(key);
      } catch {
        // nothing to do: the value is already unreachable
      }
    }
  };
}
