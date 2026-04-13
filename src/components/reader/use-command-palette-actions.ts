import { CircleHelpIcon, NewspaperIcon, RefreshCwIcon, RssIcon, SettingsIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getShortcutDisplay } from "@/lib/keyboard-shortcuts";
import type { PaletteAction } from "./use-command-palette-data";
import type { useCommandPaletteUiState } from "./use-command-palette-ui-state";

type UseCommandPaletteActionsParams = Pick<
  ReturnType<typeof useCommandPaletteUiState>,
  "platformKind" | "shortcutPrefs"
>;

export function useCommandPaletteActions({ platformKind, shortcutPrefs }: UseCommandPaletteActionsParams) {
  const { t } = useTranslation("reader");
  const { t: tSidebar } = useTranslation("sidebar");

  return useMemo<PaletteAction[]>(
    () => [
      {
        id: "open-settings",
        label: t("shortcuts.open_settings"),
        shortcut: getShortcutDisplay("open_settings", shortcutPrefs, platformKind),
        keywords: ["settings", "preferences"],
        icon: SettingsIcon,
      },
      {
        id: "open-shortcuts-help",
        label: t("shortcuts.open_shortcuts_help"),
        shortcut: "?",
        keywords: ["help", "shortcuts", "keyboard", "?"],
        icon: CircleHelpIcon,
      },
      {
        id: "open-add-feed",
        label: t("add_feed"),
        keywords: ["feed", "rss", "subscribe"],
        icon: RssIcon,
      },
      {
        id: "open-feed-cleanup",
        label: tSidebar("feed_cleanup"),
        keywords: ["feed", "cleanup", "management"],
        icon: RssIcon,
      },
      {
        id: "sync-all",
        label: tSidebar("sync_feeds"),
        keywords: ["sync", "refresh", "reload"],
        icon: RefreshCwIcon,
      },
      {
        id: "mark-all-read",
        label: t("shortcuts.mark_all_read"),
        shortcut: getShortcutDisplay("mark_all_read", shortcutPrefs, platformKind),
        keywords: ["read", "articles"],
        icon: NewspaperIcon,
      },
    ],
    [platformKind, shortcutPrefs, t, tSidebar],
  );
}
