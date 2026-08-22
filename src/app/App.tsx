import { useEffect, useRef, useState } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DeploymentBrowser } from "./DeploymentBrowser";
import {
  parseDashboardPath,
  replaceDashboardPath,
} from "./dashboardRoute";

const DEPLOYMENT_HISTORY_ENABLED = false;

export function App() {
  const params = new URL(location.href).searchParams;
  const authorizeProject = params.get("mockmark_authorize");
  const deploymentKey = params.get("deployment");
  return (
    <>
      <AuthLoading>
        <Centered>Checking session…</Centered>
      </AuthLoading>
      <Unauthenticated>
        <AuthScreen />
      </Unauthenticated>
      <Authenticated>
        {deploymentKey ? (
          <HostedPreview deploymentKey={deploymentKey} />
        ) : authorizeProject ? (
          <PreviewAuthorization projectKey={authorizeProject} />
        ) : (
          <Workspace />
        )}
      </Authenticated>
    </>
  );
}

function HostedPreview({ deploymentKey }: { deploymentKey: string }) {
  const createSession = useAction(api.previewSessions.createForDeployment);
  const [status, setStatus] = useState("Opening hosted mock…");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const path = new URL(location.href).searchParams.get("path") || "index.html";
    if (!safeHostedPath(path)) {
      setStatus("Invalid mock path.");
      return;
    }
    void createSession({ deploymentKey })
      .then(({ token }) => {
        const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL || import.meta.env.VITE_CONVEX_URL.replace(/\.convex\.cloud$/, ".convex.site")).replace(/\/$/, "");
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        location.replace(`${siteUrl}/hosted/${encodeURIComponent(token)}/${encodeURIComponent(deploymentKey)}/${encodedPath}`);
      })
      .catch((reason) => setStatus(errorMessage(reason)));
  }, [createSession, deploymentKey]);
  return <Centered>{status}</Centered>;
}

function PreviewAuthorization({ projectKey }: { projectKey: string }) {
  const createSession = useAction(api.previewSessions.createForProject);
  const [status, setStatus] = useState("Authorizing mock…");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URL(location.href).searchParams;
    const returnOrigin = params.get("origin") ?? "";
    let allowedOrigin = "";
    try {
      const parsed = new URL(returnOrigin);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      allowedOrigin = parsed.origin;
    } catch {
      setStatus("Invalid mock origin.");
      return;
    }
    void createSession({ projectKey, origin: allowedOrigin })
      .then(({ token, expiresAt }) => {
        window.opener?.postMessage(
          { type: "mockmark:authorized", projectKey, token, expiresAt },
          allowedOrigin,
        );
        setStatus("Authorized. You can close this window.");
        window.setTimeout(() => window.close(), 400);
      })
      .catch((reason) => setStatus(errorMessage(reason)));
  }, [createSession, projectKey]);
  return <Centered>{status}</Centered>;
}

function AuthScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  return (
    <main className="auth-layout">
      <section className="auth-copy">
        <Logo />
        <h1>Feedback lives beside the mock.</h1>
        <p>
          Pin, discuss, resolve. Your agents read the same human feedback
          without Mockmark telling them how to work.
        </p>
      </section>
      <form
        className="card auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await signIn("password", new FormData(event.currentTarget));
          } catch (reason) {
            setError(errorMessage(reason));
          }
        }}
      >
        <p className="eyebrow">
          {flow === "signIn" ? "Welcome back" : "Create workspace"}
        </p>
        <h2>{flow === "signIn" ? "Sign in" : "Start with Mockmark"}</h2>
        {flow === "signUp" ? (
          <Field label="Your name" name="name" autoComplete="name" required />
        ) : null}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          minLength={12}
          required
        />
        <input type="hidden" name="flow" value={flow} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="primary wide" type="submit">
          {flow === "signIn" ? "Sign in" : "Create account"}
        </button>
        <button
          className="link"
          type="button"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
        >
          {flow === "signIn"
            ? "Need an account? Sign up"
            : "Already registered? Sign in"}
        </button>
      </form>
    </main>
  );
}

