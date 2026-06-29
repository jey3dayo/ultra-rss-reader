import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ARTICLE_LIST_HEADER_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/reader/article-list-header.tsx"),
  "utf8",
);
const GLOBAL_CSS_SOURCE = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

describe("desktop overlay titlebar contract", () => {
  it("reserves mac titlebar space only for the hidden-sidebar article-list header state", () => {
    expect(ARTICLE_LIST_HEADER_SOURCE).toContain(
      'const titlebarControlReserve = showSidebarButton && isSidebarVisible !== true ? "sidebar-hidden" : undefined;',
    );
    expect(GLOBAL_CSS_SOURCE).toContain(
      '.desktop-overlay-titlebar-shell [data-article-list-header="true"][data-titlebar-control-reserve="sidebar-hidden"]',
    );
    expect(GLOBAL_CSS_SOURCE).toContain("padding-left: calc(var(--desktop-titlebar-offset) + 16px);");
    expect(GLOBAL_CSS_SOURCE).not.toContain('[data-titlebar-control-reserve="true"]');
  });
});
