import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type Config = {
  projectKey: string;
  convexUrl: string;
  appUrl?: string;
  buildKey?: string;
  branch?: string;
  commitSha?: string;
};
type Message = {
  _id: string;
  authorName: string;
  authorEmail?: string;
  body: string;
  createdAt: number;
  reactions: Array<{ _id: string; emoji: string; authorName: string }>;
};
type Thread = {
  _id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  authorName: string;
  updatedAt: number;
  resolvedAt?: number;
  messages: Message[];
};
type Feedback = { threads: Thread[]; fetchedAt: number };
type Region = { x: number; y: number; width?: number; height?: number };

declare global {
  interface Window {
    MockmarkConfig?: Partial<Config>;
  }
}

const readRef = makeFunctionReference<"action", any, Feedback>(
  "publicApi:readReview",
);
const createRef = makeFunctionReference<"action", any, string>(
  "publicApi:createThread",
);
const replyRef = makeFunctionReference<"action", any, string>(
  "publicApi:reply",
);
const resolveRef = makeFunctionReference<"action", any, void>(
  "publicApi:setResolved",
);
const reactionRef = makeFunctionReference<"action", any, boolean>(
  "publicApi:toggleReaction",
);
const REACTIONS = ["👍", "👀", "✅", "❤️"];

class MockmarkEmbed {
  private config: Config;
  private client: ConvexHttpClient;
  private host: HTMLElement;
  private root: ShadowRoot;
  private token = "";
  private feedback: Feedback = { threads: [], fetchedAt: 0 };
  private activeId: string | null = null;
  private annotating = false;
  private hidden = false;
  private listOpen = false;
  private draft: Region | null = null;
  private dragStart: { pageX: number; pageY: number } | null = null;
  private authorName = localStorage.getItem("mockmark.authorName") ?? "";
  private authorEmail = localStorage.getItem("mockmark.authorEmail") ?? "";
  private timer?: number;

  constructor(config: Config) {
    this.config = config;
    this.client = new ConvexHttpClient(config.convexUrl);
    this.host = document.createElement("mockmark-review");
    this.host.style.cssText =
      "position:absolute;inset:0 auto auto 0;width:100%;z-index:2147483000;pointer-events:none;";
    this.root = this.host.attachShadow({ mode: "open" });
    document.body.append(this.host);
    this.captureToken();
    this.bindDocument();
    this.render();
    if (this.token) void this.refresh();
  }

  private captureToken() {
    const url = new URL(location.href);
    const queryToken = url.searchParams.get("mockmark_token");
    if (queryToken) {
      sessionStorage.setItem(
        `mockmark.token.${this.config.projectKey}`,
        queryToken,
      );
      url.searchParams.delete("mockmark_token");
      history.replaceState(history.state, "", url);
    }
    this.token =
      queryToken ??
      sessionStorage.getItem(`mockmark.token.${this.config.projectKey}`) ??
      "";
  }

