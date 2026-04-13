import { FlaskConicalIcon, HashIcon, NewspaperIcon, RssIcon } from "lucide-react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { CommandGroup, CommandItem } from "../ui/command";

type CommandPaletteResourceGroupsProps = {
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: FeedDto[];
  filteredTags: TagDto[];
  articles: ArticleDto[];
  showRecentActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showTags: boolean;
  showArticles: boolean;
  feedsHeading: string;
  tagsHeading: string;
  articlesHeading: string;
  getCommandItemValue: (kind: "feed" | "tag" | "article" | "scenario", id: string) => string;
  onDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
  onFeedSelect: (feedId: string) => void;
  onTagSelect: (tagId: string) => void;
  onArticleSelect: (feedId: string, articleId: string) => void;
};

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
