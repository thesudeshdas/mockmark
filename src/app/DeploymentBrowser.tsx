import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type BrowserFile = {
  path: string;
  contentType: string;
  size: number;
  pageIds: Id<"pages">[];
  conversations: number;
  open: number;
  resolved: number;
  status: MockStatus;
};

export type MockStatus = "mocking" | "ready_to_review" | "in_review" | "reviewed" | "archived";
export type MockStatusFilter = "active" | "all" | MockStatus;

export const MOCK_STATUS_LABELS: Record<MockStatus, string> = {
  mocking: "Mocking",
  ready_to_review: "Ready to review",
  in_review: "In review",
  reviewed: "Reviewed",
  archived: "Archived",
};

const MOCK_STATUSES = Object.keys(MOCK_STATUS_LABELS) as MockStatus[];
const ACTIVE_STATUSES = new Set<MockStatus>(["mocking", "ready_to_review", "in_review"]);

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
  onSettings,
  historyMode = false,
}: {
  deploymentId: Id<"mockDeployments">;
  projectId: Id<"projects">;
  onBack?: () => void;
  onSettings?: () => void;
  historyMode?: boolean;
}) {
  const result = useQuery(api.deployments.browse, { deploymentId });
  const [selectedPath, setSelectedPath] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "open" | "resolved">("all");
  const [statusFilter, setStatusFilter] = useState<MockStatusFilter>("active");
  const [copied, setCopied] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);
  const setMockStatus = useMutation(api.mockLifecycle.setStatus);
  const reviewableFiles = result?.files.filter(isHtml) ?? [];
  const filteredFiles = reviewableFiles.filter((file) => matchesStatusFilter(file.status, statusFilter));
  const selectedFile = filteredFiles.find((file) => file.path === selectedPath)
    ?? filteredFiles[0];
  const feedback = useQuery(
    api.publicApi.feedbackForDashboard,
    selectedFile?.pageIds.length ? { projectId, pageIds: selectedFile.pageIds, unresolvedOnly: false } : "skip",
  );

  if (!result) return <div className="centered">Loading deployment…</div>;
  if (!reviewableFiles.length) return <div className="centered">No HTML mockups in this deployment.</div>;

  const deployment = result.deployment;
  const htmlCount = reviewableFiles.length;
  const tree = buildTree(filteredFiles, search);
  const shareUrl = selectedFile ? hostedShareUrl(deployment.deploymentKey, selectedFile.path) : "";
  const threads = (feedback?.threads ?? []).filter((thread) =>
    feedbackFilter === "all" || (feedbackFilter === "resolved" ? thread.resolvedAt : !thread.resolvedAt),
  );
  const label = deployment.label || deployment.commitSha?.slice(0, 8) || "Mock deployment";
  const statusCounts = countMockStatuses(reviewableFiles);

  function toggleFolder(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function changeMockStatus(status: MockStatus) {
    if (!selectedFile) return;
    setStatusError("");
    setChangingStatus(true);
    try {
      await setMockStatus({ projectId, path: selectedFile.path, status });
    } catch (reason) {
      setStatusError(errorMessage(reason));
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <section className={`deployment-browser ${historyMode ? "with-history-head" : ""}`}>
      {historyMode ? <header className="deployment-browser-head">
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
          <small>{htmlCount} mockups</small>
        </div>
      </header> : null}

      <div className="deployment-browser-grid">
        <aside className="deployment-file-pane">
          <div className="deployment-pane-title">
            <div><h2>Mockups</h2><span>{htmlCount} HTML pages · {deployment.commitSha?.slice(0, 8) || "current"}</span></div>
          </div>
          <label className="deployment-status-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MockStatusFilter)}>
              <option value="active">Active ({countActiveStatuses(statusCounts)})</option>
              <option value="all">All ({htmlCount})</option>
              {MOCK_STATUSES.map((status) => (
                <option value={status} key={status}>{MOCK_STATUS_LABELS[status]} ({statusCounts[status]})</option>
              ))}
            </select>
          </label>
          <label className="deployment-search">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mockups…" />
          </label>
          <div className="deployment-tree">
            {tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedFile?.path ?? ""}
                collapsed={collapsed}
                onToggle={toggleFolder}
                onSelect={setSelectedPath}
              />
            ))}
            {!tree.length ? <p className="deployment-tree-empty">No matching mockups.</p> : null}
          </div>
        </aside>

        <main className="deployment-preview-pane">
          {selectedFile ? <>
          <header className="deployment-preview-head">
            <div>
              <Breadcrumb path={selectedFile.path} label={label} />
              <h2>{selectedFile.path.split("/").at(-1)}</h2>
            </div>
            <div>
              <MockStatusControl
                status={selectedFile.status}
                role={result.projectRole}
                disabled={changingStatus}
                onChange={(status) => void changeMockStatus(status)}
              />
              {onSettings ? <button onClick={onSettings}>Project settings</button> : null}
              <button onClick={copyLink}>{copied ? "✓ Copied" : "Copy link"}</button>
              <a className="deployment-open-button" href={shareUrl} target="_blank" rel="noreferrer">Open ↗</a>
            </div>
          </header>
          <div className="deployment-preview-stage">
            <iframe key={selectedFile.path} src={shareUrl} title={`Preview ${selectedFile.path}`} />
          </div>
          {statusError ? <p className="deployment-status-error">{statusError}</p> : null}
          </> : <div className="deployment-filter-empty"><b>No matching mocks</b><span>Choose another lifecycle status.</span></div>}
        </main>

        <aside className="deployment-feedback-pane">
          {selectedFile ? <>
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
          </> : <div className="deployment-filter-empty"><span>Feedback appears after selecting a mock.</span></div>}
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
  return (
    <button className={`deployment-file-row ${selectedPath === file.path ? "active" : ""}`} style={{ paddingLeft: 13 + depth * 16 }} onClick={() => onSelect(file.path)}>
      <span className="deployment-file-icon html">H</span>
      <span><b>{node.name}</b><small><i className={`mock-status-badge ${file.status}`}>{MOCK_STATUS_LABELS[file.status]}</i></small></span>
      <span className="deployment-counts" title={`${file.conversations} conversations, ${file.open} open, ${file.resolved} resolved`}><i>{file.conversations}</i><i className="open">{file.open}</i><i className="resolved">{file.resolved}</i></span>
    </button>
  );
}