  private pageKey() {
    return `${location.host}${location.pathname}`.slice(0, 240);
  }
  private pageSize() {
    const doc = document.documentElement;
    return {
      width: Math.max(doc.scrollWidth, 1),
      height: Math.max(doc.scrollHeight, 1),
    };
  }
  private async refresh() {
    try {
      this.feedback = await this.client.action(readRef, {
        token: this.token,
        projectKey: this.config.projectKey,
        pageKey: this.pageKey(),
      });
      this.render();
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.refresh(), 4000);
    } catch (reason) {
      this.setError(messageOf(reason));
      if (/access.*invalid|expired/i.test(messageOf(reason))) {
        this.token = "";
        this.feedback = { threads: [], fetchedAt: 0 };
        this.activeId = null;
        this.listOpen = false;
        this.draft = null;
        sessionStorage.removeItem(`mockmark.token.${this.config.projectKey}`);
        this.render();
      }
    }
  }

  private bindDocument() {
    document.addEventListener("keydown", (event) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      )
        return;
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        this.annotating = !this.annotating;
        this.render();
      }
      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        this.listOpen = !this.listOpen;
        this.render();
      }
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        this.hidden = !this.hidden;
        this.render();
      }
      if (event.key === "Escape") {
        this.activeId = null;
        this.draft = null;
        this.listOpen = false;
        this.render();
      }
    });
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !this.annotating ||
          !this.token ||
          event.button !== 0 ||
          composedInMockmark(event)
        )
          return;
        this.dragStart = { pageX: event.pageX, pageY: event.pageY };
      },
      true,
    );
    document.addEventListener(
      "pointerup",
      (event) => {
        if (!this.dragStart || composedInMockmark(event)) {
          this.dragStart = null;
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.draft = normalizeRegion(
          this.dragStart,
          { pageX: event.pageX, pageY: event.pageY },
          this.pageSize(),
        );
        this.dragStart = null;
        this.render();
      },
      true,
    );
    window.addEventListener("resize", () => this.render());
  }

  private render() {
    const size = this.pageSize();
    this.host.style.height = `${size.height}px`;
    const active = this.feedback.threads.find(
      (thread) => thread._id === this.activeId,
    );
    const markers = this.hidden
      ? ""
      : this.feedback.threads
          .map((thread, index) =>
            thread.width && thread.height
              ? `<button class="mm-region${thread.resolvedAt ? " resolved" : ""}" data-thread="${thread._id}" style="left:${thread.x * size.width}px;top:${thread.y * size.height}px;width:${thread.width * size.width}px;height:${thread.height * size.height}px"><span>${index + 1}</span></button>`
              : `<button class="mm-pin${thread.resolvedAt ? " resolved" : ""}" data-thread="${thread._id}" style="left:${thread.x * size.width}px;top:${thread.y * size.height}px">${index + 1}</button>`,
          )
          .join("");
    this.root.innerHTML = `<style>${styles}</style><div class="mm-root">${markers}${this.draft ? draftHtml(this.draft, size) : ""}<div class="mm-toolbar"><button data-do="annotate" class="${this.annotating ? "on" : ""}">Comment <kbd>C</kbd></button><button data-do="list" class="${this.listOpen ? "on" : ""}">All <kbd>L</kbd></button><button data-do="hide">${this.hidden ? "Show" : "Hide"} <kbd>H</kbd></button></div>${!this.token ? this.accessHtml() : ""}${this.draft ? this.composerHtml() : ""}${this.listOpen ? this.listHtml() : active ? this.threadHtml(active) : ""}<div class="mm-toast" hidden></div></div>`;
    this.bindUi();
  }

  private accessHtml() {
    return `<aside class="mm-panel mm-access"><button class="mm-x" data-do="close">×</button><b>Open this review</b><p>Paste review token from your Mockmark project admin.</p><form data-form="access"><input name="token" type="password" placeholder="mmr_…" required><button class="primary">Open review</button></form></aside>`;
  }
  private composerHtml() {
    return `<aside class="mm-panel"><button class="mm-x" data-do="cancel">×</button><b>New comment</b><p>${this.draft?.width ? "Region selected." : "Point selected."}</p><form data-form="new">${this.identityHtml()}<textarea name="body" placeholder="Leave feedback…" maxlength="4000" required></textarea><button class="primary">Post comment</button></form></aside>`;
  }
  private listHtml() {
    return `<aside class="mm-panel"><button class="mm-x" data-do="close">×</button><b>All comments</b><p>${this.feedback.threads.length} conversations on this page</p><div class="mm-list">${this.feedback.threads.map((thread, index) => `<button data-thread="${thread._id}"><span>${index + 1}</span><div><b>${escapeHtml(thread.messages[0]?.body ?? "Comment")}</b><small>${escapeHtml(thread.authorName)} · ${thread.messages.length} messages${thread.resolvedAt ? " · resolved" : ""}</small></div></button>`).join("") || `<div class="mm-empty">No comments yet.</div>`}</div></aside>`;
  }
  private threadHtml(thread: Thread) {
    return `<aside class="mm-panel"><button class="mm-x" data-do="close">×</button><b>Conversation ${this.feedback.threads.indexOf(thread) + 1}</b><p>${thread.resolvedAt ? "Resolved" : `${thread.messages.length} messages`}</p><div class="mm-messages">${thread.messages
      .map(
        (message) =>
          `<article><header><b>${escapeHtml(message.authorName)}</b><time>${formatDate(message.createdAt)}</time></header><div>${escapeHtml(message.body)}</div><footer>${REACTIONS.map(
            (emoji) => {
              const count = message.reactions.filter(
                (reaction) => reaction.emoji === emoji,
              ).length;
              return `<button data-react="${message._id}" data-emoji="${emoji}">${emoji}${count ? ` ${count}` : ""}</button>`;
            },
          ).join("")}</footer></article>`,
      )
      .join(
        "",
      )}</div><div class="mm-actions"><button data-resolve="${thread._id}">${thread.resolvedAt ? "Reopen" : "Resolve"}</button></div>${thread.resolvedAt ? "" : `<form data-form="reply">${this.identityHtml()}<textarea name="body" placeholder="Reply…" maxlength="4000" required></textarea><button class="primary">Send</button></form>`}</aside>`;
  }
  private identityHtml() {
    return `<div class="mm-identity"><input name="authorName" value="${escapeHtml(this.authorName)}" placeholder="Your name" required minlength="2"><input name="authorEmail" value="${escapeHtml(this.authorEmail)}" placeholder="Email (optional)" type="email"></div>`;
  }

  private bindUi() {
    this.root.querySelectorAll<HTMLElement>("[data-thread]").forEach((button) =>
      button.addEventListener("click", () => {
        this.activeId = button.dataset.thread!;
        this.listOpen = false;
        this.render();
      }),
    );
    this.root
      .querySelector('[data-do="annotate"]')
      ?.addEventListener("click", () => {
        this.annotating = !this.annotating;
        this.render();
      });
    this.root
      .querySelector('[data-do="list"]')
      ?.addEventListener("click", () => {
        this.listOpen = !this.listOpen;
        this.activeId = null;
        this.render();
      });
    this.root
      .querySelector('[data-do="hide"]')
      ?.addEventListener("click", () => {
        this.hidden = !this.hidden;
        this.render();
      });
    this.root.querySelectorAll('[data-do="close"]').forEach((button) =>
      button.addEventListener("click", () => {
        this.activeId = null;
        this.listOpen = false;
        this.render();
      }),
    );
    this.root
      .querySelector('[data-do="cancel"]')
      ?.addEventListener("click", () => {
        this.draft = null;
        this.render();
      });
    this.root
      .querySelector<HTMLFormElement>('[data-form="access"]')
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        this.token = String(
          new FormData(event.currentTarget as HTMLFormElement).get("token") ?? "",
        ).trim();
        sessionStorage.setItem(
          `mockmark.token.${this.config.projectKey}`,
          this.token,
        );
        void this.refresh();
      });
    this.root
      .querySelector<HTMLFormElement>('[data-form="new"]')
      ?.addEventListener("submit", (event) => void this.create(event));
    this.root
      .querySelector<HTMLFormElement>('[data-form="reply"]')
      ?.addEventListener("submit", (event) => void this.reply(event));
    this.root
      .querySelector<HTMLElement>("[data-resolve]")
      ?.addEventListener(
        "click",
        (event) =>
          void this.resolve(
            (event.currentTarget as HTMLElement).dataset.resolve!,
          ),
      );
    this.root
      .querySelectorAll<HTMLElement>("[data-react]")
      .forEach((button) =>
        button.addEventListener(
          "click",
          () => void this.react(button.dataset.react!, button.dataset.emoji!),
        ),
      );
  }

  private readIdentity(form?: HTMLFormElement) {
    if (form) {
      const data = new FormData(form);
      this.authorName = String(data.get("authorName") ?? "").trim();
      this.authorEmail = String(data.get("authorEmail") ?? "").trim();
      localStorage.setItem("mockmark.authorName", this.authorName);
      localStorage.setItem("mockmark.authorEmail", this.authorEmail);
    }
    if (this.authorName.length < 2) throw new Error("Enter your name first.");
    return {
      authorName: this.authorName,
      authorEmail: this.authorEmail || undefined,
    };
  }
  private async create(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    try {
      const identity = this.readIdentity(form);
      const data = new FormData(form);
      const anchor = anchorAt(this.draft!, this.pageSize());
      const requestId =
        form.dataset.requestId ?? (form.dataset.requestId = crypto.randomUUID());
      await this.client.action(createRef, {
        token: this.token,
        projectKey: this.config.projectKey,
        pageKey: this.pageKey(),
        path: location.pathname,
        title: document.title || location.pathname,
        buildKey: this.config.buildKey,
        branch: this.config.branch,
        commitSha: this.config.commitSha,
        ...this.draft,
        ...anchor,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        requestId,
        ...identity,
        body: String(data.get("body") ?? ""),
      });
      this.draft = null;
      await this.refresh();
    } catch (reason) {
      this.setError(messageOf(reason));
    }
  }
  private async reply(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    try {
      const identity = this.readIdentity(form);
      const requestId =
        form.dataset.requestId ?? (form.dataset.requestId = crypto.randomUUID());
      await this.client.action(replyRef, {
        token: this.token,
        projectKey: this.config.projectKey,
        threadId: this.activeId,
        requestId,
        ...identity,
        body: String(new FormData(form).get("body") ?? ""),
      });
      await this.refresh();
    } catch (reason) {
      this.setError(messageOf(reason));
    }
  }
  private async resolve(threadId: string) {
    try {
      const thread = this.feedback.threads.find(
        (item) => item._id === threadId,
      )!;
      await this.client.action(resolveRef, {
        token: this.token,
        projectKey: this.config.projectKey,
        threadId,
        authorName: this.readIdentity().authorName,
        resolved: !thread.resolvedAt,
      });
      await this.refresh();
    } catch (reason) {
      this.setError(messageOf(reason));
    }
  }
  private async react(messageId: string, emoji: string) {
    try {
      const identity = this.readIdentity();
      await this.client.action(reactionRef, {
        token: this.token,
        projectKey: this.config.projectKey,
        messageId,
        emoji,
        ...identity,
      });
      await this.refresh();
    } catch (reason) {
      this.setError(messageOf(reason));
    }
  }
  private setError(message: string) {
    const toast = this.root.querySelector<HTMLElement>(".mm-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => {
      if (toast) toast.hidden = true;
    }, 5000);
  }
}

