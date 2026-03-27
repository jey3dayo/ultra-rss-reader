import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleView } from "@/components/reader/article-view";
import { useUiStore } from "@/stores/ui-store";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("ArticleView", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        default:
          return null;
      }
    });
  });

  it("shows a sidebar return button in compact layout", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    useUiStore.setState({ layoutMode: "compact", focusedPane: "content" });

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    const button = await screen.findByRole("button", { name: "Show sidebar" });
    await user.click(button);

    await waitFor(() => {
      expect(useUiStore.getState().focusedPane).toBe("sidebar");
    });
  });
});