function Workspace() {
  const workspaces = useQuery(api.workspaces.mine);
  const bootstrap = useMutation(api.workspaces.bootstrap);
  const createWorkspace = useMutation(api.workspaces.create);
  const { signOut } = useAuthActions();
  const [route, setRoute] = useState(() =>
    parseDashboardPath(location.pathname),
  );
  const acceptInvitation = useMutation(api.workspaces.acceptInvitation);
  const acceptProjectInvitation = useMutation(api.projectAccess.acceptInvitation);
  const [inviteStatus, setInviteStatus] = useState("");
  const inviteHandled = useRef(false);
  useEffect(() => {
    const restoreRoute = () => setRoute(parseDashboardPath(location.pathname));
    addEventListener("popstate", restoreRoute);
    return () => removeEventListener("popstate", restoreRoute);
  }, []);
  useEffect(() => {
    const params = new URL(location.href).searchParams;
    const projectInvite = params.get("project_invite");
    const invite = params.get("invite");
    const rawToken = projectInvite ?? invite;
    if (!rawToken || inviteHandled.current) return;
    inviteHandled.current = true;
    void sha256(rawToken)
      .then(async (tokenHash) => {
        if (projectInvite) await acceptProjectInvitation({ tokenHash });
        else await acceptInvitation({ tokenHash });
      })
      .then(() => {
        const url = new URL(location.href);
        url.searchParams.delete("invite");
        url.searchParams.delete("project_invite");
        history.replaceState(history.state, "", url);
        setInviteStatus("Invitation accepted.");
      })
      .catch((reason) => setInviteStatus(errorMessage(reason)));
  }, [acceptInvitation, acceptProjectInvitation]);
  const routedWorkspace = workspaces?.find(
    (item) => item.organization?._id === route.organizationId,
  );
  const activeOrg =
    routedWorkspace?.organization?._id ??
    workspaces?.[0]?.organization?._id ??
    null;
  const selectedProject =
    routedWorkspace && route.projectId
      ? (route.projectId as Id<"projects">)
      : null;
  const activeRole = workspaces?.find(
    (item) => item.organization?._id === activeOrg,
  )?.membership.role;
  const navigate = (
    organizationId: Id<"organizations"> | null,
    projectId: Id<"projects"> | null = null,
  ) => {
    const url = replaceDashboardPath(
      new URL(location.href),
      organizationId,
      projectId,
    );
    history.pushState(history.state, "", url);
    setRoute({ organizationId, projectId });
  };
  if (workspaces === undefined) return <Centered>Loading workspace…</Centered>;
  if (!workspaces.length)
    return (
      <Setup
        onCreate={async (name, workspaceName) => {
          await bootstrap({ name, workspaceName });
        }}
      />
    );
  return (
    <div className="shell">
      <header>
        <Logo />
        <nav>
          {workspaces.map(({ organization }) =>
            organization ? (
              <button
                className={activeOrg === organization._id ? "active" : ""}
                key={organization._id}
                onClick={() => navigate(organization._id)}
              >
                {organization.name}
              </button>
            ) : null,
          )}
        </nav>
        <button
          className="quiet"
          onClick={() => {
            const name = prompt("Workspace name");
            if (!name) return;
            void createWorkspace({ name }).then((organizationId) => {
              navigate(organizationId);
            });
          }}
        >
          New workspace
        </button>
        <button className="quiet" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main>
        {inviteStatus ? (
          <div className="global-notice">{inviteStatus}</div>
        ) : null}
        {activeOrg ? (
          selectedProject ? (
            <Project
              projectId={selectedProject}
              onBack={() => navigate(activeOrg)}
            />
          ) : (
            <ProjectList
              organizationId={activeOrg}
              onSelect={(projectId) => navigate(activeOrg, projectId)}
              canAdmin={activeRole === "owner" || activeRole === "admin"}
            />
          )
        ) : null}
      </main>
    </div>
  );
}

