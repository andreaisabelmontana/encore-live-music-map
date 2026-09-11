import test from "node:test";
import assert from "node:assert/strict";

import { clamp, escapeHtml, formatCount, formatMeta } from "../src/core/format.js";

test("escapeHtml neutralises every character that could open a tag", () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
  );
  assert.equal(escapeHtml("Sigur Rós & friends"), "Sigur Rós &amp; friends");
  assert.equal(escapeHtml("it's"), "it&#39;s");
});

test("escapeHtml handles values that are not strings", () => {
  assert.equal(escapeHtml(2023), "2023");
  assert.equal(escapeHtml(null), "null");
  assert.equal(escapeHtml(undefined), "undefined");
});

test("counts read the same on every machine", () => {
  assert.equal(formatCount(2840), "2,840");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(1000000), "1,000,000");
});

test("the meta line joins what is there and skips what is not", () => {
  assert.equal(
    formatMeta({ venue: "Red Rocks", city: "Morrison", year: 2021 }),
    "Red Rocks · Morrison · 2021"
  );
  assert.equal(formatMeta({ venue: "Red Rocks", city: "", year: 2021 }), "Red Rocks · 2021");
});

test("clamp keeps a value inside its range", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
});
