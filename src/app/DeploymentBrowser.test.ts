import { describe, expect, test } from "vitest";
import { buildTree, type BrowserFile } from "./DeploymentBrowser";

const file = (path: string, contentType: string): BrowserFile => ({
  path,
  contentType,
  size: 12,
  conversations: 0,
  open: 0,
  resolved: 0,
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
    expect(tree.map((node) => node.name)).toEqual(["shared", "today"]);
    expect(tree.flatMap((node) => node.children.map((child) => child.path))).toContain("today/index.html");
    expect(JSON.stringify(tree)).not.toContain("docs/mockups");
  });

  test("keeps matching files under their ancestors during search", () => {
    const tree = buildTree(files, "empty");
    expect(tree).toMatchObject([
      { name: "today", children: [{ name: "states", children: [{ name: "empty.html" }] }] },
    ]);
  });
});
