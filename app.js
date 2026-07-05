/* ============ ENCORE · app logic ============ */

// ---- gradient fallback thumbnail (data-uri SVG) ----
const GRADIENT_THUMB =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#ff2e9a"/><stop offset=".5" stop-color="#8a4bff"/>
         <stop offset="1" stop-color="#2ec5ff"/></linearGradient></defs>
       <rect width="320" height="200" fill="#14141c"/>
       <rect width="320" height="200" fill="url(#g)" opacity="0.25"/>
       <text x="50%" y="52%" font-family="sans-serif" font-size="40" fill="#fff"
         text-anchor="middle" opacity="0.85">▶</text>
     </svg>`);

const thumbFor = (m) =>
  m.youtubeId ? `https://i.ytimg.com/vi/${m.youtubeId}/hqdefault.jpg` : GRADIENT_THUMB;

// YouTube serves a 120x90 gray placeholder (HTTP 200) for invalid IDs, so
// onerror never fires. Detect it by size and fall back to the gradient.
window.__GRAD = GRADIENT_THUMB;
window.__encThumb = function (el) {
  if (el.dataset.fb) return;
  if (el.naturalWidth && el.naturalWidth <= 120) { el.dataset.fb = "1"; el.src = window.__GRAD; }
};
const THUMB_ATTRS =
  `onload="window.__encThumb(this)" onerror="this.dataset.fb='1';this.src=window.__GRAD"`;

const ytSearchUrl = (m) =>
  `https://www.youtube.com/results?search_query=` +
  encodeURIComponent(`${m.artist} ${m.venue} ${m.year} live`);

// ---- persistence: your pins & loves survive reloads (localStorage only, nothing leaves the browser) ----
const PINS_KEY = "encore.pins.v1";
const LIKES_KEY = "encore.likes.v1";
const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const likeBumps = readJSON(LIKES_KEY, {});

// ---- state ----
let moments = [...readJSON(PINS_KEY, []), ...MOMENTS.slice()];
moments.forEach((m) => { if (!m.mine && likeBumps[m.id]) m.likes += likeBumps[m.id]; });
let activeGenre = "all";
let searchQuery = "";
let pendingLatLng = null;        // for "pin a moment"

const savePins = () =>
  localStorage.setItem(PINS_KEY, JSON.stringify(moments.filter((m) => m.mine)));
const saveLikes = () => localStorage.setItem(LIKES_KEY, JSON.stringify(likeBumps));

const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---- map ----
const map = L.map("map", { zoomControl: false, attributionControl: true })
  .setView([25, -20], 3);

// dark, label-light vector tiles (no API key)
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 20 }
).addTo(map);

// ---- pins ----
function makePinIcon(m) {
  const html = `
    <div class="pin">
      <div class="pin-ring"></div>
      <img class="pin-thumb" src="${thumbFor(m)}" ${THUMB_ATTRS} alt="${esc(m.artist)}" />
    </div>`;
  return L.divIcon({ className: "", html, iconSize: [40, 40], iconAnchor: [20, 20] });
}

// cluster nearby pins at low zoom (plain group fallback if the plugin CDN is unreachable)
const pinLayer = (L.markerClusterGroup
  ? L.markerClusterGroup({
      maxClusterRadius: 44, showCoverageOnHover: false,
      iconCreateFunction: (c) => L.divIcon({
        className: "",
        html: `<div class="cluster">${c.getChildCount()}</div>`,
        iconSize: [44, 44], iconAnchor: [22, 22]
      })
    })
  : L.layerGroup()).addTo(map);

function renderMarkers() {
  pinLayer.clearLayers();
  visibleMoments().forEach((m) => {
    pinLayer.addLayer(
      L.marker([m.lat, m.lng], { icon: makePinIcon(m) }).on("click", () => openMoment(m))
    );
  });
}

// ---- filtering ----
function visibleMoments() {
  const q = searchQuery.toLowerCase();
  return moments.filter((m) => {
    const genreOk = activeGenre === "all" || m.genre === activeGenre;
    const searchOk = !q ||
      m.artist.toLowerCase().includes(q) ||
      m.city.toLowerCase().includes(q) ||
      m.venue.toLowerCase().includes(q);
    return genreOk && searchOk;
  });
}

