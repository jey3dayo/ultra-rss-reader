export function sortedRegistryValues<T>(items: Iterable<T>, compareFn?: (left: T, right: T) => number): T[] {
  return [...items].sort(compareFn);
}

export function extractSortedUniqueRegistryMatches(source: string, pattern: RegExp): string[] {
  const values = new Set<string>();

  for (const match of source.matchAll(pattern)) {
    const value = match[1];

    if (value !== undefined) {
      values.add(value);
    }
  }

  return sortedRegistryValues(values);
}

export function collectDuplicateRegistryValues(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const value of values) {
    const nextCount = (counts.get(value) ?? 0) + 1;
    counts.set(value, nextCount);

    if (nextCount === 2) {
      duplicates.push(value);
    }
  }

  return duplicates;
}