function configFromScript(): Config | null {
  const script = document.currentScript as HTMLScriptElement | null;
  const merged = {
    ...window.MockmarkConfig,
    projectKey: script?.dataset.project ?? window.MockmarkConfig?.projectKey,
    convexUrl: script?.dataset.convexUrl ?? window.MockmarkConfig?.convexUrl,
    appUrl: script?.dataset.appUrl ?? window.MockmarkConfig?.appUrl,
    buildKey: script?.dataset.build ?? window.MockmarkConfig?.buildKey,
    branch: script?.dataset.branch ?? window.MockmarkConfig?.branch,
    commitSha: script?.dataset.commit ?? window.MockmarkConfig?.commitSha,
  };
  return merged.projectKey && merged.convexUrl ? (merged as Config) : null;
}
function normalizeRegion(
  start: { pageX: number; pageY: number },
  end: { pageX: number; pageY: number },
  size: { width: number; height: number },
): Region {
  const width = Math.abs(end.pageX - start.pageX),
    height = Math.abs(end.pageY - start.pageY);
  if (width < 12 || height < 12)
    return { x: end.pageX / size.width, y: end.pageY / size.height };
  return {
    x: Math.min(start.pageX, end.pageX) / size.width,
    y: Math.min(start.pageY, end.pageY) / size.height,
    width: width / size.width,
    height: height / size.height,
  };
}
function anchorAt(region: Region, size: { width: number; height: number }) {
  const node = document.elementFromPoint(
    region.x * size.width - scrollX,
    region.y * size.height - scrollY,
  );
  if (!node) return {};
  return {
    selector: selectorFor(node),
    nearbyText: node.textContent?.trim().replace(/\s+/g, " ").slice(0, 500),
  };
}
function selectorFor(node: Element) {
  const parts: string[] = [];
  let current: Element | null = node;
  while (current && current !== document.body && parts.length < 5) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${CSS.escape(current.id)}`;
      parts.unshift(part);
      break;
    }
    const className = [...current.classList]
      .slice(0, 2)
      .map((name) => `.${CSS.escape(name)}`)
      .join("");
    part += className;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}
function draftHtml(region: Region, size: { width: number; height: number }) {
  return region.width && region.height
    ? `<div class="mm-draft" style="left:${region.x * size.width}px;top:${region.y * size.height}px;width:${region.width * size.width}px;height:${region.height * size.height}px"></div>`
    : "";
}
function composedInMockmark(event: Event) {
  return event
    .composedPath()
    .includes(document.querySelector("mockmark-review")!);
}
function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return (
    element?.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName ?? "")
  );
}
function escapeHtml(value: string) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
function messageOf(reason: unknown) {
  if (!(reason instanceof Error)) return "Mockmark request failed.";
  const convex = [...reason.message.matchAll(/(?:Uncaught )?ConvexError:\s*([^\n]+)/g)].at(-1)?.[1];
  return (convex ?? reason.message.split("\n")[0]).replace(/^Uncaught ConvexError:\s*/, "");
}

const styles = `:host{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#24221f}.mm-root{position:absolute;inset:0;pointer-events:none}.mm-root button,.mm-root input,.mm-root textarea{font:inherit}.mm-toolbar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:5px;padding:6px;background:#25231f;border-radius:13px;box-shadow:0 12px 35px #0004;pointer-events:auto}.mm-toolbar button{border:0;background:transparent;color:#eee7da;padding:9px 11px;border-radius:8px}.mm-toolbar button.on{background:#ee5b35;color:#fff}.mm-toolbar kbd{font-size:10px;opacity:.6;margin-left:5px}.mm-pin,.mm-region{position:absolute;pointer-events:auto;background:#ee5b35;color:#fff;border:2px solid #fff;box-shadow:0 2px 10px #0004;font-weight:800}.mm-pin{width:28px;height:28px;border-radius:50%;transform:translate(-50%,-50%)}.mm-region{background:#ee5b3522;border-color:#ee5b35}.mm-region span{position:absolute;left:-14px;top:-14px;display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#ee5b35;color:#fff}.mm-pin.resolved,.mm-region.resolved{opacity:.45}.mm-draft{position:absolute;border:2px dashed #ee5b35;background:#ee5b3518}.mm-panel{position:fixed;right:20px;top:20px;width:min(390px,calc(100vw - 40px));max-height:calc(100vh - 100px);overflow:auto;background:#fff;border:1px solid #ded8cc;border-radius:16px;padding:22px;box-shadow:0 18px 55px #0003;pointer-events:auto}.mm-panel>b{font-size:18px}.mm-panel>p{font-size:12px;color:#756e63}.mm-x{float:right;border:0;background:transparent;font-size:22px}.mm-panel form{display:grid;gap:10px;margin-top:15px}.mm-panel input,.mm-panel textarea{border:1px solid #d8d1c5;border-radius:9px;padding:10px;outline:none}.mm-panel textarea{min-height:90px;resize:vertical}.mm-panel .primary{border:0;border-radius:9px;padding:11px;background:#ee5b35;color:#fff;font-weight:700}.mm-identity{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mm-list{display:grid}.mm-list>button{display:flex;align-items:start;gap:10px;text-align:left;border:0;border-top:1px solid #eee9df;background:#fff;padding:13px 0}.mm-list>button>span{display:grid;place-items:center;min-width:25px;height:25px;border-radius:50%;background:#ee5b35;color:#fff}.mm-list>button div{display:grid;gap:4px}.mm-list small{color:#756e63}.mm-messages article{border-top:1px solid #eee9df;padding:15px 0}.mm-messages header{display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px}.mm-messages time{color:#756e63}.mm-messages article>div{white-space:pre-wrap;line-height:1.5}.mm-messages footer{display:flex;gap:4px;margin-top:10px}.mm-messages footer button,.mm-actions button{border:1px solid #ded8cc;background:#fff;border-radius:8px;padding:5px 8px}.mm-actions{display:flex;justify-content:end}.mm-toast{position:fixed;left:20px;bottom:20px;background:#9d2f1c;color:#fff;padding:12px 15px;border-radius:10px;pointer-events:auto}.mm-empty{padding:25px;text-align:center;color:#756e63}@media(max-width:600px){.mm-panel{inset:12px 12px auto;width:auto;max-height:calc(100vh - 90px)}.mm-toolbar{bottom:12px}.mm-identity{grid-template-columns:1fr}}`;

const config = configFromScript();
if (config && !document.querySelector("mockmark-review"))
  new MockmarkEmbed(config);