function Setup({
  onCreate,
}: {
  onCreate: (name: string, workspace: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Centered>
      <form
        className="card setup"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            await onCreate(
              String(data.get("name")),
              String(data.get("workspace")),
            );
          } catch (reason) {
            setError(errorMessage(reason));
          }
        }}
      >
        <Logo />
        <h1>Create your workspace</h1>
        <p>
          Projects map one-to-one with repositories. Feedback never crosses
          project boundaries.
        </p>
        <Field label="Your name" name="name" required />
        <Field
          label="Workspace name"
          name="workspace"
          placeholder="Acme Design"
          required
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="primary" type="submit">
          Create workspace
        </button>
      </form>
    </Centered>
  );
}

function ProjectList({
  organizationId,
  onSelect,
  canAdmin,
}: {
  organizationId: Id<"organizations">;
  onSelect: (id: Id<"projects">) => void;
  canAdmin: boolean;
}) {
  const projects = useQuery(api.projects.list, { organizationId });
  const create = useMutation(api.projects.create);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Repositories</p>
          <h1>Projects</h1>
          <p>Install Mockmark only where feedback should appear.</p>
        </div>
        {canAdmin ? (
          <button className="primary" onClick={() => setCreating(true)}>
            New project
          </button>
        ) : null}
      </div>
      {creating ? (
        <form
          className="card inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const name = String(new FormData(event.currentTarget).get("name"));
            try {
              const id = await create({
                organizationId,
                name,
                projectKey: randomKey("mmp"),
              });
              onSelect(id);
            } catch (reason) {
              setError(errorMessage(reason));
            }
          }}
        >
          <Field
            name="name"
            label="Project name"
            placeholder="Web platform"
            autoFocus
            required
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="actions">
            <button type="button" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Create
            </button>
          </div>
        </form>
      ) : null}
      <div className="project-grid">
        {projects?.map((project) => (
          <button
            className="project-card"
            key={project._id}
            onClick={() => onSelect(project._id)}
          >
            <span className="project-icon">M</span>
            <span>
              <b>{project.name}</b>
              <small>{project.slug}</small>
            </span>
            <span>→</span>
          </button>
        ))}
        {projects?.length === 0 ? (
          <Empty
            title="No projects yet"
            text="Create one, then install Mockmark in that repository."
          />
        ) : null}
      </div>
      <Team organizationId={organizationId} canAdmin={canAdmin} />
    </section>
  );
}

