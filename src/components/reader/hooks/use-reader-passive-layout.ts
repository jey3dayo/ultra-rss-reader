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
 *
 * The single `ResizeObserver` instance is created, observed, and disconnected entirely inside
 * one `useEffect` (below) so a static effect-cleanup analysis can trace the pairing. `registerBody`
 * / `registerCard` only mutate the registration maps and bump `registryVersion`, which re-runs
 * that effect; they never call `.observe()`/`.disconnect()` themselves.
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
  const framePendingRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const enabledRef = useRef(enabled);
  const visiblePanesRef = useRef<readonly ReaderPassiveLayoutPaneId[]>(visiblePanes);

  const [cardStates, setCardStates] = useState<
    Partial<Record<ReaderPassiveLayoutPaneId, ReaderPassiveLayoutCardState>>
  >({});
  // Bumped whenever a body/card registers or unregisters, so the observer effect below re-runs
  // and re-attaches to the current registration set (registerBody/registerCard never touch the
  // observer directly).
  const [registryVersion, setRegistryVersion] = useState(0);

  // Keeps enabledRef/visiblePanesRef in sync without writing to a ref during render. Declared
  // before the mount/measurement effect below so it always runs first within the same commit and
  // the other effect never reads a stale value from a previous render.
  useEffect(() => {
    enabledRef.current = enabled;
    visiblePanesRef.current = visiblePanes;
  });

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

  const registerBody = useCallback((paneId: ReaderPassiveLayoutPaneId, element: HTMLElement | null) => {
    const existing = bodiesRef.current.get(paneId);
    if (existing?.element === element) {
      return;
    }
    if (existing) {
      bodiesRef.current.delete(paneId);
    }
    if (element) {
      bodiesRef.current.set(paneId, { element });
    }
    setRegistryVersion((version) => version + 1);
  }, []);

  const registerCard = useCallback(
    (paneId: ReaderPassiveLayoutPaneId, identityKey: string, element: HTMLElement | null) => {
      const existing = cardsRef.current.get(paneId);
      if (existing?.element === element && existing.identityKey === identityKey) {
        return;
      }

      const identityChanged = existing?.identityKey !== identityKey;
      if (existing) {
        cardsRef.current.delete(paneId);
      }
      if (identityChanged) {
        // A new card identity/owner starts the fit evaluation over, from normal.
        modesRef.current.set(paneId, "normal");
      }

      if (element) {
        cardsRef.current.set(paneId, { element, identityKey });
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

      setRegistryVersion((version) => version + 1);
    },
    [],
  );

  const notifyLayoutChange = useCallback(() => {
    scheduleMeasure();
  }, [scheduleMeasure]);

  const visiblePanesKey = visiblePanes.join(",");

  // visiblePanesKey (not read in the body) stands in for visiblePanes: the array's identity is
  // unstable across renders, so re-running on the array itself would re-observe every render.
  // registryVersion (also not read in the body) re-runs this effect whenever registerBody/
  // registerCard add or remove an element, so the single ResizeObserver instance created below
  // stays attached to exactly the currently-registered elements without registerBody/registerCard
  // ever touching the observer directly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visiblePanesKey and registryVersion are the intended deps.
  useEffect(() => {
    generationRef.current += 1;

    if (!enabled) {
      return () => {
        generationRef.current += 1;
      };
    }

    const observer = resizeObserverSupported() ? new ResizeObserver(() => scheduleMeasure()) : null;
    if (observer) {
      for (const entry of bodiesRef.current.values()) {
        observer.observe(entry.element);
      }
      for (const entry of cardsRef.current.values()) {
        observer.observe(entry.element);
      }
    }

    scheduleMeasure();

    const handleResize = () => scheduleMeasure();
    window.addEventListener("resize", handleResize);

    return () => {
      generationRef.current += 1;
      window.removeEventListener("resize", handleResize);
      framePendingRef.current?.();
      framePendingRef.current = null;
      observer?.disconnect();
    };
  }, [enabled, visiblePanesKey, registryVersion, scheduleMeasure]);

  const getCardState = useCallback(
    (paneId: ReaderPassiveLayoutPaneId): ReaderPassiveLayoutCardState =>
      cardStates[paneId] ?? READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE,
    [cardStates],
  );

  return { registerBody, registerCard, cardStates, getCardState, notifyLayoutChange };
}
