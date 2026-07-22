import { FlaskConicalIcon, FolderIcon, HashIcon, NewspaperIcon, RssIcon } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import type { CommandPaletteResultsProps } from "./command-palette.types";

type CommandPaletteResourceGroupsProps = Pick<CommandPaletteResultsProps, "getCommandItemValue"> & {
  items: Pick<
    CommandPaletteResultsProps["items"],
    | "filteredDevScenarios"
    | "filteredFeeds"
    | "filteredFolders"
    | "filteredTags"
    | "articles"
    | "recentFeeds"
    | "recentFolders"
    | "recentTags"
    | "recentArticles"
  >;
  displayState: CommandPaletteResourceGroupsDisplayState;
  headings: Pick<
    CommandPaletteResultsProps["headings"],
    "devScenariosHeading" | "feedsHeading" | "foldersHeading" | "tagsHeading" | "articlesHeading"
  >;
  handlers: Pick<
    CommandPaletteResultsProps["handlers"],
    "onDevScenarioSelect" | "onFeedSelect" | "onFolderSelect" | "onTagSelect" | "onArticleSelect"
  >;
};

type CommandPaletteResourceGroupVisibility = Pick<
  CommandPaletteResultsProps["visibility"],
  "feeds" | "folders" | "tags" | "articles"
>;

type CommandPaletteResourceGroupsDisplayState =
  | {
      mode: "recent";
      groups: CommandPaletteResourceGroupVisibility;
    }
  | {
      mode: "search";
      groups: CommandPaletteResourceGroupVisibility & Pick<CommandPaletteResultsProps["visibility"], "devScenarios">;
    };

export function CommandPaletteResourceGroups({
  items,
  displayState,
  headings,
  getCommandItemValue,
  handlers,
}: CommandPaletteResourceGroupsProps) {
  const displayRecentResources = displayState.mode === "recent";
  const visibleFeeds = displayRecentResources ? items.recentFeeds : items.filteredFeeds;
  const visibleFolders = displayRecentResources ? items.recentFolders : items.filteredFolders;
  const visibleTags = displayRecentResources ? items.recentTags : items.filteredTags;
  const visibleArticles = displayRecentResources ? items.recentArticles : items.articles;
  const feedTitleById = new Map(items.filteredFeeds.map((feed) => [feed.id, feed.title]));

  function getArticleResourceDetail(article: CommandPaletteResultsProps["items"]["articles"][number]) {
    const feedTitle = feedTitleById.get(article.feed_id);
    return feedTitle ? `${feedTitle} - ${article.url}` : article.url;
  }

  return (
    <>
      {displayState.mode === "search" && displayState.groups.devScenarios && items.filteredDevScenarios.length > 0 ? (
        <CommandGroup heading={headings.devScenariosHeading}>
          {items.filteredDevScenarios.map((scenario) => (
            <CommandItem
              key={scenario.id}
              value={getCommandItemValue("scenario", scenario.id)}
              onSelect={() => handlers.onDevScenarioSelect(scenario.id)}
            >
              <FlaskConicalIcon />
              <span className="min-w-0 truncate">{scenario.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {displayState.groups.folders && visibleFolders.length > 0 ? (
        <CommandGroup heading={headings.foldersHeading}>
          {visibleFolders.map((folder) => (
            <CommandItem
              key={folder.id}
              value={getCommandItemValue("folder", folder.id)}
              onSelect={() => handlers.onFolderSelect(folder.id)}
            >
              <FolderIcon />
              <span className="min-w-0 truncate">{folder.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {displayState.groups.feeds && visibleFeeds.length > 0 ? (
        <CommandGroup heading={headings.feedsHeading}>
          {visibleFeeds.map((feed) => (
            <CommandItem
              key={feed.id}
              value={getCommandItemValue("feed", feed.id)}
              onSelect={() => handlers.onFeedSelect(feed.id)}
            >
              <RssIcon />
              <span className="min-w-0 truncate">{feed.title}</span>
              <span className="ml-auto truncate pl-3 text-xs text-foreground-soft">
                {feed.site_url.trim() || feed.url}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {displayState.groups.tags && visibleTags.length > 0 ? (
        <CommandGroup heading={headings.tagsHeading}>
          {visibleTags.map((tag) => (
            <CommandItem
              key={tag.id}
              value={getCommandItemValue("tag", tag.id)}
              onSelect={() => handlers.onTagSelect(tag.id)}
            >
              <HashIcon />
              <span className="min-w-0 truncate">{tag.name}</span>
              {tag.color ? <span className="ml-auto text-xs text-foreground-soft">{tag.color}</span> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {displayState.groups.articles && visibleArticles.length > 0 ? (
        <CommandGroup heading={headings.articlesHeading}>
          {visibleArticles.map((article) => (
            <CommandItem
              key={article.id}
              value={getCommandItemValue("article", article.id)}
              onSelect={() => handlers.onArticleSelect(article.feed_id, article.id)}
            >
              <NewspaperIcon />
              <span className="min-w-0 truncate">{article.title}</span>
              <span className="ml-auto truncate pl-3 text-xs text-foreground-soft">
                {getArticleResourceDetail(article)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </>
  );
}
