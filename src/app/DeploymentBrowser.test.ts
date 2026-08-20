import { describe, expect, test } from "vitest";
import {
  availableManualStatuses,
  buildTree,
  matchesStatusFilter,
  type BrowserFile,
} from "./DeploymentBrowser";

const file = (path: string, contentType: string): BrowserFile => ({
  path,
  contentType,
  size: 12,
  conversations: 0,
  open: 0,
  resolved: 0,
  status: "mocking",
  pageIds: [],
});

describe("mock lifecycle controls", () => {
  test("keeps active work separate from completed mocks", () => {
    expect(matchesStatusFilter("mocking", "active")).toBe(true);
    expect(matchesStatusFilter("in_review", "active")).toBe(true);
    expect(matchesStatusFilter("reviewed", "active")).toBe(false);
    expect(matchesStatusFilter("archived", "all")).toBe(true);
  });

  test("exposes only role-allowed manual transitions", () => {
    expect(availableManualStatuses("viewer", "mocking")).toEqual([]);
    expect(availableManualStatuses("commenter", "in_review")).toEqual(["mocking", "ready_to_review"]);
    expect(availableManualStatuses("commenter", "archived")).toEqual([]);
    expect(availableManualStatuses("admin", "archived")).toEqual([
      "mocking",
      "ready_to_review",
      "reviewed",
      "archived",
    ]);
  });
});

describe("deployment file tree", () => {
  const files = [
    file("today/index.html", "text/html"),
    file("today/states/empty.html", "text/html"),
    file("today/assets/app.css", "text/css; charset=utf-8"),
    file("shared/logo.svg", "image/svg+xml"),
  ];

  test("uses manifest paths as deployment-root hierarchy", () => {
    const tree = buildTree(files, "");
    expect(tree.map((node) => node.name)).toEqual(["today"]);
    expect(tree.flatMap((node) => node.children.map((child) => child.path))).toContain("today/index.html");
    expect(JSON.stringify(tree)).not.toContain("docs/mockups");
    expect(JSON.stringify(tree)).not.toContain("app.css");
    expect(JSON.stringify(tree)).not.toContain("logo.svg");
  });

  test("keeps matching files under their ancestors during search", () => {
    const tree = buildTree(files, "empty");
    expect(tree).toMatchObject([
      { name: "today", children: [{ name: "states", children: [{ name: "empty.html" }] }] },
    ]);
  });
});
