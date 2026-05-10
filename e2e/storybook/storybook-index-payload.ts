type StorybookIndexEntry = {
  id: string;
  type: "story";
};

type DuplicateStorybookIndexStoryIdDiagnostic = {
  id: string;
  count: number;
};

export const uiReferenceCanvasStoryIds = [
  "ui-reference-foundations-canvas--default",
  "ui-reference-input-controls-canvas--default",
  "ui-reference-button-controls-canvas--default",
  "ui-reference-shell-overlay-canvas--default",
  "ui-reference-settings-workspace-canvas--default",
  "ui-reference-navigation-collections-canvas--default",
  "ui-reference-view-specimens-canvas--default",
] as const;

export const denseNarrowViewportId = "mobile2";
export const denseNarrowViewportStoryIds = [
  "reader-sidebar-sidebarheaderview--dense-narrow-viewport",
  "reader-article-articlelistscreenview--dense-narrow-viewport",
  "reader-article-articletoolbarview--mobile-japanese-long-labels",
  "reader-article-articletoolbarview--mobile-a-11-y-disabled-state",
  "settings-page-settingsmodalview--dense-narrow-viewport",
  "settings-page-accountdetailview--japanese-long-labels-dense",
  "settings-page-accountdetailview--dense-a-11-y-disabled-state",
] as const;
export const storybookViewportMaxDimensionPx = 10_000;
export const storybookSmokeStoryIds = [...uiReferenceCanvasStoryIds, ...denseNarrowViewportStoryIds] as const;

const storybookIndexEntriesErrorMessage = "Storybook index payload must be an object with an object entries field";
const storybookIndexEntryIdErrorMessage = 'Storybook index entries with type "story" must contain string id fields';
const storybookIframeStoryIdErrorMessage = "Storybook iframe URL must include a non-empty id query parameter";
const storybookIframeStoryIdCountErrorMessage = "Storybook iframe URL must include exactly one id query parameter";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStorybookIndexEntries(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.entries)) {
    throw new Error(storybookIndexEntriesErrorMessage);
  }

  return payload.entries;
}

function isStorybookIndexEntry(value: unknown): value is StorybookIndexEntry {
  return isRecord(value) && value.type === "story" && typeof value.id === "string";
}

function isStorybookIndexStoryEntryCandidate(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value.type === "story";
}

function getStorybookIndexStoryIdsFromEntries(entries: Record<string, unknown>): string[] {
  return Object.values(entries).flatMap((entry) => {
    if (!isStorybookIndexStoryEntryCandidate(entry)) {
      return [];
    }

    if (!isStorybookIndexEntry(entry)) {
      throw new Error(storybookIndexEntryIdErrorMessage);
    }

    return [entry.id];
  });
}

export function getStorybookIndexStoryIds(payload: unknown): string[] {
  return getStorybookIndexStoryIdsFromEntries(getStorybookIndexEntries(payload));
}

export function sortedStorybookStoryIds(storyIds: Iterable<string>): string[] {
  return [...storyIds].sort((left, right) => left.localeCompare(right));
}

export function createStorybookStoryIdIndex(storyIds: Iterable<string>): Set<string> {
  return new Set(sortedStorybookStoryIds(storyIds));
}

export function getDuplicateStorybookStoryIdDiagnostics(
  storyIds: Iterable<string>,
): DuplicateStorybookIndexStoryIdDiagnostic[] {
  const storyIdCounts = new Map<string, number>();

  for (const storyId of storyIds) {
    storyIdCounts.set(storyId, (storyIdCounts.get(storyId) ?? 0) + 1);
  }

  return sortedStorybookStoryIds(storyIdCounts.keys()).flatMap((id) => {
    const count = storyIdCounts.get(id) ?? 0;
    return count > 1 ? [{ id, count }] : [];
  });
}

export function getStorybookIframeUrl(storyId: string): string {
  const url = new URL("/iframe.html", "http://storybook.local");
  url.searchParams.set("id", storyId);

  return `${url.pathname}${url.search}`;
}

export function getStorybookIframeStoryId(iframeUrl: string): string {
  let url: URL;

  try {
    url = new URL(iframeUrl, "http://storybook.local");
  } catch {
    throw new Error(storybookIframeStoryIdErrorMessage);
  }

  const storyIds = url.searchParams.getAll("id");

  if (storyIds.length > 1) {
    throw new Error(storybookIframeStoryIdCountErrorMessage);
  }

  const storyId = storyIds[0];

  if (storyId === undefined || storyId.length === 0) {
    throw new Error(storybookIframeStoryIdErrorMessage);
  }

  return storyId;
}
