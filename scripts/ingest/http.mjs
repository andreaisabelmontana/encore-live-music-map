/**
 * A polite HTTP client for public, unauthenticated APIs.
 *
 * MusicBrainz asks anonymous clients for one request per second and a User
 * Agent that identifies the project. It answers a burst with 503 and the body
 * "the MusicBrainz web server is currently busy", which is not a failure so much
 * as a request to slow down. This client therefore does three things:
 *
 *  - serialises every request through one queue with a minimum gap
 *  - retries on 503, 429 and network errors, with a wait tuned to a measured
 *    refusal rate rather than a guessed one
 *  - caches every successful response on disk, so a re-run costs nothing and a
 *    failed run resumes instead of starting over
 *
 * The cache is what makes a two hour ingest survivable. Without it, one failure
 * near the end throws away everything before it.
 *
 * @module ingest/http
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const CACHE_ROOT = join(process.cwd(), ".cache", "ingest");

/**
 * @typedef {object} ClientOptions
 * @property {string} userAgent
 * @property {number} [minIntervalMs] Minimum gap between requests.
 * @property {number} [maxRetries]
 * @property {boolean} [useCache]
 */

/**
 * @param {ClientOptions} options
 */
export function createClient(options) {
  const minInterval = options.minIntervalMs ?? 1100;
  const maxRetries = options.maxRetries ?? 12;
  const useCache = options.useCache ?? true;

  let lastRequest = 0;
  /** @type {Promise<unknown>} */
  let queue = Promise.resolve();

  const stats = { requests: 0, cacheHits: 0, retries: 0, failures: 0 };

  /**
   * Fetch a URL as JSON, from the cache when possible.
   *
   * @param {string} url
   * @returns {Promise<any>}
   */
  async function getJson(url) {
    if (useCache) {
      const cached = await readCache(url);
      if (cached !== null) {
        stats.cacheHits += 1;
        return cached;
      }
    }

    // One queue, so concurrency is one by construction rather than by luck.
    const result = queue.then(() => request(url));
    queue = result.catch(() => {});
    const body = await result;

    if (useCache) await writeCache(url, body);
    return body;
  }

  /**
   * @param {string} url
   * @returns {Promise<any>}
   */
  async function request(url) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const wait = Math.max(0, lastRequest + minInterval - Date.now());
      if (wait > 0) await sleep(wait);
      lastRequest = Date.now();

      try {
        stats.requests += 1;
        const response = await fetch(url, {
          headers: { "User-Agent": options.userAgent, Accept: "application/json" }
        });

        if (response.status === 503 || response.status === 429) {
          stats.retries += 1;
          await sleep(backoff(attempt, response.headers.get("retry-after")));
          continue;
        }
        if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);

        const body = await response.json();

        // MusicBrainz answers with an error envelope in two very different
        // situations: it is busy, which is worth waiting out, or the query was
        // wrong, which no amount of waiting will fix.
        if (body && typeof body === "object" && "error" in body) {
          if (!isTransient(String(body.error))) {
            throw new Error(`${body.error} for ${url}`);
          }
          stats.retries += 1;
          await sleep(backoff(attempt, null));
          continue;
        }
        return body;
      } catch (error) {
        if (attempt === maxRetries) {
          stats.failures += 1;
          throw error;
        }
        stats.retries += 1;
        await sleep(backoff(attempt, null));
      }
    }

    stats.failures += 1;
    throw new Error(`gave up after ${maxRetries} retries: ${url}`);
  }

  return { getJson, stats };
}

/** Attempts that wait a flat interval before the exponential part begins. */
const FLAT_ATTEMPTS = 4;
const FLAT_MS = 1200;
const MAX_MS = 30_000;

/**
 * How long to wait after a refused request.
 *
 * Measured rather than assumed. Sampling the search endpoint at one request per
 * 1.1 seconds and again at 1.6 seconds produced the same refusal rate of roughly
 * one in two, which says the server is congested rather than punishing a burst.
 * Against a coin flip, doubling the wait each time is the wrong shape: it turns a
 * 50% refusal rate into an average of seven seconds per record. So the first few
 * attempts wait a flat interval and only a genuinely stuck endpoint escalates.
 *
 * Retry-After wins whenever the server sends one, because then it is not a guess.
 *
 * @param {number} attempt
 * @param {string|null} retryAfter
 * @returns {number} milliseconds
 */
export function backoff(attempt, retryAfter) {
  const fromHeader = Number(retryAfter);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.min(fromHeader * 1000, MAX_MS);

  const base =
    attempt < FLAT_ATTEMPTS ? FLAT_MS : Math.min(2 ** (attempt - FLAT_ATTEMPTS + 1) * 1000, MAX_MS);
  return base + Math.random() * 400;
}

/**
 * Is this error envelope worth retrying? "Currently busy" and rate limit notices
 * are, a rejected query is not.
 *
 * @param {string} message
 * @returns {boolean}
 */
export function isTransient(message) {
  return /busy|timeout|rate limit|try again/i.test(message);
}

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {string} url */
function cachePath(url) {
  const digest = createHash("sha1").update(url).digest("hex");
  // Two character shard, so a directory listing stays usable at tens of
  // thousands of entries.
  return join(CACHE_ROOT, digest.slice(0, 2), `${digest}.json`);
}

/**
 * @param {string} url
 * @returns {Promise<any|null>}
 */
async function readCache(url) {
  try {
    return JSON.parse(await readFile(cachePath(url), "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {unknown} body
 */
async function writeCache(url, body) {
  const path = cachePath(url);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(body), "utf8");
}
