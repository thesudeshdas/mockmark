import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeAuthorName, normalizeBody, normalizeMockPath, normalizeReactionEmoji, normalizeRegion } from "./rules.js";

export class JsonAnnotationStore {
  constructor(file) { this.file = file; this.data = { threads: [], messages: [], reactions: [] }; this.load(); }
  load() { if (existsSync(this.file)) this.data = JSON.parse(readFileSync(this.file, "utf8")); }
  save() { mkdirSync(dirname(this.file), { recursive: true }); writeFileSync(this.file, JSON.stringify(this.data, null, 2)); }
  list(mockPath) {
    const path = normalizeMockPath(mockPath);
    return this.data.threads.filter(t => t.mockPath === path && !t.deletedAt).sort((a,b)=>b.updatedAt-a.updatedAt).map(t => this.hydrate(t));
  }
  hydrate(thread) {
    const messages = this.data.messages.filter(m => m.threadId === thread.threadId).sort((a,b)=>a.createdAt-b.createdAt).map(m => ({...m, reactions:this.reactionsFor(m.messageId)}));
    return { ...thread, messageCount: messages.length, messages };
  }
  reactionsFor(messageId) {
    const map = new Map();
    for (const r of this.data.reactions.filter(r => r.messageId === messageId)) {
      const bucket = map.get(r.emoji) || { emoji:r.emoji, count:0, authors:[] };
      bucket.count += 1; bucket.authors.push(r.authorName); map.set(r.emoji, bucket);
    }
    return [...map.values()].sort((a,b)=>a.emoji.localeCompare(b.emoji));
  }
  createThread(input) {
    const now = Date.now(); const region = normalizeRegion(input);
    const thread = { threadId: randomUUID(), mockPath: normalizeMockPath(input.mockPath), ...region, authorName: normalizeAuthorName(input.authorName), createdAt: now, updatedAt: now };
    const message = { messageId: randomUUID(), threadId: thread.threadId, authorName: thread.authorName, body: normalizeBody(input.body), createdAt: now };
    this.data.threads.push(thread); this.data.messages.push(message); this.save(); return thread.threadId;
  }
  addMessage(input) {
    const thread = this.data.threads.find(t => t.threadId === input.threadId && !t.deletedAt);
    if (!thread) throw Object.assign(new Error("Thread not found"), { status: 404 });
    if (thread.resolvedAt) throw Object.assign(new Error("Thread is resolved"), { status: 409 });
    const now = Date.now(); const message = { messageId: randomUUID(), threadId: thread.threadId, authorName: normalizeAuthorName(input.authorName), body: normalizeBody(input.body), createdAt: now };
    thread.updatedAt = now; this.data.messages.push(message); this.save(); return message.messageId;
  }
  resolveThread(input) {
    const thread = this.ownedThread(input.threadId, input.authorName); const now = Date.now();
    if (thread.resolvedAt) { delete thread.resolvedAt; delete thread.resolvedBy; } else { thread.resolvedAt = now; thread.resolvedBy = normalizeAuthorName(input.authorName); }
    thread.updatedAt = now; this.save(); return { resolved: Boolean(thread.resolvedAt) };
  }
  deleteThread(input) { const thread = this.ownedThread(input.threadId, input.authorName); const now = Date.now(); thread.deletedAt = now; thread.deletedBy = normalizeAuthorName(input.authorName); thread.updatedAt = now; this.save(); return { deleted:true }; }
  toggleReaction(input) {
    const msg = this.data.messages.find(m => m.messageId === input.messageId); if (!msg) throw Object.assign(new Error("Message not found"), { status: 404 });
    const authorName = normalizeAuthorName(input.authorName); const emoji = normalizeReactionEmoji(input.emoji);
    const idx = this.data.reactions.findIndex(r => r.messageId === input.messageId && r.authorName === authorName && r.emoji === emoji);
    if (idx >= 0) { this.data.reactions.splice(idx,1); this.save(); return { active:false }; }
    this.data.reactions.push({ reactionId: randomUUID(), messageId: input.messageId, authorName, emoji, createdAt: Date.now() }); this.save(); return { active:true };
  }
  ownedThread(threadId, authorName) { const thread = this.data.threads.find(t => t.threadId === threadId && !t.deletedAt); if (!thread) throw Object.assign(new Error("Thread not found"), { status: 404 }); if (thread.authorName !== normalizeAuthorName(authorName)) throw Object.assign(new Error("Only the thread owner can do that"), { status: 403 }); return thread; }
}
