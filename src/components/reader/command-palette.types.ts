import type { LucideIcon } from "lucide-react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";

export type CommandPaletteItemKind = "action" | "feed" | "tag" | "article" | "scenario";

export type CommandPaletteActionItem = {
  id: AppAction | "open-shortcuts-help";
  label: string;
  shortcut?: string;
  icon: LucideIcon;
};

export type CommandPaletteItemValueResolver = (kind: CommandPaletteItemKind, id: string) => string;

export type CommandPaletteResultsProps = {
  recentActions: CommandPaletteActionItem[];
  filteredActions: CommandPaletteActionItem[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: FeedDto[];
  filteredTags: TagDto[];
  articles: ArticleDto[];
  showRecentActions: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showTags: boolean;
  showArticles: boolean;
  hasVisibleResults: boolean;
  noResultsLabel: string;
  recentActionsHeading: string;
  actionsHeading: string;
  feedsHeading: string;
  tagsHeading: string;
  articlesHeading: string;
  getCommandItemValue: CommandPaletteItemValueResolver;
  onActionSelect: (action: CommandPaletteActionItem["id"]) => void;
  onDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
  onFeedSelect: (feedId: string) => void;
  onTagSelect: (tagId: string) => void;
  onArticleSelect: (feedId: string, articleId: string) => void;
};

export type CommandPaletteActionGroupsProps = Pick<
  CommandPaletteResultsProps,
  | "recentActions"
  | "filteredActions"
  | "showRecentActions"
  | "showActions"
  | "recentActionsHeading"
  | "actionsHeading"
  | "getCommandItemValue"
  | "onActionSelect"
>;

export type CommandPaletteResourceGroupsProps = Pick<
  CommandPaletteResultsProps,
  | "filteredDevScenarios"
  | "filteredFeeds"
  | "filteredTags"
  | "articles"
  | "showRecentActions"
  | "showDevScenarios"
  | "showFeeds"
  | "showTags"
  | "showArticles"
  | "feedsHeading"
  | "tagsHeading"
  | "articlesHeading"
  | "getCommandItemValue"
  | "onDevScenarioSelect"
  | "onFeedSelect"
  | "onTagSelect"
  | "onArticleSelect"
>;
