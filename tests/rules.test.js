import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAuthorName, normalizeBody, normalizeMockPath, normalizeReactionEmoji, normalizeRegion } from "../src/rules.js";

test("normalizes safe mock paths", () => { assert.equal(normalizeMockPath("/landing/home.html"), "landing/home.html"); assert.throws(() => normalizeMockPath("../x")); });
test("validates author and body", () => { assert.equal(normalizeAuthorName(" Ada   Lovelace "), "Ada Lovelace"); assert.equal(normalizeBody(" hello "), "hello"); assert.throws(() => normalizeAuthorName("a")); assert.throws(() => normalizeBody("")); });
test("normalizes point and region", () => { assert.deepEqual(normalizeRegion({x:.2,y:.3}), {x:.2,y:.3}); assert.deepEqual(normalizeRegion({x:.9,y:.9,width:.5,height:.5}), {x:.9,y:.9,width:.09999999999999998,height:.09999999999999998}); assert.throws(() => normalizeRegion({x:2,y:.1})); });
test("limits reactions", () => { assert.equal(normalizeReactionEmoji("👍"), "👍"); assert.throws(() => normalizeReactionEmoji("🚀")); });
