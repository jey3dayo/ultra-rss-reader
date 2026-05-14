import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleContextMenu } from "@/components/reader/article-context-menu";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";

describe("ArticleContextMenu", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks();
  });

  it("uses preview wording for the in-app browser action", async () => {
    render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    expect(await screen.findByRole("menuitem", { name: "Open Web Preview" })).toBeInTheDocument();
  });

  it("reuses article actions when opening the browser from the context menu", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));
    await user.click(await screen.findByRole("menuitem", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: sampleArticles[0]?.url, background: false },
      });
    });
  });

  it("copies the source feed URL from the context menu", async () => {
    const calls: MockTauriCommandCall[] = [];
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "copy_to_clipboard":
          return null;
        default:
          return undefined;
      }
    });

    render(
      <ArticleContextMenu article={sampleArticles[0]} feedUrl={sampleFeeds[0].url}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy Feed URL" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "copy_to_clipboard",
        args: { text: sampleFeeds[0].url },
      });
      expect(showToast).toHaveBeenCalledWith("Copied");
    });
  });

  it("keeps the right-clicked article as the action target when selection data updates while the menu is open", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    const { rerender } = render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    rerender(
      <ArticleContextMenu article={sampleArticles[1]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
    );

    await user.click(await screen.findByRole("menuitem", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: sampleArticles[0]?.url, background: false },
      });
    });
    expect(calls).not.toContainEqual({
      cmd: "open_in_browser",
      args: { url: sampleArticles[1]?.url, background: false },
    });
  });

  it("keeps the right-clicked article's feed URL as the copy target when selection data updates while the menu is open", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "copy_to_clipboard":
          return null;
        default:
          return undefined;
      }
    });

    const { rerender } = render(
      <ArticleContextMenu article={sampleArticles[0]} feedUrl={sampleFeeds[0].url}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    rerender(
      <ArticleContextMenu article={sampleArticles[2]} feedUrl={sampleFeeds[1].url}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
    );

    await user.click(await screen.findByRole("menuitem", { name: "Copy Feed URL" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "copy_to_clipboard",
        args: { text: sampleFeeds[0].url },
      });
    });
    expect(calls).not.toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: sampleFeeds[1].url },
    });
  });
});
