import test from "node:test";
import assert from "node:assert/strict";

import { embedUrl, isVideoId, parseVideoId, searchUrl, thumbnailUrl } from "../src/core/youtube.js";

const ID = "dQw4w9WgXcQ";

test("every link shape a person actually pastes yields the same id", () => {
  const links = [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?app=desktop&v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `  https://youtu.be/${ID}  `,
    ID
  ];
  for (const link of links) {
    assert.equal(parseVideoId(link), ID, `failed on: ${link.trim()}`);
  }
});

test("anything that is not a clip link returns null rather than throwing", () => {
  const notLinks = ["", "   ", "https://example.com", "https://vimeo.com/12345", "watch this", null, undefined, 42];
  for (const value of notLinks) {
    assert.equal(parseVideoId(/** @type {string} */ (value)), null, `failed on: ${String(value)}`);
  }
});

test("a string of the wrong length is not mistaken for a bare id", () => {
  assert.equal(parseVideoId("short"), null);
  assert.equal(parseVideoId("waytoolongtobeanid"), null);
  assert.equal(isVideoId("dQw4w9WgXc"), false, "ten characters");
  assert.equal(isVideoId(`${ID}x`), false, "twelve characters");
  assert.equal(isVideoId(ID), true);
});

test("embeds go through the no cookie host", () => {
  assert.equal(embedUrl(ID), `https://www.youtube-nocookie.com/embed/${ID}?rel=0`);
  assert.match(thumbnailUrl(ID), /^https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\//);
});

test("a moment with no clip searches for the right night, it does not guess an id", () => {
  const url = searchUrl({ artist: "Daft Punk", venue: "Coachella", year: 2006 });
  assert.match(url, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  assert.match(decodeURIComponent(url), /Daft Punk Coachella 2006 live/);
});

test("a hostile id cannot break out of the URL it is placed in", () => {
  assert.ok(!embedUrl('" onload="alert(1)').includes('"'));
});
