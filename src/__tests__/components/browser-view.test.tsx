import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("BrowserView", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks((cmd, args) => {
      if (cmd === "list_feeds") {
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      }
      if (cmd === "check_browser_embed_support") {
        return true;
      }
      return null;
    });
  });

  it("shows loading guidance until the iframe finishes loading", async () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    const { container } = render(<BrowserView />, { wrapper: createWrapper() });

    expect(screen.getByText("Loading page...")).toBeInTheDocument();
    expect(screen.getByText("If this takes too long, open it in your external browser.")).toBeInTheDocument();

    const iframe = container.querySelector("iframe");
    if (!iframe) {
      throw new Error("iframe was not rendered");
    }

    fireEvent.load(iframe);

    expect(screen.queryByText("Loading page...")).not.toBeInTheDocument();
  });

  it("shows an external-browser fallback when the iframe resolves to a browser error page", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "list_feeds") {
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      }
      if (cmd === "check_browser_embed_support") {
        return false;
      }
      return null;
    });

    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      contentMode: "browser",
      browserUrl: "https://note.com/article",
    });

    const { container } = render(<BrowserView />, { wrapper: createWrapper() });

    const iframe = container.querySelector("iframe");
    if (!iframe) {
      throw new Error("iframe was not rendered");
    }

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(screen.getByText("This page can't be shown in the in-app browser.")).toBeInTheDocument();
      expect(screen.getByText("Open it in your external browser instead.")).toBeInTheDocument();
    });
  });

  it("shows the fallback when the iframe lands on a chrome error page after load", async () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      contentMode: "browser",
      browserUrl: "https://www3.nhk.or.jp/news/html/example.html",
    });

    const { container } = render(<BrowserView />, { wrapper: createWrapper() });

    const iframe = container.querySelector("iframe");
    if (!iframe) {
      throw new Error("iframe was not rendered");
    }

    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: {
        location: {
          href: "chrome-error://chromewebdata/",
        },
      },
    });

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(screen.getByText("This page can't be shown in the in-app browser.")).toBeInTheDocument();
    });
  });

  it("keeps widescreen browser chrome hidden outside direct feed selection", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "list_feeds") {
        return sampleFeeds
          .filter((feed) => feed.account_id === args.accountId)
          .map((feed) => (feed.id === "feed-1" ? { ...feed, display_mode: "widescreen" } : feed));
      }
      if (cmd === "list_account_articles") {
        return sampleArticles;
      }
      return null;
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    });
  });

  it("can turn widescreen mode off from the browser toolbar", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "list_feeds") {
        return sampleFeeds
          .filter((feed) => feed.account_id === args.accountId)
          .map((feed) => (feed.id === "feed-1" ? { ...feed, display_mode: "widescreen" } : feed));
      }
      if (cmd === "list_articles") {
        return sampleArticles.filter((article) => article.feed_id === args.feedId);
      }
      if (cmd === "check_browser_embed_support") {
        return true;
      }
      if (cmd === "update_feed_display_mode") {
        return null;
      }
      return null;
    });

    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/1",
    });

    const user = fireEvent;
    render(<BrowserView />, { wrapper: createWrapper() });

    const toggleButton = await screen.findByRole("button", { name: "Toggle widescreen mode" });
    await waitFor(() => {
      expect(toggleButton).toHaveClass("bg-muted");
    });

    user.click(toggleButton);

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_feed_display_mode",
        args: { feedId: "feed-1", displayMode: "normal" },
      });
      expect(useUiStore.getState().contentMode).toBe("reader");
    });
  });
});
