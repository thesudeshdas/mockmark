import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonAnnotationStore } from "../src/store.js";

test("creates threads, replies, reactions, resolve and delete", () => {
  const dir = mkdtempSync(join(tmpdir(), "mockmark-"));
  try {
    const store = new JsonAnnotationStore(join(dir, "data.json"));
    const threadId = store.createThread({ mockPath:"home.html", x:.1, y:.2, authorName:"Ada", body:"Initial" });
    const messageId = store.addMessage({ threadId, authorName:"Grace", body:"Reply" });
    assert.equal(store.toggleReaction({ messageId, authorName:"Ada", emoji:"✅" }).active, true);
    let rows = store.list("home.html");
    assert.equal(rows.length, 1); assert.equal(rows[0].messageCount, 2); assert.equal(rows[0].messages[1].reactions[0].count, 1);
    assert.equal(store.resolveThread({ threadId, authorName:"Ada" }).resolved, true);
    assert.throws(() => store.addMessage({ threadId, authorName:"Grace", body:"Nope" }), /resolved/);
    store.deleteThread({ threadId, authorName:"Ada" });
    assert.equal(store.list("home.html").length, 0);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});
