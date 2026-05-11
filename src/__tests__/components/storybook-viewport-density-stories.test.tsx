import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, screen } from "@testing-library/react";
import { renderStory } from "@tests/helpers/render-story";
import { describe, expect, it } from "vitest";
import { MAX_DEV_WINDOW_DIMENSION_PX } from "@/api/schemas/platform-info";
import articleListScreenMeta, {
  DenseNarrowViewport as ArticleListDenseNarrowViewport,
} from "@/components/reader/article-list-screen-view.stories";
import articleToolbarMeta, {
  MobileA11yDisabledState as ArticleToolbarMobileA11yDisabledState,
  MobileJapaneseLongLabels as ArticleToolbarMobileJapaneseLongLabels,
} from "@/components/reader/article-toolbar-view.stories";
import browserOverlayStageMeta, {
  RetryableIssue as BrowserOverlayRetryableIssue,
} from "@/components/reader/browser-overlay-stage.stories";
import feedTreeMeta, {
  DenseNarrowA11yState as FeedTreeDenseNarrowA11yState,
} from "@/components/reader/feed-tree-view.stories";
import sidebarHeaderMeta, {
  DenseNarrowViewport as SidebarHeaderDenseNarrowViewport,
} from "@/components/reader/sidebar-header-view.stories";
import accountDetailMeta, {
  DenseA11yDisabledState as AccountDetailDenseA11yDisabledState,
  JapaneseLongLabelsDense as AccountDetailJapaneseLongLabelsDense,
} from "@/components/settings/account-detail/view.stories";
import settingsModalMeta, {
  DenseNarrowViewport as SettingsModalDenseNarrowViewport,
} from "@/components/settings/settings-modal-view.stories";
import {
  denseNarrowViewportId,
  denseNarrowViewportParameters,
  denseNarrowViewportStoryIds,
  storybookViewportMaxDimensionPx,
} from "@/components/storybook/viewport-fixtures";
import { storybookSmokeStoryIds } from "../../../e2e/storybook/storybook-index-payload";

const globalCss = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8");

