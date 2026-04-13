import { FlaskConicalIcon, HashIcon, type LucideIcon, NewspaperIcon, RssIcon } from "lucide-react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { CommandEmpty, CommandGroup, CommandItem, CommandList, CommandShortcut } from "../ui/command";

export type CommandPaletteActionItem = {
  id: AppAction | "open-shortcuts-help";
  label: string;
  shortcut?: string;
  icon: LucideIcon;
};

type CommandPaletteResultsProps = {
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
      {showRecentActions && recentActions.length > 0 ? (
        <CommandGroup heading={recentActionsHeading}>
          {recentActions.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={`recent-${action.id}`}
                value={getCommandItemValue("action", action.id)}
                onSelect={() => onActionSelect(action.id)}
              >
                <Icon />
                <span>{action.label}</span>
                {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      ) : null}

      {!showRecentActions && showActions && filteredActions.length > 0 ? (
        <CommandGroup heading={actionsHeading}>
          {filteredActions.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.id}
                value={getCommandItemValue("action", action.id)}
                onSelect={() => onActionSelect(action.id)}
              >
                <Icon />
                <span>{action.label}</span>
                {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      ) : null}

      {!showRecentActions && showDevScenarios && filteredDevScenarios.length > 0 ? (
        <CommandGroup heading="Dev Scenarios">
          {filteredDevScenarios.map((scenario) => (
            <CommandItem
              key={scenario.id}
              value={getCommandItemValue("scenario", scenario.id)}
              onSelect={() => onDevScenarioSelect(scenario.id)}
            >
              <FlaskConicalIcon />
              <span>{scenario.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {!showRecentActions && showFeeds && filteredFeeds.length > 0 ? (
        <CommandGroup heading={feedsHeading}>
          {filteredFeeds.map((feed) => (
            <CommandItem
              key={feed.id}
              value={getCommandItemValue("feed", feed.id)}
              onSelect={() => onFeedSelect(feed.id)}
            >
              <RssIcon />
              <span>{feed.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {!showRecentActions && showTags && filteredTags.length > 0 ? (
        <CommandGroup heading={tagsHeading}>
          {filteredTags.map((tag) => (
            <CommandItem key={tag.id} value={getCommandItemValue("tag", tag.id)} onSelect={() => onTagSelect(tag.id)}>
              <HashIcon />
              <span>{tag.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {!showRecentActions && showArticles && articles.length > 0 ? (
        <CommandGroup heading={articlesHeading}>
          {articles.map((article) => (
            <CommandItem
              key={article.id}
              value={getCommandItemValue("article", article.id)}
              onSelect={() => onArticleSelect(article.feed_id, article.id)}
            >
              <NewspaperIcon />
              <span>{article.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {!showRecentActions && !hasVisibleResults ? <CommandEmpty>{noResultsLabel}</CommandEmpty> : null}
    </CommandList>
  );
}
