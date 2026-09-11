/**
 * Shared type definitions for the whole app.
 * This module holds no runtime code: it exists so every other module can
 * reference one canonical shape via JSDoc, and so `tsc --checkJs` can verify it.
 *
 * @module core/types
 */

/**
 * A live music moment: one performance, pinned to the place it happened.
 *
 * `id` is a number for seed moments, `"shared"` for a moment reconstructed from
 * a share link, and an epoch millisecond number for a moment the visitor pins.
 *
 * @typedef {object} Moment
 * @property {number|string} id          Stable identity, unique within a session.
 * @property {string} artist             Performer name, as billed.
 * @property {string} venue              Venue or festival name.
 * @property {string} city               City the venue sits in.
 * @property {number|string} year        Year of the performance.
 * @property {string} genre              One of the genres in `GENRES`.
 * @property {number} lat                Latitude in degrees, [-90, 90].
 * @property {number} lng                Longitude in degrees, [-180, 180].
 * @property {string|null} videoId       YouTube video id, or null when no clip is attached.
 * @property {string} story              Why the moment mattered, in the pinner's words.
 * @property {number} likes              Count of hearts.
 * @property {boolean} [mine]            True when this visitor pinned it, so it persists locally.
 */

/**
 * One artist from a listening profile, placed at the city their sound came from.
 *
 * @typedef {object} ListeningArtist
 * @property {string} artist
 * @property {string} origin             Human readable origin, e.g. "Medellin, CO".
 * @property {string} country
 * @property {string} genre
 * @property {number} lat
 * @property {number} lng
 * @property {number} minutes            Minutes streamed over the profile window.
 */

/**
 * Aggregate view of a listening profile, used by the sound map panel.
 *
 * @typedef {object} SoundSummary
 * @property {number} artists
 * @property {number} countries
 * @property {number} hours
 * @property {number} totalMinutes
 * @property {string} topCountry
 * @property {string} topGenre
 */

export {};
