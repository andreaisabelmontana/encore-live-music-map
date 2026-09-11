/**
 * Shareable moment links, with no server involved.
 *
 * A seed moment already exists in everyone's copy of the data, so its link is
 * just `#m=<id>`. A moment a visitor pinned exists nowhere but their browser, so
 * the link carries the moment itself: a compact JSON object, UTF-8 encoded, in
 * base64url. The person receiving it opens the exact pin from a static site.
 *
 * The decoder treats its input as hostile. Anyone can edit a payload in the
 * address bar, so everything it returns goes through the same validator the
 * checked in seed data does.
 *
 * @module core/share
 */

import { validateMoment } from "./validate.js";
import { isVideoId } from "./youtube.js";

/**
 * @typedef {import("./types.js").Moment} Moment
 */

/** Rough ceiling on a packed payload, so a hand edited link cannot blow up the parser. */
const MAX_PAYLOAD = 4096;

/**
 * @param {string} text
 * @returns {string}
 */
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * @param {string} payload
 * @returns {string}
 */
function fromBase64Url(payload) {
  const padded = payload
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(payload.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Pack a moment into a URL fragment payload.
 *
 * Keys are one or two characters on purpose: the whole moment has to survive a
 * paste into a messaging app, and short keys keep a typical link near 200
 * characters instead of 400.
 *
 * @param {Moment} moment
 * @returns {string}
 */
export function encodeMoment(moment) {
  const packed = {
    a: moment.artist,
    v: moment.venue,
    c: moment.city,
    y: Number(moment.year),
    g: moment.genre,
    la: Number(moment.lat.toFixed(4)),
    ln: Number(moment.lng.toFixed(4)),
    s: moment.story,
    ...(moment.videoId ? { yt: moment.videoId } : {})
  };
  return toBase64Url(JSON.stringify(packed));
}

/**
 * Rebuild a moment from a payload, or return null if anything is off.
 *
 * @param {string} payload
 * @returns {Moment|null}
 */
export function decodeMoment(payload) {
  if (typeof payload !== "string" || payload === "" || payload.length > MAX_PAYLOAD) return null;

  let packed;
  try {
    packed = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (typeof packed !== "object" || packed === null) return null;

  /** @type {Moment} */
  const moment = {
    id: "shared",
    artist: String(packed.a ?? ""),
    venue: String(packed.v ?? ""),
    city: String(packed.c ?? ""),
    year: Number(packed.y),
    genre: String(packed.g ?? "other"),
    lat: Number(packed.la),
    lng: Number(packed.ln),
    videoId: isVideoId(packed.yt) ? String(packed.yt) : null,
    story: String(packed.s ?? ""),
    likes: 1
  };

  return validateMoment(moment).ok ? moment : null;
}

/**
 * Link for a moment. Seed moments travel by id, everything else travels whole.
 *
 * @param {Moment} moment
 * @param {{ origin: string, pathname: string, seedIds: ReadonlySet<number|string> }} context
 * @returns {string}
 */
export function shareUrlFor(moment, context) {
  const base = `${context.origin}${context.pathname}`;
  return context.seedIds.has(moment.id)
    ? `${base}#m=${moment.id}`
    : `${base}#p=${encodeMoment(moment)}`;
}

/**
 * Read a location fragment into an intent the app can act on.
 *
 * @param {string} hash
 * @returns {{ kind: "seed", id: string } | { kind: "packed", payload: string } | null}
 */
export function parseHash(hash) {
  if (typeof hash !== "string") return null;
  const seed = hash.match(/^#m=(\d+)$/);
  if (seed && seed[1]) return { kind: "seed", id: seed[1] };
  const packed = hash.match(/^#p=([\w-]+)$/);
  if (packed && packed[1]) return { kind: "packed", payload: packed[1] };
  return null;
}
