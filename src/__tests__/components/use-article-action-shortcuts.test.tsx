import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type UseArticleActionShortcutsParams,
  useArticleActionShortcuts,
} from "@/components/reader/hooks/article/use-article-action-shortcuts";
import { useKeyboard } from "@/hooks/use-keyboard";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type TestShortcutsProps = Partial<UseArticleActionShortcutsParams>;

function TestShortcuts({
  keyboardShortcuts,
  selectedArticleUrl = "https://example.com/article",
  onToggleRead = vi.fn(),
  onToggleStar = vi.fn(),
  onOpenExternalBrowser = vi.fn(),
  onCopyLink = vi.fn(),
  onAddToReadingList = vi.fn(),
}: TestShortcutsProps) {
  useKeyboard();
  useArticleActionShortcuts({
    keyboardShortcuts,
    selectedArticleUrl,
    onToggleRead,
    onToggleStar,
    onOpenExternalBrowser,
    onCopyLink,
    onAddToReadingList,
  });
  return null;
}

describe("useArticleActionShortcuts", () => {
  beforeEach(() => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  it("uses default shortcut keys when keyboardShortcuts is undefined", () => {
    const onToggleRead = vi.fn();
    const onToggleStar = vi.fn();
    const onOpenExternalBrowser = vi.fn();

    render(
      <TestShortcuts
        onToggleRead={onToggleRead}
        onToggleStar={onToggleStar}
        onOpenExternalBrowser={onOpenExternalBrowser}
      />,
    );

    fireEvent.keyDown(window, { key: "m" });
    fireEvent.keyDown(window, { key: "s" });
    fireEvent.keyDown(window, { key: "b" });

    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleStar).toHaveBeenCalledTimes(1);
    expect(onOpenExternalBrowser).toHaveBeenCalledTimes(1);
  });

  it("does not call an action when its shortcut is disabled", () => {
    const onToggleRead = vi.fn();
    usePreferencesStore.setState({
      prefs: { shortcut_toggle_read: "" },
      loaded: true,
    });

    render(<TestShortcuts onToggleRead={onToggleRead} />);

    fireEvent.keyDown(window, { key: "m" });

    expect(onToggleRead).not.toHaveBeenCalled();
  });

  it("silently ignores URL actions while Web Preview is visible without a selected article", () => {
    const onOpenExternalBrowser = vi.fn();
    const onCopyLink = vi.fn();
    const onAddToReadingList = vi.fn();
    useUiStore.setState({
      selectedArticleId: null,
      contentMode: "browser",
      browserUrl: "https://example.com/preview",
    });

    render(
      <TestShortcuts
        onOpenExternalBrowser={onOpenExternalBrowser}
        onCopyLink={onCopyLink}
        onAddToReadingList={onAddToReadingList}
      />,
    );

    window.dispatchEvent(new Event(keyboardEvents.openExternalBrowser));
    window.dispatchEvent(new Event(keyboardEvents.copyLink));
    window.dispatchEvent(new Event(keyboardEvents.addToReadingList));

    expect(onOpenExternalBrowser).not.toHaveBeenCalled();
    expect(onCopyLink).not.toHaveBeenCalled();
    expect(onAddToReadingList).not.toHaveBeenCalled();
  });

  it("silently ignores URL actions while Web Preview is visible without an article URL", () => {
    const onOpenExternalBrowser = vi.fn();
    const onCopyLink = vi.fn();
    const onAddToReadingList = vi.fn();
    useUiStore.setState({
      contentMode: "browser",
      browserUrl: "https://example.com/preview",
    });

    render(
      <TestShortcuts
        selectedArticleUrl={null}
        onOpenExternalBrowser={onOpenExternalBrowser}
        onCopyLink={onCopyLink}
        onAddToReadingList={onAddToReadingList}
      />,
    );

    fireEvent.keyDown(window, { key: "b" });
    window.dispatchEvent(new Event(keyboardEvents.copyLink));
    window.dispatchEvent(new Event(keyboardEvents.addToReadingList));

    expect(onOpenExternalBrowser).not.toHaveBeenCalled();
    expect(onCopyLink).not.toHaveBeenCalled();
    expect(onAddToReadingList).not.toHaveBeenCalled();
  });
});
