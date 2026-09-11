/**
 * The map surface: tiles, pins, clustering.
 *
 * Three things here are deliberate.
 *
 * The basemap needs no API key, because a static site has nowhere safe to keep
 * one. That rules out most dark themed tile providers, including CARTO, which
 * used to serve this app and now stamps unregistered tiles with a watermark.
 * Esri's dark canvas is keyless, dark, and light on labels, which is what the
 * pins need to stay readable.
 *
 * Tiles fall back. If the basemap fails repeatedly, the layer is swapped for
 * OpenStreetMap with a filter that darkens it in the browser, so a provider
 * outage costs the app its palette rather than its map.
 *
 * Clustering degrades. If the cluster plugin does not load, pins go into a plain
 * layer group and everything else still works.
 *
 * @module ui/mapView
 */

import { createPoster } from "./thumbnail.js";
import { moveTo } from "./motion.js";

const BASEMAP = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution:
    'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 16
};

const FALLBACK_BASEMAP = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
};

/** Tile requests that have to fail before the app gives up on the basemap. */
const TILE_ERROR_LIMIT = 6;

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/**
 * @param {string} containerId
 * @param {object} handlers
 * @param {(moment: Moment) => void} handlers.onSelect
 * @param {(latlng: {lat: number, lng: number}) => void} handlers.onMapClick
 */
export function createMapView(containerId, handlers) {
  const map = L.map(containerId, {
    zoomControl: false,
    attributionControl: true,
    worldCopyJump: true,
    maxZoom: BASEMAP.maxZoom
  }).setView([25, -20], 3);

  addBasemap(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const pinLayer = createPinLayer().addTo(map);

  map.on("click", (event) => handlers.onMapClick(event.latlng));

  /**
   * Redraw every pin. Leaflet has no diffing layer, and at the scale this runs
   * at, a few hundred markers, a full rebuild behind a debounced input is both
   * simpler and fast enough. The comment is here so the next person knows it is
   * a measured choice rather than an oversight.
   *
   * @param {Moment[]} moments
   */
  function render(moments) {
    pinLayer.clearLayers();
    for (const moment of moments) {
      const marker = L.marker([moment.lat, moment.lng], {
        icon: pinIcon(moment),
        keyboard: false,
        title: `${moment.artist}, ${moment.venue}`,
        alt: `${moment.artist} at ${moment.venue}`
      });
      marker.on("click", () => handlers.onSelect(moment));
      pinLayer.addLayer(marker);
    }
  }

  return {
    map,
    render,
    /**
     * @param {Moment|{lat: number, lng: number}} target
     * @param {number} [zoom]
     */
    focus(target, zoom = 12) {
      moveTo(map, [target.lat, target.lng], zoom);
    },
    invalidate() {
      map.invalidateSize();
    }
  };
}

/**
 * Add the basemap, and watch it. Leaflet fires `tileerror` per failed request,
 * so a provider that is down or has started refusing anonymous traffic shows up
 * as a burst of them. Past a threshold the layer is replaced rather than left as
 * a grid of holes.
 *
 * @param {import("leaflet").Map} map
 */
function addBasemap(map) {
  let failures = 0;

  const primary = L.tileLayer(BASEMAP.url, {
    attribution: BASEMAP.attribution,
    maxZoom: BASEMAP.maxZoom
  }).addTo(map);

  primary.on("tileerror", () => {
    failures += 1;
    if (failures !== TILE_ERROR_LIMIT) return;

    console.warn("basemap tiles are failing, falling back to OpenStreetMap");
    map.removeLayer(primary);
    L.tileLayer(FALLBACK_BASEMAP.url, {
      attribution: FALLBACK_BASEMAP.attribution,
      maxZoom: FALLBACK_BASEMAP.maxZoom,
      className: "tiles-darkened"
    }).addTo(map);
  });
}

/**
 * Cluster group when the plugin is present, plain group when it is not.
 * @returns {import("leaflet").LayerGroup}
 */
function createPinLayer() {
  if (typeof L.markerClusterGroup !== "function") return L.layerGroup();

  return L.markerClusterGroup({
    maxClusterRadius: 44,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster) =>
      L.divIcon({
        className: "",
        html: `<div class="cluster">${cluster.getChildCount()}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      })
  });
}

/**
 * A pin is the clip's poster in a glowing ring.
 *
 * @param {Moment} moment
 * @returns {import("leaflet").DivIcon}
 */
function pinIcon(moment) {
  const wrap = document.createElement("div");
  wrap.className = "pin";

  const ring = document.createElement("div");
  ring.className = "pin-ring";

  wrap.append(ring, createPoster(moment, "pin-thumb"));

  return L.divIcon({
    className: "",
    html: wrap,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}
