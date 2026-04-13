import type { LucideIcon } from "lucide-react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { CommandEmpty, CommandList } from "../ui/command";
import { CommandPaletteActionGroups } from "./command-palette-action-groups";
import { CommandPaletteResourceGroups } from "./command-palette-resource-groups";

export type CommandPaletteActionItem = {
  id: AppAction | "open-shortcuts-help";
  label: string;
  shortcut?: string;
  icon: LucideIcon;
};

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
  getCommandItemValue: (kind: "action" | "feed" | "tag" | "article" | "scenario", id: string) => string;
  onActionSelect: (action: CommandPaletteActionItem["id"]) => void;
  onDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
  onFeedSelect: (feedId: string) => void;
  onTagSelect: (tagId: string) => void;
  onArticleSelect: (feedId: string, articleId: string) => void;
};

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
