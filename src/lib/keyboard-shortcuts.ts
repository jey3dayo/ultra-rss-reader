import { Result } from "@praha/byethrow";

export const keyboardEvents = {
  toggleRead: "ultra-rss:toggle-read",
  toggleStar: "ultra-rss:toggle-star",
  openInAppBrowser: "ultra-rss:open-in-app-browser",
  openExternalBrowser: "ultra-rss:open-external-browser",
  markAllRead: "ultra-rss:mark-all-read",
  focusSearch: "ultra-rss:focus-search",
} as const;

type ContentMode = "empty" | "reader" | "browser" | "loading";
type ViewMode = "all" | "unread" | "starred";

export type KeyboardAction =
  | { type: "open-settings" }
  | { type: "emit"; eventName: (typeof keyboardEvents)[keyof typeof keyboardEvents] }
  | { type: "set-view-mode"; mode: ViewMode }
  | { type: "close-browser" }
  | { type: "clear-article" }
  | { type: "focus-sidebar" }
  | { type: "noop" };

export type KeyboardActionSkipReason = "ignored_input" | "missing_selected_article" | "no_action";

type KeyboardContext = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  targetTag?: string | null;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  viewMode: ViewMode;
};

function nextViewMode(current: ViewMode): ViewMode {
  const modes: ViewMode[] = ["all", "unread", "starred"];
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
}

function isTextInputTarget(targetTag?: string | null): boolean {
  return targetTag === "INPUT" || targetTag === "TEXTAREA";
}

export function resolveKeyboardAction(
  context: KeyboardContext,
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  const { key, metaKey, ctrlKey, targetTag, selectedArticleId, contentMode, viewMode } = context;

  if (key === "," && (metaKey || ctrlKey)) {
    return Result.succeed({ type: "open-settings" });
  }

  if (isTextInputTarget(targetTag)) {
    return Result.fail("ignored_input");
  }

  switch (key) {
    case "m":
      return selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.toggleRead })
        : Result.fail("missing_selected_article");
    case "s":
      return selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.toggleStar })
        : Result.fail("missing_selected_article");
    case "v":
      return selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.openInAppBrowser })
        : Result.fail("missing_selected_article");
    case "b":
      return selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.openExternalBrowser })
        : Result.fail("missing_selected_article");
    case "r":
      return Result.succeed({ type: "noop" as const });
    case "f":
      return Result.succeed({ type: "set-view-mode", mode: nextViewMode(viewMode) });
    case "a":
      return Result.succeed({ type: "emit", eventName: keyboardEvents.markAllRead });
    case "/":
      return Result.succeed({ type: "emit", eventName: keyboardEvents.focusSearch });
    case "Escape":
      if (contentMode === "browser") return Result.succeed({ type: "close-browser" });
      if (selectedArticleId) return Result.succeed({ type: "clear-article" });
      return Result.fail("no_action");
    case "u":
      return Result.succeed({ type: "focus-sidebar" });
    default:
      return Result.fail("no_action");
  }
}