function MockStatusControl({
  status,
  role,
  disabled,
  onChange,
}: {
  status: MockStatus;
  role: "admin" | "commenter" | "viewer";
  disabled: boolean;
  onChange: (status: MockStatus) => void;
}) {
  const options = availableManualStatuses(role, status);
  if (!options.length)
    return <span className={`mock-status-badge prominent ${status}`}>{MOCK_STATUS_LABELS[status]}</span>;
  return (
    <label className="mock-status-control">
      <span>Status</span>
      <select
        value={status}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as MockStatus)}
      >
        {!options.includes(status) ? <option value={status} disabled>{MOCK_STATUS_LABELS[status]}</option> : null}
        {options.map((option) => <option value={option} key={option}>{MOCK_STATUS_LABELS[option]}</option>)}
      </select>
    </label>
  );
}

export function availableManualStatuses(
  role: "admin" | "commenter" | "viewer",
  current: MockStatus,
) {
  if (role === "viewer" || (current === "archived" && role !== "admin")) return [];
  return role === "admin"
    ? (["mocking", "ready_to_review", "reviewed", "archived"] as MockStatus[])
    : (["mocking", "ready_to_review"] as MockStatus[]);
}

export function matchesStatusFilter(status: MockStatus, filter: MockStatusFilter) {
  return filter === "all" || (filter === "active" ? ACTIVE_STATUSES.has(status) : status === filter);
}

function countMockStatuses(files: BrowserFile[]) {
  const counts: Record<MockStatus, number> = {
    mocking: 0,
    ready_to_review: 0,
    in_review: 0,
    reviewed: 0,
    archived: 0,
  };
  for (const file of files) counts[file.status] += 1;
  return counts;
}

function countActiveStatuses(counts: Record<MockStatus, number>) {
  return counts.mocking + counts.ready_to_review + counts.in_review;
}

function Breadcrumb({ path, label }: { path: string; label: string }) {
  return <div className="deployment-breadcrumb"><span>{label}</span>{path.split("/").map((part) => <span key={part}><i>/</i>{part}</span>)}</div>;
}

export function buildTree(files: BrowserFile[], search: string): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "folder", children: [] };
  const term = search.trim().toLowerCase();
  for (const file of files) {
    if (!isHtml(file)) continue;
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

function hostedShareUrl(deploymentKey: string, path: string) {
  const url = new URL(location.origin);
  url.searchParams.set("deployment", deploymentKey);
  url.searchParams.set("path", path);
  return url.toString();
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Status could not be updated.";
}
