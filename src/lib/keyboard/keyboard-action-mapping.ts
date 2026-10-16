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

type KeyboardActionResolveContext = {
  selectedArticleId: string | null;
  contentMode: ContentMode;
  viewMode: ViewMode;
  subscriptionsWorkspaceOpen?: boolean;
};

const contextFreeActions: Partial<Record<ShortcutActionId, KeyboardAction>> = {
  open_settings: { type: "open-settings" },
  open_command_palette: { type: "open-command-palette" },
  show_unread: { type: "set-view-mode", mode: "unread" },
  show_all: { type: "set-view-mode", mode: "all" },
  show_starred: { type: "set-view-mode", mode: "starred" },
  mark_all_read: { type: "emit", eventName: keyboardEvents.markAllRead },
  search: { type: "emit", eventName: keyboardEvents.focusSearch },
  focus_sidebar: { type: "focus-sidebar" },
  toggle_sidebar: { type: "toggle-sidebar" },
  next_article: { type: "navigate-article", direction: 1 },
  prev_article: { type: "navigate-article", direction: -1 },
  next_feed: { type: "navigate-feed", direction: 1 },
  prev_feed: { type: "navigate-feed", direction: -1 },
};

const selectedArticleActions: Partial<Record<ShortcutActionId, KeyboardAction>> = {
  toggle_read: { type: "emit", eventName: keyboardEvents.toggleRead },
  toggle_star: { type: "emit", eventName: keyboardEvents.toggleStar },
  open_in_app_browser: { type: "emit", eventName: keyboardEvents.openInAppBrowser },
  open_external_browser: { type: "emit", eventName: keyboardEvents.openExternalBrowser },
};

const articleScrollDirections: Partial<Record<ShortcutActionId, 1 | -1>> = {
  scroll_article_down: 1,
  scroll_article_up: -1,
};

function lookupOwnEntry<T>(table: Partial<Record<ShortcutActionId, T>>, actionId: ShortcutActionId): T | undefined {
  return Object.hasOwn(table, actionId) ? table[actionId] : undefined;
}

function resolveCloseOrClearAction(
  context: KeyboardActionResolveContext,
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  if (context.subscriptionsWorkspaceOpen) {
    return Result.fail("no_action");
  }
  if (context.contentMode === "browser") return Result.succeed({ type: "close-browser" });
  if (context.selectedArticleId) return Result.succeed({ type: "clear-article" });
  return Result.fail("no_action");
}

function resolveArticleScrollAction(
  direction: 1 | -1,
  context: KeyboardActionResolveContext,
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  if (context.contentMode === "browser") return Result.fail("no_action");
  return context.selectedArticleId
    ? Result.succeed({ type: "scroll-article", direction })
    : Result.fail("missing_selected_article");
}

export function resolveActionForId(
  actionId: ShortcutActionId,
  context: KeyboardActionResolveContext,
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  const contextFreeAction = lookupOwnEntry(contextFreeActions, actionId);
  if (contextFreeAction) {
    return Result.succeed({ ...contextFreeAction });
  }
  const selectedArticleAction = lookupOwnEntry(selectedArticleActions, actionId);
  if (selectedArticleAction) {
    return context.selectedArticleId
      ? Result.succeed({ ...selectedArticleAction })
      : Result.fail("missing_selected_article");
  }
  const scrollDirection = lookupOwnEntry(articleScrollDirections, actionId);
  if (scrollDirection) {
    return resolveArticleScrollAction(scrollDirection, context);
  }
  switch (actionId) {
    case "cycle_filter":
      return Result.succeed({
        type: "set-view-mode",
        mode: nextViewMode(context.viewMode),
      });
    case "close_or_clear":
      return resolveCloseOrClearAction(context);
    case "reload_webview":
      return context.contentMode === "browser" ? Result.succeed({ type: "reload-webview" }) : Result.fail("no_action");
  }
  return Result.fail("no_action");
}
