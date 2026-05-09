type StorybookIndexEntry = {
  id: string;
};

const storybookIndexEntriesErrorMessage = "Storybook index payload entries must be an object";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertStorybookIndexEntries(payload: unknown): asserts payload is {
  entries: Record<string, unknown>;
} {
  if (!isRecord(payload) || !isRecord(payload.entries)) {
    throw new Error(storybookIndexEntriesErrorMessage);
  }
}

function isStorybookIndexEntry(value: unknown): value is StorybookIndexEntry {
  return isRecord(value) && typeof value.id === "string";
}

export function getStorybookIndexStoryIds(payload: unknown) {
  assertStorybookIndexEntries(payload);

  return Object.values(payload.entries).flatMap((entry) => {
    if (!isStorybookIndexEntry(entry)) {
      return [];
    }

    return [entry.id];
  });
}
