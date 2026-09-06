import { useCallback, useEffect, useRef, useState } from "react";
import { scheduleAnimationFrameWithTimeoutFallback } from "@/lib/dom/animation-frame";
import {
  computeReaderPassiveLayoutCardOffset,
  computeReaderPassiveLayoutCommonBounds,
  computeReaderPassiveLayoutFitDelta,
  computeReaderPassiveLayoutNormalAnchorY,
  type ReaderPassiveLayoutMode,
  type ReaderPassiveLayoutViewportBounds,
  resolveReaderPassiveLayoutMode,
} from "../lib/reader-passive-layout";

/** The two panes that can host a passively anchored body/card in the desktop reader layout. */
export type ReaderPassiveLayoutPaneId = "list" | "content";

export type ReaderPassiveLayoutCardState = {
  mode: ReaderPassiveLayoutMode;
  offsetPx: number;
};

export const READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE: ReaderPassiveLayoutCardState = {
  mode: "fallback",
  offsetPx: 0,
};

type BodyEntry = { element: HTMLElement };
type CardEntry = { element: HTMLElement; identityKey: string };

function readViewportBounds(element: HTMLElement): ReaderPassiveLayoutViewportBounds {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom };
}

function isValidViewportBounds(bounds: ReaderPassiveLayoutViewportBounds): boolean {
  return Number.isFinite(bounds.top) && Number.isFinite(bounds.bottom) && bounds.bottom > bounds.top;
}

function resizeObserverSupported(): boolean {
  return typeof ResizeObserver !== "undefined";
}

/**
 * Owns DOM measurement, ResizeObserver/resize-listener wiring, rAF batching, and the
 * normal/fallback fit lifecycle for the desktop reader passive layout. Feature-local: closes
 * over reader-specific pane ids and DOM lifecycles, per boundary-ownership's feature-local
 * controller pattern. Consumed by `ReaderPassiveLayoutProvider` in `reader-passive-layout.tsx`.
 */
