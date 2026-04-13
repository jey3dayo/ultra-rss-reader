import { CommandEmpty, CommandList } from "../ui/command";
import type { CommandPaletteResultsProps } from "./command-palette.types";
import { CommandPaletteActionGroups } from "./command-palette-action-groups";
import { CommandPaletteResourceGroups } from "./command-palette-resource-groups";

export function CommandPaletteResults({
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
  getCommandItemValue,
  onActionSelect,
  onDevScenarioSelect,
  onFeedSelect,
  onTagSelect,
  onArticleSelect,
}: CommandPaletteResultsProps) {
  return (
    <CommandList>
      <CommandPaletteActionGroups
        recentActions={recentActions}
        filteredActions={filteredActions}
        showRecentActions={showRecentActions}
        showActions={showActions}
        recentActionsHeading={recentActionsHeading}
        actionsHeading={actionsHeading}
        getCommandItemValue={(kind, id) => getCommandItemValue(kind, id)}
        onActionSelect={onActionSelect}
      />

      <CommandPaletteResourceGroups
        filteredDevScenarios={filteredDevScenarios}
        filteredFeeds={filteredFeeds}
        filteredTags={filteredTags}
        articles={articles}
        showRecentActions={showRecentActions}
        showDevScenarios={showDevScenarios}
        showFeeds={showFeeds}
        showTags={showTags}
        showArticles={showArticles}
        feedsHeading={feedsHeading}
        tagsHeading={tagsHeading}
        articlesHeading={articlesHeading}
        getCommandItemValue={(kind, id) => getCommandItemValue(kind, id)}
        onDevScenarioSelect={onDevScenarioSelect}
        onFeedSelect={onFeedSelect}
        onTagSelect={onTagSelect}
        onArticleSelect={onArticleSelect}
      />

      {!showRecentActions && !hasVisibleResults ? <CommandEmpty>{noResultsLabel}</CommandEmpty> : null}
    </CommandList>
  );
}
