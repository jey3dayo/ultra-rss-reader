import { useEffect, useRef, useState } from "react";

/**
 * `candidate === null` means there is no newly adoptable snapshot yet.
 * It represents unresolved input, not a resolved empty state.
 */
export function useScreenSnapshot<T>(candidate: T | null, canAdopt: boolean) {
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
  } as const;
}
