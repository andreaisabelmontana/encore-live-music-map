#!/usr/bin/env node
/**
 * The ingest.
 *
 * Builds `data/performances.json` from public, unauthenticated sources. Runs on
 * a schedule in CI and commits the result, which is the whole point: a static
 * site cannot hold an API key, so the fetching happens at build time and the
 * browser only ever sees a file.
 *
 * Three passes, in dependency order:
 *
 *   places   ->  id to coordinates, the join key
 *   genres   ->  artist id to genre, because events carry no genre
 *   events   ->  concerts, joined against both, normalised, validated, packed
 *
 * Usage:
 *   node scripts/ingest/run.mjs                    full run
 *   node scripts/ingest/run.mjs --event-pages 20   a small run for development
 *   node scripts/ingest/run.mjs --no-cache         ignore the on disk cache
 *
 * @module ingest/run
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createClient } from "./http.mjs";
import { fetchArtistGenres, fetchConcerts, fetchPlaces, skipped } from "./musicbrainz.mjs";
import { normalizeBatch } from "./normalize.mjs";
import { pack } from "../../src/core/bundle.js";
import { GENRES } from "../../src/core/validate.js";

const USER_AGENT =
  "EncoreIngest/1.0 (https://github.com/andreaisabelmontana/encore-live-music-map)";

const OUTPUT = fileURLToPath(new URL("../../data/performances.json", import.meta.url));

const args = parseArgs(process.argv.slice(2));

const config = {
  placePages: number(args["place-pages"], 900),
  eventPages: number(args["event-pages"], 900),
  artistsPerGenre: number(args["artists-per-genre"], 400),
  useCache: args["no-cache"] !== true
};

await main();

async function main() {
  const started = Date.now();
  const client = createClient({ userAgent: USER_AGENT, useCache: config.useCache });

  // Pass one. Venues that have a point on the earth. Everything else joins to
  // this, so it runs first and a miss here discards the event.
  log("places", "reading venue coordinates");
  const places = await fetchPlaces(client, config.placePages, (page, total) =>
    progress("places", page, Math.min(total, config.placePages))
  );
  log("places", `${places.size.toLocaleString("en-US")} venues with coordinates`);

  // Pass two. Genre per artist. Events do not carry one, and one lookup per
  // artist would be tens of thousands of requests, so the genres the interface
  // already offers are enumerated instead.
  log("genres", "reading artists by genre tag");
  const artistGenres = await fetchArtistGenres(
    client,
    GENRES.filter((genre) => genre !== "other"),
    config.artistsPerGenre,
    (genre, count) => log("genres", `${genre}: ${count} artists`)
  );
  log("genres", `${artistGenres.size.toLocaleString("en-US")} artists tagged`);

  // Pass three. The concerts themselves, normalised as they stream in so the
  // whole result set never has to sit in memory as raw API responses.
  log("events", "reading concerts");
  /** @type {import("../../src/core/types.js").Moment[]} */
  const moments = [];
  /** @type {Record<string, number>} */
  let tally = {};

  for await (const batch of fetchConcerts(client, config.eventPages, (page, total) =>
    progress("events", page, Math.min(total, config.eventPages))
  )) {
    const result = normalizeBatch(batch, { places, artistGenres }, tally);
    moments.push(...result.moments);
    tally = result.tally;
  }

  const unique = dedupe(moments);
  const bundle = pack(unique, {
    generated: new Date().toISOString().slice(0, 10),
    source: "MusicBrainz"
  });

  await writeFile(OUTPUT, JSON.stringify(bundle), "utf8");

  report({ unique, tally, bundle, client, started });
}

/**
 * Two sources can describe the same night, and a short id can in principle
 * collide. Both are resolved here, so the packed file has one row per
 * performance and the ids in it are unique.
 *
 * @param {import("../../src/core/types.js").Moment[]} moments
 * @returns {import("../../src/core/types.js").Moment[]}
 */
function dedupe(moments) {
  /** @type {Map<string, import("../../src/core/types.js").Moment>} */
  const byIdentity = new Map();

  for (const moment of moments) {
    const key = `${moment.artist}|${moment.venue}|${moment.year}|${moment.lat}|${moment.lng}`;
    if (!byIdentity.has(key)) byIdentity.set(key, moment);
  }

  /** @type {Set<string>} */
  const seenIds = new Set();
  /** @type {import("../../src/core/types.js").Moment[]} */
  const unique = [];

  for (const moment of byIdentity.values()) {
    if (seenIds.has(String(moment.id))) continue;
    seenIds.add(String(moment.id));
    unique.push(moment);
  }

  return unique;
}

/**
 * @param {{
 *   unique: import("../../src/core/types.js").Moment[],
 *   tally: Record<string, number>,
 *   bundle: import("../../src/core/bundle.js").Bundle,
 *   client: { stats: Record<string, number> },
 *   started: number
 * }} input
 */
function report(input) {
  const bytes = Buffer.byteLength(JSON.stringify(input.bundle));
  const dropped = Object.values(input.tally).reduce((sum, n) => sum + n, 0);

  console.log("");
  console.log("performances   ", input.unique.length.toLocaleString("en-US"));
  console.log("artists        ", input.bundle.artists.length.toLocaleString("en-US"));
  console.log("venues         ", input.bundle.venues.length.toLocaleString("en-US"));
  console.log("packed size    ", `${(bytes / 1024).toFixed(0)} KB`);
  console.log("bytes per row  ", (bytes / Math.max(1, input.unique.length)).toFixed(1));
  console.log("dropped        ", dropped.toLocaleString("en-US"));
  for (const [reason, count] of Object.entries(input.tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(26)} ${count.toLocaleString("en-US")}`);
  }
  console.log("pages skipped  ", skipped.pages);
  console.log("requests       ", input.client.stats.requests);
  console.log("cache hits     ", input.client.stats.cacheHits);
  console.log("retries        ", input.client.stats.retries);
  console.log("elapsed        ", `${((Date.now() - input.started) / 1000).toFixed(0)}s`);
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string|true>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string|true>} */
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      i += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

/**
 * @param {string|true|undefined} value
 * @param {number} fallback
 */
function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {string} stage
 * @param {string} message
 */
function log(stage, message) {
  console.log(`[${stage}] ${message}`);
}

/**
 * @param {string} stage
 * @param {number} page
 * @param {number} total
 */
function progress(stage, page, total) {
  if (page % 25 === 0 || page === total) log(stage, `page ${page} of ${total}`);
}
