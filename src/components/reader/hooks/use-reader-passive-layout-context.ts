import { createContext, type Ref, useCallback, useContext } from "react";
import {
  READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE,
  type ReaderPassiveLayoutCardState,
  type ReaderPassiveLayoutPaneId,
} from "./use-reader-passive-layout";

/**
 * Consumer-facing context and registration hooks for the desktop reader passive-card layout
 * anchor. Split out from `reader-passive-layout.tsx` so that file only exports the
 * `ReaderPassiveLayoutProvider` component (react-doctor/only-export-components).
 */
export type ReaderPassiveLayoutContextValue = {
  enabled: boolean;
  cardStates: Partial<Record<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutCardState>>;
  registerBody: (paneId: ReaderPassiveLayoutPaneId, element: HTMLElement | null) => void;
  registerCard: (paneId: ReaderPassiveLayoutPaneId, identityKey: string, element: HTMLElement | null) => void;
  notifyLayoutChange: () => void;
};

export const ReaderPassiveLayoutContext = createContext<ReaderPassiveLayoutContextValue | null>(null);

function useOptionalReaderPassiveLayoutContext(): ReaderPassiveLayoutContextValue | null {
  return useContext(ReaderPassiveLayoutContext);
}

/**
 * Registers a pane's visible body viewport (the region below its chrome) for the shared common
 * region calculation. Safe to use outside a provider or while disabled -- resolves to a no-op
 * ref callback so non-desktop callers do not need to branch.
 *
 * Depends on `enabled` and `registerBody` individually (not the whole context object): the
 * context value is a new object every time `cardStates` updates (i.e. after every measurement),
 * while `registerBody` itself stays referentially stable. Depending on the whole context would
 * give this ref callback a new identity on every measurement, which makes React detach and
 * re-attach the DOM ref (unregister then re-register) forever -- the registration never settles
 * and no measurement's result ever reaches the DOM.
 */
export function useReaderPassiveLayoutBodyRef(paneId: ReaderPassiveLayoutPaneId) {
  const context = useOptionalReaderPassiveLayoutContext();
  const enabled = context?.enabled ?? false;
  const registerBody = context?.registerBody;
  return useCallback(
    (element: HTMLElement | null) => {
      if (enabled && registerBody) {
        registerBody(paneId, element);
      }
    },
    [enabled, registerBody, paneId],
  );
}

/**
 * Registers a pane's passive card under the given content identity and returns its computed
 * mode/offset. Outside a provider, while disabled, or before the first measurement, resolves to
 * a safe top-anchored fallback state instead of hiding the card.
 *
 * See `useReaderPassiveLayoutBodyRef` above for why `cardRef` depends on `enabled`/`registerCard`
 * individually rather than the whole context object.
 */
export function useReaderPassiveLayoutCard(
  paneId: ReaderPassiveLayoutPaneId,
  identityKey: string,
): { cardRef: (element: HTMLElement | null) => void; enabled: boolean } & ReaderPassiveLayoutCardState {
  const context = useOptionalReaderPassiveLayoutContext();
  const enabled = context?.enabled ?? false;
  const registerCard = context?.registerCard;
  const cardRef = useCallback(
    (element: HTMLElement | null) => {
      if (enabled && registerCard) {
        registerCard(paneId, identityKey, element);
      }
    },
    [enabled, registerCard, paneId, identityKey],
  );

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
    if (typeof existingRef === "function") {
      existingRef(element);
      return;
    }
    // A non-function Ref from `useRef`/`createRef` is always a mutable object with a writable
    // `current` property; RefObject's type only marks `current` readonly for the consumer side.
    if (existingRef) {
      existingRef.current = element;
    }
  };
}
