// Keyboard dispatch context and the shortcut-id to KeyboardAction mapping.
import { Result } from "@praha/byethrow";
import type { PlatformKind } from "@/constants/platform";
import type { ContentMode } from "@/lib/layout/layout-state.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type {
  KeyboardAction,
  KeyboardActionSkipReason,
  KeyToActionMap,
  ShortcutActionId,
} from "./keyboard-shortcut-model";
import { keyboardEvents } from "./keyboard-shortcut-model";

export type KeyboardContext = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  targetTag?: string | null;
  targetIsTextEditing?: boolean;
  targetIsNativeActivation?: boolean;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  viewMode: ViewMode;
  subscriptionsWorkspaceOpen?: boolean;
  keyToAction?: KeyToActionMap;
  platformKind?: PlatformKind;
};

export function nextViewMode(current: ViewMode): ViewMode {
  const modes: ViewMode[] = ["all", "unread", "starred"];
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
}

export function isTextInputTarget(targetTag?: string | null, targetIsTextEditing = false): boolean {
  const normalizedTag = targetTag?.toUpperCase();
  return targetIsTextEditing || normalizedTag === "INPUT" || normalizedTag === "TEXTAREA";
}

export function resolveActionForId(
  actionId: ShortcutActionId,
  context: {
    selectedArticleId: string | null;
    contentMode: ContentMode;
    viewMode: ViewMode;
    subscriptionsWorkspaceOpen?: boolean;
  },
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  switch (actionId) {
    case "open_settings":
      return Result.succeed({ type: "open-settings" });
    case "open_command_palette":
      return Result.succeed({ type: "open-command-palette" });
    case "toggle_read":
      return context.selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.toggleRead })
        : Result.fail("missing_selected_article");
    case "toggle_star":
      return context.selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.toggleStar })
        : Result.fail("missing_selected_article");
    case "open_in_app_browser":
      return context.selectedArticleId
        ? Result.succeed({
            type: "emit",
            eventName: keyboardEvents.openInAppBrowser,
          })
        : Result.fail("missing_selected_article");
    case "open_external_browser":
      return context.selectedArticleId
        ? Result.succeed({
            type: "emit",
            eventName: keyboardEvents.openExternalBrowser,
          })
        : Result.fail("missing_selected_article");
    case "cycle_filter":
      return Result.succeed({
        type: "set-view-mode",
        mode: nextViewMode(context.viewMode),
      });
    case "show_unread":
      return Result.succeed({ type: "set-view-mode", mode: "unread" });
    case "show_all":
      return Result.succeed({ type: "set-view-mode", mode: "all" });
    case "show_starred":
      return Result.succeed({ type: "set-view-mode", mode: "starred" });
    case "mark_all_read":
      return Result.succeed({
        type: "emit",
        eventName: keyboardEvents.markAllRead,
      });
    case "search":
      return Result.succeed({
        type: "emit",
        eventName: keyboardEvents.focusSearch,
      });
    case "close_or_clear":
      if (context.subscriptionsWorkspaceOpen) {
        return Result.fail("no_action");
      }
      if (context.contentMode === "browser") return Result.succeed({ type: "close-browser" });
      if (context.selectedArticleId) return Result.succeed({ type: "clear-article" });
      return Result.fail("no_action");
    case "focus_sidebar":
      return Result.succeed({ type: "focus-sidebar" });
    case "toggle_sidebar":
      return Result.succeed({ type: "toggle-sidebar" });
    case "next_article":
      return Result.succeed({ type: "navigate-article", direction: 1 });
    case "prev_article":
      return Result.succeed({ type: "navigate-article", direction: -1 });
    case "scroll_article_down":
      if (context.contentMode === "browser") return Result.fail("no_action");
      return context.selectedArticleId
        ? Result.succeed({ type: "scroll-article", direction: 1 })
        : Result.fail("missing_selected_article");
    case "scroll_article_up":
      if (context.contentMode === "browser") return Result.fail("no_action");
      return context.selectedArticleId
        ? Result.succeed({ type: "scroll-article", direction: -1 })
        : Result.fail("missing_selected_article");
    case "next_feed":
      return Result.succeed({ type: "navigate-feed", direction: 1 });
    case "prev_feed":
      return Result.succeed({ type: "navigate-feed", direction: -1 });
    case "reload_webview":
      return context.contentMode === "browser" ? Result.succeed({ type: "reload-webview" }) : Result.fail("no_action");
  }
}
