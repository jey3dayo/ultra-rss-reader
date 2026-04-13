import { FlaskConicalIcon, HashIcon, NewspaperIcon, RssIcon } from "lucide-react";
import { CommandGroup, CommandItem } from "../ui/command";
import type { CommandPaletteResourceGroupsProps } from "./command-palette.types";

export function CommandPaletteResourceGroups({
  filteredDevScenarios,
  filteredFeeds,
  filteredTags,
  articles,
  showRecentActions,
  showDevScenarios,
  showFeeds,
  showTags,
  showArticles,
  feedsHeading,
  tagsHeading,
  articlesHeading,
  getCommandItemValue,
  onDevScenarioSelect,
  onFeedSelect,
  onTagSelect,
  onArticleSelect,
}: CommandPaletteResourceGroupsProps) {
  return (
    <>
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
    </>
  );
}
