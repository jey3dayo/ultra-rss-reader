import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleCommands } from "@/components/reader/hooks/article/use-article-commands";
import { useArticlePaneShortcuts } from "@/components/reader/hooks/article/use-article-pane-shortcuts";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

function createCommands() {
  return {
    setRead: vi.fn(),
    setStarred: vi.fn(),
    toggleRead: vi.fn(),
    toggleStar: vi.fn(),
    openInExternalBrowser: vi.fn(),
    copyLink: vi.fn(),
    addToReadingList: vi.fn(),
  } satisfies ArticleCommands;
}

function dispatchUrlShortcuts() {
  window.dispatchEvent(new Event(keyboardEvents.openExternalBrowser));
  window.dispatchEvent(new Event(keyboardEvents.copyLink));
  window.dispatchEvent(new Event(keyboardEvents.addToReadingList));
}

describe("useArticlePaneShortcuts", () => {
  const overlay = { onToggle: vi.fn(), onClose: vi.fn() };

  beforeEach(() => {
    useUiStore.setState({ ...useUiStore.getInitialState() });
  });

  it("ignores URL shortcuts while Web Preview has no selected article", () => {
    useUiStore.setState({ contentMode: "browser", selectedArticleId: null });
    const commands = createCommands();
    renderHook(() => useArticlePaneShortcuts({ commands, articleUrl: "https://example.com/1", overlay }));

    dispatchUrlShortcuts();

    expect(commands.openInExternalBrowser).not.toHaveBeenCalled();
    expect(commands.copyLink).not.toHaveBeenCalled();
    expect(commands.addToReadingList).not.toHaveBeenCalled();
  });

  it("runs URL shortcuts in Web Preview when an article is selected", () => {
    useUiStore.setState({ contentMode: "browser", selectedArticleId: "art-1" });
    const commands = createCommands();
    renderHook(() => useArticlePaneShortcuts({ commands, articleUrl: "https://example.com/1", overlay }));

    dispatchUrlShortcuts();

    expect(commands.openInExternalBrowser).toHaveBeenCalledTimes(1);
    expect(commands.copyLink).toHaveBeenCalledTimes(1);
    expect(commands.addToReadingList).toHaveBeenCalledTimes(1);
  });
});