// ---- feed ----
function renderFeed() {
  const list = document.getElementById("feedList");
  const vis = visibleMoments().slice().sort((a, b) => b.likes - a.likes);
  document.getElementById("feedCount").textContent = vis.length;
  list.innerHTML = "";
  vis.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <span class="card-play">▶</span>
      <img class="card-thumb" src="${thumbFor(m)}" ${THUMB_ATTRS} alt="${esc(m.artist)}" />
      <div class="card-body">
        <div class="card-artist">${esc(m.artist)}</div>
        <div class="card-meta">${esc(m.venue)} · ${esc(m.city)} · ${esc(m.year)}</div>
        <div class="card-foot">
          <span class="card-genre">${esc(m.genre)}</span>
          <span class="card-likes">♥ ${m.likes.toLocaleString()}</span>
        </div>
      </div>`;
    card.addEventListener("click", () => {
      document.body.classList.remove("feed-open");
      map.flyTo([m.lat, m.lng], 12, { duration: 1.1 });
      openMoment(m);
    });
    list.appendChild(card);
  });
}

// ---- genre chips ----
function renderChips() {
  const genres = ["all", ...Array.from(new Set(MOMENTS.map((m) => m.genre)))];
  const wrap = document.getElementById("genreFilters");
  wrap.innerHTML = "";
  genres.forEach((g) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (g === activeGenre ? " active" : "");
    chip.textContent = g;
    chip.addEventListener("click", () => {
      activeGenre = g;
      renderChips(); renderFeed(); renderMarkers();
    });
    wrap.appendChild(chip);
  });
}

// ---- moment modal ----
let currentMoment = null;
function openMoment(m) {
  currentMoment = m;
  document.getElementById("modalArtist").textContent = m.artist;
  document.getElementById("modalMeta").textContent = `${m.venue} · ${m.city} · ${m.year}`;
  document.getElementById("modalStory").textContent = m.story;
  document.getElementById("modalTags").innerHTML = `<span class="card-genre">${esc(m.genre)}</span>`;
  document.getElementById("saveCount").textContent = m.likes.toLocaleString();

  const v = document.getElementById("modalVideo");
  if (m.youtubeId && m.videoOk) {
    v.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${m.youtubeId}?rel=0"
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
         allowfullscreen></iframe>`;
  } else {
    const b = document.createElement("button");
    b.className = "video-fallback";
    b.type = "button";
    b.innerHTML = `<span class="vf-play">▶</span>
         <span class="vf-main">watch fan clips on YouTube</span>
         <small>no clip pinned yet — be the first to add one</small>`;
    b.addEventListener("click", () => window.open(ytSearchUrl(m), "_blank"));
    v.innerHTML = "";
    v.appendChild(b);
  }

  history.replaceState(null, "", shareUrlFor(m));
  document.getElementById("modal").hidden = false;
}
document.getElementById("modalClose").onclick = closeModal;
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") closeModal();
});
function closeModal() {
  document.getElementById("modalVideo").innerHTML = ""; // stop playback
  document.getElementById("modal").hidden = true;
  history.replaceState(null, "", location.pathname + location.search);
}
document.getElementById("modalYt").onclick = () =>
  window.open(currentMoment ? ytSearchUrl(currentMoment) : "https://youtube.com", "_blank");
document.getElementById("modalSave").onclick = () => {
  if (!currentMoment) return;
  currentMoment.likes += 1;
  if (currentMoment.mine) savePins();
  else if (moments.includes(currentMoment)) {
    likeBumps[currentMoment.id] = (likeBumps[currentMoment.id] || 0) + 1;
    saveLikes();
  }
  document.getElementById("saveCount").textContent = currentMoment.likes.toLocaleString();
  renderFeed();
};

// ---- search ----
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  renderFeed(); renderMarkers();
});

// ---- add a moment ----
const sheet = document.getElementById("sheet");
const sheetHint = document.getElementById("sheetHint");
document.getElementById("addBtn").onclick = () => { sheet.hidden = false; };
document.getElementById("sheetCancel").onclick = () => { sheet.hidden = true; };
sheet.addEventListener("click", (e) => { if (e.target.id === "sheet") sheet.hidden = true; });

map.on("click", (e) => {
  pendingLatLng = e.latlng;
  sheetHint.textContent = `📍 location set: ${e.latlng.lat.toFixed(2)}, ${e.latlng.lng.toFixed(2)} — now fill the details`;
  sheetHint.classList.add("set");
});

function parseYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  const latlng = pendingLatLng || map.getCenter();
  const m = {
    id: Date.now(),
    artist: f.artist.value.trim(),
    venue: f.venue.value.trim(),
    city: f.city.value.trim(),
    year: parseInt(f.year.value, 10) || new Date().getFullYear(),
    genre: f.genre.value,
    lat: latlng.lat, lng: latlng.lng,
    youtubeId: parseYouTubeId(f.yt.value.trim()),
    story: f.story.value.trim() || "a moment that mattered.",
    likes: 1
  };
  m.videoOk = !!m.youtubeId; // trust a freshly pasted link
  m.mine = true;
  moments.unshift(m);
  savePins();
  f.reset();
  pendingLatLng = null;
  sheetHint.textContent = "tip: click anywhere on the map first to set the location 📍";
  sheetHint.classList.remove("set");
  sheet.hidden = true;
  renderFeed(); renderMarkers();
  map.flyTo([m.lat, m.lng], 11, { duration: 1.1 });
  setTimeout(() => openMoment(m), 900);
});

