import { createContext, type ReactNode, type Ref, useCallback, useContext, useMemo } from "react";
import type { LayoutMode } from "@/lib/layout/layout-state.types";
import {
  READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE,
  type ReaderPassiveLayoutCardState,
  type ReaderPassiveLayoutPaneId,
  useReaderPassiveLayout,
} from "./hooks/use-reader-passive-layout";

export type { ReaderPassiveLayoutPaneId } from "./hooks/use-reader-passive-layout";

type ReaderPassiveLayoutContextValue = {
  enabled: boolean;
  cardStates: Partial<Record<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutCardState>>;
  registerBody: (paneId: ReaderPassiveLayoutPaneId, element: HTMLElement | null) => void;
  registerCard: (paneId: ReaderPassiveLayoutPaneId, identityKey: string, element: HTMLElement | null) => void;
  notifyLayoutChange: () => void;
};

const ReaderPassiveLayoutContext = createContext<ReaderPassiveLayoutContextValue | null>(null);

/**
 * Feature-local context boundary for the desktop reader passive-card layout anchor. Wired once
 * at the reader layout's common boundary (`app-layout.tsx`) so the list-empty card and the
 * summary card share the same computed anchor without a global store. Disabled outside desktop
 * layoutModes (mobile keeps its existing centered/offset presentation unchanged).
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

function useOptionalReaderPassiveLayoutContext(): ReaderPassiveLayoutContextValue | null {
  return useContext(ReaderPassiveLayoutContext);
}

/**
 * Registers a pane's visible body viewport (the region below its chrome) for the shared common
 * region calculation. Safe to use outside a provider or while disabled -- resolves to a no-op
 * ref callback so non-desktop callers do not need to branch.
 */
export function useReaderPassiveLayoutBodyRef(paneId: ReaderPassiveLayoutPaneId) {
  const context = useOptionalReaderPassiveLayoutContext();
  return useCallback(
    (element: HTMLElement | null) => {
      if (context?.enabled) {
        context.registerBody(paneId, element);
      }
    },
    [context, paneId],
  );
}

/**
 * Registers a pane's passive card under the given content identity and returns its computed
 * mode/offset. Outside a provider, while disabled, or before the first measurement, resolves to
 * a safe top-anchored fallback state instead of hiding the card.
 */
export function useReaderPassiveLayoutCard(
  paneId: ReaderPassiveLayoutPaneId,
  identityKey: string,
): { cardRef: (element: HTMLElement | null) => void; enabled: boolean } & ReaderPassiveLayoutCardState {
  const context = useOptionalReaderPassiveLayoutContext();
  const cardRef = useCallback(
    (element: HTMLElement | null) => {
      if (context?.enabled) {
        context.registerCard(paneId, identityKey, element);
      }
    },
    [context, paneId, identityKey],
  );

  const enabled = context?.enabled ?? false;
  const state = enabled ? (context?.cardStates[paneId] ?? READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE) : undefined;

  return {
    cardRef,
    enabled,
    mode: state?.mode ?? READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE.mode,
    offsetPx: state?.offsetPx ?? READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE.offsetPx,
  };
}

/**
 * Notifies the shared layout that a known, non-observer-visible chrome change happened (search
 * band opening/closing, footer mounting/unmounting) so it re-measures on the next frame instead
 * of relying solely on ResizeObserver.
 */
export function useReaderPassiveLayoutNotify(): () => void {
  const context = useOptionalReaderPassiveLayoutContext();
  return context?.notifyLayoutChange ?? (() => {});
}

/**
 * Combines an existing `Ref` (used by unrelated scroll-restoration/focus code) with a passive
 * layout registration callback so both keep receiving the same DOM node.
 */
export function mergeReaderPassiveLayoutRefs<T>(
  existingRef: Ref<T> | undefined,
  registerRef: (element: T | null) => void,
): (element: T | null) => void {
  return (element: T | null) => {
    registerRef(element);
    if (!existingRef) {
      return;
    }
    if (typeof existingRef === "function") {
      existingRef(element);
      return;
    }
    (existingRef as { current: T | null }).current = element;
  };
}
