import type { LucideIcon } from "lucide-react";
import type { PlatformInfo } from "@/api/schemas";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import type { ToastData } from "@/stores/ui-store";

export type CommandPaletteItemKind = "action" | "feed" | "tag" | "article" | "scenario";

export type CommandPaletteActionItem = {
  id: AppAction | "open-shortcuts-help";
  label: string;
  shortcut?: string;
  icon: LucideIcon;
};

export type PaletteAction = CommandPaletteActionItem & {
  keywords: string[];
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

export type CommandPaletteViewResultsProps = Omit<CommandPaletteResultsProps, "getCommandItemValue">;

export type CommandPalettePrefixHints = {
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

export type UseCommandPaletteDataParams = {
  actions: PaletteAction[];
  deferredQuery: string;
  devScenarios: RuntimeDevScenario[];
  prefix: string | null;
  query: string;
  selectedAccountId: string | null;
};

export type UseCommandPaletteDataResult = {
  articles: ArticleDto[];
  filteredActions: PaletteAction[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: FeedDto[];
  filteredTags: TagDto[];
  recentActions: PaletteAction[];
  showRecentActions: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showTags: boolean;
  showArticles: boolean;
  hasVisibleResults: boolean;
};

export type UseCommandPaletteActionsParams = {
  platformKind: PlatformInfo["kind"];
  shortcutPrefs: Record<string, string>;
};

export type UseCommandPaletteActionsResult = PaletteAction[];

export type UseCommandPaletteHandlersParams = {
  closePalette: () => void;
  openShortcutsHelp: () => void;
  showToast: (message: string | ToastData) => void;
  selectFeed: (feedId: string) => void;
  selectTag: (tagId: string) => void;
  selectArticle: (articleId: string) => void;
  openFeedLanding: (feedId: string) => Promise<void>;
};

export type UseCommandPaletteHandlersResult = {
  handleActionSelect: (action: PaletteAction["id"]) => void;
  handleFeedSelect: (feedId: string) => void;
  handleTagSelect: (tagId: string) => void;
  handleArticleSelect: (feedId: string, articleId: string) => void;
  handleDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
};

export type UseCommandPaletteRuntimeParams = {
  open: boolean;
};

export type UseCommandPaletteRuntimeResult = {
  input: string;
  setInput: (value: string) => void;
  devScenarios: RuntimeDevScenario[];
  prefix: string | null;
  query: string;
  deferredQuery: string;
};

export type UseCommandPaletteViewPropsParams = {
  title: string;
  description: string;
  placeholder: string;
  noResultsLabel: string;
  recentActionsHeading: string;
  actionsHeading: string;
  feedsHeading: string;
  tagsHeading: string;
  articlesHeading: string;
  recentActions: CommandPaletteActionItem[];
  filteredActions: CommandPaletteActionItem[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: CommandPaletteResultsProps["filteredFeeds"];
  filteredTags: CommandPaletteResultsProps["filteredTags"];
  articles: CommandPaletteResultsProps["articles"];
  showRecentActions: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showTags: boolean;
  showArticles: boolean;
  hasVisibleResults: boolean;
  onActionSelect: CommandPaletteResultsProps["onActionSelect"];
  onDevScenarioSelect: CommandPaletteResultsProps["onDevScenarioSelect"];
  onFeedSelect: CommandPaletteResultsProps["onFeedSelect"];
  onTagSelect: CommandPaletteResultsProps["onTagSelect"];
  onArticleSelect: CommandPaletteResultsProps["onArticleSelect"];
  prefixHintActions: string;
  prefixHintFeeds: string;
  prefixHintTags: string;
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

export type CommandPaletteActionItemsProps = Pick<
  CommandPaletteActionGroupsProps,
  "getCommandItemValue" | "onActionSelect"
> & {
  actions: CommandPaletteActionItem[];
  keyPrefix?: string;
};

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
