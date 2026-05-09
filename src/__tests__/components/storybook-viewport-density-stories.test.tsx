import { cleanup, screen } from "@testing-library/react";
import { renderStory } from "@tests/helpers/render-story";
import { describe, expect, it } from "vitest";
import articleListScreenMeta, {
  DenseNarrowViewport as ArticleListDenseNarrowViewport,
} from "@/components/reader/article-list-screen-view.stories";
import sidebarHeaderMeta, {
  DenseNarrowViewport as SidebarHeaderDenseNarrowViewport,
} from "@/components/reader/sidebar-header-view.stories";
import settingsModalMeta, {
  DenseNarrowViewport as SettingsModalDenseNarrowViewport,
} from "@/components/settings/settings-modal-view.stories";
import { denseNarrowViewportId, denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";

describe("Storybook viewport density fixtures", () => {
  it("uses one narrow viewport baseline for all density fixtures", () => {
    expect(SidebarHeaderDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(ArticleListDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(SettingsModalDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);
    expect(denseNarrowViewportParameters.viewport.defaultViewport).toBe(denseNarrowViewportId);
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

  it("keeps the settings modal narrow fixture focused on modal controls and rails", () => {
    expect(SettingsModalDenseNarrowViewport.parameters?.viewport).toBe(denseNarrowViewportParameters.viewport);

    cleanup();
    renderStory(settingsModalMeta, SettingsModalDenseNarrowViewport);

    expect(screen.getByRole("heading", { name: "環境設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "環境設定を閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一般設定" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "アカウントを追加" }).length).toBeGreaterThan(0);
  });
});
