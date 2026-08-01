import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleContextMenu } from "@/components/reader/article-context-menu";
import i18n from "@/lib/i18n";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

describe("ArticleContextMenu", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks();
  });

  it("opens the right-clicked article's resolved source feed for editing", async () => {
    render(
      <ArticleContextMenu article={sampleArticles[0]} sourceFeed={sampleFeeds[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit source feed…" }));

    expect(await screen.findByRole("heading", { name: "Edit Feed" })).toBeInTheDocument();
  });

  it("does not offer source-feed editing when the article feed is no longer resolved", async () => {
    render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: "Edit source feed…" })).toBeNull();
    });
  });

  it("uses browser wording for the external browser action", async () => {
    render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    expect(await screen.findByRole("menuitem", { name: "Open in Browser" })).toBeInTheDocument();
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
    await user.click(await screen.findByRole("menuitem", { name: "Open in Browser" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: sampleArticles[0]?.url, background: false },
      });
    });
  });

  it("does not register row context menus as global external-browser shortcut targets", () => {
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
      <>
        <ArticleContextMenu article={sampleArticles[0]}>
          <button type="button">First article row</button>
        </ArticleContextMenu>
        <ArticleContextMenu article={sampleArticles[1]}>
          <button type="button">Second article row</button>
        </ArticleContextMenu>
        <ArticleContextMenu article={sampleArticles[2]}>
          <button type="button">Third article row</button>
        </ArticleContextMenu>
      </>,
      { wrapper: createWrapper() },
    );

    window.dispatchEvent(new Event(keyboardEvents.openExternalBrowser));

    expect(calls.filter(({ cmd }) => cmd === "open_in_browser")).toHaveLength(0);
  });

  it("copies the article URL from the context menu", async () => {
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
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "copy_to_clipboard",
        args: { text: sampleArticles[0]?.url },
      });
      expect(showToast).toHaveBeenCalledWith("Link copied");
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

    await user.click(await screen.findByRole("menuitem", { name: "Open in Browser" }));

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

  it("keeps the right-clicked article URL as the copy target when selection data updates while the menu is open", async () => {
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
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    rerender(
      <ArticleContextMenu article={sampleArticles[2]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
    );

    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "copy_to_clipboard",
        args: { text: sampleArticles[0]?.url },
      });
    });
    expect(calls).not.toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: sampleArticles[2]?.url },
    });
  });
});