// ---- esc to close ----
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(); sheet.hidden = true; document.getElementById("spotifyModal").hidden = true; }
});

// ---- intro splash sequence (cassette → stage → map) ----
const splash = document.getElementById("splash");
const splashKicker = document.getElementById("splashKicker");
let splashDone = false;
let toStageTimer, toEndTimer;

function goStage() {
  if (splashDone || splash.dataset.phase === "stage") return;
  splash.dataset.phase = "stage";
  splashKicker.textContent = "▸ the show's about to start";
  clearTimeout(toEndTimer);
  toEndTimer = setTimeout(endSplash, 2200);
}
function endSplash() {
  if (splashDone) return;
  splashDone = true;
  clearTimeout(toStageTimer); clearTimeout(toEndTimer);
  splash.classList.add("gone");
  setTimeout(() => { splash.remove(); map.invalidateSize(); }, 800);
}

// auto-advance: cassette ~4.5s → stage ~2.2s → map
toStageTimer = setTimeout(goStage, 4500);
document.getElementById("splashPlay").addEventListener("click", (e) => {
  e.stopPropagation();
  splash.dataset.phase === "stage" ? endSplash() : goStage();
});
document.getElementById("splashSkip").addEventListener("click", endSplash);
splash.addEventListener("click", endSplash);

// ============ Spotify "Sound Map" ============
const spotifyLayer = L.layerGroup();
let spotifyOn = false;
const maxMinutes = Math.max(...SPOTIFY_TOP.map((a) => a.minutes));

