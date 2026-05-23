import { describe, expect, it } from "vitest";
import { resolveArticleListKeyboardIntent } from "@/lib/articles/article-list-keyboard-intent";
import { type KeyToActionMap, keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";

const keyToAction: KeyToActionMap = new Map([
  ["m", "toggle_read"],
  ["f", "cycle_filter"],
]);

const baseContext = {
  key: "m",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  optionTargetTag: "BUTTON",
  focusedArticleId: "focused-article",
  selectedArticleId: "selected-article",
  contentMode: "reader",
  viewMode: "unread",
  keyToAction,
} as const;

describe("resolveArticleListKeyboardIntent", () => {
  it("resolves arrow row navigation without DOM side effects", () => {
    expect(
      resolveArticleListKeyboardIntent({
        ...baseContext,
        key: "ArrowDown",
      }),
    ).toEqual({
      type: "keyboard-action",
      action: { type: "navigate-article", direction: 1 },
      debugLabel: "navigate-article",
    });

    expect(
      resolveArticleListKeyboardIntent({
        ...baseContext,
        key: "ArrowUp",
      }),
    ).toEqual({
      type: "keyboard-action",
      action: { type: "navigate-article", direction: -1 },
      debugLabel: "navigate-article",
    });
  });

  it("resolves arrow focus movement as local list intents", () => {
    expect(
      resolveArticleListKeyboardIntent({
        ...baseContext,
        key: "ArrowLeft",
      }),
    ).toEqual({
      type: "focus-sidebar",
      debugLabel: "focus-sidebar",
    });

    expect(
      resolveArticleListKeyboardIntent({
        ...baseContext,
        key: "ArrowRight",
      }),
    ).toEqual({
      type: "focus-content",
      articleId: "focused-article",
      debugLabel: "focus-content",
    });
  });

  it("delegates configured shortcut fallback to the shared keyboard resolver", () => {
    expect(resolveArticleListKeyboardIntent(baseContext)).toEqual({
      type: "keyboard-action",
      action: {
        type: "emit",
        eventName: keyboardEvents.toggleRead,
      },
      debugLabel: "emit",
    });

    expect(
      resolveArticleListKeyboardIntent({
        ...baseContext,
        key: "f",
      }),
    ).toEqual({
      type: "keyboard-action",
      action: {
        type: "set-view-mode",
        mode: "starred",
      },
      debugLabel: "set-view-mode",
    });
  });

  it("keeps unresolved shortcut fallback as a local no-op", () => {
    expect(
      resolveArticleListKeyboardIntent({
        ...baseContext,
        selectedArticleId: null,
      }),
    ).toBeNull();
  });
});
