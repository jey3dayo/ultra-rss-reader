import type { LucideIcon } from "lucide-react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { RuntimeDevScenario } from "@/dev/scenario-runtime";
import type { AppAction } from "@/lib/app-actions";

type CommandPaletteItemKind = "action" | "feed" | "tag" | "article" | "scenario";

export type CommandPaletteActionItem = {
  id: AppAction | "open-shortcuts-help";
  label: string;
  shortcut?: string;
  icon: LucideIcon;
};

export type PaletteAction = CommandPaletteActionItem & {
  keywords: string[];
};

type CommandPaletteItemValueResolver = (kind: CommandPaletteItemKind, id: string) => string;

type CommandPaletteResultsItems = {
  recentActions: CommandPaletteActionItem[];
  filteredActions: CommandPaletteActionItem[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: FeedDto[];
  filteredTags: TagDto[];
  articles: ArticleDto[];
  recentFeeds: FeedDto[];
  recentTags: TagDto[];
  recentArticles: ArticleDto[];
};

type CommandPaletteResultsVisibility = {
  recentActions: boolean;
  recentResources: boolean;
  actions: boolean;
  devScenarios: boolean;
  feeds: boolean;
  tags: boolean;
  articles: boolean;
  hasVisibleResults: boolean;
};

type CommandPaletteResultsHeadings = {
  noResultsLabel: string;
  resultsLabel: string;
  recentActionsHeading: string;
  actionsHeading: string;
  devScenariosHeading: string;
  feedsHeading: string;
  tagsHeading: string;
  articlesHeading: string;
};

type CommandPaletteResultsHandlers = {
  onActionSelect: (action: CommandPaletteActionItem["id"]) => void;
  onDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
  onFeedSelect: (feedId: string) => void;
  onTagSelect: (tagId: string) => void;
  onArticleSelect: (feedId: string, articleId: string) => void;
};

export type CommandPaletteResultsProps = {
  resultsMotionKey?: string;
  items: CommandPaletteResultsItems;
  visibility: CommandPaletteResultsVisibility;
  headings: CommandPaletteResultsHeadings;
  handlers: CommandPaletteResultsHandlers;
  getCommandItemValue: CommandPaletteItemValueResolver;
};

type CommandPaletteViewResultsProps = Omit<CommandPaletteResultsProps, "getCommandItemValue">;

type CommandPalettePrefixHints = {
  actions: string;
  feeds: string;
  tags: string;
};

export type CommandPaletteViewPropsResult = {
  title: string;
  description: string;
  placeholder: string;
  resultsProps: CommandPaletteViewResultsProps;
  prefixHints: CommandPalettePrefixHints;
};

export type CommandPaletteControllerResult = CommandPaletteViewPropsResult & {
  open: boolean;
  input: string;
  setInput: (value: string) => void;
  closePalette: () => void;
};
