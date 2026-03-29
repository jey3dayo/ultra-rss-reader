import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("BrowserView", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks((cmd, args) => {
      if (cmd === "list_feeds") {
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
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
});
