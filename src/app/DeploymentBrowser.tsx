import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type BrowserFile = {
  path: string;
  contentType: string;
  size: number;
  pageId?: Id<"pages">;
  conversations: number;
  open: number;
  resolved: number;
};

type TreeNode = {
  name: string;
  path: string;
  kind: "folder" | "file";
  children: TreeNode[];
  file?: BrowserFile;
};

export function DeploymentBrowser({
  deploymentId,
  projectId,
  onBack,
}: {
  deploymentId: Id<"mockDeployments">;
  projectId: Id<"projects">;
  onBack: () => void;
}) {
  const result = useQuery(api.deployments.browse, { deploymentId });
  const [selectedPath, setSelectedPath] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "open" | "resolved">("all");
  const [copied, setCopied] = useState(false);
  const selectedFile = result?.files.find((file) => file.path === selectedPath)
    ?? result?.files.find(isHtml)
    ?? result?.files[0];
  const feedback = useQuery(
    api.publicApi.feedbackForDashboard,
    selectedFile?.pageId ? { projectId, pageId: selectedFile.pageId, unresolvedOnly: false } : "skip",
  );

  if (!result || !selectedFile) return <div className="centered">Loading deployment…</div>;

  const deployment = result.deployment;
  const htmlCount = result.files.filter(isHtml).length;
  const tree = buildTree(result.files, search);
  const shareUrl = hostedShareUrl(deployment.deploymentKey, selectedFile.path);
  const threads = (feedback?.threads ?? []).filter((thread) =>
    feedbackFilter === "all" || (feedbackFilter === "resolved" ? thread.resolvedAt : !thread.resolvedAt),
  );
  const label = deployment.label || deployment.commitSha?.slice(0, 8) || "Mock deployment";

  function toggleFolder(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function copyLink() {
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="deployment-browser">
      <header className="deployment-browser-head">
        <div>
          <button className="back" onClick={onBack}>← Deployments</button>
          <p className="eyebrow">Hosted mock</p>
          <h1>{label}</h1>
        </div>
        <div className="deployment-build-meta">
          <span className="deployment-live-dot" />
          <span>
            <b>Current build</b>
            <small>{deployment.commitSha?.slice(0, 8) || deployment.deploymentKey.slice(0, 12)}{deployment.branch ? ` · ${deployment.branch}` : ""}</small>
          </span>
          <small>{result.files.length} files · {htmlCount} pages</small>
        </div>
      </header>

      <div className="deployment-browser-grid">
        <aside className="deployment-file-pane">
          <div className="deployment-pane-title">
            <div><h2>Files</h2><span>{result.files.length} files · {htmlCount} pages</span></div>
          </div>
          <label className="deployment-search">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files…" />
          </label>
          <div className="deployment-tree">
            {tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedFile.path}
                collapsed={collapsed}
                onToggle={toggleFolder}
                onSelect={setSelectedPath}
              />
            ))}
            {!tree.length ? <p className="deployment-tree-empty">No matching files.</p> : null}
          </div>
        </aside>

        <main className="deployment-preview-pane">
          <header className="deployment-preview-head">
            <div>
              <Breadcrumb path={selectedFile.path} label={label} />
              <h2>{selectedFile.path.split("/").at(-1)}</h2>
            </div>
            {isHtml(selectedFile) ? (
              <div>
                <button onClick={copyLink}>{copied ? "✓ Copied" : "Copy link"}</button>
                <a className="deployment-open-button" href={shareUrl} target="_blank" rel="noreferrer">Open ↗</a>
              </div>
            ) : null}
          </header>
          {isHtml(selectedFile) ? (
            <div className="deployment-preview-stage">
              <iframe key={selectedFile.path} src={shareUrl} title={`Preview ${selectedFile.path}`} />
            </div>
          ) : (
            <AssetDetail file={selectedFile} />
          )}
        </main>

        <aside className="deployment-feedback-pane">
          {isHtml(selectedFile) ? (
            <>
              <div className="deployment-feedback-title">
                <div><h2>Feedback</h2><span>{selectedFile.conversations} conversations</span></div>
              </div>
              <div className="deployment-feedback-tabs">
                {(["all", "open", "resolved"] as const).map((item) => (
                  <button key={item} className={feedbackFilter === item ? "active" : ""} onClick={() => setFeedbackFilter(item)}>
                    {item} <span>{item === "all" ? selectedFile.conversations : selectedFile[item]}</span>
                  </button>
                ))}
              </div>
              <div className="deployment-thread-list">
                {threads.map((thread, index) => (
                  <article key={thread._id}>
                    <span className="deployment-thread-pin">{index + 1}</span>
                    <div>
                      <header><b>{thread.authorName}</b><time>{new Date(thread.updatedAt).toLocaleDateString()}</time></header>
                      <p>{thread.messages[0]?.body || "Conversation"}</p>
                      <footer className={thread.resolvedAt ? "resolved" : "open"}>{thread.resolvedAt ? "✓ Resolved" : "● Open"}</footer>
                    </div>
                  </article>
                ))}
                {!threads.length ? (
                  <div className="deployment-no-feedback">
                    <span>✓</span><b>No {feedbackFilter === "all" ? "feedback" : feedbackFilter + " feedback"}</b>
                    <p>{selectedFile.conversations ? "Try another feedback filter." : "This page is ready for its first review."}</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="deployment-asset-aside"><span>Supporting asset</span><p>Feedback belongs to reviewable HTML pages.</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}

function TreeRow({
  node,
  depth,
  selectedPath,
  collapsed,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  if (node.kind === "folder") {
    const isCollapsed = collapsed.has(node.path);
    return (
      <div>
        <button className="deployment-folder-row" style={{ paddingLeft: 8 + depth * 16 }} onClick={() => onToggle(node.path)}>
          <span>{isCollapsed ? "›" : "⌄"}</span><b>▰ {node.name}</b><small>{countFiles(node)}</small>
        </button>
        {!isCollapsed ? node.children.map((child) => (
          <TreeRow key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} />
        )) : null}
      </div>
    );
  }
  const file = node.file!;
  const kind = fileKind(file);
  return (
    <button className={`deployment-file-row ${selectedPath === file.path ? "active" : ""}`} style={{ paddingLeft: 13 + depth * 16 }} onClick={() => onSelect(file.path)}>
      <span className={`deployment-file-icon ${kind}`}>{fileIcon(kind)}</span>
      <span><b>{node.name}</b><small>{kind === "html" ? "Reviewable page" : file.contentType.split(";", 1)[0]}</small></span>
      {kind === "html" ? <span className="deployment-counts" title={`${file.conversations} conversations, ${file.open} open, ${file.resolved} resolved`}><i>{file.conversations}</i><i className="open">{file.open}</i><i className="resolved">{file.resolved}</i></span> : null}
    </button>
  );
}

function Breadcrumb({ path, label }: { path: string; label: string }) {
  return <div className="deployment-breadcrumb"><span>{label}</span>{path.split("/").map((part) => <span key={part}><i>/</i>{part}</span>)}</div>;
}

function AssetDetail({ file }: { file: BrowserFile }) {
  const kind = fileKind(file);
  return (
    <div className="deployment-asset-detail">
      <span className={`deployment-file-icon ${kind}`}>{fileIcon(kind)}</span>
      <h2>{file.path.split("/").at(-1)}</h2>
      <p>{file.path}</p>
      <dl><div><dt>Type</dt><dd>{file.contentType}</dd></div><div><dt>Size</dt><dd>{formatBytes(file.size)}</dd></div></dl>
    </div>
  );
}

export function buildTree(files: BrowserFile[], search: string): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "folder", children: [] };
  const term = search.trim().toLowerCase();
  for (const file of files) {
    if (term && !file.path.toLowerCase().includes(term)) continue;
    const parts = file.path.split("/");
    let parent = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const last = index === parts.length - 1;
      let node = parent.children.find((child) => child.name === part);
      if (!node) {
        node = { name: part, path, kind: last ? "file" : "folder", children: [], file: last ? file : undefined };
        parent.children.push(node);
      }
      parent = node;
    });
  }
  sortTree(root);
  return root.children;
}

function sortTree(node: TreeNode) {
  node.children.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1);
  node.children.forEach(sortTree);
}

function countFiles(node: TreeNode): number {
  return node.kind === "file" ? 1 : node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function isHtml(file: BrowserFile) {
  return file.contentType.split(";", 1)[0] === "text/html";
}

function fileKind(file: BrowserFile) {
  const extension = file.path.split(".").at(-1)?.toLowerCase();
  if (isHtml(file)) return "html";
  if (extension === "css") return "css";
  if (["js", "mjs", "json", "map"].includes(extension || "")) return "code";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(extension || "")) return "image";
  return "document";
}

function fileIcon(kind: string) {
  if (kind === "html") return "H";
  if (kind === "css") return "#";
  if (kind === "code") return "JS";
  if (kind === "image") return "▧";
  return "≡";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hostedShareUrl(deploymentKey: string, path: string) {
  const url = new URL(location.origin);
  url.searchParams.set("deployment", deploymentKey);
  url.searchParams.set("path", path);
  return url.toString();
}