function spotifyIcon(a) {
  const size = 30 + Math.round((a.minutes / maxMinutes) * 46); // 30–76px glow
  const big = a.minutes > maxMinutes * 0.7 ? " big" : "";
  return L.divIcon({
    className: "",
    html: `<div class="sp-pin${big}" style="width:${size}px;height:${size}px">
             <div class="glow"></div><div class="core"></div>
           </div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
}

function renderSpotifyLayer() {
  spotifyLayer.clearLayers();
  SPOTIFY_TOP.forEach((a) => {
    L.marker([a.lat, a.lng], { icon: spotifyIcon(a) })
      .bindTooltip(`<b>${a.artist}</b><br>${a.origin} · ${a.minutes.toLocaleString()} min`,
        { direction: "top", offset: [0, -10], className: "sp-tip" })
      .addTo(spotifyLayer);
  });
}

function soundStats() {
  const byCountry = {};
  SPOTIFY_TOP.forEach((a) => { byCountry[a.country] = (byCountry[a.country] || 0) + a.minutes; });
  const topCountry = Object.entries(byCountry).sort((a, b) => b[1] - a[1])[0][0];
  const countries = Object.keys(byCountry).length;
  const hours = Math.round(SPOTIFY_TOP.reduce((s, a) => s + a.minutes, 0) / 60);
  const byGenre = {};
  SPOTIFY_TOP.forEach((a) => { byGenre[a.genre] = (byGenre[a.genre] || 0) + a.minutes; });
  const topGenre = Object.entries(byGenre).sort((a, b) => b[1] - a[1])[0][0];
  return { topCountry, countries, hours, topGenre, artists: SPOTIFY_TOP.length };
}

function openSoundPanel() {
  const s = soundStats();
  document.getElementById("soundSub").textContent =
    `your sound lives mostly in ${s.topCountry}`;
  document.getElementById("soundStats").innerHTML = `
    <div class="sp-stat"><div class="n">${s.artists}</div><div class="l">top artists</div></div>
    <div class="sp-stat"><div class="n">${s.countries}</div><div class="l">countries</div></div>
    <div class="sp-stat"><div class="n">${s.hours}h</div><div class="l">streamed</div></div>
    <div class="sp-stat"><div class="n">${s.topGenre}</div><div class="l">top sound</div></div>`;
  const list = document.getElementById("soundList");
  list.innerHTML = "";
  SPOTIFY_TOP.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "sp-row";
    const w = 30 + Math.round((a.minutes / maxMinutes) * 60);
    row.innerHTML = `
      <span class="sp-rank">${i + 1}</span>
      <div class="sp-info"><div class="a">${a.artist}</div><div class="o">${a.origin}</div></div>
      <span class="sp-bar" style="width:${w}px"></span>`;
    row.addEventListener("click", () => map.flyTo([a.lat, a.lng], 6, { duration: 1.1 }));
    list.appendChild(row);
  });
  document.getElementById("soundPanel").hidden = false;
}

function connectSpotify() {
  spotifyOn = true;
  renderSpotifyLayer();
  spotifyLayer.addTo(map);
  openSoundPanel();
  document.body.classList.add("sound-on");
  const btn = document.getElementById("spotifyBtn");
  btn.classList.add("on");
  btn.innerHTML = `<span class="sp-logo">●</span> sound map on`;
  document.getElementById("spotifyModal").hidden = true;
  const b = L.latLngBounds(SPOTIFY_TOP.map((a) => [a.lat, a.lng]));
  map.flyToBounds(b, { padding: [80, 80], duration: 1.2, maxZoom: 4 });
}

function disconnectSpotify() {
  spotifyOn = false;
  map.removeLayer(spotifyLayer);
  document.body.classList.remove("sound-on");
  document.getElementById("soundPanel").hidden = true;
  const btn = document.getElementById("spotifyBtn");
  btn.classList.remove("on");
  btn.innerHTML = `<span class="sp-logo">●</span> connect spotify`;
}

document.getElementById("spotifyBtn").addEventListener("click", () => {
  if (spotifyOn) { disconnectSpotify(); return; }
  document.getElementById("spotifyModal").hidden = false;
});
document.getElementById("spotifyConnect").addEventListener("click", connectSpotify);
document.getElementById("spotifyClose").addEventListener("click", () => {
  document.getElementById("spotifyModal").hidden = true;
});
document.getElementById("spotifyModal").addEventListener("click", (e) => {
  if (e.target.id === "spotifyModal") e.currentTarget.hidden = true;
});
document.getElementById("soundClose").addEventListener("click", disconnectSpotify);

// ============ share & deep links ============
// seed moments share as #m=<id>; your own pins are encoded into the link itself
// (base64url JSON) so the person you send it to sees the exact moment — no backend.
function encodeMoment(m) {
  const p = {
    a: m.artist, v: m.venue, c: m.city, y: m.year, g: m.genre,
    la: +m.lat.toFixed(4), ln: +m.lng.toFixed(4),
    yt: m.youtubeId || undefined, s: m.story
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeMoment(str) {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/")))));
    if (!p.a || typeof p.la !== "number" || typeof p.ln !== "number") return null;
    const yt = typeof p.yt === "string" && /^[\w-]{11}$/.test(p.yt) ? p.yt : null;
    return {
      id: "shared", artist: String(p.a), venue: String(p.v || ""), city: String(p.c || ""),
      year: p.y || "", genre: String(p.g || "other"), lat: p.la, lng: p.ln,
      youtubeId: yt, videoOk: !!yt, story: String(p.s || ""), likes: 1
    };
  } catch { return null; }
}

function shareUrlFor(m) {
  const base = location.origin + location.pathname;
  return MOMENTS.some((s) => s.id === m.id) ? `${base}#m=${m.id}` : `${base}#p=${encodeMoment(m)}`;
}

document.getElementById("modalShare").onclick = async () => {
  if (!currentMoment) return;
  const url = shareUrlFor(currentMoment);
  const btn = document.getElementById("modalShare");
  try {
    if (navigator.share) { await navigator.share({ title: `${currentMoment.artist} — ENCORE`, url }); return; }
    await navigator.clipboard.writeText(url);
    btn.textContent = "✓ link copied";
    setTimeout(() => { btn.textContent = "⤴ share"; }, 1600);
  } catch { /* user dismissed the share sheet */ }
};

// opening a shared link skips the intro and lands on the moment
function openFromHash() {
  const mMatch = location.hash.match(/^#m=(\d+)$/);
  const pMatch = location.hash.match(/^#p=([\w-]+)$/);
  let target = null;
  if (mMatch) target = moments.find((x) => String(x.id) === mMatch[1]) || null;
  else if (pMatch) target = decodeMoment(pMatch[1]);
  if (!target) return;
  endSplash();
  map.setView([target.lat, target.lng], 12);
  setTimeout(() => openMoment(target), 300);
}

// ---- mobile feed toggle ----
document.getElementById("feedToggle").addEventListener("click", () =>
  document.body.classList.toggle("feed-open"));

// ---- probe which seed videos actually resolve (avoids dead embeds) ----
function probeVideos() {
  moments.forEach((m) => {
    if (!m.youtubeId) { m.videoOk = false; return; }
    if (m.videoOk !== undefined) return;
    const img = new Image();
    img.onload = () => { m.videoOk = img.naturalWidth > 120; };
    img.onerror = () => { m.videoOk = false; };
    img.src = `https://i.ytimg.com/vi/${m.youtubeId}/hqdefault.jpg`;
  });
}

// ---- boot ----
probeVideos();
renderChips();
renderFeed();
renderMarkers();
openFromHash();
