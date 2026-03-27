import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleList } from "@/components/reader/article-list";
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

describe("ArticleList", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
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
});
