import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import type {
  CommandPaletteActionItem,
  CommandPaletteResultsProps,
  CommandPaletteViewPropsResult,
} from "./command-palette.types";

type UseCommandPaletteViewPropsParams = {
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

export function useCommandPaletteViewProps({
  title,
  description,
  placeholder,
  noResultsLabel,
  recentActionsHeading,
  actionsHeading,
  feedsHeading,
  tagsHeading,
  articlesHeading,
  recentActions,
  filteredActions,
  filteredDevScenarios,
  filteredFeeds,
  filteredTags,
  articles,
  showRecentActions,
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
      recentActions,
      filteredActions,
      filteredDevScenarios,
      filteredFeeds,
      filteredTags,
      articles,
      showRecentActions,
      showActions,
      showDevScenarios,
      showFeeds,
      showTags,
      showArticles,
      hasVisibleResults,
      noResultsLabel,
      recentActionsHeading,
      actionsHeading,
      feedsHeading,
      tagsHeading,
      articlesHeading,
      onActionSelect,
      onDevScenarioSelect,
      onFeedSelect,
      onTagSelect,
      onArticleSelect,
    },
    prefixHints: {
      actions: prefixHintActions,
      feeds: prefixHintFeeds,
      tags: prefixHintTags,
    },
  };
}
