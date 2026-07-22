import type { RuntimeDevScenario } from "@/dev/scenario-runtime";
import type {
  CommandPaletteActionItem,
  CommandPaletteResultsProps,
  CommandPaletteViewPropsResult,
} from "../../command-palette.types";

type UseCommandPaletteViewPropsParams = {
  title: string;
  description: string;
  placeholder: string;
  noResultsLabel: string;
  resultsLabel: string;
  recentActionsHeading: string;
  actionsHeading: string;
  devScenariosHeading: string;
  feedsHeading: string;
  foldersHeading: string;
  tagsHeading: string;
  articlesHeading: string;
  recentActions: CommandPaletteActionItem[];
  filteredActions: CommandPaletteActionItem[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: CommandPaletteResultsProps["items"]["filteredFeeds"];
  filteredFolders: CommandPaletteResultsProps["items"]["filteredFolders"];
  filteredTags: CommandPaletteResultsProps["items"]["filteredTags"];
  articles: CommandPaletteResultsProps["items"]["articles"];
  recentFeeds: CommandPaletteResultsProps["items"]["recentFeeds"];
  recentFolders: CommandPaletteResultsProps["items"]["recentFolders"];
  recentTags: CommandPaletteResultsProps["items"]["recentTags"];
  recentArticles: CommandPaletteResultsProps["items"]["recentArticles"];
  showRecentActions: boolean;
  showRecentResources: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showFolders: boolean;
  showTags: boolean;
  showArticles: boolean;
  hasVisibleResults: boolean;
  onActionSelect: CommandPaletteResultsProps["handlers"]["onActionSelect"];
  onDevScenarioSelect: CommandPaletteResultsProps["handlers"]["onDevScenarioSelect"];
  onFeedSelect: CommandPaletteResultsProps["handlers"]["onFeedSelect"];
  onFolderSelect: CommandPaletteResultsProps["handlers"]["onFolderSelect"];
  onTagSelect: CommandPaletteResultsProps["handlers"]["onTagSelect"];
  onArticleSelect: CommandPaletteResultsProps["handlers"]["onArticleSelect"];
  prefixHintActions: string;
  prefixHintFeeds: string;
  prefixHintTags: string;
};

export function useCommandPaletteViewProps({
  title,
  description,
  placeholder,
  noResultsLabel,
  resultsLabel,
  recentActionsHeading,
  actionsHeading,
  devScenariosHeading,
  feedsHeading,
  foldersHeading,
  tagsHeading,
  articlesHeading,
  recentActions,
  filteredActions,
  filteredDevScenarios,
  filteredFeeds,
  filteredFolders,
  filteredTags,
  articles,
  recentFeeds,
  recentFolders,
  recentTags,
  recentArticles,
  showRecentActions,
  showRecentResources,
  showActions,
  showDevScenarios,
  showFeeds,
  showFolders,
  showTags,
  showArticles,
  hasVisibleResults,
  onActionSelect,
  onDevScenarioSelect,
  onFeedSelect,
  onFolderSelect,
  onTagSelect,
  onArticleSelect,
  prefixHintActions,
  prefixHintFeeds,
  prefixHintTags,
}: UseCommandPaletteViewPropsParams): CommandPaletteViewPropsResult {
  return {
    title,
    description,
    placeholder,
    resultsProps: {
      items: {
        recentActions,
        filteredActions,
        filteredDevScenarios,
        filteredFeeds,
        filteredFolders,
        filteredTags,
        articles,
        recentFeeds,
        recentFolders,
        recentTags,
        recentArticles,
      },
      visibility: {
        recentActions: showRecentActions,
        recentResources: showRecentResources,
        actions: showActions,
        devScenarios: showDevScenarios,
        feeds: showFeeds,
        folders: showFolders,
        tags: showTags,
        articles: showArticles,
        hasVisibleResults,
      },
      headings: {
        noResultsLabel,
        resultsLabel,
        recentActionsHeading,
        actionsHeading,
        devScenariosHeading,
        feedsHeading,
        foldersHeading,
        tagsHeading,
        articlesHeading,
      },
      handlers: {
        onActionSelect,
        onDevScenarioSelect,
        onFeedSelect,
        onFolderSelect,
        onTagSelect,
        onArticleSelect,
      },
    },
    prefixHints: {
      actions: prefixHintActions,
      feeds: prefixHintFeeds,
      tags: prefixHintTags,
    },
  };
}
