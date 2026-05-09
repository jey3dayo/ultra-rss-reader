type StorybookIndexEntry = {
  id: string;
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

const storybookIndexEntriesErrorMessage = "Storybook index payload must be an object with an object entries field";
const storybookIndexEntryIdErrorMessage = "Storybook index entries must contain story objects with string id fields";

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
  return isRecord(value) && typeof value.id === "string";
}

function getStorybookIndexStoryIdsFromEntries(entries: Record<string, unknown>): string[] {
  return Object.values(entries).flatMap((entry) => {
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
  const url = new URL(iframeUrl, "http://storybook.local");
  const storyId = url.searchParams.get("id");

  if (storyId === null || storyId.length === 0) {
    throw new Error("Storybook iframe URL must include a non-empty id query parameter");
  }

  return storyId;
}
