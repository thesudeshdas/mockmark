const STORE_KEY = "mockmark.v1";
const state = {
  mockPath: mockPathFor(location),
  data: loadData(),
  threads: [],
  activeThreadId: null,
  annotating: false,
  hidden: localStorage.getItem("mockmarkHidden") === "1",
  listOpen: false,
  authorName: localStorage.getItem("mockmarkAuthor") || "",
  dragStart: null,
  draftRegion: null,
};
const MIN_REGION_PX = 12;
const REACTIONS = ["👍", "👀", "✅", "❤️"];

function mockPathFor(loc) {
  return decodeURIComponent(loc.pathname).replace(/^.*\/mocks\//, "").replace(/^\/+/, "") || `${document.title || "mock"}.html`;
}
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function loadData() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function normalizeData(data) {
  return { version: 1, threads: data.threads || [], messages: data.messages || [], reactions: data.reactions || [] };
}
function saveData() { localStorage.setItem(STORE_KEY, JSON.stringify(normalizeData(state.data))); }
function refreshThreads() {
  const data = normalizeData(state.data);
  state.threads = data.threads
    .filter((thread) => thread.mockPath === state.mockPath && !thread.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(hydrateThread);
  if (state.activeThreadId && !state.threads.some((thread) => thread.threadId === state.activeThreadId)) state.activeThreadId = null;
}
function hydrateThread(thread) {
  const messages = normalizeData(state.data).messages
    .filter((message) => message.threadId === thread.threadId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((message) => ({ ...message, reactions: reactionsFor(message.messageId) }));
  return { ...thread, messageCount: messages.length, messages };
}
function reactionsFor(messageId) {
  const map = new Map();
  for (const reaction of normalizeData(state.data).reactions.filter((item) => item.messageId === messageId)) {
    const bucket = map.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, authors: [] };
    bucket.count += 1;
    bucket.authors.push(reaction.authorName);
    map.set(reaction.emoji, bucket);
  }
  return [...map.values()].sort((a, b) => a.emoji.localeCompare(b.emoji));
}
function pageSize() {
  const root = document.documentElement;
  return { width: Math.max(root.scrollWidth, 1), height: Math.max(root.scrollHeight, 1) };
}
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function formatTime(ms) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ms)); }
function isUi(target) { return Boolean(target.closest?.(".mockmark-toolbar,.mockmark-panel,.mockmark-composer,.mockmark-pin,.mockmark-region,.mockmark-draft")); }
function isTyping(target) { const tag = target?.tagName?.toLowerCase(); return target?.isContentEditable || ["input", "textarea", "select"].includes(tag); }
function cleanAuthor(form) {
  const input = form?.querySelector?.('input[name="author"]');
  const authorName = String(input?.value || state.authorName || "").trim().replace(/\s+/g, " ");
  if (authorName.length < 2) throw new Error("Enter your name once before commenting.");
  state.authorName = authorName;
  localStorage.setItem("mockmarkAuthor", authorName);
  updateAuthorFields();
  return authorName;
}
function cleanBody(value) {
  const body = String(value || "").trim();
  if (!body) throw new Error("Comment cannot be empty.");
  return body;
}
function updateAuthorFields() {
  document.querySelectorAll(".mockmark-author-row").forEach((row) => {
    const input = row.querySelector('input[name="author"]');
    if (input) input.value = state.authorName;
    row.hidden = state.authorName.trim().length >= 2;
  });
}
function threadLabel(thread) { return state.threads.indexOf(thread) + 1; }
function renderPins() {
  document.querySelectorAll(".mockmark-pin,.mockmark-region").forEach((node) => node.remove());
  if (state.hidden) return;
  const size = pageSize();
  state.threads.forEach((thread) => {
    if (thread.width && thread.height) {
      const region = document.createElement("button");
      region.type = "button";
      region.className = `mockmark-region${thread.threadId === state.activeThreadId ? " is-active" : ""}${thread.resolvedAt ? " is-resolved" : ""}`;
      Object.assign(region.style, { left: `${thread.x * size.width}px`, top: `${thread.y * size.height}px`, width: `${thread.width * size.width}px`, height: `${thread.height * size.height}px` });
      region.innerHTML = `<span>${threadLabel(thread)}</span>`;
      region.addEventListener("click", () => openThread(thread.threadId));
      document.body.append(region);
      return;
    }
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = `mockmark-pin${thread.threadId === state.activeThreadId ? " is-active" : ""}${thread.resolvedAt ? " is-resolved" : ""}`;
    pin.style.left = `${thread.x * size.width}px`;
    pin.style.top = `${thread.y * size.height}px`;
    pin.textContent = String(threadLabel(thread));
    pin.addEventListener("click", () => openThread(thread.threadId));
    document.body.append(pin);
  });
}
function renderPanel() {
  const panel = document.querySelector(".mockmark-panel");
  const thread = state.threads.find((item) => item.threadId === state.activeThreadId);
  if (state.listOpen) return renderList();
  if (!thread) { panel.hidden = true; return; }
  panel.hidden = false;
  panel.querySelector("[data-reply]").hidden = Boolean(thread.resolvedAt);
  panel.querySelector(".mockmark-title").textContent = `Comment ${threadLabel(thread)}`;
  panel.querySelector(".mockmark-subtitle").textContent = `${thread.messageCount} message${thread.messageCount === 1 ? "" : "s"} · local/private${thread.resolvedAt ? " · resolved" : ""}`;
  const own = state.authorName.trim() && thread.authorName === state.authorName.trim();
  const actions = own ? `<button type="button" data-resolve>${thread.resolvedAt ? "Reopen" : "Resolve"}</button><button type="button" data-delete>Delete</button>` : "";
  const box = panel.querySelector(".mockmark-messages");
  box.innerHTML = `<div class="mockmark-thread-actions"><button type="button" data-list>All comments</button>${actions}</div>`;
  for (const message of thread.messages) {
    const item = document.createElement("div");
    item.className = "mockmark-msg";
    const reactions = REACTIONS.map((emoji) => {
      const found = message.reactions.find((item) => item.emoji === emoji);
      return `<button type="button" data-message="${message.messageId}" data-emoji="${emoji}" title="${found?.authors?.join(", ") || "React"}">${emoji} ${found?.count || ""}</button>`;
    }).join("");
    item.innerHTML = `<div class="mockmark-meta"><b>${escapeHtml(message.authorName)}</b><span>${formatTime(message.createdAt)}</span></div><div class="mockmark-body">${escapeHtml(message.body)}</div><div class="mockmark-reactions">${reactions}</div>`;
    box.append(item);
  }
  box.querySelectorAll("button[data-emoji]").forEach((button) => button.addEventListener("click", react));
  box.querySelector("[data-list]")?.addEventListener("click", toggleList);
  box.querySelector("[data-resolve]")?.addEventListener("click", resolveThread);
  box.querySelector("[data-delete]")?.addEventListener("click", deleteThread);
}
function renderList() {
  const panel = document.querySelector(".mockmark-panel");
  panel.hidden = false;
  panel.querySelector("[data-reply]").hidden = true;
  panel.querySelector(".mockmark-title").textContent = "All comments";
  panel.querySelector(".mockmark-subtitle").textContent = `${state.threads.length} local/private thread${state.threads.length === 1 ? "" : "s"} · ${state.mockPath}`;
  const box = panel.querySelector(".mockmark-messages");
  box.innerHTML = state.threads.length ? "" : `<div class="mockmark-empty">No comments yet. Comments stay in this browser until you export them.</div>`;
  state.threads.forEach((thread) => {
    const first = thread.messages[0];
    const item = document.createElement("button");
    item.type = "button";
    item.className = `mockmark-list-item${thread.resolvedAt ? " is-resolved" : ""}`;
    item.innerHTML = `<span class="mockmark-list-num">${threadLabel(thread)}</span><span><b>${escapeHtml(first?.body || "Comment")}</b><small>${escapeHtml(thread.authorName)} · ${thread.messageCount} message${thread.messageCount === 1 ? "" : "s"}${thread.resolvedAt ? " · resolved" : ""}</small></span>`;
    item.addEventListener("click", () => { state.listOpen = false; openThread(thread.threadId); });
    box.append(item);
  });
}
function renderToolbar() {
  document.querySelector(".mockmark-toggle")?.classList.toggle("is-on", state.annotating);
  document.querySelector(".mockmark-hide")?.classList.toggle("is-on", state.hidden);
  document.querySelector(".mockmark-list")?.classList.toggle("is-on", state.listOpen);
  const hiddenLabel = document.querySelector(".mockmark-hide span");
  if (hiddenLabel) hiddenLabel.textContent = state.hidden ? "Show" : "Hide";
}
function render() { refreshThreads(); renderPins(); renderPanel(); renderToolbar(); }
function setError(message) { const error = document.querySelector(".mockmark-error"); if (error) { error.textContent = message; error.hidden = !message; } }
function openThread(threadId) { state.activeThreadId = threadId; state.listOpen = false; render(); }
function toggleAnnotating() { state.annotating = !state.annotating; document.body.classList.toggle("mockmark-annotating", state.annotating); renderToolbar(); }
function toggleHidden() { state.hidden = !state.hidden; localStorage.setItem("mockmarkHidden", state.hidden ? "1" : "0"); render(); }
function toggleList() { state.listOpen = !state.listOpen; render(); }
function normalizedRegion(start, end) {
  const size = pageSize();
  const left = Math.min(start.pageX, end.pageX), top = Math.min(start.pageY, end.pageY), widthPx = Math.abs(end.pageX - start.pageX), heightPx = Math.abs(end.pageY - start.pageY);
  if (widthPx < MIN_REGION_PX || heightPx < MIN_REGION_PX) return { x: end.pageX / size.width, y: end.pageY / size.height };
  return { x: left / size.width, y: top / size.height, width: widthPx / size.width, height: heightPx / size.height };
}
function renderDraft(region) {
  document.querySelector(".mockmark-draft")?.remove();
  if (!region?.width || !region?.height) return;
  const size = pageSize();
  const draft = document.createElement("div");
  draft.className = "mockmark-draft";
  Object.assign(draft.style, { left: `${region.x * size.width}px`, top: `${region.y * size.height}px`, width: `${region.width * size.width}px`, height: `${region.height * size.height}px` });
  document.body.append(draft);
}
function closeComposer() { state.draftRegion = null; state.dragStart = null; document.querySelector(".mockmark-draft")?.remove(); document.querySelector(".mockmark-composer").hidden = true; }
function createThread(event) {
  event.preventDefault();
  try {
    const data = normalizeData(state.data);
    const form = event.currentTarget;
    const now = Date.now();
    const thread = { threadId: uuid(), mockPath: state.mockPath, ...state.draftRegion, authorName: cleanAuthor(form), createdAt: now, updatedAt: now };
    const message = { messageId: uuid(), threadId: thread.threadId, authorName: thread.authorName, body: cleanBody(new FormData(form).get("body")), createdAt: now };
    data.threads.push(thread); data.messages.push(message); state.data = data; saveData(); form.reset(); updateAuthorFields(); closeComposer(); openThread(thread.threadId);
  } catch (error) { setError(error.message); document.querySelector(".mockmark-panel").hidden = false; }
}
function reply(event) {
  event.preventDefault();
  try {
    const data = normalizeData(state.data);
    const thread = data.threads.find((item) => item.threadId === state.activeThreadId && !item.deletedAt);
    if (!thread || thread.resolvedAt) throw new Error(thread ? "Thread is resolved." : "Thread not found.");
    const form = event.currentTarget;
    const now = Date.now();
    data.messages.push({ messageId: uuid(), threadId: thread.threadId, authorName: cleanAuthor(form), body: cleanBody(new FormData(form).get("body")), createdAt: now });
    thread.updatedAt = now; state.data = data; saveData(); form.reset(); updateAuthorFields(); render();
  } catch (error) { setError(error.message); }
}
function react(event) {
  try {
    const data = normalizeData(state.data);
    const messageId = event.currentTarget.dataset.message;
    const emoji = event.currentTarget.dataset.emoji;
    const authorName = cleanAuthor();
    const index = data.reactions.findIndex((item) => item.messageId === messageId && item.emoji === emoji && item.authorName === authorName);
    if (index >= 0) data.reactions.splice(index, 1);
    else data.reactions.push({ reactionId: uuid(), messageId, authorName, emoji, createdAt: Date.now() });
    state.data = data; saveData(); render();
  } catch (error) { setError(error.message); }
}
function ownedThread() {
  const data = normalizeData(state.data);
  const thread = data.threads.find((item) => item.threadId === state.activeThreadId && !item.deletedAt);
  const authorName = cleanAuthor();
  if (!thread) throw new Error("Thread not found.");
  if (thread.authorName !== authorName) throw new Error("Only the thread owner can do that.");
  return { data, thread, authorName };
}
function resolveThread() {
  try {
    const { data, thread, authorName } = ownedThread();
    const now = Date.now();
    if (thread.resolvedAt) { delete thread.resolvedAt; delete thread.resolvedBy; }
    else { thread.resolvedAt = now; thread.resolvedBy = authorName; }
    thread.updatedAt = now; state.data = data; saveData(); render();
  } catch (error) { setError(error.message); }
}
function deleteThread() {
  try {
    const { data, thread, authorName } = ownedThread();
    const now = Date.now();
    thread.deletedAt = now; thread.deletedBy = authorName; thread.updatedAt = now; state.data = data; saveData(); state.activeThreadId = null; render();
  } catch (error) { setError(error.message); }
}
function exportData() {
  const blob = new Blob([JSON.stringify({ ...normalizeData(state.data), exportedAt: Date.now() }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `mockmark-${state.mockPath.replace(/[^a-z0-9._-]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function importData() { document.querySelector(".mockmark-import-input").click(); }
function mergeById(existing, incoming, key) {
  const map = new Map(existing.map((item) => [item[key], item]));
  incoming.forEach((item) => map.set(item[key], { ...map.get(item[key]), ...item }));
  return [...map.values()];
}
function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = normalizeData(JSON.parse(String(reader.result || "{}")));
      const current = normalizeData(state.data);
      state.data = {
        version: 1,
        threads: mergeById(current.threads, incoming.threads, "threadId"),
        messages: mergeById(current.messages, incoming.messages, "messageId"),
        reactions: mergeById(current.reactions, incoming.reactions, "reactionId"),
      };
      saveData(); render(); setError("");
    } catch (error) { setError(`Import failed: ${error.message}`); }
  };
  reader.readAsText(file);
  event.target.value = "";
}
function chrome() {
  document.body.insertAdjacentHTML("beforeend", `<div class="mockmark-toolbar"><button class="mockmark-toggle" type="button" title="Comment (C)"><span>Comment</span><kbd>C</kbd></button><button class="mockmark-list" type="button" title="All comments (L)"><span>All</span><kbd>L</kbd></button><button class="mockmark-hide" type="button" title="Hide comments (H)"><span>Hide</span><kbd>H</kbd></button><button class="mockmark-export" type="button" title="Export private comments"><span>Export</span></button><button class="mockmark-import" type="button" title="Import comments"><span>Import</span></button><input class="mockmark-import-input" type="file" accept="application/json" hidden></div><aside class="mockmark-panel" hidden><div class="mockmark-head"><div><div class="mockmark-title">Comment</div><div class="mockmark-muted mockmark-subtitle"></div></div><button type="button" data-close>×</button></div><div class="mockmark-error" hidden></div><div class="mockmark-messages"></div><form class="mockmark-form" data-reply><label class="mockmark-author-row"><span>Your name</span><input name="author" placeholder="Your name" value="${escapeHtml(state.authorName)}"></label><textarea name="body" placeholder="Reply…" required></textarea><div class="mockmark-actions"><button class="primary" type="submit">Send</button></div></form></aside><aside class="mockmark-composer" hidden><div class="mockmark-head"><div>New comment</div><button type="button" data-cancel>×</button></div><div class="mockmark-muted" data-region-copy>Click or drag on the mock, then leave feedback. Stored locally in this browser.</div><form class="mockmark-form" data-new><label class="mockmark-author-row"><span>Your name</span><input name="author" placeholder="Your name" value="${escapeHtml(state.authorName)}"></label><textarea name="body" placeholder="Leave feedback…" required></textarea><div class="mockmark-actions"><button type="button" data-cancel>Cancel</button><button class="primary" type="submit">Post</button></div></form></aside>`);
  document.querySelector(".mockmark-toggle").addEventListener("click", toggleAnnotating);
  document.querySelector(".mockmark-hide").addEventListener("click", toggleHidden);
  document.querySelector(".mockmark-list").addEventListener("click", toggleList);
  document.querySelector(".mockmark-export").addEventListener("click", exportData);
  document.querySelector(".mockmark-import").addEventListener("click", importData);
  document.querySelector(".mockmark-import-input").addEventListener("change", handleImport);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => { state.activeThreadId = null; state.listOpen = false; render(); }));
  document.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", closeComposer));
  document.querySelector("[data-reply]").addEventListener("submit", reply);
  document.querySelector("[data-new]").addEventListener("submit", createThread);
  updateAuthorFields();
}
function init() {
  chrome();
  document.addEventListener("pointerdown", (event) => { if (!state.annotating || isUi(event.target) || event.button !== 0) return; state.dragStart = { pageX: event.pageX, pageY: event.pageY }; }, true);
  document.addEventListener("pointermove", (event) => { if (state.dragStart) renderDraft(normalizedRegion(state.dragStart, { pageX: event.pageX, pageY: event.pageY })); }, true);
  document.addEventListener("pointerup", (event) => {
    if (!state.annotating || !state.dragStart || isUi(event.target)) { state.dragStart = null; return; }
    event.preventDefault(); event.stopPropagation(); state.draftRegion = normalizedRegion(state.dragStart, { pageX: event.pageX, pageY: event.pageY }); state.dragStart = null; renderDraft(state.draftRegion);
    const composer = document.querySelector(".mockmark-composer"); composer.hidden = false;
    composer.querySelector("[data-region-copy]").textContent = state.draftRegion.width ? "Section selected. Add a local/private comment for this marked area." : "Point selected. Add a local/private comment for this spot.";
    composer.querySelector("textarea").focus();
  }, true);
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (key === "c") { event.preventDefault(); toggleAnnotating(); }
    if (key === "h") { event.preventDefault(); toggleHidden(); }
    if (key === "l") { event.preventDefault(); toggleList(); }
  });
  window.addEventListener("resize", () => { renderPins(); renderDraft(state.draftRegion); });
  render();
}
init();
