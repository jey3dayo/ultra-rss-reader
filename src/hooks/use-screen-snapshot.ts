import { useEffect, useRef, useState } from "react";

export function adoptSnapshotByKey<T extends Record<TKey, string>, TKey extends string>(
  snapshot: T | null,
  key: TKey,
  value: string | null,
) {
  return value !== null && snapshot?.[key] === value ? snapshot : null;
}

export type ScreenSnapshotResult<T> = {
  snapshot: T | null;
  hasResolvedSnapshot: boolean;
  hasAdoptedSnapshot: boolean;
};

/**
 * `candidate === null` means there is no newly adoptable snapshot yet.
 * It represents unresolved input, not a resolved empty state.
 */
export function useScreenSnapshot<T>(candidate: T | null, canAdopt: boolean): ScreenSnapshotResult<T> {
  const [snapshot, setSnapshot] = useState<T | null>(() => (canAdopt ? candidate : null));
  const hasAdoptedSnapshotRef = useRef(snapshot !== null);

  useEffect(() => {
    if (!canAdopt || candidate === null) {
      return;
    }

    setSnapshot(candidate);
    hasAdoptedSnapshotRef.current = true;
  }, [candidate, canAdopt]);

  return {
    snapshot,
    hasResolvedSnapshot: snapshot !== null,
    hasAdoptedSnapshot: hasAdoptedSnapshotRef.current,
  };
}
