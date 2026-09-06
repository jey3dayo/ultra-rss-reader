import type { ReactNode } from "react";
import { useMemo } from "react";
import type { LayoutMode } from "@/lib/layout/layout-state.types";
import { type ReaderPassiveLayoutPaneId, useReaderPassiveLayout } from "./hooks/use-reader-passive-layout";
import {
  ReaderPassiveLayoutContext,
  type ReaderPassiveLayoutContextValue,
} from "./hooks/use-reader-passive-layout-context";

/**
 * Feature-local context boundary for the desktop reader passive-card layout anchor. Wired once
 * at the reader layout's common boundary (`app-layout.tsx`) so the list-empty card and the
 * summary card share the same computed anchor without a global store. Disabled outside desktop
 * layoutModes (mobile keeps its existing centered/offset presentation unchanged).
 *
 * Consumer registration hooks (`useReaderPassiveLayoutBodyRef`, `useReaderPassiveLayoutCard`,
 * `useReaderPassiveLayoutNotify`) and the context value type live in
 * `./hooks/use-reader-passive-layout-context` so this file only exports a component.
 */
export function ReaderPassiveLayoutProvider({
  layoutMode,
  visiblePanes,
  children,
}: {
  layoutMode: LayoutMode;
  visiblePanes: readonly ReaderPassiveLayoutPaneId[];
  children: ReactNode;
}) {
  const enabled = layoutMode !== "mobile";
  const { registerBody, registerCard, cardStates, notifyLayoutChange } = useReaderPassiveLayout({
    enabled,
    visiblePanes,
  });

  const value = useMemo<ReaderPassiveLayoutContextValue>(
    () => ({ enabled, cardStates, registerBody, registerCard, notifyLayoutChange }),
    [enabled, cardStates, registerBody, registerCard, notifyLayoutChange],
  );

  return <ReaderPassiveLayoutContext.Provider value={value}>{children}</ReaderPassiveLayoutContext.Provider>;
}
