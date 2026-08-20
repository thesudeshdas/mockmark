import { describe, expect, test } from "vitest";
import {
  dashboardPath,
  parseDashboardPath,
  replaceDashboardPath,
} from "./dashboardRoute";

describe("dashboard routing", () => {
  test("restores a project from its URL after a page load", () => {
    expect(parseDashboardPath("/workspaces/org_1/projects/project_2")).toEqual({
      organizationId: "org_1",
      projectId: "project_2",
    });
  });

  test("builds encoded workspace and project paths", () => {
    expect(dashboardPath("org/1", "project 2")).toBe(
      "/workspaces/org%2F1/projects/project%202",
    );
  });

  test("rejects unrelated or incomplete paths", () => {
    expect(parseDashboardPath("/")).toEqual({
      organizationId: null,
      projectId: null,
    });
    expect(parseDashboardPath("/workspaces/org_1/projects")).toEqual({
      organizationId: null,
      projectId: null,
    });
  });

  test("changes only the path so invitation query parameters survive", () => {
    const url = replaceDashboardPath(
      new URL("https://mockmark.dev/?invite=secret"),
      "org_1",
      "project_2",
    );
    expect(url.href).toBe(
      "https://mockmark.dev/workspaces/org_1/projects/project_2?invite=secret",
    );
  });
});
