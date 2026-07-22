import {
  CircleHelpIcon,
  ClockIcon,
  ListFilterIcon,
  MonitorIcon,
  MoonIcon,
  NewspaperIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  RssIcon,
  SettingsIcon,
  StarIcon,
  SunIcon,
} from "lucide-react";
import { useMemo } from "react";
import type { PlatformInfo } from "@/api/schemas";
import { useStableOpenTranslation } from "@/lib/i18n/use-stable-open-translation";
import { getShortcutDisplay } from "@/lib/keyboard/keyboard-shortcuts";
import type { PaletteAction } from "../../command-palette.types";

type UseCommandPaletteActionsParams = {
  open: boolean;
  platformKind: PlatformInfo["kind"];
  shortcutPrefs: Record<string, string>;
  selectedAccountId: string | null;
  isSyncing: boolean;
};

type UseCommandPaletteActionsResult = PaletteAction[];

export function useCommandPaletteActions({
  open,
  platformKind,
  shortcutPrefs,
  selectedAccountId,
  isSyncing,
}: UseCommandPaletteActionsParams): UseCommandPaletteActionsResult {
  const t = useStableOpenTranslation("reader", open);
  const tSidebar = useStableOpenTranslation("sidebar", open);
  const tSettings = useStableOpenTranslation("settings", open);

  return useMemo(() => {
    const actions: UseCommandPaletteActionsResult = [
      {
        id: "open-settings",
        label: t("shortcuts.open_settings"),
        shortcut: getShortcutDisplay("open_settings", shortcutPrefs, platformKind),
        keywords: [
          "settings",
          "preferences",
          "設定",
          "環境設定",
          "一般",
          "閲覧",
          "外観",
          "サイドバー",
          "ナビゲーション",
          "データ管理",
        ],
        icon: SettingsIcon,
      },
      {
        id: "open-current-account-settings",
        label: tSidebar("account_settings"),
        keywords: ["account", "settings", "preferences", "アカウント", "設定"],
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
        keywords: [
          "theme",
          "appearance",
          "light",
          "テーマ",
          "外観",
          "ライト",
          tSettings("appearance.theme"),
          tSettings("appearance.light"),
        ],
        icon: SunIcon,
      },
      {
        id: "set-theme-dark",
        label: t("command_palette.theme_action", {
          theme: tSettings("appearance.dark"),
        }),
        keywords: [
          "theme",
          "appearance",
          "dark",
          "テーマ",
          "外観",
          "ダーク",
          tSettings("appearance.theme"),
          tSettings("appearance.dark"),
        ],
        icon: MoonIcon,
      },
      {
        id: "set-theme-system",
        label: t("command_palette.theme_action", {
          theme: tSettings("appearance.automatic"),
        }),
        keywords: [
          "theme",
          "appearance",
          "system",
          "auto",
          "テーマ",
          "外観",
          "システム",
          "自動",
          tSettings("appearance.theme"),
          tSettings("appearance.automatic"),
        ],
        icon: MonitorIcon,
      },
      ...(selectedAccountId
        ? [
            {
              id: "show-smart-unread" as const,
              label: tSidebar("unread"),
              keywords: ["unread", "smart", "view", "未読"],
              icon: NewspaperIcon,
            },
            {
              id: "show-smart-starred" as const,
              label: tSidebar("starred"),
              keywords: ["starred", "smart", "view", "スター"],
              icon: StarIcon,
            },
            {
              id: "show-smart-recent" as const,
              label: tSidebar("recent_articles"),
              keywords: ["recent", "smart", "view", "最近", "履歴"],
              icon: ClockIcon,
            },
            {
              id: "show-smart-all" as const,
              label: tSidebar("all"),
              keywords: ["all", "smart", "view", "すべて"],
              icon: ListFilterIcon,
            },
          ]
        : []),
      {
        id: "set-filter-unread",
        label: t("command_palette.filter_action", { filter: t("filter_unread") }),
        keywords: ["filter", "unread", "フィルター", "未読"],
        icon: ListFilterIcon,
      },
      {
        id: "set-filter-all",
        label: t("command_palette.filter_action", { filter: t("filter_all") }),
        keywords: ["filter", "all", "フィルター", "すべて"],
        icon: ListFilterIcon,
      },
      {
        id: "set-filter-starred",
        label: t("command_palette.filter_action", { filter: t("filter_starred") }),
        keywords: ["filter", "starred", "フィルター", "スター"],
        icon: ListFilterIcon,
      },
      ...(selectedAccountId
        ? [
            {
              id: "open-add-feed" as const,
              label: t("add_feed"),
              keywords: ["feed", "rss", "subscribe"],
              icon: RssIcon,
            },
          ]
        : []),
      {
        id: "open-subscriptions-index",
        label: tSidebar("subscriptions_index"),
        keywords: ["subscriptions", "feeds", "management"],
        icon: RssIcon,
      },
      ...(selectedAccountId && !isSyncing
        ? [
            {
              id: "sync-all" as const,
              label: tSidebar("sync_feeds"),
              keywords: ["sync", "refresh", "reload"],
              icon: RefreshCwIcon,
            },
          ]
        : []),
      ...(selectedAccountId
        ? [
            {
              id: "mark-all-read" as const,
              label: t("shortcuts.mark_all_read"),
              shortcut: getShortcutDisplay("mark_all_read", shortcutPrefs, platformKind),
              keywords: ["read", "articles"],
              icon: NewspaperIcon,
            },
          ]
        : []),
    ];

    if (import.meta.env.DEV) {
      actions.push({
        id: "restart-app",
        label: t("command_palette.restart_app"),
        keywords: ["restart", "relaunch", "reload", "dev"],
        icon: RotateCcwIcon,
      });
    }

    return actions;
  }, [isSyncing, platformKind, selectedAccountId, shortcutPrefs, t, tSettings, tSidebar]);
}
