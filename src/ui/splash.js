/**
 * The cassette to stage intro.
 *
 * It exists to set a mood, which means it must never get in the way: any click,
 * any key, a reduced motion preference or a shared link all skip straight to the
 * map. The element is removed from the document afterwards rather than hidden,
 * so it cannot trap focus.
 *
 * @module ui/splash
 */

import { prefersReducedMotion } from "./motion.js";

const CASSETTE_MS = 4500;
const STAGE_MS = 2200;
const FADE_MS = 800;

/**
 * @param {() => void} onDone Called once, after the splash leaves the page.
 */
export function createSplash(onDone) {
  const found = document.getElementById("splash");
  if (!found) {
    onDone();
    return { skip: () => {} };
  }
  const splash = found;

  const kicker = /** @type {HTMLElement} */ (document.getElementById("splashKicker"));
  const playBtn = /** @type {HTMLButtonElement} */ (document.getElementById("splashPlay"));
  const skipBtn = /** @type {HTMLButtonElement} */ (document.getElementById("splashSkip"));

  let finished = false;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let toStage;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let toEnd;

  function goStage() {
    if (finished || splash.dataset.phase === "stage") return;
    splash.dataset.phase = "stage";
    kicker.textContent = "▸ the show is about to start";
    clearTimeout(toEnd);
    toEnd = setTimeout(skip, STAGE_MS);
  }

  function skip() {
    if (finished) return;
    finished = true;
    clearTimeout(toStage);
    clearTimeout(toEnd);
    splash.classList.add("gone");
    setTimeout(() => {
      splash.remove();
      onDone();
    }, prefersReducedMotion() ? 0 : FADE_MS);
  }

  playBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (splash.dataset.phase === "stage") skip();
    else goStage();
  });
  skipBtn.addEventListener("click", skip);
  splash.addEventListener("click", skip);
  document.addEventListener("keydown", (event) => {
    if (!finished && (event.key === "Escape" || event.key === "Enter" || event.key === " ")) skip();
  });

  if (prefersReducedMotion()) {
    skip();
  } else {
    toStage = setTimeout(goStage, CASSETTE_MS);
  }

  return { skip };
}
