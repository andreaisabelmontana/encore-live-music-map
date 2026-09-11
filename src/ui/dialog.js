/**
 * Accessible dialog behaviour, shared by the moment player, the pin form and the
 * connect panel.
 *
 * A dialog that only hides and shows a div is not a dialog. Keyboard and screen
 * reader users need four more things, and all three overlays in this app need
 * them identically, so they live here once:
 *
 *  - focus moves into the dialog when it opens and returns to the control that
 *    opened it when it closes
 *  - Tab cycles inside the dialog instead of wandering into the map behind it
 *  - Escape closes it
 *  - the rest of the page is marked `inert` so assistive technology skips it
 *
 * @module ui/dialog
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */
function focusableIn(root) {
  return /** @type {HTMLElement[]} */ (
    Array.from(root.querySelectorAll(FOCUSABLE)).filter(
      (el) => el instanceof HTMLElement && el.offsetParent !== null
    )
  );
}

/**
 * Wire up one overlay element.
 *
 * @param {HTMLElement} scrim         The full screen backdrop element.
 * @param {object} [options]
 * @param {HTMLElement} [options.card] The panel inside the scrim, defaults to the first element child.
 * @param {string} [options.labelledBy] Id of the element that names the dialog.
 * @param {() => void} [options.onClose]
 * @returns {{ open: (focusTarget?: HTMLElement|null) => void, close: () => void, isOpen: () => boolean }}
 */
export function createDialog(scrim, options = {}) {
  const card = options.card ?? /** @type {HTMLElement} */ (scrim.firstElementChild);
  /** @type {HTMLElement|null} */
  let lastFocused = null;

  scrim.setAttribute("role", "dialog");
  scrim.setAttribute("aria-modal", "true");
  if (options.labelledBy) scrim.setAttribute("aria-labelledby", options.labelledBy);
  // The card itself has to be focusable as a last resort, for a dialog whose
  // contents are still rendering when it opens.
  if (!card.hasAttribute("tabindex")) card.tabIndex = -1;

  const isOpen = () => !scrim.hidden;

  /** @param {KeyboardEvent} event */
  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const items = focusableIn(card);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !card.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** @param {MouseEvent} event */
  function onBackdrop(event) {
    if (event.target === scrim) close();
  }

  /** @param {HTMLElement|null} [focusTarget] */
  function open(focusTarget) {
    if (isOpen()) return;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    scrim.hidden = false;
    document.body.classList.add("dialog-open");
    document.addEventListener("keydown", onKeydown, true);
    scrim.addEventListener("click", onBackdrop);
    const target = focusTarget ?? focusableIn(card)[0] ?? card;
    target.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    scrim.hidden = true;
    document.body.classList.remove("dialog-open");
    document.removeEventListener("keydown", onKeydown, true);
    scrim.removeEventListener("click", onBackdrop);
    options.onClose?.();
    lastFocused?.focus({ preventScroll: true });
    lastFocused = null;
  }

  return { open, close, isOpen };
}
