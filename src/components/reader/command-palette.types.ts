import type { LucideIcon } from "lucide-react";
import type { ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import type { RuntimeDevScenario } from "@/dev/scenario-runtime";
import type { AppAction } from "@/lib/app-actions";

type CommandPaletteItemKind = "action" | "feed" | "folder" | "tag" | "article" | "scenario";

/** Palette-only pseudo actions that do not go through the AppAction dispatcher. */
type CommandPalettePseudoAction =
  | "open-shortcuts-help"
  | "show-smart-unread"
  | "show-smart-starred"
  | "show-smart-recent"
  | "show-smart-all";

export type CommandPaletteActionItem = {
  id: AppAction | CommandPalettePseudoAction;
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
  filteredFolders: FolderDto[];
  filteredTags: TagDto[];
  articles: ArticleDto[];
  recentFeeds: FeedDto[];
  recentFolders: FolderDto[];
  recentTags: TagDto[];
  recentArticles: ArticleDto[];
};

type CommandPaletteResultsVisibility = {
  recentActions: boolean;
  recentResources: boolean;
  actions: boolean;
  devScenarios: boolean;
  feeds: boolean;
  folders: boolean;
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
  foldersHeading: string;
  tagsHeading: string;
  articlesHeading: string;
};

type CommandPaletteResultsHandlers = {
  onActionSelect: (action: CommandPaletteActionItem["id"]) => void;
  onDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
  onFeedSelect: (feedId: string) => void;
  onFolderSelect: (folderId: string) => void;
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