function Team({
  organizationId,
  canAdmin,
}: {
  organizationId: Id<"organizations">;
  canAdmin: boolean;
}) {
  const members = useQuery(api.workspaces.members, { organizationId });
  const invitations = useQuery(api.workspaces.invitations, canAdmin ? { organizationId } : "skip");
  const requestInvitation = useMutation(api.workspaces.requestInvitation);
  const resendInvitation = useMutation(api.workspaces.resendInvitation);
  const revokeInvitation = useMutation(api.workspaces.revokeInvitation);
  const removeMember = useMutation(api.workspaces.removeMember);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="team-section">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>Team</h2>
      </div>
      <div className="card member-list">
        {members?.map((member) => (
          <div key={member._id}>
            <span>
              <b>{member.name}</b>
              <small>{member.email}</small>
            </span>
            <span className="member-actions">
              <span className="role">{member.role}</span>
              {canAdmin && member.role !== "owner" ? (
                <button
                  onClick={() => { if (confirm(`Remove ${member.name} from this workspace?`)) void removeMember({ membershipId: member._id }); }}
                >
                  Remove
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {canAdmin ? (
        <form
          className="card invite-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = event.currentTarget;
            const data = new FormData(form);
            const rawToken = randomKey("mmv");
            try {
              await requestInvitation({
                organizationId,
                email: String(data.get("email")),
                role: String(data.get("role")) as
                  "admin" | "commenter" | "viewer",
                rawToken,
              });
              setNotice("Invitation email queued.");
              form.reset();
            } catch (reason) {
              setError(errorMessage(reason));
            }
          }}
        >
          <Field label="Invite by email" name="email" type="email" required />
          <label className="field">
            <span>Role</span>
            <select name="role" defaultValue="commenter">
              <option value="admin">Admin</option>
              <option value="commenter">Commenter</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button className="primary" type="submit">
            Send invitation
          </button>
          {notice ? <Notice tone="success">{notice}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </form>
      ) : null}
      {canAdmin && invitations?.length ? (
        <div className="card invitation-list">
          <h3>Invitations</h3>
          {invitations.map((invitation) => (
            <div key={invitation._id}>
              <span><b>{invitation.email}</b><small>{invitation.role} · {invitation.status} · {invitation.deliveryAttemptCount} attempt{invitation.deliveryAttemptCount === 1 ? "" : "s"}</small>{invitation.lastDeliveryError ? <small className="invitation-error">{invitation.lastDeliveryError}</small> : null}</span>
              {!invitation.acceptedAt && !invitation.revokedAt ? <span className="member-actions">
                <button onClick={() => void resendInvitation({ invitationId: invitation._id, rawToken: randomKey("mmv") }).catch((reason) => setError(errorMessage(reason)))}>Resend</button>
                <button onClick={() => { if (confirm(`Revoke invitation for ${invitation.email}?`)) void revokeInvitation({ invitationId: invitation._id }).catch((reason) => setError(errorMessage(reason))); }}>Revoke</button>
              </span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Project({
  projectId,
  onBack,
}: {
  projectId: Id<"projects">;
  onBack: () => void;
}) {
  const detail = useQuery(api.projects.detail, { projectId });
  const [view, setView] = useState<"mocks" | "settings">("mocks");
  const feedback = useQuery(
    api.publicApi.feedbackForDashboard,
    view === "settings" ? { projectId, unresolvedOnly: false } : "skip",
  );
  const createToken = useAction(api.tokens.create);
  const revokeToken = useMutation(api.tokens.revoke);
  const deleteThread = useMutation(api.publicApi.deleteThreadForDashboard);
  const latestDeployment = useQuery(api.deployments.latest, { projectId });
  const deployments = useQuery(
    api.deployments.list,
    DEPLOYMENT_HISTORY_ENABLED ? { projectId } : "skip",
  );
  const [browsingDeploymentId, setBrowsingDeploymentId] = useState<Id<"mockDeployments"> | null>(null);
  const [issued, setIssued] = useState<{ token: string; kind: "installation" | "deployment" } | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  if (!detail || latestDeployment === undefined) return <Centered>Loading project…</Centered>;
  if (browsingDeploymentId)
    return (
      <DeploymentBrowser
        deploymentId={browsingDeploymentId}
        projectId={projectId}
        onBack={() => setBrowsingDeploymentId(null)}
        historyMode
      />
    );
  if (view === "mocks" && latestDeployment)
    return (
      <DeploymentBrowser
        deploymentId={latestDeployment._id}
        projectId={projectId}
        onSettings={() => setView("settings")}
      />
    );
  if (view === "mocks")
    return (
      <section className="page">
        <button className="back" onClick={onBack}>← Projects</button>
        <Empty title="No mocks deployed" text="Deploy the repository mockDir to publish its HTML mockups." />
        <button onClick={() => setView("settings")}>Project settings</button>
      </section>
    );
  if (!feedback) return <Centered>Loading project settings…</Centered>;
  const canAdmin = detail.role === "admin";
  const threads = feedback.threads.filter(
    (thread) =>
      filter === "all" ||
      (filter === "resolved" ? thread.resolvedAt : !thread.resolvedAt),
  );
  const install = `npm install -D @thesudeshdas/mockmark\nnpx mockmark init ./mocks --project ${detail.project.projectKey} --convex-url ${import.meta.env.VITE_CONVEX_URL} --app-url ${location.origin}`;
  return (
    <section className="page">
      <button className="back" onClick={() => latestDeployment ? setView("mocks") : onBack()}>
        {latestDeployment ? "← Mocks" : "← Projects"}
      </button>
      <div className="page-head">
        <div>
          <p className="eyebrow">Project settings</p>
          <h1>{detail.project.name}</h1>
          <p>
            {detail.pages.length} pages · {feedback.threads.length}{" "}
            conversations
          </p>
        </div>
        <div className="actions">
          <button
            onClick={() =>
              downloadJson(`${detail.project.slug}-feedback.json`, {
                version: 1,
                project: detail.project,
                threads: feedback.threads,
                exportedAt: Date.now(),
              })
            }
          >
            Export feedback
          </button>
          {canAdmin ? (
            <button
              className="primary"
              onClick={async () => {
                const result = await createToken({
                  projectId,
                  kind: "installation",
                  label: "CLI installation",
                });
                setIssued({ token: result.token, kind: "installation" });
              }}
            >
              Create CLI token
            </button>
          ) : null}
          {canAdmin ? (
            <button
              className="primary"
              onClick={async () => {
                const result = await createToken({ projectId, kind: "deployment", label: "Mock deployments" });
                setIssued({ token: result.token, kind: "deployment" });
              }}
            >
              Create deploy token
            </button>
          ) : null}
        </div>
      </div>
      {issued ? (
        <Notice tone="success">
          <b>{issued.kind === "deployment" ? "Deploy" : "CLI"} token—copy now; it will not be shown again.</b>
          <code>{issued.token}</code>
          <button
            onClick={() => void navigator.clipboard.writeText(issued.token)}
          >
            Copy
          </button>
        </Notice>
      ) : null}
      <div className="two-col">
        <section className="card install">
          <p className="eyebrow">Install in repository</p>
          <h2>Repo-scoped setup</h2>
          <pre>{install}</pre>
          <button onClick={() => void navigator.clipboard.writeText(install)}>
            Copy commands
          </button>
          <p className="muted">
            Then authenticate CLI with an installation token:{" "}
            <code>npx mockmark login TOKEN</code>
          </p>
          <p className="muted">
            Authenticate once with a deploy token, then run:{" "}
            <code>npx mockmark deploy</code>
          </p>
        </section>
        <section className="card stats">
          <div>
            <b>{feedback.threads.filter((t) => !t.resolvedAt).length}</b>
            <span>Open</span>
          </div>
          <div>
            <b>{feedback.threads.filter((t) => t.resolvedAt).length}</b>
            <span>Resolved</span>
          </div>
          <div>
            <b>{detail.tokens.filter((t) => !t.revokedAt).length}</b>
            <span>Access tokens</span>
          </div>
        </section>
      </div>
      {DEPLOYMENT_HISTORY_ENABLED ? <section className="card token-list">
        <p className="eyebrow">Hosted mocks</p>
        <h2>Deployments</h2>
        {deployments?.length ? deployments.map((deployment) => (
          <div key={deployment._id}>
            <span>
              <b>{deployment.label || deployment.commitSha?.slice(0, 8) || "Mock deployment"}</b>
              <small>{deployment.pageCount} mockups · {new Date(deployment.createdAt).toLocaleString()}</small>
            </span>
            {deployment.completedAt && deployment.primaryHtmlPath ? (
              <span className="deployment-actions">
                <a href={hostedShareUrl(deployment.deploymentKey, deployment.primaryHtmlPath)} target="_blank" rel="noreferrer">Open</a>
                <button onClick={() => setBrowsingDeploymentId(deployment._id)}>Browse files</button>
              </span>
            ) : <small>Uploading</small>}
          </div>
        )) : <p className="muted">No hosted deployments yet.</p>}
      </section> : null}
      <section className="card token-list">
        <p className="eyebrow">Access</p>
        <h2>Project tokens</h2>
        {detail.tokens.length ? (
          detail.tokens.map((token) => (
            <div key={token._id}>
              <span>
                <b>{token.label}</b>
                <small>
                  CLI · {token.tokenPrefix}…
                  {token.revokedAt ? " · revoked" : ""}
                </small>
              </span>
              {!token.revokedAt && canAdmin ? (
                <button
                  onClick={() => { if (confirm(`Revoke ${token.label}? Existing links using it will stop working.`)) void revokeToken({ tokenId: token._id }); }}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="muted">No tokens created.</p>
        )}
      </section>
      <ProjectTeam projectId={projectId} canAdmin={canAdmin} />
      <div className="feedback-head">
        <h2>Feedback</h2>
        <div className="segmented">
          {(["open", "all", "resolved"] as const).map((item) => (
            <button
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="threads">
        {threads.map((thread) => (
          <article className="card thread" key={thread._id}>
            <div className="thread-top">
              <span
                className={`status ${thread.resolvedAt ? "resolved" : "open"}`}
              >
                {thread.resolvedAt ? "Resolved" : "Open"}
              </span>
              <span>{thread.page?.path}</span>
              <time>{new Date(thread.updatedAt).toLocaleString()}</time>
            </div>
            {thread.messages.map(
              (message: { _id: string; authorName: string; body: string }) => (
                <div className="message" key={message._id}>
                  <b>{message.authorName}</b>
                  <p>{message.body}</p>
                </div>
              ),
            )}
            {canAdmin ? (
              <div className="thread-admin">
                <button
                  onClick={() => { if (confirm("Delete this conversation? This removes it from active review views.")) void deleteThread({ threadId: thread._id }); }}
                >
                  Delete conversation
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {threads.length === 0 ? (
          <Empty
            title="No matching feedback"
            text="Open a configured mock and press C to add the first comment."
          />
        ) : null}
      </div>
    </section>
  );
}

function ProjectTeam({
  projectId,
  canAdmin,
}: {
  projectId: Id<"projects">;
  canAdmin: boolean;
}) {
  const members = useQuery(api.projectAccess.members, { projectId });
  const invitations = useQuery(api.projectAccess.invitations, canAdmin ? { projectId } : "skip");
  const requestInvitation = useMutation(api.projectAccess.requestInvitation);
  const resendInvitation = useMutation(api.projectAccess.resendInvitation);
  const revokeInvitation = useMutation(api.projectAccess.revokeInvitation);
  const remove = useMutation(api.projectAccess.remove);
  const setRole = useMutation(api.projectAccess.setRole);
  const origins = useQuery(api.projectAccess.origins, { projectId });
  const addOrigin = useMutation(api.projectAccess.addOrigin);
  const removeOrigin = useMutation(api.projectAccess.removeOrigin);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="team-section">
      <div>
        <p className="eyebrow">Project access</p>
        <h2>Assigned members</h2>
      </div>
      <div className="card member-list">
        {members?.map((member) => (
          <div key={member._id}>
            <span>
              <b>{member.name}</b>
              <small>{member.email}</small>
            </span>
            <span className="member-actions">
              {canAdmin ? (
                <select
                  value={member.role}
                  onChange={(event) =>
                    void setRole({
                      projectId,
                      userId: member.userId,
                      role: event.target.value as "admin" | "commenter" | "viewer",
                    }).catch((reason) => setError(errorMessage(reason)))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="commenter">Commenter</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className="role">{member.role}</span>
              )}
              {canAdmin ? (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${member.name} from this project?`))
                      void remove({ membershipId: member._id }).catch((reason) =>
                        setError(errorMessage(reason)),
                      );
                  }}
                >
                  Remove
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {canAdmin ? (
        <form
          className="card invite-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = event.currentTarget;
            const data = new FormData(form);
            const rawToken = randomKey("mmv");
            try {
              await requestInvitation({
                projectId,
                email: String(data.get("email")),
                role: String(data.get("role")) as "admin" | "commenter" | "viewer",
                rawToken,
              });
              setNotice("Project invitation email queued.");
              form.reset();
            } catch (reason) {
              setError(errorMessage(reason));
            }
          }}
        >
          <Field label="Invite to project" name="email" type="email" required />
          <label className="field">
            <span>Project role</span>
            <select name="role" defaultValue="commenter">
              <option value="admin">Admin</option>
              <option value="commenter">Commenter</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button className="primary" type="submit">Send project invitation</button>
          {notice ? <Notice tone="success">{notice}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </form>
      ) : null}
      {canAdmin && invitations?.length ? (
        <div className="card invitation-list">
          <h3>Project invitations</h3>
          {invitations.map((invitation) => (
            <div key={invitation._id}>
              <span><b>{invitation.email}</b><small>{invitation.role} · {invitation.status} · {invitation.deliveryAttemptCount} attempt{invitation.deliveryAttemptCount === 1 ? "" : "s"}</small>{invitation.lastDeliveryError ? <small className="invitation-error">{invitation.lastDeliveryError}</small> : null}</span>
              {!invitation.acceptedAt && !invitation.revokedAt ? <span className="member-actions">
                <button onClick={() => void resendInvitation({ invitationId: invitation._id, rawToken: randomKey("mmv") }).catch((reason) => setError(errorMessage(reason)))}>Resend</button>
                <button onClick={() => { if (confirm(`Revoke invitation for ${invitation.email}?`)) void revokeInvitation({ invitationId: invitation._id }).catch((reason) => setError(errorMessage(reason))); }}>Revoke</button>
              </span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <p className="eyebrow">Deployed mocks</p>
        <h2>Authorized origins</h2>
      </div>
      <div className="card member-list">
        {origins?.map((item) => (
          <div key={item._id}>
            <code>{item.origin}</code>
            {canAdmin ? (
              <button onClick={() => void removeOrigin({ originId: item._id })}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {origins?.length === 0 ? (
          <p className="muted">Add each deployed mock origin. Localhost works automatically.</p>
        ) : null}
      </div>
      {canAdmin ? (
        <form
          className="card invite-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            try {
              await addOrigin({
                projectId,
                origin: String(new FormData(form).get("origin")),
              });
              form.reset();
            } catch (reason) {
              setError(errorMessage(reason));
            }
          }}
        >
          <Field
            label="Mock origin"
            name="origin"
            type="url"
            placeholder="https://preview.example.com"
            required
          />
          <button className="primary" type="submit">Authorize origin</button>
        </form>
      ) : null}
    </section>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...input } = props;
  return (
    <label className="field">
      <span>{label}</span>
      <input {...input} />
    </label>
  );
}
function Logo() {
  return (
    <div className="logo">
      <span>M</span>
      <b>Mockmark</b>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return <main className="centered">{children}</main>;
}
function Notice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}
function randomKey(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
function errorMessage(reason: unknown) {
  if (!(reason instanceof Error)) return "Something went wrong.";
  const convex = [...reason.message.matchAll(/(?:Uncaught )?ConvexError:\s*([^\n]+)/g)].at(-1)?.[1];
  return (convex ?? reason.message.split("\n")[0]).replace(/^Uncaught ConvexError:\s*/, "");
}
function safeHostedPath(path: string) {
  return path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.split("/").some((part) => !part || part === "." || part === "..");
}
function hostedShareUrl(deploymentKey: string, path: string) {
  const url = new URL(location.origin);
  url.searchParams.set("deployment", deploymentKey);
  url.searchParams.set("path", path);
  return url.toString();
}