export function useReaderPassiveLayout({
  enabled,
  visiblePanes,
}: {
  enabled: boolean;
  visiblePanes: readonly ReaderPassiveLayoutPaneId[];
}) {
  const bodiesRef = useRef(new Map<ReaderPassiveLayoutPaneId, BodyEntry>());
  const cardsRef = useRef(new Map<ReaderPassiveLayoutPaneId, CardEntry>());
  const modesRef = useRef(new Map<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutMode>());
  const observedElementsRef = useRef(new Map<HTMLElement, ResizeObserver>());
  const framePendingRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const visiblePanesRef = useRef<readonly ReaderPassiveLayoutPaneId[]>(visiblePanes);
  visiblePanesRef.current = visiblePanes;

  const [cardStates, setCardStates] = useState<
    Partial<Record<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutCardState>>
  >({});

  const measureNow = useCallback((ownerGeneration: number) => {
    if (ownerGeneration !== generationRef.current) {
      return; // Stale owner: unmounted or StrictMode re-setup happened before this frame ran.
    }

    const visible = new Set(visiblePanesRef.current);
    const bodyBoundsByPane = new Map<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutViewportBounds>();
    const commonInputs: ReaderPassiveLayoutViewportBounds[] = [];

    for (const [paneId, entry] of bodiesRef.current) {
      if (!visible.has(paneId)) {
        continue;
      }
      const bounds = readViewportBounds(entry.element);
      bodyBoundsByPane.set(paneId, bounds);
      commonInputs.push(bounds);
    }

    const commonBounds = computeReaderPassiveLayoutCommonBounds(commonInputs);
    const normalAnchorY = computeReaderPassiveLayoutNormalAnchorY(commonBounds);
    const canEvaluateFit = normalAnchorY !== null && resizeObserverSupported();

    const nextStates: Partial<Record<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutCardState>> = {};

    for (const [paneId, cardEntry] of cardsRef.current) {
      if (!visible.has(paneId)) {
        continue;
      }

      const bodyBounds = bodyBoundsByPane.get(paneId);
      const currentMode = modesRef.current.get(paneId) ?? "normal";

      if (!bodyBounds || !isValidViewportBounds(bodyBounds) || !canEvaluateFit || normalAnchorY === null) {
        modesRef.current.set(paneId, "fallback");
        nextStates[paneId] = READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE;
        continue;
      }

      const cardHeight = cardEntry.element.getBoundingClientRect().height;
      const fitDelta = computeReaderPassiveLayoutFitDelta({
        normalAnchorY,
        cardHeight,
        bodyBottom: bodyBounds.bottom,
      });
      const nextMode = resolveReaderPassiveLayoutMode({ currentMode, fitDelta });
      modesRef.current.set(paneId, nextMode);

      const offsetPx = computeReaderPassiveLayoutCardOffset({
        mode: nextMode,
        normalAnchorY,
        bodyTop: bodyBounds.top,
        bodyHeight: bodyBounds.bottom - bodyBounds.top,
      });

      nextStates[paneId] = { mode: nextMode, offsetPx };
    }

    setCardStates((previous) => {
      const paneIds = new Set<ReaderPassiveLayoutPaneId>([
        ...(Object.keys(previous) as ReaderPassiveLayoutPaneId[]),
        ...(Object.keys(nextStates) as ReaderPassiveLayoutPaneId[]),
      ]);
      let changed = false;
      for (const paneId of paneIds) {
        const before = previous[paneId];
        const after = nextStates[paneId];
        if (before?.mode !== after?.mode || before?.offsetPx !== after?.offsetPx) {
          changed = true;
          break;
        }
      }
      return changed ? nextStates : previous;
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (!enabledRef.current || framePendingRef.current !== null) {
      return;
    }

    const ownerGeneration = generationRef.current;
    framePendingRef.current = scheduleAnimationFrameWithTimeoutFallback(() => {
      framePendingRef.current = null;
      measureNow(ownerGeneration);
    });
  }, [measureNow]);

  const observeElement = useCallback(
    (element: HTMLElement) => {
      if (!enabledRef.current || !resizeObserverSupported() || observedElementsRef.current.has(element)) {
        return;
      }
      const observer = new ResizeObserver(() => scheduleMeasure());
      observer.observe(element);
      observedElementsRef.current.set(element, observer);
    },
    [scheduleMeasure],
  );

  const unobserveElement = useCallback((element: HTMLElement) => {
    const observer = observedElementsRef.current.get(element);
    if (observer) {
      observer.disconnect();
      observedElementsRef.current.delete(element);
    }
  }, []);

  const registerBody = useCallback(
    (paneId: ReaderPassiveLayoutPaneId, element: HTMLElement | null) => {
      const existing = bodiesRef.current.get(paneId);
      if (existing) {
        unobserveElement(existing.element);
        bodiesRef.current.delete(paneId);
      }
      if (element) {
        bodiesRef.current.set(paneId, { element });
        observeElement(element);
      }
      scheduleMeasure();
    },
    [observeElement, unobserveElement, scheduleMeasure],
  );

  const registerCard = useCallback(
    (paneId: ReaderPassiveLayoutPaneId, identityKey: string, element: HTMLElement | null) => {
      const existing = cardsRef.current.get(paneId);
      const identityChanged = existing?.identityKey !== identityKey;
      if (existing) {
        unobserveElement(existing.element);
        cardsRef.current.delete(paneId);
      }
      if (identityChanged) {
        // A new card identity/owner starts the fit evaluation over, from normal.
        modesRef.current.set(paneId, "normal");
      }

      if (element) {
        cardsRef.current.set(paneId, { element, identityKey });
        observeElement(element);
      } else {
        modesRef.current.delete(paneId);
        setCardStates((previous) => {
          if (!(paneId in previous)) {
            return previous;
          }
          const next = { ...previous };
          delete next[paneId];
          return next;
        });
      }

      scheduleMeasure();
    },
    [observeElement, unobserveElement, scheduleMeasure],
  );

  const notifyLayoutChange = useCallback(() => {
    scheduleMeasure();
  }, [scheduleMeasure]);

  const visiblePanesKey = visiblePanes.join(",");

  // visiblePanesKey (not read in the body) stands in for visiblePanes: the array's identity is
  // unstable across renders, so re-running on the array itself would re-observe every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visiblePanesKey is the intended dep.
  useEffect(() => {
    generationRef.current += 1;

    if (!enabled) {
      return () => {
        generationRef.current += 1;
      };
    }

    // Re-attach observers for elements registered before this effect (re)ran, e.g. a StrictMode
    // setup->cleanup->setup cycle or a desktop layoutMode toggle that keeps the same DOM.
    for (const entry of bodiesRef.current.values()) {
      observeElement(entry.element);
    }
    for (const entry of cardsRef.current.values()) {
      observeElement(entry.element);
    }

    scheduleMeasure();

    const handleResize = () => scheduleMeasure();
    window.addEventListener("resize", handleResize);

    return () => {
      generationRef.current += 1;
      window.removeEventListener("resize", handleResize);
      framePendingRef.current?.();
      framePendingRef.current = null;
      for (const observer of observedElementsRef.current.values()) {
        observer.disconnect();
      }
      observedElementsRef.current.clear();
    };
  }, [enabled, visiblePanesKey, observeElement, scheduleMeasure]);

  const getCardState = useCallback(
    (paneId: ReaderPassiveLayoutPaneId): ReaderPassiveLayoutCardState =>
      cardStates[paneId] ?? READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE,
    [cardStates],
  );

  return { registerBody, registerCard, cardStates, getCardState, notifyLayoutChange };
}
