import { CircleHelpIcon, MoonIcon, NewspaperIcon, RefreshCwIcon, RssIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getShortcutDisplay } from "@/lib/keyboard-shortcuts";
import type { UseCommandPaletteActionsParams, UseCommandPaletteActionsResult } from "./command-palette.types";

export function useCommandPaletteActions({
  platformKind,
  shortcutPrefs,
}: UseCommandPaletteActionsParams): UseCommandPaletteActionsResult {
  const { t } = useTranslation("reader");
  const { t: tSidebar } = useTranslation("sidebar");
  const { t: tSettings } = useTranslation("settings");

  return useMemo(
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
        id: "set-theme-light",
        label: t("command_palette.theme_action", {
          theme: tSettings("appearance.light"),
        }),
        keywords: ["theme", "appearance", "light", tSettings("appearance.theme"), tSettings("appearance.light")],
        icon: SunIcon,
      },
      {
        id: "set-theme-dark",
        label: t("command_palette.theme_action", {
          theme: tSettings("appearance.dark"),
        }),
        keywords: ["theme", "appearance", "dark", tSettings("appearance.theme"), tSettings("appearance.dark")],
        icon: MoonIcon,
      },
      {
        id: "open-add-feed",
        label: t("add_feed"),
        keywords: ["feed", "rss", "subscribe"],
        icon: RssIcon,
      },
      {
        id: "open-subscriptions-index",
        label: tSidebar("subscriptions_index"),
        keywords: ["subscriptions", "feeds", "management"],
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
    [platformKind, shortcutPrefs, t, tSettings, tSidebar],
  );
}
