import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
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

  it("lets mobile users navigate back to the sidebar", async () => {
    useUiStore.setState({ layoutMode: "mobile" });
    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(useUiStore.getState().focusedPane).toBe("sidebar");
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

  it("removes articles from unread view after confirming mark all read", async () => {
    let articles = [
      { ...sampleArticles[0], is_read: false },
      { ...sampleArticles[1], is_read: true },
    ];
    let feeds = sampleFeeds.map((feed) =>
      feed.id === "feed-1"
        ? {
            ...feed,
            unread_count: articles.filter((article) => article.feed_id === feed.id && !article.is_read).length,
          }
        : feed,
    );

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return feeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return articles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return articles.filter((article) =>
            feeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        case "mark_articles_read": {
          const ids = new Set(args.articleIds as string[]);
          articles = articles.map((article) => (ids.has(article.id) ? { ...article, is_read: true } : article));
          feeds = feeds.map((feed) => ({
            ...feed,
            unread_count: articles.filter((article) => article.feed_id === feed.id && !article.is_read).length,
          }));
          return null;
        }
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(
      <>
        <ArticleList />
        <AppConfirmDialog />
      </>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("First Article")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    await user.click(screen.getByRole("button", { name: "Mark as Read" }));

    await waitFor(() => {
      expect(screen.queryByText("First Article")).not.toBeInTheDocument();
    });
  });

  it("does not render read articles in unread view even when recentlyReadIds contains them", async () => {
    const articles = [
      { ...sampleArticles[0], id: "art-read", title: "Read Article", is_read: true },
      { ...sampleArticles[1], id: "art-unread", title: "Unread Article", is_read: false, is_starred: false },
    ];

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return articles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return articles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      viewMode: "unread",
      recentlyReadIds: new Set(["art-read"]),
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Unread Article")).toBeInTheDocument();
      expect(screen.queryByText("Read Article")).not.toBeInTheDocument();
    });
  });
});
