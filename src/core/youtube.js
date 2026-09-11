/**
 * YouTube link handling.
 *
 * ENCORE embeds clips, it never downloads or re-hosts them. Everything in this
 * module either reads an id out of a link a visitor pasted, or builds a URL that
 * points back at YouTube.
 *
 * @module core/youtube
 */

/** YouTube ids are exactly 11 characters of the URL safe alphabet. */
const VIDEO_ID = /^[\w-]{11}$/;

/**
 * Every link shape a visitor is likely to paste, in the order we try them.
 * Each pattern captures the id in group 1.
 */
const LINK_PATTERNS = [
  /[?&]v=([\w-]{11})/,          // youtube.com/watch?v=ID
  /youtu\.be\/([\w-]{11})/,     // youtu.be/ID
  /\/embed\/([\w-]{11})/,       // youtube.com/embed/ID
  /\/shorts\/([\w-]{11})/,      // youtube.com/shorts/ID
  /\/live\/([\w-]{11})/         // youtube.com/live/ID
];

/**
 * Pull the video id out of any common YouTube link.
 *
 * Returns null rather than throwing, because the caller is a form field and an
 * unparseable link simply means "pin this moment without a clip".
 *
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function parseVideoId(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed === "") return null;

  for (const pattern of LINK_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) return match[1];
  }

  // A bare id, pasted without the surrounding URL.
  return VIDEO_ID.test(trimmed) ? trimmed : null;
}

/**
 * True when a string is a well formed video id.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isVideoId(value) {
  return typeof value === "string" && VIDEO_ID.test(value);
}

/**
 * Privacy preserving embed URL. `youtube-nocookie.com` does not set tracking
 * cookies until playback starts, and `rel=0` keeps the end screen inside the
 * uploader's own channel.
 *
 * @param {string} videoId
 * @returns {string}
 */
export function embedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`;
}

/**
 * Poster image for a clip.
 * @param {string} videoId
 * @returns {string}
 */
export function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/**
 * Search URL for a moment with no clip attached yet.
 *
 * Seed moments deliberately ship without ids, because a guessed id resolves to
 * the wrong performance. Searching `artist + venue + year` sends the visitor to
 * fan footage of the right night instead.
 *
 * @param {Pick<import("./types.js").Moment, "artist"|"venue"|"year">} moment
 * @returns {string}
 */
export function searchUrl(moment) {
  const query = `${moment.artist} ${moment.venue} ${moment.year} live`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
