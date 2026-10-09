import { parseCommandPaletteHistoryEntry } from "@/lib/command-palette/command-history";
import { projectCommandHistoryForExistingEntries } from "@/lib/command-palette/command-history-storage";

type WithId = { id: string };

type ProjectRecentPaletteEntriesParams<
  A extends WithId,
  F extends WithId,
  Fo extends WithId,
  T extends WithId,
  Ar extends WithId,
> = {
  history: string[];
  resourcesReady: boolean;
  actions: readonly A[];
  feeds: readonly F[];
  folders: readonly Fo[];
  tags: readonly T[];
  articles: readonly Ar[];
};

type RecentPaletteEntries<A, F, Fo, T, Ar> = {
  recentActions: A[];
  recentFeeds: F[];
  recentFolders: Fo[];
  recentTags: T[];
  recentArticles: Ar[];
  historyProjection: { previous: string[]; next: string[] } | null;
};

function createCollector<Item extends WithId>(items: readonly Item[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const picked: Item[] = [];
  return {
    picked,
    collect(id: string) {
      const item = byId.get(id);
      if (item) {
        picked.push(item);
      }
    },
  };
}

function existingHistoryKeys(params: {
  actions: readonly WithId[];
  feeds: readonly WithId[];
  folders: readonly WithId[];
  tags: readonly WithId[];
  articles: readonly WithId[];
}): Set<string> {
  return new Set<string>([
    ...params.actions.map((action) => `action:${action.id}`),
    ...params.feeds.map((feed) => `feed:${feed.id}`),
    ...params.folders.map((folder) => `folder:${folder.id}`),
    ...params.tags.map((tag) => `tag:${tag.id}`),
    ...params.articles.map((article) => `article:${article.id}`),
  ]);
}

export function projectRecentPaletteEntries<
  A extends WithId,
  F extends WithId,
  Fo extends WithId,
  T extends WithId,
  Ar extends WithId,
>(params: ProjectRecentPaletteEntriesParams<A, F, Fo, T, Ar>): RecentPaletteEntries<A, F, Fo, T, Ar> {
  const { history, resourcesReady, actions, feeds, folders, tags, articles } = params;
  const historyEntries = resourcesReady
    ? projectCommandHistoryForExistingEntries(history, existingHistoryKeys(params))
    : history;
  const historyProjection = resourcesReady ? { previous: history, next: historyEntries } : null;

  const actionCollector = createCollector(actions);
  const feedCollector = createCollector(feeds);
  const folderCollector = createCollector(folders);
  const tagCollector = createCollector(tags);
  const articleCollector = createCollector(articles);
  const collectors = {
    action: actionCollector,
    feed: feedCollector,
    folder: folderCollector,
    tag: tagCollector,
    article: articleCollector,
  };
  const projectedEntryKeys = new Set<string>();

  for (const historyEntry of historyEntries) {
    const entry = parseCommandPaletteHistoryEntry(historyEntry);
    if (entry === null) {
      continue;
    }
    const entryKey = `${entry.kind}:${entry.id}`;
    if (projectedEntryKeys.has(entryKey)) {
      continue;
    }
    projectedEntryKeys.add(entryKey);

    if (entry.kind !== "action" && !resourcesReady) {
      continue;
    }
    collectors[entry.kind].collect(entry.id);
  }

  return {
    recentActions: actionCollector.picked,
    recentFeeds: feedCollector.picked,
    recentFolders: folderCollector.picked,
    recentTags: tagCollector.picked,
    recentArticles: articleCollector.picked,
    historyProjection,
  };
}
