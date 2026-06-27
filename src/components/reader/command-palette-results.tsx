import { CommandEmpty, CommandList } from "@/components/ui/command";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import type { CommandPaletteResultsProps } from "./command-palette.types";
import { CommandPaletteActionGroups } from "./command-palette-action-groups";
import { CommandPaletteResourceGroups } from "./command-palette-resource-groups";

export function CommandPaletteResults({
  resultsMotionKey = "",
  items,
  visibility,
  headings,
  handlers,
  getCommandItemValue,
}: CommandPaletteResultsProps) {
  return (
    <CommandList
      key={resultsMotionKey}
      label={headings.resultsLabel}
      data-testid="command-palette-results"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={MOTION_CONTENT_SWAP_CLASS_NAME}
    >
      <CommandPaletteActionGroups
        items={{
          recentActions: items.recentActions,
          filteredActions: items.filteredActions,
        }}
        visibility={{
          recentActions: visibility.recentActions,
          actions: visibility.actions,
        }}
        headings={{
          recentActionsHeading: headings.recentActionsHeading,
          actionsHeading: headings.actionsHeading,
        }}
        getCommandItemValue={(kind, id) => getCommandItemValue(kind, id)}
        onActionSelect={handlers.onActionSelect}
      />

      <CommandPaletteResourceGroups
        items={{
          filteredDevScenarios: items.filteredDevScenarios,
          filteredFeeds: items.filteredFeeds,
          filteredTags: items.filteredTags,
          articles: items.articles,
          recentFeeds: items.recentFeeds,
          recentTags: items.recentTags,
          recentArticles: items.recentArticles,
        }}
        displayState={
          visibility.recentActions || visibility.recentResources
            ? {
                mode: "recent",
                groups: {
                  feeds: visibility.feeds,
                  tags: visibility.tags,
                  articles: visibility.articles,
                },
              }
            : {
                mode: "search",
                groups: {
                  devScenarios: visibility.devScenarios,
                  feeds: visibility.feeds,
                  tags: visibility.tags,
                  articles: visibility.articles,
                },
              }
        }
        headings={{
          devScenariosHeading: headings.devScenariosHeading,
          feedsHeading: headings.feedsHeading,
          tagsHeading: headings.tagsHeading,
          articlesHeading: headings.articlesHeading,
        }}
        getCommandItemValue={(kind, id) => getCommandItemValue(kind, id)}
        handlers={{
          onDevScenarioSelect: handlers.onDevScenarioSelect,
          onFeedSelect: handlers.onFeedSelect,
          onTagSelect: handlers.onTagSelect,
          onArticleSelect: handlers.onArticleSelect,
        }}
      />

      {!visibility.hasVisibleResults ? <CommandEmpty>{headings.noResultsLabel}</CommandEmpty> : null}
    </CommandList>
  );
}
