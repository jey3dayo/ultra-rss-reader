import { describe, expect, it } from "vitest";
import { resolveLayout } from "../../hooks/use-layout";

describe("resolveLayout", () => {
  it("wide: 3 panes", () => {
    expect(resolveLayout("wide", "sidebar", "reader")).toEqual(["sidebar", "list", "content"]);
  });

  it("wide+browser: hides sidebar", () => {
    expect(resolveLayout("wide", "sidebar", "browser")).toEqual(["list", "content"]);
  });

  it("compact+sidebar: sidebar+list", () => {
    expect(resolveLayout("compact", "sidebar", "reader")).toEqual(["sidebar", "list"]);
  });

  it("compact+content: list+content", () => {
    expect(resolveLayout("compact", "content", "reader")).toEqual(["list", "content"]);
  });

  it("mobile: single pane", () => {
    expect(resolveLayout("mobile", "list", "reader")).toEqual(["list"]);
  });
});
