import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleList } from "@/components/reader/article-list";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("ArticleList", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [sampleArticles[0]];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });
  });

  it("shows unread count for the currently displayed tagged articles", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectTag("tag-1");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("1 Unread Items")).toBeInTheDocument();
    });
  });

  it("preserves feed grouping labels and selected article state", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectArticle(sampleArticles[1].id);
    usePreferencesStore.setState({
      prefs: { group_by: "feed" },
      loaded: false,
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByText("Tech Blog").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("option", { name: /Second Article/i })).toHaveAttribute("aria-selected", "true");
  });
});
