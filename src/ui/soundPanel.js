/**
 * The sound map: where the music you listen to comes from.
 *
 * Each artist in a listening profile is placed at their city of origin and drawn
 * as a glow sized by minutes streamed, so the shape of someone's taste shows up
 * as geography. The panel next to it graphs the same profile as numbers.
 *
 * The demo loads a sample profile from `data/listening-sample.json`. A real one
 * needs two things a static site cannot hold: a Spotify OAuth flow, and origin
 * data, which Spotify does not expose and MusicBrainz does. The seam for both is
 * `loadProfile` in `main.js`, which is the only thing that would change.
 *
 * @module ui/soundPanel
 */

import { createDialog } from "./dialog.js";
import { glowSize, rankByMinutes, summarize } from "../core/soundmap.js";
import { formatCount } from "../core/format.js";
import { fitTo, moveTo } from "./motion.js";

/**
 * @typedef {import("../core/types.js").ListeningArtist} ListeningArtist
 */

/**
 * @param {object} options
 * @param {import("leaflet").Map} options.map
 * @param {() => Promise<ListeningArtist[]>} options.loadProfile
 */
export function createSoundPanel(options) {
  const connectBtn = /** @type {HTMLButtonElement} */ (document.getElementById("spotifyBtn"));
  const connectScrim = /** @type {HTMLElement} */ (document.getElementById("spotifyModal"));
  const confirmBtn = /** @type {HTMLButtonElement} */ (document.getElementById("spotifyConnect"));
  const closeConnectBtn = /** @type {HTMLButtonElement} */ (document.getElementById("spotifyClose"));
  const panel = /** @type {HTMLElement} */ (document.getElementById("soundPanel"));
  const subEl = /** @type {HTMLElement} */ (document.getElementById("soundSub"));
  const statsEl = /** @type {HTMLElement} */ (document.getElementById("soundStats"));
  const listEl = /** @type {HTMLElement} */ (document.getElementById("soundList"));
  const panelCloseBtn = /** @type {HTMLButtonElement} */ (document.getElementById("soundClose"));

  const layer = L.layerGroup();
  const dialog = createDialog(connectScrim, { labelledBy: "spotifyTitle" });

  /** @type {ListeningArtist[]} */
  let profile = [];
  let connected = false;

  connectBtn.addEventListener("click", () => {
    if (connected) {
      disconnect();
      return;
    }
    dialog.open();
  });
  closeConnectBtn.addEventListener("click", () => dialog.close());
  panelCloseBtn.addEventListener("click", disconnect);
  confirmBtn.addEventListener("click", connect);

  async function connect() {
    confirmBtn.disabled = true;
    try {
      profile = await options.loadProfile();
    } catch {
      confirmBtn.disabled = false;
      subEl.textContent = "could not load that profile, try again";
      return;
    }
    confirmBtn.disabled = false;
    if (profile.length === 0) return;

    connected = true;
    renderLayer();
    renderPanel();
    layer.addTo(options.map);
    panel.hidden = false;
    document.body.classList.add("sound-on");
    connectBtn.classList.add("on");
    connectBtn.setAttribute("aria-pressed", "true");
    setButtonLabel("sound map on");
    dialog.close();

    fitTo(options.map, L.latLngBounds(profile.map((a) => [a.lat, a.lng])), {
      padding: [80, 80],
      duration: 1.2,
      maxZoom: 4
    });
  }

  function disconnect() {
    connected = false;
    options.map.removeLayer(layer);
    panel.hidden = true;
    document.body.classList.remove("sound-on");
    connectBtn.classList.remove("on");
    connectBtn.setAttribute("aria-pressed", "false");
    setButtonLabel("connect spotify");
    connectBtn.focus({ preventScroll: true });
  }

  /** @param {string} label */
  function setButtonLabel(label) {
    const text = connectBtn.querySelector(".sp-label");
    if (text) text.textContent = label;
  }

  function renderLayer() {
    layer.clearLayers();
    const maxMinutes = Math.max(...profile.map((artist) => artist.minutes));

    for (const artist of profile) {
      const size = glowSize(artist.minutes, maxMinutes);
      const wrap = document.createElement("div");
      wrap.className = "sp-pin" + (artist.minutes > maxMinutes * 0.7 ? " big" : "");
      wrap.style.width = `${size}px`;
      wrap.style.height = `${size}px`;
      for (const part of ["glow", "core"]) {
        const el = document.createElement("div");
        el.className = part;
        wrap.append(el);
      }

      L.marker([artist.lat, artist.lng], {
        icon: L.divIcon({ className: "", html: wrap, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        keyboard: false,
        title: `${artist.artist}, ${artist.origin}`
      })
        .bindTooltip(`${artist.artist} · ${artist.origin} · ${formatCount(artist.minutes)} min`, {
          direction: "top",
          offset: [0, -10],
          className: "sp-tip"
        })
        .addTo(layer);
    }
  }

  function renderPanel() {
    const summary = summarize(profile);
    subEl.textContent = `your sound lives mostly in ${summary.topCountry}`;

    statsEl.replaceChildren(
      ...[
        [String(summary.artists), "top artists"],
        [String(summary.countries), "countries"],
        [`${formatCount(summary.hours)}h`, "streamed"],
        [summary.topGenre, "top sound"]
      ].map(([value, label]) => {
        const stat = document.createElement("div");
        stat.className = "sp-stat";
        const n = document.createElement("div");
        n.className = "n";
        n.textContent = value;
        const l = document.createElement("div");
        l.className = "l";
        l.textContent = label;
        stat.append(n, l);
        return stat;
      })
    );

    const ranked = rankByMinutes(profile);
    const maxMinutes = ranked[0]?.minutes ?? 1;

    listEl.replaceChildren(
      ...ranked.map((artist, index) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "sp-row";

        const rank = document.createElement("span");
        rank.className = "sp-rank";
        rank.textContent = String(index + 1);

        const info = document.createElement("span");
        info.className = "sp-info";
        const name = document.createElement("span");
        name.className = "a";
        name.textContent = artist.artist;
        const origin = document.createElement("span");
        origin.className = "o";
        origin.textContent = `${artist.origin} · ${formatCount(artist.minutes)} min`;
        info.append(name, origin);

        const bar = document.createElement("span");
        bar.className = "sp-bar";
        bar.style.width = `${30 + Math.round((artist.minutes / maxMinutes) * 60)}px`;

        row.append(rank, info, bar);
        row.addEventListener("click", () => moveTo(options.map, [artist.lat, artist.lng], 6));
        return row;
      })
    );
  }

  return { isOpen: dialog.isOpen, close: () => dialog.close() };
}
