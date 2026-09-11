#!/usr/bin/env node
/**
 * Check `data/` against the same validator the running app uses.
 *
 * The app degrades gracefully when a moment is malformed: it drops it and warns
 * in the console. That is the right behaviour at runtime and the wrong place to
 * find out, so this runs in CI and prints every problem with the entry that
 * caused it.
 *
 * Usage: npm run validate:data
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateMoment } from "../src/core/validate.js";
import { isBundle, unpack } from "../src/core/bundle.js";

const RED = "\u001b[31m";
const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

/** @returns {string} */
function bundlePath() {
  return fileURLToPath(new URL("../data/performances.json", import.meta.url));
}

/** @param {string} name */
function load(name) {
  const path = fileURLToPath(new URL(`../data/${name}`, import.meta.url));
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${name} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** @type {string[]} */
const problems = [];

/** @param {string} message */
function fail(message) {
  problems.push(message);
}

const moments = load("moments.json");

if (Array.isArray(moments)) {
  const seen = new Set();

  moments.forEach((moment, index) => {
    const label = `moments.json[${index}] ${moment?.artist ?? "unknown"}`;
    const result = validateMoment(moment);
    if (!result.ok) fail(`${label}: ${result.errors.join("; ")}`);

    if (seen.has(moment?.id)) fail(`${label}: duplicate id ${moment.id}`);
    seen.add(moment?.id);
  });

  if (moments.length === 0) fail("moments.json is empty");
} else if (moments !== null) {
  fail("moments.json is not an array");
}

// The ingested dataset, when one has been built. It is optional on a fresh
// clone and mandatory once it exists, which is why a missing file is silence and
// a malformed one is an error.
const performances = existsSync(bundlePath()) ? load("performances.json") : null;

if (performances !== null) {
  if (!isBundle(performances)) {
    fail("performances.json is not a dataset this version can read");
  } else {
    const moments = unpack(performances);
    if (moments.length === 0) fail("performances.json unpacked to nothing");

    const ids = new Set();
    let invalid = 0;
    /** @type {string} */
    let firstProblem = "";

    for (const moment of moments) {
      if (ids.has(moment.id)) fail(`performances.json: duplicate id ${moment.id}`);
      ids.add(moment.id);

      const result = validateMoment(moment);
      if (!result.ok) {
        invalid += 1;
        firstProblem ||= `${moment.artist}: ${result.errors[0]}`;
      }
    }

    if (invalid > 0) fail(`performances.json: ${invalid} invalid records, first is ${firstProblem}`);
  }
}

const profile = load("listening-sample.json");

if (Array.isArray(profile)) {
  profile.forEach((artist, index) => {
    const label = `listening-sample.json[${index}] ${artist?.artist ?? "unknown"}`;
    for (const field of ["artist", "origin", "country", "genre"]) {
      if (typeof artist?.[field] !== "string" || artist[field].trim() === "") {
        fail(`${label}: ${field} must be a non empty string`);
      }
    }
    if (!Number.isFinite(artist?.lat) || artist.lat < -90 || artist.lat > 90) {
      fail(`${label}: lat is off the planet`);
    }
    if (!Number.isFinite(artist?.lng) || artist.lng < -180 || artist.lng > 180) {
      fail(`${label}: lng is off the planet`);
    }
    if (!Number.isFinite(artist?.minutes) || artist.minutes <= 0) {
      fail(`${label}: minutes must be a positive number`);
    }
  });
} else if (profile !== null) {
  fail("listening-sample.json is not an array");
}

if (problems.length > 0) {
  console.error(`${RED}data check failed${RESET}`);
  for (const problem of problems) console.error(`  ${RED}x${RESET} ${problem}`);
  process.exit(1);
}

const momentCount = Array.isArray(moments) ? moments.length : 0;
const artistCount = Array.isArray(profile) ? profile.length : 0;
const performanceCount = performances && isBundle(performances) ? performances.rows.length / 4 : 0;
console.log(
  `${GREEN}data ok${RESET} ${DIM}${momentCount} curated moments, ` +
    `${performanceCount.toLocaleString("en-US")} ingested performances, ` +
    `${artistCount} artists in the listening sample${RESET}`
);
