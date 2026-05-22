import type { ReaderQuerySelection, ReaderSourceKind } from "@/lib/reader/reader-query";

type SelectableReaderSourceKind = Extract<ReaderSourceKind, "feed" | "folder" | "tag">;

export function resolveReaderSelectionSourceKind(selection: ReaderQuerySelection): SelectableReaderSourceKind | null {
  if (selection.type === "feed" || selection.type === "folder" || selection.type === "tag") {
    return selection.type;
  }

  return null;
}

export function resolveReaderSourceArticles<T>(params: {
  sourceKind: ReaderSourceKind | null;
  feedArticles: T[] | undefined;
  folderArticles: T[] | undefined;
  tagArticles: T[] | undefined;
  fallbackArticles?: T[] | undefined;
}): T[] | undefined {
  const { sourceKind, feedArticles, folderArticles, tagArticles, fallbackArticles } = params;

  return resolveReaderSourceValue({
    sourceKind,
    feedValue: feedArticles,
    folderValue: folderArticles,
    tagValue: tagArticles,
    fallbackValue: fallbackArticles,
  });
}

export function resolveReaderSourceValue<T>(params: {
  sourceKind: ReaderSourceKind | null;
  feedValue: T;
  folderValue: T;
  tagValue: T;
  recentValue?: T;
  fallbackValue: T;
}): T {
  const { sourceKind, feedValue, folderValue, tagValue, recentValue, fallbackValue } = params;

  if (sourceKind === "feed") {
    return feedValue;
  }

  if (sourceKind === "folder") {
    return folderValue;
  }

  if (sourceKind === "tag") {
    return tagValue;
  }

  if (sourceKind === "recent" && recentValue !== undefined) {
    return recentValue;
  }

  return fallbackValue;
}
