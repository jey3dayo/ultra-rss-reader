import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE,
  focusArticleContentTarget,
  focusArticleListRowTargetWhenReady,
  focusArticleListTarget,
  focusSelectedAccountPaneTarget,
  focusSelectedSidebarTarget,
  focusSidebarSmartViewTargetWhenReady,
  isArticleListPaneTarget,
  isArticleListRowTarget,
  isSidebarPaneTarget,
  resolveReaderFocusReturnAction,
  SIDEBAR_FALLBACK_TARGET_ATTRIBUTE,
  SIDEBAR_SELECTED_TARGET_ATTRIBUTE,
  SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE,
} from "@/lib/reader-focus";

describe("reader-focus", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("focuses the selected sidebar target", () => {
    const fallbackTarget = createButton({ [SIDEBAR_FALLBACK_TARGET_ATTRIBUTE]: "true" });
    const selectedTarget = createButton({ [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" });
    document.body.append(fallbackTarget, selectedTarget);

    expect(focusSelectedSidebarTarget()).toBe(true);

    expect(selectedTarget).toHaveFocus();
  });

  it("falls back to the sidebar fallback target when the selected target cannot receive focus", () => {
    const fallbackTarget = createButton({ [SIDEBAR_FALLBACK_TARGET_ATTRIBUTE]: "true" });
    const selectedTarget = createButton({ [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true", disabled: "" });
    document.body.append(selectedTarget, fallbackTarget);

    expect(focusSelectedSidebarTarget()).toBe(true);

    expect(fallbackTarget).toHaveFocus();
  });

  it("falls back when selected reader targets are aria-disabled", () => {
    const sidebarFallbackTarget = createButton({ [SIDEBAR_FALLBACK_TARGET_ATTRIBUTE]: "true" });
    const sidebarSelectedTarget = createButton({
      [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true",
      "aria-disabled": "true",
    });
    document.body.append(sidebarSelectedTarget, sidebarFallbackTarget);

    expect(focusSelectedSidebarTarget()).toBe(true);
    expect(sidebarFallbackTarget).toHaveFocus();

    const accountFallbackTarget = createButton({ "data-account-pane-navigation-target": "true" });
    const accountSelectedTarget = createButton({
      [ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE]: "true",
      "aria-disabled": "true",
    });
    document.body.replaceChildren(accountSelectedTarget, accountFallbackTarget);

    expect(focusSelectedAccountPaneTarget()).toBe(true);
    expect(accountFallbackTarget).toHaveFocus();

    const selectedRow = createButton({
      "data-article-id": "article-2",
      role: "option",
      "aria-disabled": "true",
    });
    const fallbackRow = createButton({ "data-article-id": "article-1", role: "option" });
    document.body.replaceChildren(selectedRow, fallbackRow);

    expect(focusArticleListTarget("article-2")).toBe(true);
    expect(fallbackRow).toHaveFocus();
  });

  it("focuses the selected account pane target before its navigation fallback", () => {
    const fallbackTarget = createButton({ "data-account-pane-navigation-target": "true" });
    const selectedTarget = createButton({ [ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE]: "true" });
    document.body.append(fallbackTarget, selectedTarget);

    expect(focusSelectedAccountPaneTarget()).toBe(true);

    expect(selectedTarget).toHaveFocus();
  });

  it("falls back to the account pane navigation target when the selected target cannot receive focus", () => {
    const selectedTarget = createButton({ [ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE]: "true", disabled: "" });
    const fallbackTarget = createButton({ "data-account-pane-navigation-target": "true" });
    document.body.append(selectedTarget, fallbackTarget);

    expect(focusSelectedAccountPaneTarget()).toBe(true);

    expect(fallbackTarget).toHaveFocus();
  });

  it("focuses the selected article row target", () => {
    const fallbackRow = createButton({ "data-article-id": "article-1", role: "option" });
    const selectedRow = createButton({ "data-article-id": "article-2", role: "option" });
    document.body.append(fallbackRow, selectedRow);

    expect(focusArticleListTarget("article-2")).toBe(true);

    expect(selectedRow).toHaveFocus();
  });

  it("keeps focus success when scrolling the selected article row fails", () => {
    const selectedRow = createButton({ "data-article-id": "article-2", role: "option" });
    setThrowingScrollIntoView(selectedRow);
    document.body.append(selectedRow);

    expect(focusArticleListTarget("article-2")).toBe(true);

    expect(selectedRow).toHaveFocus();
  });

  it("falls back to the first focusable article row when the selected article row cannot receive focus", () => {
    const selectedRow = createButton({ "data-article-id": "article-2", role: "option", disabled: "" });
    const fallbackRow = createButton({ "data-article-id": "article-1", role: "option" });
    document.body.append(selectedRow, fallbackRow);

    expect(focusArticleListTarget("article-2")).toBe(true);

    expect(fallbackRow).toHaveFocus();
  });

  it("falls back to the article list root when no article row is focusable", () => {
    const listRoot = createDiv({ "data-article-list-root": "true", tabindex: "0" });
    document.body.append(listRoot);

    expect(focusArticleListTarget("missing-article")).toBe(true);

    expect(listRoot).toHaveFocus();
  });

  it("retries focusing the selected article row before falling back to the article list target", () => {
    vi.useFakeTimers();
    const row = createButton({ "data-article-id": "article-2", role: "option" });

    focusArticleListRowTargetWhenReady("article-2", 2);

    expect(document.activeElement).toBe(document.body);

    document.body.append(row);
    vi.advanceTimersByTime(50);

    expect(row).toHaveFocus();
  });

  it("focuses the article content pane", () => {
    const articlePane = createDiv({ "data-article-content-pane": "true", tabindex: "0" });
    document.body.append(articlePane);

    expect(focusArticleContentTarget()).toBe(true);

    expect(articlePane).toHaveFocus();
  });

  it("retries focusing a sidebar smart view before falling back to the selected sidebar target", () => {
    vi.useFakeTimers();
    const smartViewTarget = createButton({ [SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE]: "recent" });
    const selectedTarget = createButton({ [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" });
    document.body.append(selectedTarget);

    focusSidebarSmartViewTargetWhenReady("recent", 2);

    expect(document.activeElement).toBe(document.body);

    document.body.append(smartViewTarget);
    vi.advanceTimersByTime(50);

    expect(smartViewTarget).toHaveFocus();
    expect(selectedTarget).not.toHaveFocus();
  });

  it("identifies reader pane keyboard targets without exposing selectors to callers", () => {
    const sidebarPane = createDiv({ "data-sidebar-pane": "true" });
    const sidebarButton = createButton({});
    const articleListPane = createDiv({ "data-article-list-pane": "true" });
    const articleRow = createButton({ "data-article-id": "article-1", role: "option" });
    const plainButton = createButton({});
    sidebarPane.append(sidebarButton);
    articleListPane.append(articleRow);
    document.body.append(sidebarPane, articleListPane, plainButton);

    expect(isSidebarPaneTarget(sidebarButton)).toBe(true);
    expect(isArticleListPaneTarget(articleRow)).toBe(true);
    expect(isArticleListRowTarget(articleRow)).toBe(true);
    expect(isSidebarPaneTarget(plainButton)).toBe(false);
    expect(isArticleListPaneTarget(plainButton)).toBe(false);
    expect(isArticleListRowTarget(plainButton)).toBe(false);
    expect(isSidebarPaneTarget(null)).toBe(false);
    expect(isArticleListPaneTarget(null)).toBe(false);
    expect(isArticleListRowTarget(null)).toBe(false);
  });

  it("resolves reader ArrowLeft focus returns without exposing pane selectors to global keyboard handling", () => {
    const articleListPane = createDiv({ "data-article-list-pane": "true" });
    const articleRow = createButton({ "data-article-id": "article-1", role: "option" });
    const articleContent = createDiv({ "data-article-content-pane": "true" });
    articleListPane.append(articleRow);
    document.body.append(articleListPane, articleContent);

    expect(
      resolveReaderFocusReturnAction({
        key: "ArrowLeft",
        focusedPane: "content",
        target: articleRow,
        targetIsTextEditing: false,
      }),
    ).toBe("focus-sidebar");
    expect(
      resolveReaderFocusReturnAction({
        key: "ArrowLeft",
        focusedPane: "content",
        target: articleContent,
        targetIsTextEditing: false,
      }),
    ).toBe("focus-list");
    expect(
      resolveReaderFocusReturnAction({
        key: "ArrowLeft",
        focusedPane: "content",
        target: articleContent,
        targetIsTextEditing: true,
      }),
    ).toBeNull();
    expect(
      resolveReaderFocusReturnAction({
        key: "ArrowRight",
        focusedPane: "content",
        target: articleContent,
        targetIsTextEditing: false,
      }),
    ).toBeNull();
    expect(
      resolveReaderFocusReturnAction({
        key: "ArrowLeft",
        focusedPane: "list",
        target: articleContent,
        targetIsTextEditing: false,
      }),
    ).toBeNull();
  });
});

function createButton(attributes: Record<string, string>): HTMLButtonElement {
  const button = document.createElement("button");
  setAttributes(button, attributes);
  return button;
}

function createDiv(attributes: Record<string, string>): HTMLDivElement {
  const div = document.createElement("div");
  setAttributes(div, attributes);
  return div;
}

function setAttributes(element: HTMLElement, attributes: Record<string, string>) {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function setThrowingScrollIntoView(element: HTMLElement) {
  Object.defineProperty(element, "scrollIntoView", {
    value: vi.fn(() => {
      throw new Error("scroll failed");
    }),
    configurable: true,
  });
}
