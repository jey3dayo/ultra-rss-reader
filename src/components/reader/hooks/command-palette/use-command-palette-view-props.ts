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
  tagsHeading: string;
  articlesHeading: string;
  recentActions: CommandPaletteActionItem[];
  filteredActions: CommandPaletteActionItem[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: CommandPaletteResultsProps["items"]["filteredFeeds"];
  filteredTags: CommandPaletteResultsProps["items"]["filteredTags"];
  articles: CommandPaletteResultsProps["items"]["articles"];
  recentFeeds: CommandPaletteResultsProps["items"]["recentFeeds"];
  recentTags: CommandPaletteResultsProps["items"]["recentTags"];
  recentArticles: CommandPaletteResultsProps["items"]["recentArticles"];
  showRecentActions: boolean;
  showRecentResources: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showTags: boolean;
  showArticles: boolean;
  hasVisibleResults: boolean;
  onActionSelect: CommandPaletteResultsProps["handlers"]["onActionSelect"];
  onDevScenarioSelect: CommandPaletteResultsProps["handlers"]["onDevScenarioSelect"];
  onFeedSelect: CommandPaletteResultsProps["handlers"]["onFeedSelect"];
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
  tagsHeading,
  articlesHeading,
  recentActions,
  filteredActions,
  filteredDevScenarios,
  filteredFeeds,
  filteredTags,
  articles,
  recentFeeds,
  recentTags,
  recentArticles,
  showRecentActions,
  showRecentResources,
  showActions,
  showDevScenarios,
  showFeeds,
  showTags,
  showArticles,
  hasVisibleResults,
  onActionSelect,
  onDevScenarioSelect,
  onFeedSelect,
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
        filteredTags,
        articles,
        recentFeeds,
        recentTags,
        recentArticles,
      },
      visibility: {
        recentActions: showRecentActions,
        recentResources: showRecentResources,
        actions: showActions,
        devScenarios: showDevScenarios,
        feeds: showFeeds,
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
        tagsHeading,
        articlesHeading,
      },
      handlers: {
        onActionSelect,
        onDevScenarioSelect,
        onFeedSelect,
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
