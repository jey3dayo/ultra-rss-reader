import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
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

  it("renders tagged articles in the list", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectTag("tag-1");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });
  });

  it("renders feed articles even when account-wide loading is still pending", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return new Promise(() => {
            // Keep the unrelated account query pending to reproduce the stuck loading state.
          });
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });
  });

  it("clears the selected article when the active filter excludes it", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "STARRED" }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });
});
