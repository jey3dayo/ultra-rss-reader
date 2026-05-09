type StorybookIndexEntry = {
  id: string;
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

export function getStorybookIndexEntries(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.entries)) {
    throw new Error(storybookIndexEntriesErrorMessage);
  }

  return payload.entries;
}

function isStorybookIndexEntry(value: unknown): value is StorybookIndexEntry {
  return isRecord(value) && typeof value.id === "string";
}

export function getStorybookIndexStoryIdsFromEntries(entries: Record<string, unknown>): string[] {
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
