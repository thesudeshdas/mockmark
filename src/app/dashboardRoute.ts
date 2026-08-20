export type DashboardRoute = {
  organizationId: string | null;
  projectId: string | null;
};

const ROOT_ROUTE: DashboardRoute = {
  organizationId: null,
  projectId: null,
};

export function parseDashboardPath(pathname: string): DashboardRoute {
  if (pathname === "/" || pathname === "") return ROOT_ROUTE;
  const segments = pathname.split("/").filter(Boolean);
  try {
    if (segments.length === 2 && segments[0] === "workspaces") {
      return {
        organizationId: decodeURIComponent(segments[1]),
        projectId: null,
      };
    }
    if (
      segments.length === 4 &&
      segments[0] === "workspaces" &&
      segments[2] === "projects"
    ) {
      return {
        organizationId: decodeURIComponent(segments[1]),
        projectId: decodeURIComponent(segments[3]),
      };
    }
  } catch {
    return ROOT_ROUTE;
  }
  return ROOT_ROUTE;
}

export function dashboardPath(
  organizationId: string | null,
  projectId: string | null = null,
) {
  if (!organizationId) return "/";
  const workspacePath = `/workspaces/${encodeURIComponent(organizationId)}`;
  return projectId
    ? `${workspacePath}/projects/${encodeURIComponent(projectId)}`
    : workspacePath;
}

export function replaceDashboardPath(
  currentUrl: URL,
  organizationId: string | null,
  projectId: string | null = null,
) {
  const nextUrl = new URL(currentUrl);
  nextUrl.pathname = dashboardPath(organizationId, projectId);
  return nextUrl;
}