describe("Storybook viewport density fixtures", () => {
  it("syncs OS high contrast and forced-colors settings through shared design tokens", () => {
    expect(globalCss).toContain("@media (prefers-contrast: more)");
    expect(globalCss).toContain("@media (forced-colors: active)");
    expect(globalCss).toContain("--ring: color-mix(in srgb, var(--primary) 70%, var(--foreground));");
    expect(globalCss).toContain("--border-strong: color-mix(in srgb, var(--foreground) 42%, transparent);");
    expect(globalCss).toContain("--sidebar-selection-shadow: inset 0 0 0 1px var(--sidebar-selection-border);");
    expect(globalCss).toContain("--browser-overlay-rail-border: ButtonBorder;");
    expect(globalCss).toContain("--browser-overlay-state-detail-border: ButtonBorder;");
    expect(globalCss).toContain("--overlay-action-surface-focus: Highlight;");
    expect(globalCss).toContain("--surface-selected: Highlight;");
    expect(globalCss).toContain("--reader-toolbar-surface: Canvas;");
    expect(globalCss).toContain("--state-warning-border: ButtonBorder;");
    expect(globalCss).toContain("--state-danger-border: ButtonBorder;");
  });

  it("uses one narrow viewport baseline for all density fixtures", () => {
    expect(SidebarHeaderDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(FeedTreeDenseNarrowA11yState.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(ArticleListDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(ArticleToolbarMobileJapaneseLongLabels.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(ArticleToolbarMobileA11yDisabledState.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(BrowserOverlayRetryableIssue.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(SettingsModalDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(AccountDetailJapaneseLongLabelsDense.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(AccountDetailDenseA11yDisabledState.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(denseNarrowViewportParameters.viewport.defaultViewport).toBe(denseNarrowViewportId);
  });

  it("keeps Storybook viewport fixtures aligned with the dev window dimension cap", () => {
    expect(storybookViewportMaxDimensionPx).toBe(MAX_DEV_WINDOW_DIMENSION_PX);
  });

  it("connects dense narrow viewport fixtures to the Storybook smoke matrix", () => {
    expect(storybookSmokeStoryIds).toEqual(expect.arrayContaining([...denseNarrowViewportStoryIds]));
  });

  it("keeps the sidebar header narrow fixture focused on primary toolbar actions", () => {
    expect(SidebarHeaderDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    renderStory(sidebarHeaderMeta, SidebarHeaderDenseNarrowViewport);

    expect(screen.getByRole("button", { name: "すべてのフィードを同期" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "購読フィードを追加" })).toBeInTheDocument();
  });

  it("keeps the article list narrow fixture focused on list density and row presence", () => {
    expect(ArticleListDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    renderStory(articleListScreenMeta, ArticleListDenseNarrowViewport);

    expect(screen.getByRole("listbox", { name: "記事一覧" })).toBeInTheDocument();
    expect(screen.getByText("AUTOMATON")).toBeInTheDocument();
    expect(screen.getAllByText("テックニュースまとめ").length).toBeGreaterThan(0);
  });

  it("keeps the feed tree dense fixture focused on row density and a11y state", () => {
    expect(FeedTreeDenseNarrowA11yState.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    renderStory(feedTreeMeta, FeedTreeDenseNarrowA11yState);

    expect(screen.getByTestId("feed-tree-dense-smoke")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select folder Engineering and release monitoring" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accessibility regression queue84" })).toBeInTheDocument();
  });

  it("keeps the article toolbar dense fixtures focused on mobile labels and disabled state", () => {
    expect(ArticleToolbarMobileJapaneseLongLabels.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(ArticleToolbarMobileA11yDisabledState.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    cleanup();
    const { container: longLabelContainer } = renderStory(articleToolbarMeta, ArticleToolbarMobileJapaneseLongLabels);
    expect(longLabelContainer.querySelector(".sticky.top-0")).toHaveClass("h-12");
    expect(longLabelContainer.querySelector("[data-tauri-drag-region]")).toHaveClass("min-w-0");
    expect(screen.getByRole("button", { name: "この記事を既読または未読に切り替える" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Webプレビューを開く" })).toBeInTheDocument();
    expect(screen.getByText("未読にする")).toHaveClass("max-w-16", "truncate");
    expect(screen.getByText("プレビューを開く")).toHaveClass("max-w-16", "truncate");

    cleanup();
    renderStory(articleToolbarMeta, ArticleToolbarMobileA11yDisabledState);
    expect(screen.getByRole("button", { name: "Toggle read" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open Web Preview" })).toBeDisabled();
  });

  it("keeps the browser overlay retryable issue fixture focused on error recovery controls", () => {
    expect(BrowserOverlayRetryableIssue.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    cleanup();
    renderStory(browserOverlayStageMeta, BrowserOverlayRetryableIssue);

    expect(screen.getByText("Web Preview could not load.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Web Preview" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open in External Browser" }).length).toBeGreaterThan(0);
  });

  it("keeps the settings modal narrow fixture focused on modal controls and rails", () => {
    expect(SettingsModalDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    cleanup();
    renderStory(settingsModalMeta, SettingsModalDenseNarrowViewport);

    expect(screen.getByRole("heading", { name: "環境設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "環境設定を閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一般設定" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "アカウントを追加" }).length).toBeGreaterThan(0);
    expect(document.querySelector("nav")).toHaveClass("flex-wrap", "overflow-visible");
    expect(screen.getByRole("button", { name: "表示とテーマ" })).toHaveClass("max-w-full", "overflow-hidden");
    expect(screen.getAllByRole("button", { name: /FreshRSS 長い表示名の検証/ })[0]).toHaveClass(
      "max-w-full",
      "overflow-hidden",
    );
  });

  it("keeps the account detail dense fixtures focused on localized error and disabled controls", () => {
    expect(AccountDetailJapaneseLongLabelsDense.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(AccountDetailDenseA11yDisabledState.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    cleanup();
    renderStory(accountDetailMeta, AccountDetailJapaneseLongLabelsDense);
    expect(screen.getByText("再試行を待機中")).toBeInTheDocument();
    expect(screen.getByText("個人用FreshRSS長い表示名の検証アカウント")).toBeInTheDocument();

    cleanup();
    renderStory(accountDetailMeta, AccountDetailDenseA11yDisabledState);
    expect(screen.getByText("接続できません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Syncing" })).toBeDisabled();
  });
});
