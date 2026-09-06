/**
 * Pure geometry for the desktop reader passive-card layout anchor.
 *
 * Contract (tmp/summary-alignment/design-contract.md, section 2): the summary card and the
 * default list-empty card share one optical top anchor derived from the visible list/content
 * body viewports, so neither pane's anchor depends on the other pane's item count or on the
 * card's own content height. When a card does not fit under that anchor, its pane alone falls
 * back to a top-flush position so pane scrolling (not card-internal scrolling) reaches the rest.
 *
 * This module has no DOM or React dependency so it can be unit tested with explicit numbers
 * instead of jsdom layout, and it is the single owner of the tuning constants below -- do not
 * duplicate 0.25 / 24 / 4 / 1 in CSS or components.
 */

/** Ratio of the common viewport height used as the preferred (pre-clamp) optical anchor offset. */
export const READER_PASSIVE_LAYOUT_OPTICAL_ANCHOR_RATIO = 0.25;

/** Safe margin (CSS px) kept above and below a passively anchored card. */
export const READER_PASSIVE_LAYOUT_SAFE_MARGIN_PX = 24;

/** Hysteresis (CSS px) required before a fallback pane is allowed to return to normal anchoring. */
export const READER_PASSIVE_LAYOUT_FALLBACK_RECOVERY_HYSTERESIS_PX = 4;

/** Tolerance (CSS px) for "top edges match" evaluation between panes in normal mode. */
export const READER_PASSIVE_LAYOUT_NORMAL_TOP_TOLERANCE_PX = 1;

export type ReaderPassiveLayoutViewportBounds = {
  /** Viewport-relative top edge (CSS px), e.g. from `getBoundingClientRect().top`. */
  top: number;
  /** Viewport-relative bottom edge (CSS px), e.g. from `getBoundingClientRect().bottom`. */
  bottom: number;
};

export type ReaderPassiveLayoutMode = "normal" | "fallback";

function isValidBounds(bounds: ReaderPassiveLayoutViewportBounds): boolean {
  return Number.isFinite(bounds.top) && Number.isFinite(bounds.bottom) && bounds.bottom > bounds.top;
}

/**
 * Intersects the currently visible body viewports into one common region: T = max(top),
 * B = min(bottom). Hidden/unmounted panes must already be excluded by the caller; a single
 * remaining body simply becomes the common region. Returns null when no valid body remains
 * (unmeasured, non-finite, or zero/negative height), which callers must treat as fallback.
 */
export function computeReaderPassiveLayoutCommonBounds(
  bodies: readonly ReaderPassiveLayoutViewportBounds[],
): ReaderPassiveLayoutViewportBounds | null {
  const valid = bodies.filter(isValidBounds);
  if (valid.length === 0) {
    return null;
  }

  const top = Math.max(...valid.map((bounds) => bounds.top));
  const bottom = Math.min(...valid.map((bounds) => bounds.bottom));
  if (!(bottom > top)) {
    return null;
  }

  return { top, bottom };
}

/**
 * Normal-mode optical anchor Y, independent of any card's own height:
 * Y = T + clamp(S, 0.25*H, H-S). Returns null when the common region is missing or shorter
 * than 2*S, which callers must treat as fallback for every registered card.
 */
export function computeReaderPassiveLayoutNormalAnchorY(
  common: ReaderPassiveLayoutViewportBounds | null,
  safeMarginPx: number = READER_PASSIVE_LAYOUT_SAFE_MARGIN_PX,
): number | null {
  if (!common) {
    return null;
  }

  const height = common.bottom - common.top;
  if (!Number.isFinite(height) || height < safeMarginPx * 2) {
    return null;
  }

  const preferred = height * READER_PASSIVE_LAYOUT_OPTICAL_ANCHOR_RATIO;
  const offset = Math.min(Math.max(preferred, safeMarginPx), height - safeMarginPx);
  return common.top + offset;
}

/**
 * F = P - S - (Y + C): remaining slack below a card placed at the normal anchor, in its own
 * pane. Negative F means the card would run past the pane's bottom safe margin.
 */
export function computeReaderPassiveLayoutFitDelta(params: {
  normalAnchorY: number;
  cardHeight: number;
  bodyBottom: number;
  safeMarginPx?: number;
}): number {
  const { normalAnchorY, cardHeight, bodyBottom, safeMarginPx = READER_PASSIVE_LAYOUT_SAFE_MARGIN_PX } = params;
  return bodyBottom - safeMarginPx - (normalAnchorY + cardHeight);
}

/**
 * Fit/fallback mode transition with hysteresis. Pass `fitDelta: null` whenever the pane cannot
 * be measured this pass (missing/invalid geometry, unsupported ResizeObserver, no common
 * region) -- that always resolves to fallback regardless of the current mode.
 */
export function resolveReaderPassiveLayoutMode(params: {
  currentMode: ReaderPassiveLayoutMode;
  fitDelta: number | null;
  recoveryHysteresisPx?: number;
}): ReaderPassiveLayoutMode {
  const {
    currentMode,
    fitDelta,
    recoveryHysteresisPx = READER_PASSIVE_LAYOUT_FALLBACK_RECOVERY_HYSTERESIS_PX,
  } = params;

  if (fitDelta === null) {
    return "fallback";
  }

  if (currentMode === "normal") {
    return fitDelta < 0 ? "fallback" : "normal";
  }

  return fitDelta >= recoveryHysteresisPx ? "normal" : "fallback";
}

/**
 * Scroll-content top offset (CSS px) for a card in the given mode, relative to its own pane's
 * body top. Normal mode reuses the shared anchor (Y - bodyTop); fallback anchors the pane at
 * its own top safe margin, collapsing to 0 when the measured body is shorter than that margin.
 */
export function computeReaderPassiveLayoutCardOffset(params: {
  mode: ReaderPassiveLayoutMode;
  normalAnchorY: number | null;
  bodyTop: number;
  bodyHeight: number;
  safeMarginPx?: number;
}): number {
  const { mode, normalAnchorY, bodyTop, bodyHeight, safeMarginPx = READER_PASSIVE_LAYOUT_SAFE_MARGIN_PX } = params;

  if (mode === "normal" && normalAnchorY !== null) {
    return normalAnchorY - bodyTop;
  }

  return bodyHeight < safeMarginPx ? 0 : safeMarginPx;
}
