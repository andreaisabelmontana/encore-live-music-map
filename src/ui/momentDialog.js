/**
 * The moment player: clip, story, love and share.
 *
 * Nothing here writes untrusted text into `innerHTML`. Artist names, venues and
 * stories all arrive through `textContent`, including the ones reconstructed
 * from a share link, which is the one path in the app a stranger controls.
 *
 * @module ui/momentDialog
 */

import { createDialog } from "./dialog.js";
import { embedUrl, searchUrl } from "../core/youtube.js";
import { formatCount, formatMeta } from "../core/format.js";

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/**
 * @param {object} options
 * @param {(moment: Moment) => string} options.shareUrl
 * @param {(moment: Moment) => void} options.onLove
 * @param {() => void} options.onClose
 */
export function createMomentDialog(options) {
  const scrim = /** @type {HTMLElement} */ (document.getElementById("modal"));
  const video = /** @type {HTMLElement} */ (document.getElementById("modalVideo"));
  const artistEl = /** @type {HTMLElement} */ (document.getElementById("modalArtist"));
  const metaEl = /** @type {HTMLElement} */ (document.getElementById("modalMeta"));
  const storyEl = /** @type {HTMLElement} */ (document.getElementById("modalStory"));
  const tagsEl = /** @type {HTMLElement} */ (document.getElementById("modalTags"));
  const countEl = /** @type {HTMLElement} */ (document.getElementById("saveCount"));
  const shareBtn = /** @type {HTMLButtonElement} */ (document.getElementById("modalShare"));
  const loveBtn = /** @type {HTMLButtonElement} */ (document.getElementById("modalSave"));
  const youtubeBtn = /** @type {HTMLButtonElement} */ (document.getElementById("modalYt"));
  const closeBtn = /** @type {HTMLButtonElement} */ (document.getElementById("modalClose"));

  /** @type {Moment|null} */
  let current = null;

  const dialog = createDialog(scrim, {
    labelledBy: "modalArtist",
    onClose() {
      // Clearing the iframe is what actually stops playback. Hiding the dialog
      // would leave audio running behind the map.
      video.replaceChildren();
      current = null;
      options.onClose();
    }
  });

  closeBtn.addEventListener("click", () => dialog.close());

  youtubeBtn.addEventListener("click", () => {
    if (current) window.open(searchUrl(current), "_blank", "noopener");
  });

  loveBtn.addEventListener("click", () => {
    if (!current) return;
    current.likes += 1;
    countEl.textContent = formatCount(current.likes);
    options.onLove(current);
  });

  shareBtn.addEventListener("click", async () => {
    if (!current) return;
    const url = options.shareUrl(current);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${current.artist} on ENCORE`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = "✓ link copied";
      setTimeout(() => {
        shareBtn.textContent = "⤴ share";
      }, 1600);
    } catch {
      // The share sheet was dismissed, or the clipboard is blocked. Neither is
      // an error worth interrupting anyone over.
    }
  });

  /**
   * @param {Moment} moment
   */
  function open(moment) {
    current = moment;
    artistEl.textContent = moment.artist;
    metaEl.textContent = formatMeta(moment);
    storyEl.textContent = moment.story;
    countEl.textContent = formatCount(moment.likes);

    const tag = document.createElement("span");
    tag.className = "card-genre";
    tag.textContent = moment.genre;
    tagsEl.replaceChildren(tag);

    video.replaceChildren(moment.videoId ? embed(moment) : poster(moment));
    dialog.open(closeBtn);
  }

  return { open, close: () => dialog.close(), isOpen: dialog.isOpen };
}

/**
 * @param {Moment} moment
 * @returns {HTMLIFrameElement}
 */
function embed(moment) {
  const frame = document.createElement("iframe");
  frame.src = embedUrl(/** @type {string} */ (moment.videoId));
  frame.title = `${moment.artist} at ${moment.venue}`;
  frame.loading = "lazy";
  frame.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  frame.allowFullscreen = true;
  return frame;
}

/**
 * Seed moments ship without a clip id on purpose: a guessed id resolves to the
 * wrong performance. This sends the visitor to fan footage of the right night
 * instead of lying about which video they are watching.
 *
 * @param {Moment} moment
 * @returns {HTMLButtonElement}
 */
function poster(moment) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "video-fallback";

  const play = document.createElement("span");
  play.className = "vf-play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";

  const main = document.createElement("span");
  main.className = "vf-main";
  main.textContent = "watch fan clips on YouTube";

  const note = document.createElement("small");
  note.textContent = "no clip pinned yet, be the first to add one";

  button.append(play, main, note);
  button.addEventListener("click", () => window.open(searchUrl(moment), "_blank", "noopener"));
  return button;
}
