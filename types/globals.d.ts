/**
 * Ambient declarations for the globals the page loads from a CDN.
 *
 * Leaflet and its cluster plugin arrive as script tags rather than as bundled
 * imports, which keeps the site buildless. `allowUmdGlobalAccess` in the
 * tsconfig lets the modules reach the `L` that Leaflet's own types already
 * declare; this file adds the one function the cluster plugin bolts on, so
 * `tsc --checkJs` can still check every call against real types.
 */
import "leaflet";

declare module "leaflet" {
  interface MarkerClusterGroupOptions {
    maxClusterRadius?: number;
    showCoverageOnHover?: boolean;
    iconCreateFunction?: (cluster: { getChildCount: () => number }) => DivIcon;
  }

  /** Present only when leaflet.markercluster loaded, which the code checks for. */
  function markerClusterGroup(options?: MarkerClusterGroupOptions): LayerGroup;
}

export {};
